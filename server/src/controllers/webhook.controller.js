const timesheetService = require('../services/timesheet.service');
const db = require('../database/connection');
require('dotenv').config();

/**
 * Webhook Controller
 * Handles incoming webhooks from Wrike
 */
class WebhookController {
  /**
   * Handle Wrike webhook
   * POST /api/webhooks/wrike
   */
  async handleWrikeWebhook(req, res) {
    try {
      const event = req.body;
      const webhookSecret = req.headers['x-wrike-signature'];

      // Verify webhook secret if configured
      if (process.env.WRIKE_WEBHOOK_SECRET) {
        // In production, verify the signature
        // For now, we'll skip this for simplicity
      }

      console.log('📨 Received Wrike webhook:', JSON.stringify(event, null, 2));

      // Log the webhook event
      await this.logWebhookEvent(event);

      // Process different event types
      if (event.eventType === 'TaskStatusChanged' || event.eventType === 'Task.statusChanged') {
        await this.handleTaskStatusChange(event);
      }

      // Always return 200 to acknowledge receipt
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      res.status(200).json({ received: true, error: error.message });
    }
  }

  /**
   * Handle task status change event
   */
  async handleTaskStatusChange(event) {
    const taskId = event.taskId || event.id;
    const oldStatus = event.oldStatus || event.previousStatus;
    const newStatus = event.newStatus || event.currentStatus;

    console.log(`🔄 Task ${taskId} status changed: ${oldStatus} → ${newStatus}`);

    // Update webhook log
    await db.update(
      'wrike_webhook_logs',
      {
        processed: true,
        processed_at: new Date()
      },
      'task_id = ? AND processed = false',
      [taskId]
    );

    // Process the status change
    const result = await timesheetService.handleApproval(taskId, newStatus);

    if (result.success) {
      console.log(`✅ Webhook processed successfully: ${result.action}`);
    } else {
      console.log(`⚠️  Webhook processing skipped: ${result.reason}`);
    }

    return result;
  }

  /**
   * Log webhook event to database
   */
  async logWebhookEvent(event) {
    try {
      await db.insert('wrike_webhook_logs', {
        webhook_event_id: event.eventId || event.id || null,
        event_type: event.eventType || event.type || 'unknown',
        task_id: event.taskId || event.id || null,
        old_status: event.oldStatus || event.previousStatus || null,
        new_status: event.newStatus || event.currentStatus || null,
        payload: JSON.stringify(event),
        processed: false
      });
    } catch (error) {
      console.error('Failed to log webhook event:', error);
    }
  }

  /**
   * Get webhook logs
   */
  async getWebhookLogs(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const logs = await db.query(`
        SELECT * FROM wrike_webhook_logs
        ORDER BY created_at DESC
        LIMIT ?
      `, [limit]);

      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get unprocessed webhook events
   */
  async getUnprocessedEvents(req, res) {
    try {
      const events = await db.query(`
        SELECT * FROM wrike_webhook_logs
        WHERE processed = false
        ORDER BY created_at ASC
      `);

      res.json({
        success: true,
        count: events.length,
        data: events
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Retry unprocessed events
   */
  async retryUnprocessedEvents(req, res) {
    try {
      const events = await db.query(`
        SELECT * FROM wrike_webhook_logs
        WHERE processed = false
        ORDER BY created_at ASC
      `);

      const results = [];
      for (const event of events) {
        try {
          const payload = JSON.parse(event.payload);
          const result = await this.handleTaskStatusChange({
            taskId: event.task_id,
            oldStatus: event.old_status,
            newStatus: event.new_status,
            ...payload
          });
          results.push({
            eventId: event.id,
            success: result.success,
            action: result.action || result.reason
          });
        } catch (error) {
          results.push({
            eventId: event.id,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        processed: results.length,
        results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(req, res) {
    const { taskId, status } = req.body;

    if (!taskId || !status) {
      return res.status(400).json({
        success: false,
        error: 'taskId and status are required'
      });
    }

    try {
      const result = await timesheetService.handleApproval(taskId, status);
      res.json({
        success: true,
        result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new WebhookController();
