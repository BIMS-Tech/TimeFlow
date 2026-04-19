const wrikeService = require('../services/wrike.service');
const Employee = require('../models/Employee');
const TimeEntry = require('../models/TimeEntry');
const db = require('../database/connection');

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
   * POST /api/wrike/import
   * Body: { date: 'YYYY-MM-DD', approvedOnly: true }  — imports the full week into time_entries
   */
  async importWeekTimelogs(req, res) {
    try {
      const date         = req.body.date || new Date().toISOString().split('T')[0];
      const approvedOnly = req.body.approvedOnly === true;
      const startDate = getWeekStart(date);
      const endDate   = getWeekEnd(date);

      const allEmployees   = await Employee.findAll(false);
      const linkedEmployees = allEmployees.filter(e => e.wrike_user_id);
      const wrikeIds       = linkedEmployees.map(e => e.wrike_user_id);

      // Fetch timelogs from Wrike then filter client-side by approval status
      let timelogs = await wrikeService.getTimeLogs(startDate, endDate, wrikeIds);
      if (approvedOnly) {
        timelogs = timelogs.filter(l => l.approvalStatus?.toLowerCase() === 'approved');
      }

      const allTaskIds = timelogs.map(l => l.taskId).filter(Boolean);
      const [taskTitles, categoryMap] = await Promise.all([
        wrikeService.getTaskTitles(allTaskIds),
        wrikeService.getTimelogCategories()
      ]);

      // Group by Wrike user ID, mapping raw fields to processed shape
      const byUser = wrikeService.groupTimeLogsByUser(timelogs);

      const empByWrikeId = {};
      for (const e of linkedEmployees) empByWrikeId[e.wrike_user_id] = e;

      let imported = 0;
      let skipped  = 0;

      for (const [wrikeUserId, logs] of Object.entries(byUser)) {
        const emp = empByWrikeId[wrikeUserId];
        if (!emp) { skipped += logs.length; continue; }

        for (const log of logs) {
          if (!log.hours || log.hours <= 0) continue;

          const categoryName = log.categoryId ? (categoryMap[log.categoryId] || null) : null;

          // Check for duplicate (same employee, date, wrike source, same logId in description)
          const existing = await TimeEntry.findDuplicate(emp.id, log.date, log.logId);
          if (existing) {
            // Back-fill category on entries that were imported before the category column existed
            if (categoryName && !existing.category) {
              await TimeEntry.update(existing.id, { category: categoryName });
            }
            skipped++;
            continue;
          }

          const description = `[${log.logId}] ${log.comment || taskTitles[log.taskId] || ''}`.trim();
          await TimeEntry.create({
            employee_id:      emp.id,
            entry_date:       log.date,
            hours_worked:     log.hours,
            task_description: description,
            project_name:     taskTitles[log.taskId] || null,
            wrike_task_id:    log.taskId || null,
            category:         categoryName,
            source:           'wrike'
          });
          imported++;
        }
      }

      res.json({
        success: true,
        message: `Imported ${imported} entries, skipped ${skipped} duplicates`,
        imported,
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
