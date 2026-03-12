# Timesheet & Payslip Management System

A comprehensive timesheet and payslip management system with Wrike integration for approval workflows.

## 🏗️ Architecture Flow

```
CRON → Create Period → Calculate Hours → Generate Timesheet PDF → 
Create Wrike Approval Task → Wait for Webhook → 
IF Approved → Generate Final Payslip → Upload to Drive
ELSE → Mark Rejected
```

## 🚀 Features

- **Automated Timesheet Generation**: Fetch time logs, calculate hours, generate PDF timesheets
- **Wrike Integration**: Create approval tasks in Wrike for employee review
- **Webhook-based Approval**: Real-time status updates via Wrike webhooks
- **Payslip Generation**: Generate final payslips only after approval
- **Google Drive Integration**: Upload approved payslips to Google Drive
- **React Dashboard**: Modern admin interface for managing the entire workflow

## 📋 Prerequisites

- Node.js 18+
- MySQL 8.0+
- Wrike Account (with API access)
- Google Cloud Project (for Drive API)

## ⚙️ Installation

### 1. Clone and Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required configurations:
- Database credentials
- Wrike API key and folder ID
- Google Drive credentials
- JWT secret

### 3. Initialize Database

```bash
npm run db:init
```

This will create the database schema and a default admin user.

### 4. Start the Application

```bash
# Development mode (backend only)
npm run dev

# Development mode (full stack)
npm run dev:full

# Production mode
npm start
```

## 🔌 API Endpoints

### Dashboard
- `GET /api/dashboard` - Get dashboard statistics

### Employees
- `GET /api/employees` - List all employees
- `POST /api/employees` - Create employee
- `GET /api/employees/:id` - Get employee details
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Timesheet
- `POST /api/timesheet/process` - Process timesheets for a period
- `POST /api/timesheet/generate` - Generate timesheet for employee
- `GET /api/timesheet/pending` - Get pending approvals
- `GET /api/timesheet/periods` - List all periods
- `GET /api/timesheet/periods/:id` - Get period details
- `GET /api/timesheet/summaries/:id` - Get summary details
- `POST /api/timesheet/summaries/:id/approve` - Approve summary
- `POST /api/timesheet/summaries/:id/reject` - Reject summary

### Webhooks
- `POST /api/webhooks/wrike` - Wrike webhook endpoint
- `GET /api/webhooks/logs` - Get webhook logs
- `POST /api/webhooks/test` - Test webhook

## 🗄️ Database Schema

### Key Tables

- **employees** - Employee information
- **pay_periods** - Pay period definitions
- **time_entries** - Raw time logs
- **time_entries_summary** - Aggregated timesheet data with approval status
- **payslips** - Generated payslips
- **wrike_webhook_logs** - Webhook event logs

### Approval Status Flow

```
pending → approved → generate payslip → upload to drive
    ↓
rejected → return to draft → regenerate
```

## 🔄 Workflow

### 1. Timesheet Generation (Draft)

When cron runs or manually triggered:
1. Fetch time logs for the period
2. Calculate total hours (regular + overtime)
3. Generate Timesheet PDF with "Awaiting Approval" watermark
4. Create Wrike approval task
5. Attach PDF to Wrike task
6. Store task ID in database

### 2. Approval Process

Via Wrike webhook:
1. Receive task status change event
2. Find summary by Wrike task ID
3. If approved:
   - Mark summary as approved
   - Generate final payslip (no watermark)
   - Upload to Google Drive
   - Update file URLs
4. If rejected:
   - Mark summary as rejected
   - Store rejection reason

### 3. Safety Checks

Before generating payslip:
```javascript
if (summary.approval_status !== 'approved') return;
```

## 📅 Cron Jobs

Default schedules:
- **Timesheet Processing**: Every Monday at 9 AM
- **Approval Reminders**: Daily at 10 AM
- **Webhook Health Check**: Every 6 hours
- **Cleanup**: Daily at 2 AM

Configure via `CRON_SCHEDULE` in `.env`.


COnfigure AI  in future 

## 🔐 Security


- JWT-based authentication
- Helmet for security headers
- CORS configuration
- Webhook signature verification
- SQL injection prevention via parameterized queries

## 📁 Project Structure

```
timesheet-ext/
├── src/
│   ├── controllers/      # API controllers
│   ├── cron/             # Cron job scheduler
│   ├── database/         # Database connection & schema
│   ├── models/           # Data models
│   ├── routes/           # API routes
│   ├── services/         # Business logic services
│   └── server.js         # Express server
├── client/               # React frontend
│   ├── public/
│   └── src/
│       ├── api/          # API client
│       ├── pages/        # React pages
│       └── components/   # React components
├── uploads/              # Generated PDFs
├── .env.example          # Environment template
└── package.json
```

## 🔧 Configuration

### Wrike Setup

1. Get API key from Wrike profile settings
2. Find or create a folder for approval tasks
3. Note the folder ID from the URL

### Google Drive Setup

1. Create Google Cloud project
2. Enable Drive API
3. Create OAuth credentials
4. Get refresh token using the auth URL

## 📝 License

MIT License - see LICENSE file for details.

## 👤 Author

Tamim Hossain

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request
