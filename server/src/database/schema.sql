-- Timesheet and Payslip Management System Database Schema
-- Run this script to initialize the database

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS timesheet_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE timesheet_db;

-- ============================================
-- EMPLOYEES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    department VARCHAR(100),
    position VARCHAR(100),
    hourly_rate DECIMAL(10, 2) DEFAULT 500.00,
    wrike_user_id VARCHAR(100),
    hire_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_employee_id (employee_id),
    INDEX idx_email (email),
    INDEX idx_wrike_user_id (wrike_user_id)
) ENGINE=InnoDB;

-- ============================================
-- TIME ENTRIES TABLE (Raw time logs)
-- ============================================
CREATE TABLE IF NOT EXISTS time_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    entry_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    hours_worked DECIMAL(5, 2) NOT NULL,
    task_description TEXT,
    project_name VARCHAR(255),
    wrike_task_id VARCHAR(100),
    source ENUM('manual', 'wrike', 'import') DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee_date (employee_id, entry_date),
    INDEX idx_entry_date (entry_date),
    INDEX idx_wrike_task_id (wrike_task_id)
) ENGINE=InnoDB;

-- ============================================
-- PAY PERIODS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pay_periods (
    id INT PRIMARY KEY AUTO_INCREMENT,
    period_name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('open', 'processing', 'pending_approval', 'approved', 'paid', 'rejected') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_period (start_date, end_date),
    INDEX idx_status (status),
    INDEX idx_dates (start_date, end_date)
) ENGINE=InnoDB;

-- ============================================
-- TIME ENTRIES SUMMARY TABLE (Aggregated timesheet data)
-- ============================================
CREATE TABLE IF NOT EXISTS time_entries_summary (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    period_id INT NOT NULL,
    total_hours DECIMAL(6, 2) NOT NULL DEFAULT 0,
    regular_hours DECIMAL(6, 2) DEFAULT 0,
    overtime_hours DECIMAL(6, 2) DEFAULT 0,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    gross_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    deductions DECIMAL(12, 2) DEFAULT 0,
    net_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    
    -- Approval workflow fields
    approval_task_id VARCHAR(100),
    approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approved_at DATETIME NULL,
    approved_by VARCHAR(100),
    rejection_reason TEXT,
    rejection_files TEXT,

    -- File references
    timesheet_pdf_path VARCHAR(500),
    payslip_pdf_path VARCHAR(500),
    drive_file_id VARCHAR(200),
    drive_file_url VARCHAR(500),
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES pay_periods(id) ON DELETE CASCADE,
    UNIQUE KEY unique_employee_period (employee_id, period_id),
    INDEX idx_approval_status (approval_status),
    INDEX idx_approval_task_id (approval_task_id),
    INDEX idx_period_id (period_id)
) ENGINE=InnoDB;

-- ============================================
-- TASK BREAKDOWN TABLE (Detailed task entries for each summary)
-- ============================================
CREATE TABLE IF NOT EXISTS task_breakdown (
    id INT PRIMARY KEY AUTO_INCREMENT,
    summary_id INT NOT NULL,
    task_date DATE NOT NULL,
    task_name VARCHAR(255),
    project_name VARCHAR(255),
    hours DECIMAL(5, 2) NOT NULL,
    description TEXT,
    wrike_task_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (summary_id) REFERENCES time_entries_summary(id) ON DELETE CASCADE,
    INDEX idx_summary_id (summary_id),
    INDEX idx_task_date (task_date)
) ENGINE=InnoDB;

