const wrikeService = require('../services/wrike.service');
const Employee = require('../models/Employee');
const TimeEntry = require('../models/TimeEntry');
const db = require('../database/connection');

function toDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).substring(0, 10);
}

/**
 * Returns Monday of the week containing `date`
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

/**
 * Returns Sunday of the week containing `date`
 */
function getWeekEnd(date) {
  const d = new Date(getWeekStart(date));
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

/**
 * Generate array of 7 date strings Mon–Sun for a given week start
 */
function weekDays(weekStart) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

/**
 * Sync Wrike timelogs for a date range into the time_entries table.
 *
 * Batched and idempotent:
 *  - existing entries are fetched once (single query) instead of one SELECT per log
 *  - new entries are written with a single chunked bulk INSERT
 *  - entries whose hours or category CHANGED in Wrike are updated, so a re-sync
 *    corrects previously wrong imports instead of silently skipping them
 *  - AUTHORITATIVE: Wrike-sourced entries in range whose log is no longer in the
 *    fetch (deleted or, under approvedOnly, no longer approved) are deleted, so a
 *    re-sync self-heals stale rows. Manual (non-Wrike) entries are never touched.
 *    Deletion is scoped to employees whose Wrike fetch succeeded, so a partial API
 *    failure can never wipe good data.
 *
 * @returns {{imported:number, updated:number, deleted:number, skipped:number, startDate:string, endDate:string}}
 */
async function syncTimelogsToEntries({ startDate, endDate, approvedOnly }) {
  const allEmployees    = await Employee.findAll(false);
  const linkedEmployees = allEmployees.filter(e => e.wrike_user_id);
  const wrikeIds        = linkedEmployees.map(e => e.wrike_user_id);

  const { logs: fetchedLogs, okContactIds } =
    await wrikeService.getTimeLogs(startDate, endDate, wrikeIds, { withMeta: true });

  let timelogs = fetchedLogs;
  if (approvedOnly) {
    timelogs = timelogs.filter(l => l.approvalStatus?.toLowerCase() === 'approved');
  }

  const allTaskIds = timelogs.map(l => l.taskId).filter(Boolean);
  const [taskTitles, categoryMap] = await Promise.all([
    wrikeService.getTaskTitles(allTaskIds),
    wrikeService.getTimelogCategories()
  ]);

  const byUser = wrikeService.groupTimeLogsByUser(timelogs);

  const empByWrikeId = {};
  for (const e of linkedEmployees) empByWrikeId[e.wrike_user_id] = e;

  // One query for all existing Wrike entries in range, keyed by employee+logId
  const existingMap = await TimeEntry.getWrikeEntryMap(
    linkedEmployees.map(e => e.id), startDate, endDate
  );

  const toInsert = [];
  const toUpdate = [];
  const toDelete = [];           // ids to remove: duplicate copies + (later) stale rows
  const presentKeys = new Set(); // employee|logId still present in the (filtered) fetch
  let deduped = 0;
  let skipped = 0;

  for (const [wrikeUserId, logs] of Object.entries(byUser)) {
    const emp = empByWrikeId[wrikeUserId];
    if (!emp) { skipped += logs.length; continue; }

    for (const log of logs) {
      if (!log.hours || log.hours <= 0) continue;

      const key = `${emp.id}|${log.logId}`;
      presentKeys.add(key);

      // hours_worked is DECIMAL(5,2) — round to the column's precision so a re-sync
      // compares like-for-like. Wrike returns full-precision hours (e.g. 0.5666…),
      // and comparing that against the stored 0.57 would flag every row as "changed"
      // on every sync, churning pointless UPDATEs while the total never moves.
      const hrs = Math.round(log.hours * 100) / 100;
      const categoryName = log.categoryId ? (categoryMap[log.categoryId] || null) : null;
      const rows = existingMap.get(key);

      if (rows && rows.length) {
        // Keep the first row as canonical; any further rows are duplicate imports of the
        // same Wrike log (they inflate the total) — delete them.
        const canonical = rows[0];
        for (let i = 1; i < rows.length; i++) { toDelete.push(rows[i].id); deduped++; }

        // Re-sync corrects the canonical row when hours/category changed in Wrike
        const changes = {};
        if (Math.abs(canonical.hours_worked - hrs) >= 0.005) changes.hours_worked = hrs;
        if (categoryName && canonical.category !== categoryName) changes.category = categoryName;

        if (Object.keys(changes).length) toUpdate.push({ id: canonical.id, changes });
        else skipped++;
        continue;
      }

      const description = `[${log.logId}] ${log.comment || taskTitles[log.taskId] || ''}`.trim();
      toInsert.push({
        employee_id:      emp.id,
        entry_date:       log.date,
        hours_worked:     hrs,
        task_description: description,
        project_name:     taskTitles[log.taskId] || null,
        wrike_task_id:    log.taskId || null,
        category:         categoryName,
        source:           'wrike'
      });
    }
  }

  // Authoritative reconcile: delete Wrike-sourced entries in range whose log is gone
  // from the fetch — but only for employees whose fetch succeeded (guards against a
  // partial Wrike API failure deleting good data).
  const okEmpIds = new Set();
  if (okContactIds === 'all') {
    linkedEmployees.forEach(e => okEmpIds.add(e.id));
  } else {
    for (const cid of okContactIds) {
      const emp = empByWrikeId[cid];
      if (emp) okEmpIds.add(emp.id);
    }
  }

  for (const [key, rows] of existingMap) {
    if (!presentKeys.has(key) && okEmpIds.has(rows[0].employee_id)) {
      for (const r of rows) toDelete.push(r.id);
    }
  }

  const imported = await TimeEntry.bulkInsert(toInsert);
  for (const { id, changes } of toUpdate) {
    await TimeEntry.update(id, changes);
  }
  const deleted = await TimeEntry.deleteByIds(toDelete);

  // `deleted` counts both stale rows and duplicate copies removed
  return { imported, updated: toUpdate.length, deleted, deduped, skipped, startDate, endDate };
}

class WrikeController {
  /**
   * GET /api/wrike/timelogs?date=YYYY-MM-DD&approvedOnly=true
   * Fetches Wrike timelogs for the week containing `date` (defaults to current week),
   * matches them to employees and returns a weekly breakdown per employee.
   * When approvedOnly=true, only timelogs from Completed/Approved tasks are included.
   */
  async getWeeklyTimelogs(req, res) {
    try {
      const date = req.query.date || new Date().toISOString().split('T')[0];
      const approvedOnly = req.query.approvedOnly === 'true';
      const startDate = getWeekStart(date);
      const endDate   = getWeekEnd(date);
      const days      = weekDays(startDate);

      // Load all active employees that have a Wrike user ID
      const allEmployees = await Employee.findAll(false);
      const linkedEmployees = allEmployees.filter(e => e.wrike_user_id);
      const wrikeIds = linkedEmployees.map(e => e.wrike_user_id);

      // Fetch timelogs from Wrike then filter client-side by approval status
      let timelogs = await wrikeService.getTimeLogs(startDate, endDate, wrikeIds);

      const statusValues = [...new Set(timelogs.map(l => l.approvalStatus))];
      console.log(`[Wrike] ${timelogs.length} timelogs fetched. approvalStatus values:`, statusValues);

      if (approvedOnly) {
        const before = timelogs.length;
        timelogs = timelogs.filter(l => l.approvalStatus?.toLowerCase() === 'approved');
        console.log(`[Wrike] approvedOnly filter: ${before} → ${timelogs.length} timelogs`);
      }

      // Optionally fetch task titles
      const allTaskIds = timelogs.map(l => l.taskId).filter(Boolean);
      const taskTitles = await wrikeService.getTaskTitles(allTaskIds);

      // Group by Wrike user ID, mapping raw fields to processed shape
      const byUser = wrikeService.groupTimeLogsByUser(timelogs);

      // Build per-employee weekly rows
      const rows = allEmployees.map(emp => {
        const userLogs = emp.wrike_user_id ? (byUser[emp.wrike_user_id] || []) : [];

        // Sum hours per day
        const dailyHours = {};
        days.forEach(d => { dailyHours[d] = 0; });

        const taskDetails = [];
        for (const log of userLogs) {
          if (dailyHours[log.date] !== undefined) {
            dailyHours[log.date] += log.hours;
          }
          taskDetails.push({
            date:      log.date,
            hours:     log.hours,
            taskId:    log.taskId,
            taskTitle: taskTitles[log.taskId] || log.taskId || '—',
            comment:   log.comment,
            logId:     log.logId
          });
        }

        const totalHours = Object.values(dailyHours).reduce((a, b) => a + b, 0);
        const currency   = emp.currency || 'USD';
        const pay        = +(totalHours * parseFloat(emp.hourly_rate)).toFixed(2);

        return {
          employee: {
            id:           emp.id,
            employee_id:  emp.employee_id,
            name:         emp.name,
            department:   emp.department,
            hourly_rate:  emp.hourly_rate,
            currency,
            wrike_user_id: emp.wrike_user_id,
            is_active:    emp.is_active
          },
          weekStart: startDate,
          weekEnd: endDate,
          days,
          dailyHours,
          totalHours: +totalHours.toFixed(2),
          pay,
          taskDetails
        };
      });

      res.json({
        success:   true,
        weekStart: startDate,
        weekEnd:   endDate,
        days,
        data:      rows
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/wrike/timelogs/monthly?month=YYYY-MM&approvedOnly=true
   * Aggregates Wrike timelogs for a full calendar month, grouped by employee and week.
   */
  async getMonthlyTimelogs(req, res) {
    try {
      const month       = req.query.month || new Date().toISOString().substring(0, 7);
      const approvedOnly = req.query.approvedOnly === 'true';
      const [year, mon] = month.split('-').map(Number);

      const startDate = `${year}-${String(mon).padStart(2,'0')}-01`;
      const lastDay   = new Date(year, mon, 0).getDate();
      const endDate   = `${year}-${String(mon).padStart(2,'0')}-${lastDay}`;

      const allEmployees   = await Employee.findAll(false);
      const linkedEmployees = allEmployees.filter(e => e.wrike_user_id);
      const wrikeIds       = linkedEmployees.map(e => e.wrike_user_id);

      let timelogs = await wrikeService.getTimeLogs(startDate, endDate, wrikeIds);
      if (approvedOnly) {
        timelogs = timelogs.filter(l => l.approvalStatus?.toLowerCase() === 'approved');
      }

      const allTaskIds = timelogs.map(l => l.taskId).filter(Boolean);
      const taskTitles = await wrikeService.getTaskTitles(allTaskIds);
      const byUser     = wrikeService.groupTimeLogsByUser(timelogs);

      // Build week labels for the month (Mon–Sun buckets)
      const weeks = [];
      let cursor = new Date(startDate + 'T12:00:00Z');
      while (cursor.getUTCDay() !== 1) cursor.setUTCDate(cursor.getUTCDate() - 1); // rewind to Monday
      while (cursor <= new Date(endDate + 'T23:59:59Z')) {
        const wStart = cursor.toISOString().split('T')[0];
        const wEnd   = new Date(cursor); wEnd.setUTCDate(wEnd.getUTCDate() + 6);
        weeks.push({ start: wStart, end: wEnd.toISOString().split('T')[0] });
        cursor.setUTCDate(cursor.getUTCDate() + 7);
      }

      const rows = allEmployees.map(emp => {
        const userLogs = emp.wrike_user_id ? (byUser[emp.wrike_user_id] || []) : [];
        const weekHours = weeks.map(w => {
          return userLogs.filter(l => l.date >= w.start && l.date <= w.end)
                         .reduce((s, l) => s + l.hours, 0);
        });
        const totalHours = weekHours.reduce((a, b) => a + b, 0);
        const currency   = emp.currency || 'USD';
        const pay        = +(totalHours * parseFloat(emp.hourly_rate)).toFixed(2);

        return {
          employee: {
            id: emp.id, employee_id: emp.employee_id, name: emp.name,
            department: emp.department, hourly_rate: emp.hourly_rate,
            currency, wrike_user_id: emp.wrike_user_id, is_active: emp.is_active,
          },
          weekHours,
          totalHours: +totalHours.toFixed(2),
          pay,
        };
      });

      res.json({ success: true, month, startDate, endDate, weeks, data: rows });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/wrike/import
   * Body: { date: 'YYYY-MM-DD', approvedOnly: true }  — imports the full week into time_entries
   */
  async importWeekTimelogs(req, res) {
    try {
      const date         = req.body.date || new Date().toISOString().split('T')[0];
      const approvedOnly = req.body.approvedOnly === true;
      const startDate = getWeekStart(date);
      const endDate   = getWeekEnd(date);

      const { imported, updated, deleted, deduped, skipped } = await syncTimelogsToEntries({
        startDate, endDate, approvedOnly
      });

      res.json({
        success: true,
        message: `Imported ${imported} new, updated ${updated} changed, removed ${deleted} (incl. ${deduped} duplicates), skipped ${skipped} unchanged`,
        imported,
        updated,
        deleted,
        deduped,
        skipped,
        weekStart: startDate,
        weekEnd:   endDate
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/wrike/contacts
   * Returns all Wrike contacts (users) so you can match them to employees
   */
  async getContacts(req, res) {
    try {
      const contacts = await wrikeService.getUsers();
      res.json({ success: true, data: contacts });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/wrike/import-period
   * Body: { periodId }
   * Imports all APPROVED Wrike timelogs for a pay period's date range into time_entries.
   */
  async importPeriodTimelogs(req, res) {
    try {
      const { periodId } = req.body;
      if (!periodId) return res.status(400).json({ success: false, error: 'periodId is required' });

      const period = await db.getOne('SELECT * FROM pay_periods WHERE id = ?', [periodId]);
      if (!period) return res.status(404).json({ success: false, error: 'Period not found' });

      const startDate = toDateStr(period.start_date);
      const endDate   = toDateStr(period.end_date);

      const { imported, updated, deleted, deduped, skipped } = await syncTimelogsToEntries({
        startDate, endDate, approvedOnly: true
      });

      res.json({
        success: true,
        message: `Imported ${imported} new, updated ${updated} changed, removed ${deleted} (incl. ${deduped} duplicates), skipped ${skipped} unchanged`,
        imported,
        updated,
        deleted,
        deduped,
        skipped,
        startDate,
        endDate
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getFolders(req, res) {
    try {
      const folders = await wrikeService.getFolders();
      const simplified = folders.map(f => ({ id: f.id, title: f.title, childIds: f.childIds }));
      res.json({ success: true, currentFolderId: process.env.WRIKE_FOLDER_ID || null, data: simplified });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/wrike/backfill-categories
   * Fetches all Wrike timelogs for the date range of uncategorized entries
   * and patches category on any time_entries that have a matching logId.
   */
  async backfillCategories(req, res) {
    try {
      const categoryMap = await wrikeService.getTimelogCategories();
      console.log('[Backfill] Category map:', categoryMap);

      if (!Object.keys(categoryMap).length) {
        return res.status(502).json({
          success: false,
          error: 'Wrike returned no timelog categories. Check WRIKE_API_KEY permissions or whether timelog categories are enabled on your Wrike plan.'
        });
      }

      const [range] = await db.query(
        `SELECT MIN(entry_date) as minDate, MAX(entry_date) as maxDate
         FROM time_entries WHERE source = 'wrike' AND category IS NULL`
      );
      if (!range || !range.minDate) {
        return res.json({ success: true, message: 'No uncategorized Wrike entries found.', updated: 0 });
      }

      const start = String(range.minDate).substring(0, 10);
      const end   = String(range.maxDate).substring(0, 10);
      console.log(`[Backfill] Fetching Wrike timelogs ${start} → ${end}`);

      const timelogs = await wrikeService.getTimeLogs(start, end, []);
      console.log(`[Backfill] Fetched ${timelogs.length} timelogs from Wrike`);

      const logCategoryMap = {};
      for (const log of timelogs) {
        if (log.id && log.categoryId && categoryMap[log.categoryId]) {
          logCategoryMap[log.id] = categoryMap[log.categoryId];
        }
      }
      console.log(`[Backfill] ${Object.keys(logCategoryMap).length} timelogs have a category`);

      const uncategorized = await db.query(
        `SELECT id, task_description FROM time_entries WHERE source = 'wrike' AND category IS NULL`
      );

      // Build per-category batches so we can do one UPDATE per distinct category name
      const batches = {};
      for (const entry of uncategorized) {
        const match = (entry.task_description || '').match(/^\[([^\]]+)\]/);
        if (!match) continue;
        const categoryName = logCategoryMap[match[1]];
        if (categoryName) {
          if (!batches[categoryName]) batches[categoryName] = [];
          batches[categoryName].push(entry.id);
        }
      }

      let updated = 0;
      for (const [categoryName, ids] of Object.entries(batches)) {
        await db.query(
          `UPDATE time_entries SET category = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
          [categoryName, ...ids]
        );
        updated += ids.length;
      }

      console.log(`[Backfill] Done — updated ${updated} of ${uncategorized.length} entries`);
      res.json({ success: true, updated, total: uncategorized.length, categoryMap });
    } catch (error) {
      console.error('[Backfill] Failed:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new WrikeController();
