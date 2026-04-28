const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');

class JobWorkerService {
  constructor() {
    this._running = new Set();
  }

  async enqueueJob(type, payload) {
    const id = uuidv4();
    await db.query(
      `INSERT INTO payroll_jobs (id, type, status, payload) VALUES (?, ?, 'queued', ?)`,
      [id, type, JSON.stringify(payload)]
    );
    setImmediate(() => this._processJob(id).catch(err => console.error(`[Job ${id}]`, err.message)));
    return { id, type, status: 'queued' };
  }

  async getJob(id) {
    const row = await db.getOne('SELECT * FROM payroll_jobs WHERE id = ?', [id]);
    if (!row) return null;
    return {
      ...row,
      payload:  this._parseJSON(row.payload),
      progress: this._parseJSON(row.progress),
      result:   this._parseJSON(row.result),
    };
  }

  async updateProgress(jobId, done, total, current) {
    await db.query(
      `UPDATE payroll_jobs SET progress = ?, updated_at = NOW() WHERE id = ?`,
      [JSON.stringify({ done, total, current: current || null }), jobId]
    );
  }

  // Pick up queued/stuck-processing jobs after a server restart
  async drainQueued() {
    try {
      const rows = await db.query(
        `SELECT id FROM payroll_jobs WHERE status IN ('queued','processing') AND created_at > DATE_SUB(NOW(), INTERVAL 2 HOUR)`,
        []
      );
      for (const row of rows) {
        if (!this._running.has(row.id)) {
          setImmediate(() => this._processJob(row.id).catch(err => console.error(`[Job drain ${row.id}]`, err.message)));
        }
      }
      if (rows.length) console.log(`🔁 Resuming ${rows.length} interrupted payroll job(s)`);
    } catch (err) {
      console.warn('⚠️  Job drain skipped:', err.message);
    }
  }

  async _processJob(jobId) {
    if (this._running.has(jobId)) return;
    this._running.add(jobId);
    console.log(`⚙️  [Job ${jobId}] starting`);
    try {
      await db.query(
        `UPDATE payroll_jobs SET status = 'processing', updated_at = NOW() WHERE id = ? AND status != 'done'`,
        [jobId]
      );

      const job = await this.getJob(jobId);
      if (!job || job.status === 'done') return;

      // Lazy-load to avoid circular deps at module load time
      const timesheetService = require('./timesheet.service');

      const onProgress = (done, total, current) =>
        this.updateProgress(jobId, done, total, current).catch(() => {});

      let result;
      switch (job.type) {
        case 'submit': {
          const { employeeId, startDate, endDate, periodName } = job.payload;
          result = await timesheetService.submitTimesheet(employeeId, startDate, endDate, periodName);
          break;
        }
        case 'bulk_generate': {
          const { periodId, employeeIds } = job.payload;
          result = await timesheetService.bulkApproveAndGenerate(periodId, employeeIds || null, onProgress);
          break;
        }
        case 'generate_period': {
          const { periodId, employeeIds } = job.payload;
          result = await timesheetService.generatePayslipsForPeriod(periodId, employeeIds || null, onProgress);
          break;
        }
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      await db.query(
        `UPDATE payroll_jobs SET status = 'done', result = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(result ?? null), jobId]
      );
      console.log(`✅ [Job ${jobId}] done`);
    } catch (err) {
      console.error(`❌ [Job ${jobId}] failed:`, err.message);
      await db.query(
        `UPDATE payroll_jobs SET status = 'failed', error = ?, updated_at = NOW() WHERE id = ?`,
        [err.message, jobId]
      ).catch(() => {});
    } finally {
      this._running.delete(jobId);
    }
  }

  _parseJSON(val) {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return val; }
  }
}

module.exports = new JobWorkerService();