-- ============================================
-- PAYSLIPS TABLE (Final generated payslips)
-- ============================================
CREATE TABLE IF NOT EXISTS payslips (
    id INT PRIMARY KEY AUTO_INCREMENT,
    summary_id INT NOT NULL,
    payslip_number VARCHAR(50) UNIQUE NOT NULL,
    employee_id INT NOT NULL,
    period_id INT NOT NULL,
    
    -- Financial details
    total_hours DECIMAL(6, 2) NOT NULL,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    gross_amount DECIMAL(12, 2) NOT NULL,
    tax_deductions DECIMAL(12, 2) DEFAULT 0,
    other_deductions DECIMAL(12, 2) DEFAULT 0,
    net_amount DECIMAL(12, 2) NOT NULL,
    
    -- File information
    pdf_path VARCHAR(500),
    drive_file_id VARCHAR(200),
    drive_file_url VARCHAR(500),
    
    -- Status
    status ENUM('generated', 'uploaded', 'sent', 'paid') DEFAULT 'generated',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_at DATETIME NULL,
    sent_at DATETIME NULL,
    paid_at DATETIME NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (summary_id) REFERENCES time_entries_summary(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES pay_periods(id) ON DELETE CASCADE,
    INDEX idx_payslip_number (payslip_number),
    INDEX idx_employee_period (employee_id, period_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- ============================================
-- WRIKE WEBHOOK LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS wrike_webhook_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    webhook_event_id VARCHAR(100),
    event_type VARCHAR(50),
    task_id VARCHAR(100),
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    payload JSON,
    processed BOOLEAN DEFAULT FALSE,
    processed_at DATETIME NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_webhook_event_id (webhook_event_id),
    INDEX idx_task_id (task_id),
    INDEX idx_processed (processed)
) ENGINE=InnoDB;

-- ============================================
-- AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSON,
    new_values JSON,
    performed_by INT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_action (action),
    INDEX idx_performed_by (performed_by)
) ENGINE=InnoDB;

-- ============================================
-- USERS TABLE (Admin users for the system)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'hr', 'accountant', 'viewer') DEFAULT 'viewer',
    employee_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB;

-- ============================================
-- SYSTEM SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB;

-- ============================================
-- INSERT DEFAULT SYSTEM SETTINGS
-- ============================================
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('default_hourly_rate', '500', 'Default hourly rate for new employees'),
('currency', 'BDT', 'Default currency'),
('working_hours_per_day', '8', 'Standard working hours per day'),
('overtime_multiplier', '1.5', 'Overtime pay multiplier'),
('auto_generate_timesheets', 'true', 'Automatically generate timesheets on schedule'),
('approval_reminder_days', '3', 'Days before sending approval reminder'),
('payslip_storage', 'drive', 'Payslip storage location (local/drive)')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- ============================================
-- CREATE VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Employee Timesheet Summary
CREATE OR REPLACE VIEW v_employee_timesheet AS
SELECT 
    tes.id AS summary_id,
    e.employee_id,
    e.name AS employee_name,
    e.email,
    e.department,
    pp.period_name,
    pp.start_date,
    pp.end_date,
    tes.total_hours,
    tes.regular_hours,
    tes.overtime_hours,
    tes.hourly_rate,
    tes.gross_amount,
    tes.net_amount,
    tes.approval_status,
    tes.approval_task_id,
    tes.approved_at,
    tes.timesheet_pdf_path,
    tes.payslip_pdf_path,
    tes.drive_file_url
FROM time_entries_summary tes
JOIN employees e ON tes.employee_id = e.id
JOIN pay_periods pp ON tes.period_id = pp.id;

-- View: Pending Approvals
CREATE OR REPLACE VIEW v_pending_approvals AS
SELECT 
    tes.id,
    e.name AS employee_name,
    e.email,
    pp.period_name,
    pp.end_date,
    tes.total_hours,
    tes.gross_amount,
    tes.approval_task_id,
    DATEDIFF(NOW(), tes.created_at) AS days_pending
FROM time_entries_summary tes
JOIN employees e ON tes.employee_id = e.id
JOIN pay_periods pp ON tes.period_id = pp.id
WHERE tes.approval_status = 'pending';

-- ============================================
-- CREATE STORED PROCEDURES
-- ============================================

DELIMITER //

