const { CronJob } = require('cron');
const timesheetService = require('../services/timesheet.service');
const wrikeService = require('../services/wrike.service');
const TimeEntriesSummary = require('../models/TimeEntriesSummary');
const db = require('../database/connection');
require('dotenv').config();

/**
 * Cron Scheduler
 * Handles automated tasks for timesheet processing
 */
class CronScheduler {
  constructor() {
    this.jobs = [];
  }

  /**
   * Initialize all scheduled jobs
   */
  init() {
    console.log('⏰ Initializing cron scheduler...');

    // Main timesheet processing job
    this.scheduleTimesheetProcessing();

    // Approval reminder job
    this.scheduleApprovalReminders();

    // Webhook health check job
    this.scheduleWebhookHealthCheck();

    // Cleanup job
    this.scheduleCleanup();

    console.log(`✅ ${this.jobs.length} cron jobs scheduled`);
  }

  /**
   * Schedule main timesheet processing
   * Default: Every Monday at 9 AM
   */
  scheduleTimesheetProcessing() {
    const schedule = process.env.CRON_SCHEDULE || '0 9 * * 1'; // Monday 9 AM

    const job = new CronJob(
      schedule,
      async () => {
        console.log('\n🔄 [CRON] Starting scheduled timesheet processing...');
        try {
          const result = await timesheetService.processPeriod();
          console.log('✅ [CRON] Timesheet processing complete:', result);
        } catch (error) {
          console.error('❌ [CRON] Timesheet processing failed:', error);
        }
      },
      null,
      true,
      process.env.TIMEZONE || 'Asia/Dhaka'
    );

    this.jobs.push({
      name: 'timesheet-processing',
      schedule,
      job
    });

    console.log(`📅 Scheduled: Timesheet processing (${schedule})`);
  }

  /**
   * Schedule approval reminders
   * Default: Daily at 10 AM
   */
  scheduleApprovalReminders() {
    const schedule = '0 10 * * *'; // Daily at 10 AM

    const job = new CronJob(
      schedule,
      async () => {
        console.log('\n📧 [CRON] Sending approval reminders...');
        try {
          const reminderDays = parseInt(process.env.APPROVAL_REMINDER_DAYS || 3);
          const pending = await TimeEntriesSummary.getNeedingReminder(reminderDays);

          for (const summary of pending) {
            try {
              // Add comment to Wrike task
              await wrikeService.addTaskComment(
                summary.approval_task_id,
                `⏰ Reminder: This timesheet approval is pending for ${reminderDays}+ days. Please review and approve/reject.`
              );
              console.log(`📧 Reminder sent for task: ${summary.approval_task_id}`);
            } catch (error) {
              console.error(`Failed to send reminder for ${summary.approval_task_id}:`, error.message);
            }
          }

          console.log(`✅ [CRON] Sent ${pending.length} reminders`);
        } catch (error) {
          console.error('❌ [CRON] Reminder job failed:', error);
        }
      },
      null,
      true,
      process.env.TIMEZONE || 'Asia/Dhaka'
    );

    this.jobs.push({
      name: 'approval-reminders',
      schedule,
      job
    });

    console.log(`📅 Scheduled: Approval reminders (${schedule})`);
  }

  /**
   * Schedule webhook health check
   * Default: Every 6 hours
   */
  scheduleWebhookHealthCheck() {
    const schedule = '0 */6 * * *'; // Every 6 hours

    const job = new CronJob(
      schedule,
      async () => {
        console.log('\n🔍 [CRON] Checking webhook health...');
        try {
          const webhooks = await wrikeService.getWebhooks();
          console.log(`📋 Found ${webhooks.length} active webhooks`);

          // Check if our webhook is still active
          const webhookUrl = `${process.env.APP_URL}/api/webhooks/wrike`;
          const ourWebhook = webhooks.find(w => w.hookUrl === webhookUrl);

          if (!ourWebhook) {
            console.warn('⚠️  Webhook not found! Recreating...');
            await wrikeService.createWebhook(webhookUrl);
          } else {
            console.log('✅ Webhook is active');
          }
        } catch (error) {
          console.error('❌ [CRON] Webhook health check failed:', error);
        }
      },
      null,
      true,
      process.env.TIMEZONE || 'Asia/Dhaka'
    );

    this.jobs.push({
      name: 'webhook-health',
      schedule,
      job
    });

    console.log(`📅 Scheduled: Webhook health check (${schedule})`);
  }

  /**
   * Schedule cleanup job
   * Default: Daily at 2 AM
   */
  scheduleCleanup() {
    const schedule = '0 2 * * *'; // Daily at 2 AM

    const job = new CronJob(
      schedule,
      async () => {
        console.log('\n🧹 [CRON] Running cleanup...');
        try {
          // Clean old webhook logs (older than 30 days)
          await db.query(`
            DELETE FROM wrike_webhook_logs
            WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
          `);

          // Clean old audit logs (older than 90 days)
          await db.query(`
            DELETE FROM audit_logs
            WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
          `);

          console.log('✅ [CRON] Cleanup complete');
        } catch (error) {
          console.error('❌ [CRON] Cleanup failed:', error);
        }
      },
      null,
      true,
      process.env.TIMEZONE || 'Asia/Dhaka'
    );

    this.jobs.push({
      name: 'cleanup',
      schedule,
      job
    });

    console.log(`📅 Scheduled: Cleanup (${schedule})`);
  }

  /**
   * Start all jobs
   */
  start() {
    this.jobs.forEach(({ name, job }) => {
      if (!job.running) {
        job.start();
        console.log(`▶️  Started: ${name}`);
      }
    });
  }

  /**
   * Stop all jobs
   */
  stop() {
    this.jobs.forEach(({ name, job }) => {
      if (job.running) {
        job.stop();
        console.log(`⏸️  Stopped: ${name}`);
      }
    });
  }

  /**
   * Get job status
   */
  getStatus() {
    return this.jobs.map(({ name, schedule, job }) => ({
      name,
      schedule,
      running: job.running,
      nextRun: job.nextDate()?.toISO() || null
    }));
  }

  /**
   * Run a job manually
   */
  async runJob(name) {
    const jobInfo = this.jobs.find(j => j.name === name);
    if (!jobInfo) {
      throw new Error(`Job not found: ${name}`);
    }

    console.log(`🏃 Manually running: ${name}`);
    // Fire the job callback manually
    jobInfo.job.fireOnTick();
  }
}

// Create singleton instance
const scheduler = new CronScheduler();

// If run directly, start the scheduler
if (require.main === module) {
  scheduler.init();
  scheduler.start();
  console.log('\n🚀 Cron scheduler running. Press Ctrl+C to stop.\n');
}

module.exports = scheduler;
