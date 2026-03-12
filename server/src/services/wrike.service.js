const axios = require('axios');
require('dotenv').config();

/**
 * Wrike API Service
 * Handles all interactions with Wrike API
 */
class WrikeService {
  constructor() {
    this.baseUrl = process.env.WRIKE_API_BASE_URL || 'https://www.wrike.com/api/v4';
    this.apiKey = process.env.WRIKE_API_KEY;
    this.folderId = process.env.WRIKE_FOLDER_ID;
    this._resolvedFolderId = null; // cached API-format ID

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Resolve WRIKE_FOLDER_ID: if it's a legacy numeric ID, find the API ID
   * by fetching all folders and matching on legacyId. Caches the result.
   */
  async resolveFolderId() {
    if (this._resolvedFolderId) return this._resolvedFolderId;

    const raw = this.folderId;
    if (!raw) throw new Error('WRIKE_FOLDER_ID is not set in environment');

    // Wrike API IDs contain letters (e.g. IEAAAAABBBBBB); legacy IDs are purely numeric
    if (/^\d+$/.test(raw)) {
      try {
        const response = await this.client.get('/folders');
        const folders = response.data.data || [];
        const match = folders.find(f => String(f.legacyId) === raw || String(f.id) === raw);
        if (!match) {
          const list = folders.map(f => `"${f.title}" (id=${f.id}, legacyId=${f.legacyId})`).join(', ');
          throw new Error(`No Wrike folder found with legacy ID ${raw}. Available: ${list}`);
        }
        this._resolvedFolderId = match.id;
        console.log(`📁 Resolved Wrike folder ID: ${raw} → ${this._resolvedFolderId} ("${match.title}")`);
      } catch (err) {
        if (err.message.startsWith('No Wrike folder') || err.message.startsWith('WRIKE_FOLDER_ID')) throw err;
        throw new Error(`Failed to resolve Wrike folder ID: ${err.response?.data?.errorDescription || err.message}`);
      }
    } else {
      this._resolvedFolderId = raw;
    }

    return this._resolvedFolderId;
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await this.client.get('/user');
      return {
        success: true,
        user: response.data.data[0]
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    try {
      const response = await this.client.get('/user');
      return response.data.data[0];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get all users in account
   */
  async getUsers() {
    try {
      const response = await this.client.get('/contacts');
      return response.data.data.filter(contact => contact.type === 'Person');
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId) {
    try {
      const response = await this.client.get(`/contacts/${userId}`);
      return response.data.data[0];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create an approval task
   */
  async createApprovalTask(taskData) {
    try {
      const folderId = taskData.folderId || await this.resolveFolderId();
      const formOpts = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

      const buildParams = (withAssignee) => {
        const params = new URLSearchParams();
        params.append('title', taskData.title);
        if (taskData.description) params.append('description', taskData.description);
        if (withAssignee && taskData.assigneeIds && taskData.assigneeIds.length > 0) {
          params.append('responsibleIds', JSON.stringify(taskData.assigneeIds));
        }
        params.append('dates', JSON.stringify({
          type: 'Planned',
          start: taskData.startDate || new Date().toISOString().split('T')[0],
          due: taskData.dueDate || this.getDefaultDueDate()
        }));
        params.append('importance', taskData.importance || 'High');
        if (taskData.customStatusId) params.append('customStatusId', taskData.customStatusId);
        return params;
      };

      try {
        const response = await this.client.post(
          `/folders/${folderId}/tasks`,
          buildParams(true),
          formOpts
        );
        return response.data.data[0];
      } catch (assignErr) {
        // responsibleIds rejected on creation — create without it, then assign via PUT
        const errDesc = assignErr.response?.data?.errorDescription || '';
        if (errDesc.includes('responsibleIds') || errDesc.includes('not allowed')) {
          console.warn('⚠️  responsibleIds rejected on create, will assign via PUT after creation');
          const response = await this.client.post(
            `/folders/${folderId}/tasks`,
            buildParams(false),
            formOpts
          );
          const task = response.data.data[0];

          // Try assigning via PUT /tasks/{id} with addResponsibles
          if (task && taskData.assigneeIds && taskData.assigneeIds.length > 0) {
            try {
              const assignParams = new URLSearchParams();
              assignParams.append('addResponsibles', JSON.stringify(taskData.assigneeIds));
              await this.client.put(`/tasks/${task.id}`, assignParams, formOpts);
              console.log(`✅ Assigned task ${task.id} to ${taskData.assigneeIds}`);
            } catch (putErr) {
              console.warn(`⚠️  Could not assign task via PUT: ${putErr.response?.data?.errorDescription || putErr.message}`);
            }
          }

          return task;
        }
        throw assignErr;
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get task by ID
   */
  async getTask(taskId) {
    try {
      const response = await this.client.get(`/tasks/${taskId}`);
      return response.data.data[0];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId, status) {
    try {
      const params = new URLSearchParams();
      params.append('status', status);
      const response = await this.client.put(`/tasks/${taskId}`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return response.data.data[0];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Add comment to task
   */
  async addTaskComment(taskId, text) {
    try {
      const params = new URLSearchParams();
      params.append('text', text);
      const response = await this.client.post(`/tasks/${taskId}/comments`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return response.data.data[0];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Attach file to task
   */
  async attachFileToTask(taskId, filePath, fileName) {
    try {
      const fs = require('fs');
      const FormData = require('form-data');
      
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath), fileName);

      const response = await axios.post(
        `${this.baseUrl}/tasks/${taskId}/attachments`,
        form,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            ...form.getHeaders()
          }
        }
      );

      return response.data.data[0];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get task attachments
   */
  async getTaskAttachments(taskId) {
    try {
      const response = await this.client.get(`/tasks/${taskId}/attachments`);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create webhook
   */
  async createWebhook(webhookUrl, events = ['TaskCreated', 'TaskDeleted', 'TaskStatusChanged']) {
    try {
      const response = await this.client.post('/webhooks', {
        hookUrl: webhookUrl,
        events: events
      });
      return response.data.data[0];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get webhooks
   */
  async getWebhooks() {
    try {
      const response = await this.client.get('/webhooks');
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId) {
    try {
      await this.client.delete(`/webhooks/${webhookId}`);
      return true;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get custom statuses
   */
  async getCustomStatuses() {
    try {
      const response = await this.client.get('/workflows');
      const workflows = response.data.data;
      
      // Flatten all custom statuses from all workflows
      const statuses = [];
      workflows.forEach(workflow => {
        workflow.customStatuses.forEach(status => {
          statuses.push({
            id: status.id,
            name: status.name,
            color: status.color,
            workflowId: workflow.id,
            workflowName: workflow.name
          });
        });
      });
      
      return statuses;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get folders
   */
  async getFolders() {
    try {
      const response = await this.client.get('/folders');
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get time logs for a date range, optionally filtered by contact IDs.
   * Wrike API v4 does NOT support contactIds on GET /timelogs.
   * - No contactIds → single call to GET /timelogs (all users)
   * - With contactIds → one call per contact: GET /contacts/{id}/timelogs
   * @param {string} startDate  - 'YYYY-MM-DD'
   * @param {string} endDate    - 'YYYY-MM-DD'
   * @param {string[]} contactIds - optional Wrike user ID array
   */
  async getTimeLogs(startDate, endDate, contactIds = []) {
    // Wrike API expects plain YYYY-MM-DD dates — strip any time component
    const start = String(startDate).substring(0, 10);
    const end   = String(endDate).substring(0, 10);
    const params = {
      trackedDate: JSON.stringify({ start, end })
    };

    try {
      if (!contactIds.length) {
        // No filter — fetch all timelogs for the account
        const response = await this.client.get('/timelogs', { params });
        return response.data.data || [];
      }

      // Fetch per-contact and merge results (Wrike requires separate calls per user)
      const settled = await Promise.allSettled(
        contactIds.map(id =>
          this.client.get(`/contacts/${id}/timelogs`, { params })
            .then(r => ({ id, logs: r.data.data || [] }))
        )
      );

      const allLogs = [];
      const errors  = [];
      for (const result of settled) {
        if (result.status === 'fulfilled') {
          allLogs.push(...result.value.logs);
        } else {
          const err    = result.reason;
          const status = err.response?.status;
          const msg    = err.response?.data?.errorDescription || err.message;
          errors.push({ status, msg });
          console.error(`⚠️  Wrike timelogs fetch failed (HTTP ${status}): ${msg}`);
        }
      }

      // If ALL contacts failed, surface the error so the caller can notify the user
      if (errors.length > 0 && allLogs.length === 0) {
        const e = new Error(`Wrike API error: ${errors[0].msg}`);
        e.wrikeErrors = errors;
        throw e;
      }

      return allLogs;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Group raw timelogs by userId → { [userId]: [{ date, hours, taskId, comment }] }
   */
  groupTimeLogsByUser(timelogs) {
    const grouped = {};
    for (const log of timelogs) {
      const uid = log.userId;
      if (!grouped[uid]) grouped[uid] = [];
      grouped[uid].push({
        date: log.trackedDate,
        hours: parseFloat(log.hours) || 0,
        taskId: log.taskId,
        comment: log.comment || '',
        logId: log.id
      });
    }
    return grouped;
  }

  /**
   * Fetch task titles for a list of task IDs (max 100 per call)
   */
  async getTaskTitles(taskIds) {
    if (!taskIds.length) return {};
    try {
      const ids = [...new Set(taskIds)].slice(0, 100).join(',');
      const response = await this.client.get(`/tasks/${ids}`, {
        params: { fields: '["title"]' }
      });
      const map = {};
      for (const t of response.data.data || []) {
        map[t.id] = t.title;
      }
      return map;
    } catch {
      return {};
    }
  }

  /**
   * Create timesheet approval task with formatted data
   */
  async createTimesheetApprovalTask(summary, employee, period) {
    const periodStart = new Date(period.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const periodEnd = new Date(period.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    const title = `Timesheet Approval - ${employee.name} - ${periodStart}–${periodEnd}`;
    
    const description = `
Please review and approve your timesheet for this pay period.

**Employee:** ${employee.name}
**Employee ID:** ${employee.employee_id}
**Department:** ${employee.department || 'N/A'}
**Period:** ${periodStart} - ${periodEnd}

**Hours Summary:**
- Total Hours: ${summary.total_hours}
- Regular Hours: ${summary.regular_hours}
- Overtime Hours: ${summary.overtime_hours}

**Payment Summary:**
- Hourly Rate: ${summary.hourly_rate} ${summary.currency || process.env.CURRENCY || 'USD'}
- Gross Amount: ${summary.gross_amount.toLocaleString()} ${summary.currency || process.env.CURRENCY || 'USD'}

---
*Please review the attached timesheet PDF. If everything is correct, approve this task. If there are any discrepancies, reject and add a comment with the issues.*
    `.trim();

    const assigneeIds = employee.wrike_user_id ? [employee.wrike_user_id] : [];

    return this.createApprovalTask({
      title,
      description,
      assigneeIds,
      importance: 'High'
    });
  }

  /**
   * Get default due date (3 days from now)
   */
  getDefaultDueDate() {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toISOString().split('T')[0];
  }

  /**
   * Handle API errors
   */
  handleError(error) {
    if (error.response) {
      const { status, data } = error.response;
      return new Error(`Wrike API Error (${status}): ${JSON.stringify(data)}`);
    }
    return error;
  }
}

module.exports = new WrikeService();