-- Procedure: Generate Timesheet Summary for a Period
CREATE PROCEDURE sp_generate_timesheet_summary(
    IN p_employee_id INT,
    IN p_period_id INT
)
BEGIN
    DECLARE v_total_hours DECIMAL(6,2);
    DECLARE v_hourly_rate DECIMAL(10,2);
    DECLARE v_gross_amount DECIMAL(12,2);
    DECLARE v_regular_hours DECIMAL(6,2);
    DECLARE v_overtime_hours DECIMAL(6,2);
    DECLARE v_working_hours INT;
    DECLARE v_start_date DATE;
    DECLARE v_end_date DATE;
    
    -- Get period dates
    SELECT start_date, end_date INTO v_start_date, v_end_date
    FROM pay_periods WHERE id = p_period_id;
    
    -- Get employee hourly rate
    SELECT COALESCE(hourly_rate, 
        (SELECT CAST(setting_value AS DECIMAL(10,2)) 
         FROM system_settings WHERE setting_key = 'default_hourly_rate'))
    INTO v_hourly_rate
    FROM employees WHERE id = p_employee_id;
    
    -- Get working hours setting
    SELECT CAST(setting_value AS SIGNED) INTO v_working_hours
    FROM system_settings WHERE setting_key = 'working_hours_per_day';
    
    -- Calculate total hours
    SELECT COALESCE(SUM(hours_worked), 0) INTO v_total_hours
    FROM time_entries
    WHERE employee_id = p_employee_id
    AND entry_date BETWEEN v_start_date AND v_end_date;
    
    -- Calculate regular and overtime hours (assuming 8h/day standard)
    SET v_regular_hours = LEAST(v_total_hours, v_working_hours * DATEDIFF(v_end_date, v_start_date) + 1);
    SET v_overtime_hours = GREATEST(0, v_total_hours - v_regular_hours);
    
    -- Calculate gross amount
    SET v_gross_amount = (v_regular_hours * v_hourly_rate) + 
                         (v_overtime_hours * v_hourly_rate * 
         (SELECT CAST(setting_value AS DECIMAL(3,2)) 
          FROM system_settings WHERE setting_key = 'overtime_multiplier'));
    
    -- Insert or update summary
    INSERT INTO time_entries_summary (
        employee_id, period_id, total_hours, regular_hours, 
        overtime_hours, hourly_rate, gross_amount, net_amount
    ) VALUES (
        p_employee_id, p_period_id, v_total_hours, v_regular_hours,
        v_overtime_hours, v_hourly_rate, v_gross_amount, v_gross_amount
    )
    ON DUPLICATE KEY UPDATE
        total_hours = v_total_hours,
        regular_hours = v_regular_hours,
        overtime_hours = v_overtime_hours,
        hourly_rate = v_hourly_rate,
        gross_amount = v_gross_amount,
        net_amount = v_gross_amount,
        updated_at = CURRENT_TIMESTAMP;
    
    SELECT LAST_INSERT_ID() AS summary_id;
END //

-- Procedure: Mark Summary as Approved
CREATE PROCEDURE sp_mark_approved(
    IN p_summary_id INT,
    IN p_approved_by VARCHAR(100)
)
BEGIN
    UPDATE time_entries_summary
    SET approval_status = 'approved',
        approved_at = CURRENT_TIMESTAMP,
        approved_by = p_approved_by,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_summary_id;
    
    -- Update pay period status if all summaries are approved
    UPDATE pay_periods pp
    SET status = 'approved'
    WHERE id = (SELECT period_id FROM time_entries_summary WHERE id = p_summary_id)
    AND NOT EXISTS (
        SELECT 1 FROM time_entries_summary tes
        WHERE tes.period_id = pp.id
        AND tes.approval_status != 'approved'
    );
END //

-- Procedure: Mark Summary as Rejected
CREATE PROCEDURE sp_mark_rejected(
    IN p_summary_id INT,
    IN p_rejection_reason TEXT
)
BEGIN
    UPDATE time_entries_summary
    SET approval_status = 'rejected',
        rejection_reason = p_rejection_reason,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_summary_id;
    
    -- Update pay period status
    UPDATE pay_periods pp
    SET status = 'rejected'
    WHERE id = (SELECT period_id FROM time_entries_summary WHERE id = p_summary_id);
END //

DELIMITER ;

-- ============================================
-- CREATE TRIGGERS FOR AUDIT LOGGING
-- ============================================

DELIMITER //

CREATE TRIGGER tr_audit_employees_after_insert
AFTER INSERT ON employees
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (entity_type, entity_id, action, new_values)
    VALUES ('employee', NEW.id, 'INSERT', JSON_OBJECT(
        'employee_id', NEW.employee_id,
        'name', NEW.name,
        'email', NEW.email
    ));
END //

CREATE TRIGGER tr_audit_employees_after_update
AFTER UPDATE ON employees
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (entity_type, entity_id, action, old_values, new_values)
    VALUES ('employee', NEW.id, 'UPDATE', JSON_OBJECT(
        'name', OLD.name,
        'email', OLD.email,
        'hourly_rate', OLD.hourly_rate
    ), JSON_OBJECT(
        'name', NEW.name,
        'email', NEW.email,
        'hourly_rate', NEW.hourly_rate
    ));
END //

DELIMITER ;

-- End of schema
