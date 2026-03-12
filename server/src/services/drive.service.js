const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Google Drive Service
 * Handles file uploads to Google Drive
 */
class DriveService {
  constructor() {
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials if refresh token exists
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
    }

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Generate authentication URL
   */
  getAuthUrl() {
    const scopes = ['https://www.googleapis.com/auth/drive.file'];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Get tokens from code
   */
  async getTokensFromCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens;
    } catch (error) {
      throw new Error(`Failed to get tokens: ${error.message}`);
    }
  }

  /**
   * Set credentials
   */
  setCredentials(tokens) {
    this.oauth2Client.setCredentials(tokens);
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      const about = await this.drive.about.get({ fields: 'user' });
      return {
        success: true,
        user: about.data.user
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(filePath, fileName, mimeType = 'application/pdf', folderId = null) {
    try {
      const targetFolderId = folderId || this.folderId;
      
      const fileMetadata = {
        name: fileName,
        parents: targetFolderId ? [targetFolderId] : []
      };

      const media = {
        mimeType: mimeType,
        body: fs.createReadStream(filePath)
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink, size'
      });

      return {
        success: true,
        fileId: response.data.id,
        fileName: response.data.name,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
        size: response.data.size
      };
    } catch (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload payslip to Drive
   */
  async uploadPayslip(filePath, employeeName, periodName) {
    const fileName = `Payslip_${periodName.replace(/\s+/g, '_')}_${employeeName.replace(/\s+/g, '_')}.pdf`;
    
    // Create payslips folder if it doesn't exist
    const payslipsFolder = await this.getOrCreateFolder('Payslips');
    
    // Create period subfolder
    const periodFolder = await this.getOrCreateFolder(periodName, payslipsFolder.id);
    
    return this.uploadFile(filePath, fileName, 'application/pdf', periodFolder.id);
  }

  /**
   * Upload timesheet to Drive
   */
  async uploadTimesheet(filePath, employeeName, periodName) {
    const fileName = `Timesheet_${periodName.replace(/\s+/g, '_')}_${employeeName.replace(/\s+/g, '_')}.pdf`;
    
    // Create timesheets folder if it doesn't exist
    const timesheetsFolder = await this.getOrCreateFolder('Timesheets');
    
    // Create period subfolder
    const periodFolder = await this.getOrCreateFolder(periodName, timesheetsFolder.id);
    
    return this.uploadFile(filePath, fileName, 'application/pdf', periodFolder.id);
  }

  /**
   * Get or create a folder
   */
  async getOrCreateFolder(folderName, parentFolderId = null) {
    try {
      // Search for existing folder
      const query = parentFolderId
        ? `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const searchResponse = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)'
      });

      if (searchResponse.data.files.length > 0) {
        return searchResponse.data.files[0];
      }

      // Create new folder
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : (this.folderId ? [this.folderId] : [])
      };

      const createResponse = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id, name'
      });

      return createResponse.data;
    } catch (error) {
      throw new Error(`Failed to get/create folder: ${error.message}`);
    }
  }

  /**
   * Get file by ID
   */
  async getFile(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, webViewLink, webContentLink, size, createdTime, modifiedTime'
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get file: ${error.message}`);
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId) {
    try {
      await this.drive.files.delete({ fileId });
      return true;
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Share file with specific email
   */
  async shareFile(fileId, email, role = 'reader') {
    try {
      const permission = {
        type: 'user',
        role: role,
        emailAddress: email
      };

      await this.drive.permissions.create({
        fileId: fileId,
        resource: permission,
        sendNotificationEmail: true,
        emailMessage: 'Your payslip has been generated and is ready for viewing.'
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to share file: ${error.message}`);
    }
  }

  /**
   * Make file publicly accessible
   */
  async makePublic(fileId) {
    try {
      await this.drive.permissions.create({
        fileId: fileId,
        resource: { type: 'anyone', role: 'reader' }
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to make file public: ${error.message}`);
    }
  }

  /**
   * List files in folder
   */
  async listFiles(folderId = null, pageSize = 100) {
    try {
      const query = folderId
        ? `'${folderId}' in parents and trashed=false`
        : 'trashed=false';

      const response = await this.drive.files.list({
        q: query,
        pageSize: pageSize,
        fields: 'files(id, name, webViewLink, size, createdTime)'
      });

      return response.data.files;
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Download file
   */
  async downloadFile(fileId, destinationPath) {
    try {
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      return new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(destinationPath);
        response.data
          .on('end', () => resolve(destinationPath))
          .on('error', reject)
          .pipe(dest);
      });
    } catch (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Search files by name
   */
  async searchFiles(query, folderId = null) {
    try {
      let searchQuery = `name contains '${query}' and trashed=false`;
      if (folderId) {
        searchQuery += ` and '${folderId}' in parents`;
      }

      const response = await this.drive.files.list({
        q: searchQuery,
        fields: 'files(id, name, webViewLink, createdTime)'
      });

      return response.data.files;
    } catch (error) {
      throw new Error(`Failed to search files: ${error.message}`);
    }
  }

  /**
   * Get folder structure
   */
  async getFolderStructure(rootFolderId = null) {
    const folderId = rootFolderId || this.folderId;
    
    const getChildren = async (parentId, path = '') => {
      const response = await this.drive.files.list({
        q: `'${parentId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)'
      });

      const structure = [];
      for (const file of response.data.files) {
        const item = {
          id: file.id,
          name: file.name,
          type: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
          path: path ? `${path}/${file.name}` : file.name
        };

        if (item.type === 'folder') {
          item.children = await getChildren(file.id, item.path);
        }

        structure.push(item);
      }

      return structure;
    };

    return getChildren(folderId);
  }
}

module.exports = new DriveService();
