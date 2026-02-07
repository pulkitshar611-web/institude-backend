-- ============================================
-- INSTITUTE MANAGEMENT SYSTEM - DATABASE SCHEMA
-- MySQL Database Schema
-- ============================================

-- Create Database
CREATE DATABASE IF NOT EXISTS institute_management;
USE institute_management;

SET FOREIGN_KEY_CHECKS = 0;

-- Drop existing tables in reverse order of dependencies
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS calendar_events;
DROP TABLE IF EXISTS student_timeline;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS donor_student_links;
DROP TABLE IF EXISTS donations;
DROP TABLE IF EXISTS donors;
DROP TABLE IF EXISTS grades;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS parents;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS users;

-- ============================================
-- 1. USERS TABLE (Admin, Staff, Finance)
-- ============================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff', 'finance') NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- ============================================
-- 2. STUDENTS TABLE
-- ============================================
CREATE TABLE students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    class VARCHAR(50),
    academic_year VARCHAR(20),
    health_declaration_file VARCHAR(255),
    photo VARCHAR(255),
    status ENUM('active', 'inactive', 'graduated', 'transferred') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    INDEX idx_student_id (student_id),
    INDEX idx_class (class),
    INDEX idx_academic_year (academic_year),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 3. PARENTS TABLE
-- ============================================
CREATE TABLE parents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    relation ENUM('father', 'mother', 'guardian') NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    national_id VARCHAR(100),
    dob DATE,
    phone VARCHAR(20),
    email VARCHAR(255),
    id_document_file VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student (student_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- 4. ATTENDANCE TABLE
-- ============================================
CREATE TABLE attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    date DATE NOT NULL,
    status ENUM('present', 'absent', 'late', 'excused') NOT NULL,
    remarks TEXT,
    marked_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_date (student_id, date),
    UNIQUE KEY unique_attendance (student_id, date),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 5. GRADES TABLE
-- ============================================
CREATE TABLE grades (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    exam_type VARCHAR(100) NOT NULL,
    score DECIMAL(5,2),
    max_score DECIMAL(5,2),
    grade VARCHAR(10),
    exam_date DATE,
    test_photo_file VARCHAR(255),
    remarks TEXT,
    recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student (student_id),
    INDEX idx_subject (subject),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 6. DONORS TABLE
-- ============================================
CREATE TABLE donors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    donor_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    follow_up_date DATE,
    status ENUM('active', 'inactive', 'potential') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    INDEX idx_donor_id (donor_id),
    INDEX idx_follow_up (follow_up_date),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 7. DONATIONS TABLE
-- ============================================
CREATE TABLE donations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    donation_id VARCHAR(50) UNIQUE NOT NULL,
    donor_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    purpose VARCHAR(255),
    payment_method ENUM('cash', 'cheque', 'bank_transfer', 'online', 'matara') DEFAULT 'cash',
    payment_reference VARCHAR(100),
    donation_date DATE NOT NULL,
    receipt_file VARCHAR(255),
    status ENUM('completed', 'pending', 'failed', 'refunded') DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    recorded_by INT,
    INDEX idx_donor (donor_id),
    INDEX idx_date (donation_date),
    INDEX idx_status (status),
    FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 8. DONOR-STUDENT LINKS TABLE
-- ============================================
CREATE TABLE donor_student_links (
    id INT PRIMARY KEY AUTO_INCREMENT,
    donor_id INT NOT NULL,
    student_id INT NOT NULL,
    sponsorship_type VARCHAR(100),
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_link (donor_id, student_id),
    FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================
-- 9. PAYMENTS TABLE (MATARA & Student Payments)
-- ============================================
CREATE TABLE payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    payment_id VARCHAR(50) UNIQUE NOT NULL,
    student_id INT,
    payment_type ENUM('tuition', 'fee', 'matara', 'other') NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    due_date DATE,
    paid_date DATE,
    payment_method ENUM('cash', 'cheque', 'bank_transfer', 'online', 'matara') DEFAULT 'cash',
    payment_reference VARCHAR(100),
    status ENUM('paid', 'pending', 'failed', 'overdue', 'partial') DEFAULT 'pending',
    receipt_file VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    recorded_by INT,
    INDEX idx_student (student_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 10. STUDENT TIMELINE (Events/Notes/Letters)
-- ============================================
CREATE TABLE student_timeline (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    entry_type ENUM('attendance', 'grade', 'event', 'note', 'document', 'letter') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    entry_date DATE NOT NULL,
    file_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    INDEX idx_student (student_id),
    INDEX idx_date (entry_date),
    INDEX idx_type (entry_type),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 11. CALENDAR EVENTS TABLE
-- ============================================
CREATE TABLE calendar_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type ENUM('school', 'academic', 'fundraiser', 'holiday', 'birthday', 'follow_up', 'reminder', 'other') NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_all_day BOOLEAN DEFAULT TRUE,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50),
    related_student_id INT,
    related_donor_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    INDEX idx_date (event_date),
    INDEX idx_type (event_type),
    FOREIGN KEY (related_student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (related_donor_id) REFERENCES donors(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 12. DOCUMENTS TABLE
-- ============================================
CREATE TABLE documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    document_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    document_type ENUM('health_declaration', 'parent_id', 'donation_receipt', 'transfer_certificate', 'report_card', 'test_paper', 'letter', 'other') NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT,
    mime_type VARCHAR(100),
    student_id INT,
    donor_id INT,
    description TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by INT,
    INDEX idx_type (document_type),
    INDEX idx_student (student_id),
    INDEX idx_donor (donor_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 13. SYSTEM SETTINGS TABLE
-- ============================================
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string',
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INT,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 14. AUDIT LOG TABLE
-- ============================================
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Default Admin User (password: admin123)
INSERT INTO users (user_id, email, password, full_name, role, phone) VALUES
('USR-001', 'admin@school.edu', '$2a$10$8pFZTZUklj/rOK8m3XpOaugSJA86fBbV1xNtdMUZW6pA2DLHeLHVi', 'System Administrator', 'admin', '+91 98765 00001'),
('USR-002', 'staff@school.edu', '$2a$10$NEGX.mXeNAKdbDsP5E4W3OFNVD3t3qTx8o1x3iuuyLbbolFHAsOne', 'Staff Member', 'staff', '+91 98765 00002'),
('USR-003', 'finance@school.edu', '$2a$10$GU67YS.AY1h.Yf5x4xB2pOwdgNgfu/lZsOljds.mu8iq/75wYu4JW', 'Finance Manager', 'finance', '+91 98765 00003');

-- Default System Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('institution_name', 'Institution Management System', 'string', 'Name of the institution'),
('academic_year', '2025-2026', 'string', 'Current academic year'),
('currency', 'INR', 'string', 'Default currency'),
('language', 'en', 'string', 'System language'),
('calendar_type', 'hebrew', 'string', 'Calendar type (hebrew/gregorian)'),
('matara_enabled', 'true', 'boolean', 'Enable MATARA payment integration');

-- Sample Students
INSERT INTO students (student_id, full_name, dob, address, city, class, academic_year, status) VALUES
('STU-2024-001', 'Aarav Sharma', '2010-05-15', 'Block B, 402, Green Valley Aprt', 'Pune, Maharashtra', 'VIII-B', '2023-2024', 'active'),
('STU-2024-002', 'Isha Kapoor', '2011-02-22', '12, Civil Lines', 'Mumbai, Maharashtra', 'VII-A', '2023-2024', 'active'),
('STU-2024-003', 'Rohan Gupta', '2009-11-10', 'Flat 201, Sunshine Heights', 'Delhi, Delhi', 'IX-C', '2023-2024', 'active');

-- Sample Parents
INSERT INTO parents (student_id, relation, full_name, national_id, dob, phone, email) VALUES
(1, 'father', 'Rajesh Sharma', 'PAN-ABCDE1234F', '1978-03-20', '+91 98765 43210', 'rajesh.s@example.com'),
(1, 'mother', 'Priya Sharma', 'PAN-FGHIJ5678K', '1980-08-12', '+91 98765 43211', 'priya.s@example.com'),
(2, 'father', 'Amit Kapoor', 'ADHR-11223344', '1975-11-05', '+91 91234 56789', 'amit.k@example.com'),
(2, 'mother', 'Sneha Kapoor', 'ADHR-55667788', '1979-01-30', '+91 91234 56790', 'sneha.k@example.com'),
(3, 'father', 'Vikram Gupta', 'VOT-998877', '1976-06-15', '+91 99887 76655', 'vikram.g@example.com'),
(3, 'mother', 'Anjali Gupta', 'VOT-112233', '1982-04-25', '+91 99887 76666', 'anjali.g@example.com');

-- Sample Donors
INSERT INTO donors (donor_id, name, phone, email, notes, follow_up_date, status) VALUES
('DNR-001', 'Dr. Arvind Patel', '+91 98989 89898', 'arvind.patel@clinic.com', 'Interested in funding the new science lab.', DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'active'),
('DNR-002', 'Mrs. Kavita Reddy', '+91 77777 66666', 'kavita.foundation@org.in', 'Promised to sponsor 3 students for the next academic year.', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'active');

-- Sample Donations
INSERT INTO donations (donation_id, donor_id, amount, purpose, payment_method, donation_date, status) VALUES
('DON-001', 1, 50000.00, 'Library Books Upgrade', 'bank_transfer', '2023-12-10', 'completed'),
('DON-002', 1, 25000.00, 'Independence Day Celebration', 'cheque', '2023-08-15', 'completed'),
('DON-003', 2, 100000.00, 'Scholarship Fund', 'cheque', '2024-01-01', 'completed');

-- Sample Calendar Events
INSERT INTO calendar_events (event_id, title, description, event_type, event_date) VALUES
('EVT-001', 'Annual Sports Day', 'All classes to assemble in the playground by 8 AM.', 'school', DATE_ADD(CURDATE(), INTERVAL 10 DAY)),
('EVT-002', 'Parent Teacher Meeting', 'Review of mid-term results.', 'academic', DATE_ADD(CURDATE(), INTERVAL 5 DAY)),
('EVT-003', 'Donor Gala Dinner', 'Invitation only event for top donors.', 'fundraiser', DATE_ADD(CURDATE(), INTERVAL 15 DAY));

-- ============================================
-- END OF SCHEMA
-- ============================================

SET FOREIGN_KEY_CHECKS = 1;
