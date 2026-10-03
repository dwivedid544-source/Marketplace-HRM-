/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: attendance
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `attendance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `in_time` datetime DEFAULT NULL,
  `out_time` datetime DEFAULT NULL,
  `total_hours` decimal(10, 2) DEFAULT 0.00,
  `status` enum('present', 'absent', 'late', 'half_day') DEFAULT 'present',
  `marked_by` int(11) DEFAULT NULL,
  `company_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 20 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: audit_logs
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `target_id` int(11) DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 20 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: broadcast_messages
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `broadcast_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `sender_id` int(11) DEFAULT NULL,
  `sender_name` varchar(255) DEFAULT NULL,
  `message_type` enum('broadcast', 'personal') NOT NULL DEFAULT 'broadcast',
  `channels` varchar(50) NOT NULL DEFAULT 'both',
  `target_audience` varchar(100) NOT NULL DEFAULT 'all',
  `target_department` varchar(100) DEFAULT NULL,
  `target_employee_id` int(11) DEFAULT NULL,
  `target_employee_name` varchar(255) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `message_text` text NOT NULL,
  `priority` enum('normal', 'important', 'urgent') NOT NULL DEFAULT 'normal',
  `total_recipients` int(11) NOT NULL DEFAULT 0,
  `email_sent_count` int(11) NOT NULL DEFAULT 0,
  `email_failed_count` int(11) NOT NULL DEFAULT 0,
  `whatsapp_sent_count` int(11) NOT NULL DEFAULT 0,
  `whatsapp_failed_count` int(11) NOT NULL DEFAULT 0,
  `status` varchar(50) NOT NULL DEFAULT 'COMPLETED',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_msg_company` (`company_id`),
  KEY `idx_msg_created` (`created_at`)
) ENGINE = InnoDB AUTO_INCREMENT = 5 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: claims
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `claims` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) DEFAULT NULL,
  `employee_id` int(11) NOT NULL,
  `employee_name` varchar(100) DEFAULT NULL,
  `claim_type` enum('Travel', 'Fuel', 'Food', 'Accommodation', 'Other') DEFAULT 'Other',
  `amount` decimal(10, 2) DEFAULT 0.00,
  `expense_date` date DEFAULT NULL,
  `status` enum('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
  `receipt` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `claims_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `claims_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 2 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: companies
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `companies` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `company_name` varchar(255) DEFAULT NULL,
  `owner_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `plan` varchar(100) DEFAULT NULL,
  `employee_limit` int(11) DEFAULT 0,
  `status` enum('active', 'inactive', 'suspended') DEFAULT 'active',
  `subscription_start` date DEFAULT NULL,
  `subscription_end` date DEFAULT NULL,
  `created_by` bigint(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 27 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: company_backup_schedules
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `company_backup_schedules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `is_enabled` tinyint(1) DEFAULT 1,
  `frequency_days` int(11) DEFAULT 7,
  `target_email` varchar(255) DEFAULT '',
  `last_run_at` datetime DEFAULT NULL,
  `next_run_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_id` (`company_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: company_email_settings
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `company_email_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `smtp_host` varchar(255) NOT NULL,
  `smtp_port` int(11) NOT NULL,
  `smtp_user` varchar(255) NOT NULL,
  `smtp_pass` text NOT NULL,
  `sender_email` varchar(255) NOT NULL,
  `sender_name` varchar(100) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_company` (`company_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 2 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: company_requests
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `company_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_name` varchar(255) NOT NULL,
  `owner_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `plan` varchar(100) DEFAULT NULL,
  `status` enum('pending', 'accepted', 'rejected') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 11 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: company_whatsapp_settings
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `company_whatsapp_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) NOT NULL,
  `phone_number` varchar(50) DEFAULT NULL,
  `status` enum(
  'DISCONNECTED',
  'CONNECTING',
  'QR_READY',
  'AUTHENTICATING',
  'CONNECTED',
  'ERROR'
  ) DEFAULT 'DISCONNECTED',
  `qr_code` longtext DEFAULT NULL,
  `connected_at` datetime DEFAULT NULL,
  `last_seen_at` datetime DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `notify_attendance` tinyint(1) DEFAULT 1,
  `notify_leaves` tinyint(1) DEFAULT 1,
  `notify_claims` tinyint(1) DEFAULT 1,
  `notify_payroll` tinyint(1) DEFAULT 1,
  `notify_admin_alerts` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_id` (`company_id`),
  KEY `idx_whatsapp_company` (`company_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 6 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: email_logs
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `payroll_id` int(11) DEFAULT NULL,
  `employee_id` int(11) NOT NULL,
  `status` enum('queued', 'processing', 'failed', 'sent') DEFAULT 'queued',
  `priority` enum('low', 'medium', 'high') DEFAULT 'medium',
  `retry_count` int(11) DEFAULT 0,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `email_logs_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: employees
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `employees` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `machine_id` varchar(50) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `role` enum('admin', 'employee') DEFAULT 'employee',
  `department` varchar(100) DEFAULT 'General',
  `email` varchar(150) DEFAULT NULL,
  `salary_rate` decimal(10, 2) DEFAULT 0.00,
  `salary_type` enum('hourly', 'daily', 'monthly') DEFAULT 'hourly',
  `status` enum('active', 'on_leave', 'terminated') DEFAULT 'active',
  `joined_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `custom_id` varchar(100) DEFAULT '',
  `shift` enum('Morning Shift', 'Evening Shift', 'Night Shift') DEFAULT 'Morning Shift',
  `phone` varchar(30) DEFAULT '',
  `photo` longtext DEFAULT NULL,
  `uif_number` varchar(100) DEFAULT '',
  `is_uif_registered` tinyint(1) DEFAULT 1,
  `advance_balance` decimal(10, 2) DEFAULT 0.00,
  `signature` longtext DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `company_id` bigint(20) DEFAULT NULL,
  `assigned_branch` varchar(150) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `contribution_applicable` tinyint(1) DEFAULT 0,
  `employee_contribution_percentage` decimal(5, 2) DEFAULT NULL,
  `employer_contribution_percentage` decimal(5, 2) DEFAULT NULL,
  `advance_installment` decimal(10, 2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_company_machine` (`company_id`, `machine_id`),
  UNIQUE KEY `unique_company_custom` (`company_id`, `custom_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 16 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: enquiries
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `enquiries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `status` enum('pending', 'resolved') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 7 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: face_embeddings
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `face_embeddings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `descriptor` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`descriptor`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_employee_face` (`employee_id`),
  CONSTRAINT `face_embeddings_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 8 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: face_logs
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `face_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `status` enum('success', 'failure') NOT NULL,
  `confidence` decimal(5, 4) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `face_logs_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 18 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: geofences
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `geofences` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `address` text DEFAULT NULL,
  `latitude` decimal(10, 7) DEFAULT NULL,
  `longitude` decimal(10, 7) DEFAULT NULL,
  `radius` int(11) DEFAULT 100,
  `status` enum('Active', 'Inactive') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `geofences_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 4 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: global_settings
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `global_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `platform_name` varchar(255) DEFAULT 'Nexus HRM Pro',
  `support_email` varchar(255) DEFAULT 'support@nexushrm.com',
  `timezone` varchar(100) DEFAULT 'Asia/Kolkata',
  `currency` varchar(20) DEFAULT 'INR',
  `date_format` varchar(20) DEFAULT 'DD/MM/YYYY',
  `language` varchar(50) DEFAULT 'English',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `notifications` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`notifications`)),
  `company_name` varchar(255) DEFAULT NULL,
  `company_logo` longtext DEFAULT NULL,
  `company_address` text DEFAULT NULL,
  `contact_number` varchar(50) DEFAULT NULL,
  `about_us` text DEFAULT NULL,
  `social_linkedin` varchar(500) DEFAULT NULL,
  `social_facebook` varchar(500) DEFAULT NULL,
  `social_instagram` varchar(500) DEFAULT NULL,
  `social_twitter` varchar(500) DEFAULT NULL,
  `social_youtube` varchar(500) DEFAULT NULL,
  `privacy_policy` longtext DEFAULT NULL,
  `terms_conditions` longtext DEFAULT NULL,
  `copyright_text` varchar(500) DEFAULT NULL,
  `whatsapp_number` varchar(50) DEFAULT NULL,
  `powered_by` varchar(255) DEFAULT 'Kiaan Technology',
  `company_website` varchar(255) DEFAULT 'https://kiaantechnology.com/',
  `country` varchar(100) DEFAULT 'India',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 2 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: in_app_notifications
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `in_app_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` enum('info', 'warning', 'success', 'error') DEFAULT 'info',
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `in_app_notifications_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `in_app_notifications_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 34 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: invoices
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `invoices` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(50) NOT NULL,
  `company_id` bigint(20) NOT NULL,
  `subscription_id` bigint(20) DEFAULT NULL,
  `plan_name` varchar(100) NOT NULL,
  `billing_cycle` varchar(50) NOT NULL DEFAULT 'monthly',
  `amount` decimal(10, 2) NOT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'INR',
  `payment_status` enum('paid', 'failed', 'pending', 'refunded') NOT NULL DEFAULT 'paid',
  `payment_method` varchar(50) DEFAULT 'razorpay',
  `razorpay_order_id` varchar(100) DEFAULT NULL,
  `razorpay_payment_id` varchar(100) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `customer_email` varchar(255) DEFAULT NULL,
  `customer_phone` varchar(50) DEFAULT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `invoice_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_number` (`invoice_number`),
  KEY `idx_company` (`company_id`),
  KEY `idx_invoice_num` (`invoice_number`),
  KEY `idx_payment_id` (`razorpay_payment_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 8 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: kiosk_settings
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `kiosk_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) DEFAULT NULL,
  `kiosk_name` varchar(150) DEFAULT 'Reception Tablet A',
  `branch` varchar(150) DEFAULT '',
  `status` enum('Active', 'Inactive') DEFAULT 'Active',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `kiosk_settings_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: kpis
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `kpis` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) DEFAULT NULL,
  `employee_id` int(11) NOT NULL,
  `employee_name` varchar(100) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `attendance_score` int(11) DEFAULT 0,
  `task_score` int(11) DEFAULT 0,
  `overall_score` int(11) DEFAULT 0,
  `rating` enum('Excellent', 'Good', 'Average', 'Needs Improvement') DEFAULT 'Average',
  `review_period` varchar(50) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `kpis_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kpis_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: leave_balances
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `leave_balances` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) DEFAULT NULL,
  `employee_id` int(11) NOT NULL,
  `annual` int(11) DEFAULT 15,
  `sick` int(11) DEFAULT 10,
  `unpaid` int(11) DEFAULT 20,
  `emergency` int(11) DEFAULT 5,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `leave_balances_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leave_balances_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: leaves
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `leaves` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) DEFAULT NULL,
  `employee_id` int(11) NOT NULL,
  `employee_name` varchar(100) DEFAULT NULL,
  `leave_type` enum(
  'Annual Leave',
  'Sick Leave',
  'Unpaid Leave',
  'Emergency Leave'
  ) DEFAULT 'Annual Leave',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `days` decimal(4, 1) DEFAULT 1.0,
  `half_day` tinyint(1) DEFAULT 0,
  `reason` text DEFAULT NULL,
  `status` enum('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
  `applied_date` date DEFAULT NULL,
  `attachment` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `admin_hidden` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `leaves_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leaves_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 6 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: password_resets
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(150) NOT NULL,
  `otp` varchar(10) NOT NULL,
  `token` varchar(100) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_email_otp` (`email`, `otp`),
  KEY `idx_token` (`token`)
) ENGINE = InnoDB AUTO_INCREMENT = 8 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: payment_transactions
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) DEFAULT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  `plan_name` varchar(100) NOT NULL,
  `billing_cycle` varchar(50) DEFAULT 'monthly',
  `amount` decimal(10, 2) NOT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'INR',
  `razorpay_order_id` varchar(100) NOT NULL,
  `razorpay_payment_id` varchar(100) DEFAULT NULL,
  `razorpay_signature` varchar(255) DEFAULT NULL,
  `payment_status` enum('pending', 'success', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  `payment_method` varchar(50) DEFAULT NULL,
  `error_code` varchar(100) DEFAULT NULL,
  `error_description` text DEFAULT NULL,
  `notes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`notes`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `razorpay_order_id` (`razorpay_order_id`),
  KEY `idx_txn_company` (`company_id`),
  KEY `idx_txn_order` (`razorpay_order_id`),
  KEY `idx_txn_payment` (`razorpay_payment_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 11 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: payroll
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `payroll` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `cycle_start` date NOT NULL,
  `cycle_end` date NOT NULL,
  `status` enum('pending', 'paid') DEFAULT 'pending',
  `total_hours` decimal(10, 2) DEFAULT 0.00,
  `gross_earnings` decimal(10, 2) DEFAULT 0.00,
  `base_salary` decimal(10, 2) DEFAULT 0.00,
  `deductions` decimal(10, 2) DEFAULT 0.00,
  `uif_amount` decimal(10, 2) DEFAULT 0.00,
  `advance_deduction` decimal(10, 2) DEFAULT 0.00,
  `overtime` decimal(10, 2) DEFAULT 0.00,
  `net_salary` decimal(10, 2) DEFAULT 0.00,
  `shifts_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`shifts_data`)),
  `company_id` bigint(20) DEFAULT NULL,
  `pdf_path` varchar(255) DEFAULT NULL,
  `cpf_employee` decimal(10, 2) DEFAULT 0.00,
  `cpf_employer` decimal(10, 2) DEFAULT 0.00,
  `cpf_total` decimal(10, 2) DEFAULT 0.00,
  `employee_contribution` decimal(10, 2) DEFAULT 0.00,
  `employer_contribution` decimal(10, 2) DEFAULT 0.00,
  `total_contribution` decimal(10, 2) DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `payroll_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 5 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: plan_requests
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `plan_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) NOT NULL,
  `requested_plan` varchar(255) NOT NULL,
  `status` enum('pending', 'approved', 'rejected') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 14 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: plans
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `price` varchar(100) DEFAULT NULL,
  `duration` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `features` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`features`)),
  `buttonText` varchar(100) DEFAULT NULL,
  `isPopular` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` bigint(20) DEFAULT NULL,
  `employee_limit` int(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 8 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: public_holidays
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `public_holidays` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `holiday_name` varchar(150) NOT NULL,
  `holiday_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `holiday_date` (`holiday_date`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: settings
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `machine_ip` varchar(50) DEFAULT NULL,
  `machine_port` int(11) DEFAULT 4370,
  `machine_alias` varchar(100) DEFAULT 'Main Entrance',
  `sync_interval` int(11) DEFAULT 30,
  `late_deduction` tinyint(1) DEFAULT 1,
  `late_deduction_amount` decimal(10, 2) DEFAULT 50.00,
  `salary_cycle` varchar(50) DEFAULT '15 Days Cycle',
  `ot_multiplier` decimal(4, 2) DEFAULT 1.50,
  `business_name` varchar(150) DEFAULT 'Kiaan HRM Pro',
  `business_address` text DEFAULT NULL,
  `business_phone` varchar(50) DEFAULT '',
  `business_email` varchar(150) DEFAULT '',
  `standard_start_time` time DEFAULT '09:00:00',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `company_id` bigint(20) DEFAULT NULL,
  `timezone` varchar(100) DEFAULT NULL,
  `currency` varchar(20) DEFAULT NULL,
  `date_format` varchar(20) DEFAULT NULL,
  `language` varchar(50) DEFAULT NULL,
  `grace_period_mins` int(11) DEFAULT 15,
  `standard_end_time` time DEFAULT '17:00:00',
  `weekends` varchar(100) DEFAULT 'Saturday,Sunday',
  `salary_cycle_start_date` int(11) DEFAULT 1,
  `notify_leaves` tinyint(1) DEFAULT 1,
  `notify_claims` tinyint(1) DEFAULT 1,
  `notify_password_resets` tinyint(1) DEFAULT 1,
  `contribution_enabled` tinyint(1) DEFAULT 0,
  `default_employee_contribution_percentage` decimal(5, 2) DEFAULT 0.00,
  `default_employer_contribution_percentage` decimal(5, 2) DEFAULT 0.00,
  `country` varchar(100) DEFAULT 'India',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 16 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: subscription_history
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `subscription_history` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) NOT NULL,
  `previous_plan` varchar(100) DEFAULT NULL,
  `new_plan` varchar(100) NOT NULL,
  `previous_employee_limit` int(11) DEFAULT 0,
  `new_employee_limit` int(11) NOT NULL DEFAULT 0,
  `previous_end_date` date DEFAULT NULL,
  `new_end_date` date NOT NULL,
  `change_type` enum(
  'initial',
  'renewal',
  'upgrade',
  'downgrade',
  'manual'
  ) NOT NULL,
  `amount` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `changed_by` varchar(100) NOT NULL DEFAULT 'system',
  `razorpay_payment_id` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_subhist_company` (`company_id`),
  KEY `idx_subhist_type` (`change_type`)
) ENGINE = InnoDB AUTO_INCREMENT = 8 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: subscriptions
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) DEFAULT NULL,
  `plan_name` varchar(100) DEFAULT NULL,
  `amount` decimal(10, 2) DEFAULT NULL,
  `billing_cycle` varchar(50) DEFAULT NULL,
  `payment_status` enum('paid', 'pending', 'failed') DEFAULT 'pending',
  `order_id` varchar(100) DEFAULT NULL,
  `payment_id` varchar(100) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 36 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: support_ticket_messages
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `support_ticket_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ticket_id` int(11) NOT NULL,
  `sender_id` int(11) NOT NULL,
  `sender_role` enum('superadmin', 'admin') NOT NULL,
  `sender_name` varchar(150) NOT NULL,
  `message` text NOT NULL,
  `attachment_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `ticket_id` (`ticket_id`),
  CONSTRAINT `support_ticket_messages_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 3 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: support_tickets
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ticket_number` varchar(20) DEFAULT NULL,
  `company_id` bigint(20) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `message` text DEFAULT NULL,
  `attachment_url` varchar(500) DEFAULT NULL,
  `status` enum('pending', 'seen', 'solved') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_number` (`ticket_number`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `support_tickets_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 2 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: system_logs
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `system_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `action` varchar(255) DEFAULT NULL,
  `role` varchar(50) DEFAULT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  `ip_address` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: unknown_attempts
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `unknown_attempts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `photo` longtext DEFAULT NULL,
  `confidence` decimal(5, 4) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 16 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: users
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) DEFAULT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('superadmin', 'admin', 'employee', 'Master Admin') NOT NULL,
  `name` varchar(100) DEFAULT '',
  `photo` longtext DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `company_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_company_user_email` (`company_id`, `email`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE
  SET
  NULL
) ENGINE = InnoDB AUTO_INCREMENT = 37 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: whatsapp_logs
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `whatsapp_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` bigint(20) NOT NULL,
  `recipient_phone` varchar(50) NOT NULL,
  `recipient_name` varchar(150) DEFAULT NULL,
  `recipient_role` varchar(50) DEFAULT 'employee',
  `event_type` varchar(100) NOT NULL,
  `message` text NOT NULL,
  `status` enum('QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED') DEFAULT 'QUEUED',
  `provider_message_id` varchar(255) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_wlog_company` (`company_id`),
  KEY `idx_wlog_created` (`created_at`)
) ENGINE = InnoDB AUTO_INCREMENT = 9 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: attendance
# ------------------------------------------------------------

INSERT INTO
  `attendance` (
    `id`,
    `employee_id`,
    `date`,
    `in_time`,
    `out_time`,
    `total_hours`,
    `status`,
    `marked_by`,
    `company_id`
  )
VALUES
  (
    19,
    15,
    '2026-10-01',
    '2026-10-01 09:00:00',
    '2026-10-01 17:00:00',
    8.00,
    'present',
    NULL,
    26
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: audit_logs
# ------------------------------------------------------------

INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    1,
    4,
    NULL,
    'ADD_MANUAL_ATTENDANCE',
    5,
    '{\"date\":\"2026-06-22\",\"status\":\"late\"}',
    '2026-06-22 12:59:18'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    2,
    1,
    NULL,
    'CREATE COMPANY',
    13,
    '{\"info\":\"Created company: admin\",\"email\":\"admin@gmail.com\",\"plan\":\"Free Plan\"}',
    '2026-08-19 17:33:51'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    3,
    1,
    NULL,
    'CREATE COMPANY',
    14,
    '{\"info\":\"Created company: admin\",\"email\":\"admin@gmail.com\",\"plan\":\"Free Plan\",\"durationDays\":7}',
    '2026-08-19 17:42:57'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    4,
    1,
    NULL,
    'CREATE COMPANY',
    15,
    '{\"info\":\"Created company: admin\",\"email\":\"admin@gmail.com\",\"plan\":\"Free Plan\",\"durationDays\":7}',
    '2026-08-19 17:44:18'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    5,
    1,
    NULL,
    'CREATE COMPANY',
    16,
    '{\"info\":\"Created company: Admin\",\"email\":\"admin@gmail.com\",\"plan\":\"Free Plan\",\"durationDays\":7}',
    '2026-08-19 17:50:51'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    6,
    1,
    NULL,
    'CREATE COMPANY',
    17,
    '{\"info\":\"Created company: Admin\",\"email\":\"admin@gmail.com\",\"plan\":\"Free Plan\",\"durationDays\":7}',
    '2026-08-19 17:59:13'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    7,
    24,
    NULL,
    'SUBSCRIPTION_PAYMENT_SUCCESS',
    21,
    '{\"plan\":\"Starter Plan\",\"amount\":\"999.00\",\"order_id\":\"order_test_1787216218405\",\"payment_id\":\"pay_test_1787216218405\",\"changeType\":\"initial\",\"endDate\":\"2026-09-19\"}',
    '2026-08-20 14:26:58'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    8,
    25,
    NULL,
    'SUBSCRIPTION_PAYMENT_SUCCESS',
    22,
    '{\"plan\":\"Starter Plan\",\"amount\":\"1.00\",\"order_id\":\"order_TRxrLk7x3NryiM\",\"payment_id\":\"pay_TRxsFIa2K3qvMe\",\"changeType\":\"initial\",\"endDate\":\"2026-09-19\"}',
    '2026-08-20 14:29:09'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    9,
    25,
    NULL,
    'SUBSCRIPTION_PAYMENT_SUCCESS',
    22,
    '{\"plan\":\"Pro Plan\",\"amount\":\"1.00\",\"order_id\":\"order_TRyArWPvZr5tnH\",\"payment_id\":\"pay_TRyBAOtYSwp0xm\",\"changeType\":\"upgrade\",\"endDate\":\"2026-09-19\"}',
    '2026-08-20 14:40:34'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    10,
    25,
    NULL,
    'ADD_MANUAL_ATTENDANCE',
    7,
    '{\"date\":\"2026-08-20\",\"status\":\"present\"}',
    '2026-08-20 15:28:51'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    11,
    25,
    NULL,
    'ADD_MANUAL_ATTENDANCE',
    8,
    '{\"date\":\"2026-08-20\",\"status\":\"present\"}',
    '2026-08-20 16:48:05'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    12,
    29,
    NULL,
    'SUBSCRIPTION_PAYMENT_SUCCESS',
    24,
    '{\"plan\":\"Pro Plan\",\"amount\":\"1.00\",\"order_id\":\"order_TSJjOgGmgKd3S4\",\"payment_id\":\"pay_TSJjiJcHLAZ1Zm\",\"changeType\":\"initial\",\"endDate\":\"2026-09-20\"}',
    '2026-08-21 11:45:51'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    13,
    34,
    NULL,
    'SUBSCRIPTION_PAYMENT_SUCCESS',
    25,
    '{\"plan\":\"Standard Plan\",\"amount\":\"1.00\",\"order_id\":\"order_TTvCsh527n4BH2\",\"payment_id\":\"pay_TTvDL7YvFZIh8c\",\"changeType\":\"initial\",\"endDate\":\"2026-10-01\"}',
    '2026-08-25 13:04:30'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    14,
    1,
    NULL,
    'CREATE COMPANY',
    26,
    '{\"info\":\"Created company: Sonu and Sons \",\"email\":\"sonu@gmail.com\",\"plan\":\"Standard Plan\",\"durationDays\":30}',
    '2026-09-30 11:16:16'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    15,
    35,
    26,
    'SEND_DIRECT_MESSAGE',
    15,
    '{\"subject\":\"Hloo\",\"channels\":\"whatsapp\",\"target_audience\":\"individual\",\"target_department\":\"General\",\"recipients\":1,\"email_sent\":0,\"whatsapp_sent\":1}',
    '2026-10-01 11:15:57'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    16,
    35,
    26,
    'SEND_DIRECT_MESSAGE',
    15,
    '{\"subject\":\"hy\",\"channels\":\"both\",\"target_audience\":\"individual\",\"target_department\":\"General\",\"recipients\":1,\"email_sent\":1,\"whatsapp_sent\":1}',
    '2026-10-01 11:19:54'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    17,
    35,
    NULL,
    'ADD_MANUAL_ATTENDANCE',
    15,
    '{\"date\":\"2026-10-01\",\"status\":\"present\"}',
    '2026-10-01 11:22:03'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    18,
    35,
    26,
    'DISPATCH_ANNOUNCEMENT',
    15,
    '{\"subject\":\"hyy\",\"channels\":\"whatsapp\",\"target_audience\":\"all\",\"target_department\":\"General\",\"recipients\":1,\"email_sent\":0,\"whatsapp_sent\":1}',
    '2026-10-01 11:22:47'
  );
INSERT INTO
  `audit_logs` (
    `id`,
    `admin_id`,
    `company_id`,
    `action`,
    `target_id`,
    `details`,
    `created_at`
  )
VALUES
  (
    19,
    35,
    26,
    'SEND_DIRECT_MESSAGE',
    15,
    '{\"subject\":\"hyty\",\"channels\":\"email\",\"target_audience\":\"individual\",\"target_department\":\"General\",\"recipients\":1,\"email_sent\":1,\"whatsapp_sent\":0}',
    '2026-10-01 12:19:28'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: broadcast_messages
# ------------------------------------------------------------

INSERT INTO
  `broadcast_messages` (
    `id`,
    `company_id`,
    `sender_id`,
    `sender_name`,
    `message_type`,
    `channels`,
    `target_audience`,
    `target_department`,
    `target_employee_id`,
    `target_employee_name`,
    `subject`,
    `message_text`,
    `priority`,
    `total_recipients`,
    `email_sent_count`,
    `email_failed_count`,
    `whatsapp_sent_count`,
    `whatsapp_failed_count`,
    `status`,
    `created_at`
  )
VALUES
  (
    1,
    26,
    35,
    'Company Admin',
    'personal',
    'whatsapp',
    'individual',
    'General',
    15,
    'Rohit Sharma ',
    'Hloo',
    'Sonu & sons',
    'normal',
    1,
    0,
    0,
    1,
    0,
    'COMPLETED',
    '2026-10-01 11:15:57'
  );
INSERT INTO
  `broadcast_messages` (
    `id`,
    `company_id`,
    `sender_id`,
    `sender_name`,
    `message_type`,
    `channels`,
    `target_audience`,
    `target_department`,
    `target_employee_id`,
    `target_employee_name`,
    `subject`,
    `message_text`,
    `priority`,
    `total_recipients`,
    `email_sent_count`,
    `email_failed_count`,
    `whatsapp_sent_count`,
    `whatsapp_failed_count`,
    `status`,
    `created_at`
  )
VALUES
  (
    2,
    26,
    35,
    'Company Admin',
    'personal',
    'both',
    'individual',
    'General',
    15,
    'Rohit Sharma ',
    'hy',
    'sonu',
    'normal',
    1,
    1,
    0,
    1,
    0,
    'COMPLETED',
    '2026-10-01 11:19:54'
  );
INSERT INTO
  `broadcast_messages` (
    `id`,
    `company_id`,
    `sender_id`,
    `sender_name`,
    `message_type`,
    `channels`,
    `target_audience`,
    `target_department`,
    `target_employee_id`,
    `target_employee_name`,
    `subject`,
    `message_text`,
    `priority`,
    `total_recipients`,
    `email_sent_count`,
    `email_failed_count`,
    `whatsapp_sent_count`,
    `whatsapp_failed_count`,
    `status`,
    `created_at`
  )
VALUES
  (
    3,
    26,
    35,
    'Company Admin',
    'broadcast',
    'whatsapp',
    'all',
    'General',
    15,
    'Rohit Sharma ',
    'hyy',
    'hyy',
    'urgent',
    1,
    0,
    0,
    1,
    0,
    'COMPLETED',
    '2026-10-01 11:22:47'
  );
INSERT INTO
  `broadcast_messages` (
    `id`,
    `company_id`,
    `sender_id`,
    `sender_name`,
    `message_type`,
    `channels`,
    `target_audience`,
    `target_department`,
    `target_employee_id`,
    `target_employee_name`,
    `subject`,
    `message_text`,
    `priority`,
    `total_recipients`,
    `email_sent_count`,
    `email_failed_count`,
    `whatsapp_sent_count`,
    `whatsapp_failed_count`,
    `status`,
    `created_at`
  )
VALUES
  (
    4,
    26,
    35,
    'Company Admin',
    'personal',
    'email',
    'individual',
    'General',
    15,
    'Rohit Sharma ',
    'hyty',
    'hy',
    'normal',
    1,
    1,
    0,
    0,
    0,
    'COMPLETED',
    '2026-10-01 12:19:28'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: claims
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: companies
# ------------------------------------------------------------

INSERT INTO
  `companies` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `phone`,
    `address`,
    `plan`,
    `employee_limit`,
    `status`,
    `subscription_start`,
    `subscription_end`,
    `created_by`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    8,
    'd',
    'fdg',
    'fesw@fe.gre',
    '1234567894',
    NULL,
    '4',
    0,
    '',
    NULL,
    NULL,
    NULL,
    '2026-06-20 12:59:43',
    '2026-06-20 12:59:43'
  );
INSERT INTO
  `companies` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `phone`,
    `address`,
    `plan`,
    `employee_limit`,
    `status`,
    `subscription_start`,
    `subscription_end`,
    `created_by`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    9,
    'efwt',
    'wertghad',
    'cfgh@gd.fe',
    '23456783',
    NULL,
    '5',
    0,
    '',
    NULL,
    NULL,
    NULL,
    '2026-06-20 13:00:02',
    '2026-06-20 13:00:02'
  );
INSERT INTO
  `companies` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `phone`,
    `address`,
    `plan`,
    `employee_limit`,
    `status`,
    `subscription_start`,
    `subscription_end`,
    `created_by`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    10,
    'rtygh',
    'srfg',
    'rdt@rg.fw',
    's123456783',
    NULL,
    '6',
    0,
    '',
    NULL,
    NULL,
    NULL,
    '2026-06-20 13:00:24',
    '2026-06-20 13:00:24'
  );
INSERT INTO
  `companies` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `phone`,
    `address`,
    `plan`,
    `employee_limit`,
    `status`,
    `subscription_start`,
    `subscription_end`,
    `created_by`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    26,
    'Sonu and Sons ',
    'Sonu ',
    'sonu@gmail.com',
    '64366436',
    NULL,
    'Standard Plan',
    100,
    'active',
    NULL,
    NULL,
    1,
    '2026-09-30 11:16:16',
    '2026-09-30 11:16:16'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: company_backup_schedules
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: company_email_settings
# ------------------------------------------------------------

INSERT INTO
  `company_email_settings` (
    `id`,
    `company_id`,
    `smtp_host`,
    `smtp_port`,
    `smtp_user`,
    `smtp_pass`,
    `sender_email`,
    `sender_name`,
    `is_active`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    1,
    26,
    'smtp.gmail.com',
    587,
    'yashuchoudhary3621@gmail.com',
    '3547809fe8c215f0ce4969625d228795:6b118c2341a0f533988a2bc4b99d96e15affaedc9ece1ccce241a1db8bfe36de',
    'yashuchoudhary3621@gmail.com',
    'hr department',
    1,
    '2026-09-30 12:26:15',
    '2026-09-30 14:59:33'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: company_requests
# ------------------------------------------------------------

INSERT INTO
  `company_requests` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `password`,
    `phone`,
    `plan`,
    `status`,
    `created_at`
  )
VALUES
  (
    1,
    'demoo',
    'demo Yadav',
    'demo@gmail.comm',
    '$2a$10$GChDEgHVbdhBg07M5/GaL.aYsZP.YZqUwW/ouYNU36J94.GdSnJxO',
    '',
    'Low',
    'rejected',
    '2026-06-19 11:52:14'
  );
INSERT INTO
  `company_requests` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `password`,
    `phone`,
    `plan`,
    `status`,
    `created_at`
  )
VALUES
  (
    2,
    'genpro',
    'genius',
    'genius@gmail.com',
    '$2a$10$K.W/mxRZOAwNX3UlPh9E..fRmhLsiDvm4T0cHbFC7b7ZHlJl7gSNG',
    '',
    'Medium',
    'accepted',
    '2026-06-20 11:36:46'
  );
INSERT INTO
  `company_requests` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `password`,
    `phone`,
    `plan`,
    `status`,
    `created_at`
  )
VALUES
  (
    3,
    'test',
    'qwert',
    'wer@dad.ees',
    '$2a$10$Zfi4Ssykzik/xn2M1Ei4gOYH4pO3c33gvEk6qoklaC7BM4amQZj3O',
    '123456789098',
    'Medium',
    'rejected',
    '2026-06-20 12:47:09'
  );
INSERT INTO
  `company_requests` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `password`,
    `phone`,
    `plan`,
    `status`,
    `created_at`
  )
VALUES
  (
    4,
    'd',
    'fdg',
    'fesw@fe.gre',
    '$2a$10$zOXyMSxca5W5CvR.d0WmY.06u6qIqd0sWPUk00wPYJyh/PH25PSAm',
    '1234567894',
    '4',
    'rejected',
    '2026-06-20 12:59:43'
  );
INSERT INTO
  `company_requests` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `password`,
    `phone`,
    `plan`,
    `status`,
    `created_at`
  )
VALUES
  (
    5,
    'efwt',
    'wertghad',
    'cfgh@gd.fe',
    '$2a$10$Oo8gLKi6L8ryiQ1KBvt5MugoSKzYkbKn981Rjg4U/r459ryX76Z4a',
    '23456783',
    '5',
    'rejected',
    '2026-06-20 13:00:02'
  );
INSERT INTO
  `company_requests` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `password`,
    `phone`,
    `plan`,
    `status`,
    `created_at`
  )
VALUES
  (
    6,
    'rtygh',
    'srfg',
    'rdt@rg.fw',
    '$2a$10$4D4cH4F/0kRli2EoJ0BHOOs0iEv6lJK.UTSG8Paik7U4lMHvFfZaO',
    's123456783',
    '6',
    'rejected',
    '2026-06-20 13:00:24'
  );
INSERT INTO
  `company_requests` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `password`,
    `phone`,
    `plan`,
    `status`,
    `created_at`
  )
VALUES
  (
    7,
    'qwer',
    'dgveds',
    'd@edfd.d',
    '$2a$10$d7rzjZc3/wF3Di/y5HHQTejORuqXuVfxHv4ZvILja2YPvUNv0uR4K',
    '123456782',
    '5',
    'rejected',
    '2026-06-20 14:37:49'
  );
INSERT INTO
  `company_requests` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `password`,
    `phone`,
    `plan`,
    `status`,
    `created_at`
  )
VALUES
  (
    8,
    'qwerty',
    'qwerty',
    'qwerty@gmail.com',
    '$2a$10$wd9/ziyWQM68m/9t74DhiuZe/2W.DCl7kXG/exi3teXPWYheq/.zG',
    '',
    'Free Plan',
    'accepted',
    '2026-08-20 12:01:18'
  );
INSERT INTO
  `company_requests` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `password`,
    `phone`,
    `plan`,
    `status`,
    `created_at`
  )
VALUES
  (
    9,
    'qwerty',
    'qwerty',
    'qwertyuio@gmail.com',
    '$2a$10$rshTH6o8Ae7wGrOHwpbqce3aUIBPnSNn4VHUeOx3YYMIko6VrF65W',
    '1234563456',
    'Free Trial',
    'accepted',
    '2026-08-21 11:28:42'
  );
INSERT INTO
  `company_requests` (
    `id`,
    `company_name`,
    `owner_name`,
    `email`,
    `password`,
    `phone`,
    `plan`,
    `status`,
    `created_at`
  )
VALUES
  (
    10,
    'demo',
    'testing',
    'demogmail01@gmail.com',
    '$2a$10$CU8nnjk0WLVLpOqO5C7Zm.JC8kxdkQJosWOS5Z00PLjlakw6q7zm.',
    '1234567890',
    'Free Trial',
    'accepted',
    '2026-08-25 13:01:45'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: company_whatsapp_settings
# ------------------------------------------------------------

INSERT INTO
  `company_whatsapp_settings` (
    `id`,
    `company_id`,
    `phone_number`,
    `status`,
    `qr_code`,
    `connected_at`,
    `last_seen_at`,
    `last_error`,
    `notify_attendance`,
    `notify_leaves`,
    `notify_claims`,
    `notify_payroll`,
    `notify_admin_alerts`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    3,
    26,
    NULL,
    'QR_READY',
    'data:image/png;base64,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',
    NULL,
    '2026-10-01 11:18:57',
    NULL,
    1,
    1,
    1,
    1,
    1,
    '2026-09-30 18:05:16',
    '2026-10-01 15:19:07'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: email_logs
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: employees
# ------------------------------------------------------------

INSERT INTO
  `employees` (
    `id`,
    `machine_id`,
    `name`,
    `role`,
    `department`,
    `email`,
    `salary_rate`,
    `salary_type`,
    `status`,
    `joined_date`,
    `created_at`,
    `custom_id`,
    `shift`,
    `phone`,
    `photo`,
    `uif_number`,
    `is_uif_registered`,
    `advance_balance`,
    `signature`,
    `created_by`,
    `company_id`,
    `assigned_branch`,
    `date_of_birth`,
    `contribution_applicable`,
    `employee_contribution_percentage`,
    `employer_contribution_percentage`,
    `advance_installment`
  )
VALUES
  (
    15,
    '1001',
    'Rohit Sharma ',
    'employee',
    'General',
    'yashuchoudhary.com@gmail.com',
    80000.00,
    'monthly',
    'active',
    '2026-09-30',
    '2026-09-30 11:55:18',
    '1001',
    'Morning Shift',
    '8319399018',
    NULL,
    NULL,
    1,
    -9.00,
    NULL,
    35,
    26,
    NULL,
    '2026-09-01',
    0,
    NULL,
    NULL,
    NULL
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: enquiries
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: face_embeddings
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: face_logs
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: geofences
# ------------------------------------------------------------

INSERT INTO
  `geofences` (
    `id`,
    `company_id`,
    `name`,
    `address`,
    `latitude`,
    `longitude`,
    `radius`,
    `status`,
    `created_at`
  )
VALUES
  (
    2,
    26,
    'nan',
    'nan',
    22.6903920,
    75.8286740,
    100,
    'Inactive',
    '2026-10-01 12:55:37'
  );
INSERT INTO
  `geofences` (
    `id`,
    `company_id`,
    `name`,
    `address`,
    `latitude`,
    `longitude`,
    `radius`,
    `status`,
    `created_at`
  )
VALUES
  (
    3,
    26,
    'main',
    'Paliya, Hatod Tahsil, Indore, Madhya Pradesh, India',
    22.6903640,
    75.8286640,
    100,
    'Active',
    '2026-10-01 14:55:29'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: global_settings
# ------------------------------------------------------------

INSERT INTO
  `global_settings` (
    `id`,
    `platform_name`,
    `support_email`,
    `timezone`,
    `currency`,
    `date_format`,
    `language`,
    `updated_at`,
    `notifications`,
    `company_name`,
    `company_logo`,
    `company_address`,
    `contact_number`,
    `about_us`,
    `social_linkedin`,
    `social_facebook`,
    `social_instagram`,
    `social_twitter`,
    `social_youtube`,
    `privacy_policy`,
    `terms_conditions`,
    `copyright_text`,
    `whatsapp_number`,
    `powered_by`,
    `company_website`,
    `country`
  )
VALUES
  (
    1,
    'Nexus HRM Pro',
    'info@kiaantechnology.com',
    'Asia/Kolkata',
    'INR',
    'DD/MM/YYYY',
    'English',
    '2026-09-30 11:29:58',
    '{\"emailNewCompany\":true,\"emailCompanyRequest\":true,\"emailPlanRenewalRequest\":true,\"systemNewLogin\":true,\"systemCompanyExpiry\":true,\"systemExpiry3Day\":true,\"systemExpiry1Day\":true,\"systemLowStorage\":false,\"digestFrequency\":\"daily\",\"emailNewEnquiry\":true}',
    'Nexus HRM pro',
    'data:image/png;base64,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Zty38JU3bln48rTrFr4y9ZqFj71yxWdPTrxy/uMvXD3v0UlXzn3huSvmvvTspXOff/bCOZOeOW/2pCfOnv3c42fOenziybMmPnLCrIcfPn7W/Q/8dea99x8388m7Tpw99tHjZl0y8fi5bz58wrw3Jhw79/qHjpp994N/nnnXA4d8+sAVv/90wtV//PihK//06d33/mH29fccPPvFu343d9Ktv5771I37zD7r2p998tg1P/v4wqt/9uHFV+zxwcWX7v7uZRfv8e7FF+854+IL95pxxUW7T//b+TtNO+f3u758wI49DsJP5OlXhrIzLtt74r23H/Hh3Tcf9sa464946/7rj3r7kfuO+fCRe//68bi7j/lw7N3HfXjPPSd+NHHCmZ9Mevqij5985IpPHnnqqo8ff/q6T55/6bZPX5x8x8xJT9wx6+Xnxs55bvL9s1964b75r06+b/bzk8bOfuXlh+a89Nzjc5577uE5U195bu7rU5+dN/W1J+dPmfzY/OmTn1ow7eUn50175RmmTZz3yquPznt9ysNzp06fMHf66xNmv/ba+DmvTnlgzhtvTpzz1muPzH3tjfGfvfra+PlvvvaQj2mvTVgwdcqEhW+/Mv7zKa88uHDK5PsXTnnp3kVTXr5nwZQX754/9aW75r364h3zX5l0+4IpL9w6f+qLt81/9flb5r4+5fr5r02+fv6UF69bMPXFa+ZNeeFv86a+ePW8Z567ePZTz14w++mnLpj95FPnzHr0sbNmPfXI6bM492Y+fP/Jnz50z3Efj7vz2E8en3Dcx4899NePHnvgrx/f9+CxHz467q8fPkL/Q+OO+uSB+4/49IH7jpx5351/mXXPLX+adfv1h8687ZpDP7n5qkNm3njlwTOvv+ygT2649HcfXX/JQR9ff8mBH9946e/ev/2KAz6886rfvX/zpQd8eP3Fv/3w6vN++9HFZ+z/8fVX/vLjK67Y99PLr9j700su32vmpVfsQXf3mZdcvvvMv1255yc3nfrzj24+dZ+PLj193w8vOm3fDy45ac8PLjphtw8vPH73D688f9cPLjln1/fOO2Ond889Y5d3zj1j57fPP2vXty85Y5e3Lz195zfPOm3n6WeeuuPrFx2585RLTt/l1cvO3O2VK47bY+q5x+3+yvnH7fbyBcfv/vJlJ+/58mWn/OzVS0/7+fSLTt97xoWn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uz0EPAT2EAQ8RWAPeZC7OoytdVg/c0l0xOjJa+/8csXivziQM+vr8327Wr45XwWQXLgDK96fX//OMxPX//kf784468+PvD3kltteOPTO+9+5ediImW99Omvz/DWb3c2baoza+lQ4ndby4PqUBGEbFjJCoiA/orVuUVDQpUOrtr27t+u+T9/u/Q7Yt8/Qww4a+KsjDx501mknHfrrs8448tYLzz/53t9efvojN1170dO/u+GyF/9w8+XDf3/DlWPuuP2GCXf86Zrxd952w8i//uVP7//t3j9/8Ltbrhl+1pknP37ggQfcdujBB92xz4CBN7dt3fo4TcqcqsrKORu2bv502454vHksnush8JMj4HVgd0TAVV9xWVCNzVNWJWZ+OK/6/WGfb33+ifEr77zjjdm/eeytaafe//SEo+565uOD7n5k/JC/Pjn60AdfGH32y+9Nu+29yQuHTfh8zYTP5ldOmb20ZsaKTemVW+r9dbV2fiYmWtACX46UUU6CXoaUVoa0WQ7HagU30AYItAVC7SCC7bJh6W8Dx9+Sa2dr2L5y5itHxmrBMmWIilLUogjbM7m1m6LBjSsqsWTu2oZpkxZs/WDcF2teGPnZyic+mLb8wXcmLbr2jYmLTxg2atEB/xi19OCXJqw8cPjE1ceM/mzrJa/Nqvrjh8uiT03e6Lz5RSU+XtiIFauBBj4Qm+LdHgIeAns4AtoePj5veP83AnL9emxduHDLitra2vr/O9supciFlYjNr0DFuIXJyc+O2vj3x/4+86I77ht31E13jTr65ttGH3fdHR+ecss9oy+467HJf3rs9fnPvTZu7Yj3pqwfNfKjlR9NmrZ2yrQvNn3+xdytCxYsq123botTXx31u43pMLbUOJm1W2J1C1du3jxz/uq1n81ZtvzzeStWzFywesncpavmfjR7xsS3J4x66olXhv3x3sdfvPbOB1+99u4H3/nNfY+MOfDuB8b0+/NfRne/96FxPR96+tN9Hh++6LRxc7a/uqIyua4W+E/HvEvAeJk8BDwE9kgE7Io61H25FevVKcKc9fhy8hJM/mBG+s1nPth+94jnV1z6wJsLTnnspbknPPzYrGPue3ba4fc98emv/vbs1JMfemHGqY88N/u8h16cffETbyy87NHXF13+6LBFlz4ybMEFD/5j3vn3vzznkgdenHOxch9+fd7lT7+z7IZXRlfcN/zjLQ8Nn1R1/6vjN97+wgerrn/inZUXPvTW8hMefHXxoPuHrRh87z9W7/fQsIpDnv5w6/Gvf1h/9uOTkle+OD3122EzUze9v9h97KN1GDltO6bPpmV/UT3WLoxi+yYgsUc+nZ/JoLxuegjsDgh4isDu8BT2wD5U8MRg8XZUzlgeWzRlSeP0sbNqR78xZdurT72/6p47npuJ51oAAALXSURBVJ1x1VP3jT/nr3dPPP33t0048f7Hxh97599HH3H7nSMPuvVPb+13059fGHjL7U/2v/7PTwy67W8vD7r9b28OvvevIwffdf+4wX94YPT+f7j/g31v+/v7+9/45/cPefC+8Sfe/ezMa54csfLeF0ateezlsasee3PK+qcmflk3df4mrFpWhVUrKrFucyOqCbNN8W4PAQ8BD4H/KgLqNwiVNI6s2IFGku7auWux4dPl9oyJ81KjR82MvvvB7IbX3p/Z+PKb02teeOuLmuffmlXz4vBZda++M6dh2LtzGl8aMa/xZeW+9Xn98698WvnwsxM3/OHx0Wtvemrs2t+9PGnbXW/OaHhk5NzYK1OWpEbOWIdZCzZj5ZoabFR/8a2iDnU7Cb7zXx2kV7mHgIfAHoGApwj8Tx+j19hOBFy1UVZQWdgCxOduQXwhN8353MDm7sDWmWuxasoSLJi2FLOmLsWXc9ZhxcIabFI/WlaEflMDaiqYt4bH196GtxNRz/EQ8BDY0xGQe/oAvfF5CHgI/O8R8BSB/z3mXoseAh4CvyQEvLF6CHgIeAh4CHgI7KYIeIrAbvpgvG55CHgIeAh4CHgIeAj8PBHweu0h8HNBwFMEfi5Pyuunh4CHgIeAh4CHgIeAh4CHgIfAj4iApwj8aGB6FXkIeAh4CHgIeAh4CHgIeAh4CPx8EPAUgZ/Ps/J66iHgIbC7IeD1x0PAQ8BDwEPAQ+BnjICnCPyMH57XdQ8BDwEPAQ8BDwEPgf8tAl5rHgJ7EgKeIrAnPU1vLB4CHgIeAh4CHgIeAh4CHgIeAruIgKcI7BJQXiYPAQ8BDwEPAQ8BDwEPAQ8BD4E9CwFPEdiznqc3Gg8BD4EfCwGvHg8BDwEPAQ8BD4E9HAFPEdjDH7A3PA8BDwEPAQ8BDwEPgV1DwMvlIfBLQ8BTBH5pT9wbr4eAh4CHgIeAh4CHgIeAh4CHAID/BwAA//+L+YU4AAAABklEQVQDAByD/nZ8hz6qAAAAAElFTkSuQmCC',
    'Indore, India',
    '+91 97521 00980',
    'Kiaan Technology is a modern software development company delivering innovative, secure, and scalable digital solutions. We specialize in Web Development, Mobile Apps, Custom Software, CRM/ERP Systems, AI Automation, and Cloud Solutions.\n\nOur goal is simple — to help businesses grow faster with smart technology, powerful automation, and reliable digital products.',
    'https://www.linkedin.com/company/89547261/',
    NULL,
    'https://www.instagram.com/kiaan_technology4/',
    NULL,
    'https://www.youtube.com/@kiaantechnology-r3p',
    'Privacy Policy\n\nLast Updated: August 2026\n\nKiaan Technology Private Limited (\"Kiaan Technology\", \"we\", \"our\", or \"us\") respects your privacy and is committed to protecting your personal information.\n\nThis Privacy Policy explains how we collect, use, store, and protect your information when you use our HRM SaaS platform (\"Service\").\n\nBy accessing or using our Service, you agree to the practices described in this Privacy Policy.\n\n1. Information We Collect\n\nWhen you use our HRM platform, we may collect the following information:\n\nCompany Information:\nCompany name\nBusiness details\nCompany address\nContact information\nSubscription and billing details\nUser Information:\nName\nEmail address\nPhone number\nLogin credentials\nRole and permission details\nEmployee Information:\nEmployee name\nEmployee ID\nContact details\nAttendance records\nLeave records\nPayroll information\nEmployment details\nTechnical Information:\nIP address\nBrowser information\nDevice information\nLogin activity\nSystem usage data\n2. How We Use Your Information\n\nWe use collected information to:\n\nProvide HR management services\nManage employee attendance and payroll\nProcess subscriptions and payments\nMaintain account security\nImprove platform performance\nProvide customer support\nSend important service notifications\nMaintain compliance and audit records\n3. Employee Data Management\n\nCompanies using our platform are responsible for the employee information they upload and manage.\n\nEach company acts as the data controller for its own employee data.\n\nKiaan Technology provides the platform and security infrastructure to help companies manage their HR operations.\n\n4. Payment Information\n\nPayments are processed securely through third-party payment providers such as Razorpay.\n\nWe do not store your complete payment card details.\n\nPayment information is handled according to the payment provider\'s privacy and security policies.\n\n5. Data Security\n\nWe implement reasonable security measures including:\n\nSecure authentication\nRole-based access control\nData isolation between companies\nEncrypted communication\nSecure database practices\nAccess monitoring\n\nHowever, no online platform can guarantee 100% security.\n\n6. Data Sharing\n\nWe do not sell, rent, or trade your personal information.\n\nWe may share information only when required:\n\nTo provide requested services\nWith trusted service providers\nTo comply with legal requirements\nTo protect our rights and users\n7. Data Retention\n\nWe retain information only for as long as required to:\n\nProvide the Service\nMaintain business records\nMeet legal obligations\nResolve disputes\n8. Your Rights\n\nYou may request:\n\nAccess to your data\nCorrection of inaccurate information\nAccount deletion (subject to legal requirements)\nInformation about how your data is processed\n9. Cookies\n\nWe may use cookies and similar technologies to:\n\nMaintain login sessions\nImprove user experience\nAnalyze platform usage\n10. Contact Us\n\nFor privacy-related questions:\n\nKiaan Technology Private Limited\n\nEmail:\nsupport@kiaantechnology.com',
    'Terms & Conditions\n\nLast Updated: August 2026\n\nWelcome to Kiaan Technology Private Limited\'s HRM SaaS platform.\n\nThese Terms & Conditions govern your access and use of our HR management software.\n\nBy creating an account or using our platform, you agree to these terms.\n\n1. Service Description\n\nKiaan Technology provides a cloud-based HR Management Software platform that helps businesses manage:\n\nEmployee records\nAttendance\nPayroll\nLeave management\nReports\nHR operations\nBusiness workflows\n2. Account Responsibility\n\nYou are responsible for:\n\nMaintaining account security\nKeeping login credentials confidential\nProviding accurate information\nManaging authorized users\n\nYou must immediately notify us of unauthorized account access.\n\n3. Subscription & Payments\n\nPaid features require an active subscription plan.\n\nSubscriptions are billed according to the selected plan.\n\nPayments are processed through secure third-party payment gateways.\n\nFailure to maintain an active subscription may result in restricted access to paid features.\n\n4. Free Trial\n\nWe may provide a free trial period for eligible users.\n\nTrial availability and duration may vary.\n\nAt the end of the trial period, users may need to purchase a paid subscription to continue accessing premium features.\n\n5. User Data Responsibility\n\nCustomers are responsible for:\n\nAccuracy of employee information\nLegal compliance of stored HR data\nObtaining necessary employee permissions\n\nKiaan Technology is not responsible for incorrect information entered by customers.\n\n6. Acceptable Usage\n\nUsers agree not to:\n\nMisuse the platform\nAttempt unauthorized access\nReverse engineer the software\nUpload illegal or harmful content\nViolate applicable laws\n7. Intellectual Property\n\nAll software, designs, features, trademarks, and content provided by Kiaan Technology remain the intellectual property of Kiaan Technology Private Limited.\n\nUsers receive a limited license to use the platform during their active subscription.\n\n8. Service Availability\n\nWe aim to maintain reliable service availability but do not guarantee uninterrupted operation due to:\n\nMaintenance\nThird-party service failures\nInternet issues\nUnforeseen technical problems\n9. Cancellation & Termination\n\nWe reserve the right to suspend or terminate accounts that:\n\nViolate these Terms\nAbuse the platform\nEngage in fraudulent activities\n\nCustomers may cancel subscriptions according to their plan terms.\n\n10. Limitation of Liability\n\nKiaan Technology shall not be liable for:\n\nLoss caused by incorrect customer data\nBusiness decisions made using platform information\nThird-party service interruptions\n11. Changes to Terms\n\nWe may update these Terms & Conditions from time to time.\n\nUsers will be notified of significant changes.\n\n12. Contact Information\n\nKiaan Technology Private Limited\n\nEmail:\nsupport@kiaantechnology.com',
    '© 2026 Kiaan Technology Private Limited. All rights reserved.',
    '+91 97521 00980',
    'Kiaan Technology',
    'https://kiaantechnology.com/',
    'India'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: in_app_notifications
# ------------------------------------------------------------

INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    3,
    NULL,
    NULL,
    'Company Subscription Expiring in 3 Days',
    'genpro\'s subscription will expire in 3 days.',
    'warning',
    1,
    '2026-06-20 12:43:10'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    4,
    NULL,
    NULL,
    'New Company Request',
    'qwert (test) has requested to join with the Medium plan.',
    'info',
    1,
    '2026-06-20 12:47:09'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    5,
    NULL,
    NULL,
    'New Company Request',
    'fdg (d) has requested to join with the 4 plan.',
    'info',
    1,
    '2026-06-20 12:59:43'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    6,
    NULL,
    NULL,
    'New Company Request',
    'wertghad (efwt) has requested to join with the 5 plan.',
    'info',
    1,
    '2026-06-20 13:00:02'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    7,
    NULL,
    NULL,
    'New Company Request',
    'srfg (rtygh) has requested to join with the 6 plan.',
    'info',
    1,
    '2026-06-20 13:00:24'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    8,
    NULL,
    NULL,
    'New Support Issue Raised',
    'TICKET-10001: Payroll',
    'info',
    1,
    '2026-08-19 18:42:09'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    10,
    NULL,
    NULL,
    'New Message: TICKET-10001',
    'Company Admin (Admin): Hellooo',
    'info',
    1,
    '2026-08-19 19:02:04'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    13,
    NULL,
    NULL,
    'New Free Trial Activated',
    'qwerty (qwerty) has directly started a Free Trial on the Free Plan plan.',
    'info',
    1,
    '2026-08-20 12:01:18'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    14,
    NULL,
    NULL,
    'Plan Renewal Request',
    'A company has requested a plan renewal/upgrade to Free Plan.',
    'warning',
    1,
    '2026-08-20 12:09:09'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    15,
    NULL,
    NULL,
    'Plan Renewal/Upgrade Request',
    'qwerty has requested to renew/upgrade to the Free Plan plan.',
    'info',
    1,
    '2026-08-20 12:09:09'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    16,
    NULL,
    NULL,
    'New Support Enquiry',
    'New enquiry from qwerty (qwerty@gmail.com): wertyuuk',
    'info',
    1,
    '2026-08-20 12:36:19'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    19,
    NULL,
    NULL,
    'Paid Subscription Received ?',
    'Test Corp 1787216218406 paid ₹999.00 for Starter Plan (initial).',
    'success',
    1,
    '2026-08-20 14:26:58'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    21,
    NULL,
    NULL,
    'Paid Subscription Received ?',
    'sonu Tech paid ₹1.00 for Starter Plan (initial).',
    'success',
    1,
    '2026-08-20 14:29:09'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    23,
    NULL,
    NULL,
    'Paid Subscription Received ?',
    'sonu Tech paid ₹1.00 for Pro Plan (upgrade).',
    'success',
    1,
    '2026-08-20 14:40:34'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    24,
    NULL,
    NULL,
    'New Support Enquiry',
    'New enquiry from dsgdg (sdg@gmail.com): \"Custom Plan Request from gdg\"',
    'info',
    1,
    '2026-08-21 11:25:39'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    25,
    NULL,
    NULL,
    'New Free Trial Activated',
    'qwerty (qwerty) has directly started a Free Trial on the Free Trial plan.',
    'info',
    1,
    '2026-08-21 11:28:43'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    26,
    NULL,
    NULL,
    'New Support Enquiry',
    'New enquiry from wert (fsd@gmail.com): \"Custom Plan Request from fsdg\"',
    'info',
    1,
    '2026-08-21 11:30:33'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    27,
    NULL,
    NULL,
    'New Support Enquiry',
    'New enquiry from dsf (qwerty@gmailcom): \"Custom Plan Request from fse\"',
    'info',
    1,
    '2026-08-21 11:35:09'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    29,
    NULL,
    NULL,
    'Paid Subscription Received ?',
    'demo company paid ₹1.00 for Pro Plan (initial).',
    'success',
    1,
    '2026-08-21 11:45:51'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    30,
    NULL,
    NULL,
    'New Support Enquiry',
    'New enquiry from egeg (fdsa@d.hfv): \"wwertyhgf\"',
    'info',
    1,
    '2026-08-21 18:44:01'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    31,
    NULL,
    NULL,
    'New Free Trial Activated',
    'testing (demo ) has directly started a Free Trial on the Free Trial plan.',
    'info',
    0,
    '2026-08-25 13:01:46'
  );
INSERT INTO
  `in_app_notifications` (
    `id`,
    `company_id`,
    `user_id`,
    `title`,
    `message`,
    `type`,
    `is_read`,
    `created_at`
  )
VALUES
  (
    33,
    NULL,
    NULL,
    'Paid Subscription Received ?',
    'demo paid ₹1.00 for Standard Plan (initial).',
    'success',
    1,
    '2026-08-25 13:04:30'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: invoices
# ------------------------------------------------------------

INSERT INTO
  `invoices` (
    `id`,
    `invoice_number`,
    `company_id`,
    `subscription_id`,
    `plan_name`,
    `billing_cycle`,
    `amount`,
    `currency`,
    `payment_status`,
    `payment_method`,
    `razorpay_order_id`,
    `razorpay_payment_id`,
    `customer_name`,
    `customer_email`,
    `customer_phone`,
    `company_name`,
    `invoice_date`,
    `created_at`
  )
VALUES
  (
    4,
    'INV-2026-349493',
    22,
    29,
    'Starter Plan',
    'monthly',
    1.00,
    'INR',
    'paid',
    'razorpay_checkout',
    'order_TRxrLk7x3NryiM',
    'pay_TRxsFIa2K3qvMe',
    'sonu Kiaan',
    'demogmail01@gmail.com',
    '1234567890',
    'sonu Tech',
    '2026-08-20',
    '2026-08-20 14:29:09'
  );
INSERT INTO
  `invoices` (
    `id`,
    `invoice_number`,
    `company_id`,
    `subscription_id`,
    `plan_name`,
    `billing_cycle`,
    `amount`,
    `currency`,
    `payment_status`,
    `payment_method`,
    `razorpay_order_id`,
    `razorpay_payment_id`,
    `customer_name`,
    `customer_email`,
    `customer_phone`,
    `company_name`,
    `invoice_date`,
    `created_at`
  )
VALUES
  (
    5,
    'INV-2026-034288',
    22,
    30,
    'Pro Plan',
    'monthly',
    1.00,
    'INR',
    'paid',
    'razorpay_checkout',
    'order_TRyArWPvZr5tnH',
    'pay_TRyBAOtYSwp0xm',
    'sonu Kiaan',
    'demogmail01@gmail.com',
    '1234567890',
    'sonu Tech',
    '2026-08-20',
    '2026-08-20 14:40:34'
  );
INSERT INTO
  `invoices` (
    `id`,
    `invoice_number`,
    `company_id`,
    `subscription_id`,
    `plan_name`,
    `billing_cycle`,
    `amount`,
    `currency`,
    `payment_status`,
    `payment_method`,
    `razorpay_order_id`,
    `razorpay_payment_id`,
    `customer_name`,
    `customer_email`,
    `customer_phone`,
    `company_name`,
    `invoice_date`,
    `created_at`
  )
VALUES
  (
    6,
    'INV-2026-951049',
    24,
    32,
    'Pro Plan',
    'monthly',
    1.00,
    'INR',
    'paid',
    'razorpay_checkout',
    'order_TSJjOgGmgKd3S4',
    'pay_TSJjiJcHLAZ1Zm',
    'demoo',
    'kiaan2534@gmail.com',
    '8319399018',
    'demo company',
    '2026-08-21',
    '2026-08-21 11:45:51'
  );
INSERT INTO
  `invoices` (
    `id`,
    `invoice_number`,
    `company_id`,
    `subscription_id`,
    `plan_name`,
    `billing_cycle`,
    `amount`,
    `currency`,
    `payment_status`,
    `payment_method`,
    `razorpay_order_id`,
    `razorpay_payment_id`,
    `customer_name`,
    `customer_email`,
    `customer_phone`,
    `company_name`,
    `invoice_date`,
    `created_at`
  )
VALUES
  (
    7,
    'INV-2026-270083',
    25,
    34,
    'Standard Plan',
    'monthly',
    1.00,
    'INR',
    'paid',
    'razorpay_checkout',
    'order_TTvCsh527n4BH2',
    'pay_TTvDL7YvFZIh8c',
    'testing',
    'demogmail01@gmail.com',
    '1234567890',
    'demo',
    '2026-08-25',
    '2026-08-25 13:04:30'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: kiosk_settings
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: kpis
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: leave_balances
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: leaves
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: password_resets
# ------------------------------------------------------------

INSERT INTO
  `password_resets` (
    `id`,
    `email`,
    `otp`,
    `token`,
    `expires_at`,
    `used`,
    `created_at`
  )
VALUES
  (
    1,
    'lightlabcreation@gmail.com',
    '793516',
    'fbceebcb1d5e9c354e670f9caba7cac87ab6371895c2fe61',
    '2026-08-25 15:33:31',
    1,
    '2026-08-25 15:18:31'
  );
INSERT INTO
  `password_resets` (
    `id`,
    `email`,
    `otp`,
    `token`,
    `expires_at`,
    `used`,
    `created_at`
  )
VALUES
  (
    2,
    'demogmail01@gmail.com',
    '892263',
    'ee3064a4b5294a49be34f3b94ee34678065ce2ecb9542618',
    '2026-08-25 15:33:33',
    1,
    '2026-08-25 15:18:33'
  );
INSERT INTO
  `password_resets` (
    `id`,
    `email`,
    `otp`,
    `token`,
    `expires_at`,
    `used`,
    `created_at`
  )
VALUES
  (
    3,
    'lightlabcreation@gmail.com',
    '364631',
    'f550936bbd3992bea12b3ffdeaa4787431cc3b66fe508ff9',
    '2026-08-25 15:35:47',
    1,
    '2026-08-25 15:20:47'
  );
INSERT INTO
  `password_resets` (
    `id`,
    `email`,
    `otp`,
    `token`,
    `expires_at`,
    `used`,
    `created_at`
  )
VALUES
  (
    4,
    'lightlabcreation@gmail.com',
    '488843',
    '65785df383ba0c5ca41e082d4615ead361b46d12db97a0e2',
    '2026-08-25 15:39:27',
    1,
    '2026-08-25 15:24:27'
  );
INSERT INTO
  `password_resets` (
    `id`,
    `email`,
    `otp`,
    `token`,
    `expires_at`,
    `used`,
    `created_at`
  )
VALUES
  (
    5,
    'demogmail01@gmail.com',
    '643649',
    '81c6efa4bf38bcb2c750af05c7210cfbc86a89d8c8507f81',
    '2026-08-25 15:39:27',
    1,
    '2026-08-25 15:24:27'
  );
INSERT INTO
  `password_resets` (
    `id`,
    `email`,
    `otp`,
    `token`,
    `expires_at`,
    `used`,
    `created_at`
  )
VALUES
  (
    6,
    'lightlabcreation@gmail.com',
    '252651',
    '9f4316c74dfdb8efd03c4a8c6d59293712144883b70d515c',
    '2026-08-25 15:46:51',
    1,
    '2026-08-25 15:31:51'
  );
INSERT INTO
  `password_resets` (
    `id`,
    `email`,
    `otp`,
    `token`,
    `expires_at`,
    `used`,
    `created_at`
  )
VALUES
  (
    7,
    'demogmail01@gmail.com',
    '329548',
    '145a6bed4fa8dc7e7be3c8b2dcdd3d6c252ac71ab6d4e4aa',
    '2026-08-25 15:48:56',
    1,
    '2026-08-25 15:33:56'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: payment_transactions
# ------------------------------------------------------------

INSERT INTO
  `payment_transactions` (
    `id`,
    `company_id`,
    `user_id`,
    `plan_name`,
    `billing_cycle`,
    `amount`,
    `currency`,
    `razorpay_order_id`,
    `razorpay_payment_id`,
    `razorpay_signature`,
    `payment_status`,
    `payment_method`,
    `error_code`,
    `error_description`,
    `notes`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    2,
    22,
    25,
    'Starter Plan',
    'monthly',
    1.00,
    'INR',
    'order_TRxrLk7x3NryiM',
    'pay_TRxsFIa2K3qvMe',
    'fee958a6c1774a7c16682e9c8a229c183e2df6832c504726b1b503521f1f2d45',
    'success',
    'razorpay_checkout',
    NULL,
    NULL,
    '{\"registrationData\":{\"companyName\":\"sonu Tech\",\"adminName\":\"sonu Kiaan\",\"email\":\"demogmail01@gmail.com\",\"phone\":\"1234567890\",\"password\":\"123456\"},\"planDetails\":{\"id\":5,\"name\":\"Starter Plan\",\"price\":\"1\",\"duration\":\"monthly\",\"description\":\"Perfect For Small Teams\",\"features\":\"[\\\"Up to 60 Employees\\\",\\\"Attendance Management\\\",\\\"Leave & Claims Management\\\",\\\"Payroll Management\\\",\\\"Kiosk Mode\\\",\\\"GPS Geofencing\\\"]\",\"buttonText\":\"Get Started\",\"isPopular\":1,\"created_at\":\"2026-06-18 16:43:35\",\"created_by\":null,\"employee_limit\":60}}',
    '2026-08-20 14:21:33',
    '2026-08-20 14:29:09'
  );
INSERT INTO
  `payment_transactions` (
    `id`,
    `company_id`,
    `user_id`,
    `plan_name`,
    `billing_cycle`,
    `amount`,
    `currency`,
    `razorpay_order_id`,
    `razorpay_payment_id`,
    `razorpay_signature`,
    `payment_status`,
    `payment_method`,
    `error_code`,
    `error_description`,
    `notes`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    3,
    NULL,
    NULL,
    'Starter Plan',
    'monthly',
    999.00,
    'INR',
    'order_test_1787216161772',
    NULL,
    NULL,
    'pending',
    NULL,
    NULL,
    NULL,
    '{\"registrationData\":{\"companyName\":\"Test Corp 1787216161772\",\"adminName\":\"Sonu Kiaan\",\"email\":\"test_1787216161772@gmail.com\",\"phone\":\"9876543210\",\"password\":\"password123\"}}',
    '2026-08-20 14:26:01',
    '2026-08-20 14:26:01'
  );
INSERT INTO
  `payment_transactions` (
    `id`,
    `company_id`,
    `user_id`,
    `plan_name`,
    `billing_cycle`,
    `amount`,
    `currency`,
    `razorpay_order_id`,
    `razorpay_payment_id`,
    `razorpay_signature`,
    `payment_status`,
    `payment_method`,
    `error_code`,
    `error_description`,
    `notes`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    5,
    22,
    25,
    'Pro Plan',
    'monthly',
    1.00,
    'INR',
    'order_TRyArWPvZr5tnH',
    'pay_TRyBAOtYSwp0xm',
    'ab5b89e4ac028e351571b8ad952c680af6b2b6d3c7e8d5e8301163d27afc2162',
    'success',
    'razorpay_checkout',
    NULL,
    NULL,
    '{\"registrationData\":null,\"planDetails\":{\"id\":7,\"name\":\"Pro Plan\",\"price\":\"1\",\"duration\":\"monthly\",\"description\":\"Built For Scaling Organizations\",\"features\":\"[\\\"Up to 150 Employees\\\",\\\"Attendance Management\\\",\\\"Leave & Claims Management\\\",\\\"Payroll Management\\\",\\\"Kiosk Mode\\\",\\\"GPS Geofencing\\\"]\",\"buttonText\":\"Get Started\",\"isPopular\":0,\"created_at\":\"2026-08-17 14:42:41\",\"created_by\":null,\"employee_limit\":150}}',
    '2026-08-20 14:40:01',
    '2026-08-20 14:40:34'
  );
INSERT INTO
  `payment_transactions` (
    `id`,
    `company_id`,
    `user_id`,
    `plan_name`,
    `billing_cycle`,
    `amount`,
    `currency`,
    `razorpay_order_id`,
    `razorpay_payment_id`,
    `razorpay_signature`,
    `payment_status`,
    `payment_method`,
    `error_code`,
    `error_description`,
    `notes`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    6,
    22,
    25,
    'Standard Plan',
    'monthly',
    1.00,
    'INR',
    'order_TS1113fMx05XqQ',
    NULL,
    NULL,
    'pending',
    NULL,
    NULL,
    NULL,
    '{\"registrationData\":null,\"planDetails\":{\"id\":6,\"name\":\"Standard Plan\",\"price\":\"1\",\"duration\":\"monthly\",\"description\":\"Designed For Growing Businesses\",\"features\":\"[\\\"Up to 100 Employees\\\",\\\"Attendance Management\\\",\\\"Leave & Claims Management\\\",\\\"Payroll Management\\\",\\\"Kiosk Mode\\\",\\\"GPS Geofencing\\\"]\",\"buttonText\":\"Get Started\",\"isPopular\":1,\"created_at\":\"2026-06-19 18:28:47\",\"created_by\":null,\"employee_limit\":100}}',
    '2026-08-20 17:26:47',
    '2026-08-20 17:26:47'
  );
INSERT INTO
  `payment_transactions` (
    `id`,
    `company_id`,
    `user_id`,
    `plan_name`,
    `billing_cycle`,
    `amount`,
    `currency`,
    `razorpay_order_id`,
    `razorpay_payment_id`,
    `razorpay_signature`,
    `payment_status`,
    `payment_method`,
    `error_code`,
    `error_description`,
    `notes`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    7,
    22,
    25,
    'Standard Plan',
    'monthly',
    1299.00,
    'INR',
    'order_TS1E3wqCl7JzHy',
    NULL,
    NULL,
    'pending',
    NULL,
    NULL,
    NULL,
    '{\"registrationData\":null,\"planDetails\":{\"id\":6,\"name\":\"Standard Plan\",\"price\":\"1299\",\"duration\":\"monthly\",\"description\":\"Designed For Growing Businesses\",\"features\":\"[\\\"Up to 100 Employees\\\",\\\"Attendance Management\\\",\\\"Leave & Claims Management\\\",\\\"Payroll Management\\\",\\\"Kiosk Mode\\\",\\\"GPS Geofencing\\\"]\",\"buttonText\":\"Get Started\",\"isPopular\":1,\"created_at\":\"2026-06-19 18:28:47\",\"created_by\":null,\"employee_limit\":100}}',
    '2026-08-20 17:39:08',
    '2026-08-20 17:39:08'
  );
INSERT INTO
  `payment_transactions` (
    `id`,
    `company_id`,
    `user_id`,
    `plan_name`,
    `billing_cycle`,
    `amount`,
    `currency`,
    `razorpay_order_id`,
    `razorpay_payment_id`,
    `razorpay_signature`,
    `payment_status`,
    `payment_method`,
    `error_code`,
    `error_description`,
    `notes`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    8,
    24,
    29,
    'Pro Plan',
    'monthly',
    1.00,
    'INR',
    'order_TSJjOgGmgKd3S4',
    'pay_TSJjiJcHLAZ1Zm',
    'cdf616c8388e1e67aa7779ab094c019533ceb9122e6f8ff0fe1fe0607a77c872',
    'success',
    'razorpay_checkout',
    NULL,
    NULL,
    '{\"registrationData\":{\"companyName\":\"demo company\",\"adminName\":\"demoo\",\"email\":\"kiaan2534@gmail.com\",\"phone\":\"8319399018\",\"password\":\"123456\"},\"planDetails\":{\"id\":7,\"name\":\"Pro Plan\",\"price\":\"1\",\"duration\":\"monthly\",\"description\":\"Built For Scaling Organizations\",\"features\":\"[\\\"Up to 150 Employees\\\",\\\"Attendance Management\\\",\\\"Leave & Claims Management\\\",\\\"Payroll Management\\\",\\\"Kiosk Mode\\\",\\\"GPS Geofencing\\\"]\",\"buttonText\":\"Get Started\",\"isPopular\":1,\"created_at\":\"2026-08-17 14:42:41\",\"created_by\":null,\"employee_limit\":4}}',
    '2026-08-21 11:45:16',
    '2026-08-21 11:45:51'
  );
INSERT INTO
  `payment_transactions` (
    `id`,
    `company_id`,
    `user_id`,
    `plan_name`,
    `billing_cycle`,
    `amount`,
    `currency`,
    `razorpay_order_id`,
    `razorpay_payment_id`,
    `razorpay_signature`,
    `payment_status`,
    `payment_method`,
    `error_code`,
    `error_description`,
    `notes`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    9,
    NULL,
    NULL,
    'Starter Plan',
    'monthly',
    999.00,
    'INR',
    'order_TSPl3dBkWFlL2w',
    NULL,
    NULL,
    'pending',
    NULL,
    NULL,
    NULL,
    '{\"registrationData\":{\"companyName\":\"wsad\",\"adminName\":\"sf\",\"email\":\"qwerty@fedd.cvg\",\"phone\":\"675645767543\",\"password\":\"123456\"},\"planDetails\":{\"id\":5,\"name\":\"Starter Plan\",\"price\":\"999\",\"duration\":\"monthly\",\"description\":\"Perfect For Small Teams\",\"features\":\"[\\\"Up to 60 Employees\\\",\\\"Attendance Management\\\",\\\"Leave & Claims Management\\\",\\\"Payroll Management\\\",\\\"Kiosk Mode\\\",\\\"GPS Geofencing\\\"]\",\"buttonText\":\"Get Started\",\"isPopular\":0,\"created_at\":\"2026-06-18 16:43:35\",\"created_by\":null,\"employee_limit\":60}}',
    '2026-08-21 17:39:00',
    '2026-08-21 17:39:00'
  );
INSERT INTO
  `payment_transactions` (
    `id`,
    `company_id`,
    `user_id`,
    `plan_name`,
    `billing_cycle`,
    `amount`,
    `currency`,
    `razorpay_order_id`,
    `razorpay_payment_id`,
    `razorpay_signature`,
    `payment_status`,
    `payment_method`,
    `error_code`,
    `error_description`,
    `notes`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    10,
    25,
    34,
    'Standard Plan',
    'monthly',
    1.00,
    'INR',
    'order_TTvCsh527n4BH2',
    'pay_TTvDL7YvFZIh8c',
    '179aab570dbfcf1c8e9d5b7ada636667ad6e541156cc06c939d78f8937fd23df',
    'success',
    'razorpay_checkout',
    NULL,
    NULL,
    '{\"registrationData\":{\"companyName\":\"testing\",\"adminName\":\"testing\",\"email\":\"demogmail01@gmail.com\",\"phone\":\"23456787654\",\"password\":\"123456666678\"},\"planDetails\":{\"id\":6,\"name\":\"Standard Plan\",\"price\":\"1\",\"duration\":\"monthly\",\"description\":\"Designed For Growing Businesses\",\"features\":\"[\\\"Up to 100 Employees\\\",\\\"Attendance Management\\\",\\\"Leave & Claims Management\\\",\\\"Payroll Management\\\",\\\"Kiosk Mode\\\",\\\"GPS Geofencing\\\"]\",\"buttonText\":\"Get Started\",\"isPopular\":0,\"created_at\":\"2026-06-19 18:28:47\",\"created_by\":null,\"employee_limit\":100}}',
    '2026-08-25 13:03:49',
    '2026-08-25 13:04:30'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: payroll
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: plan_requests
# ------------------------------------------------------------

INSERT INTO
  `plan_requests` (
    `id`,
    `company_id`,
    `requested_plan`,
    `status`,
    `created_at`
  )
VALUES
  (9, 2, 'Medium', 'approved', '2026-06-19 17:46:19');
INSERT INTO
  `plan_requests` (
    `id`,
    `company_id`,
    `requested_plan`,
    `status`,
    `created_at`
  )
VALUES
  (10, 2, 'HIGH', 'approved', '2026-06-19 19:02:34');
INSERT INTO
  `plan_requests` (
    `id`,
    `company_id`,
    `requested_plan`,
    `status`,
    `created_at`
  )
VALUES
  (11, 2, 'Medium', 'rejected', '2026-06-20 11:34:52');
INSERT INTO
  `plan_requests` (
    `id`,
    `company_id`,
    `requested_plan`,
    `status`,
    `created_at`
  )
VALUES
  (12, 2, 'Low', 'approved', '2026-06-20 11:35:33');
INSERT INTO
  `plan_requests` (
    `id`,
    `company_id`,
    `requested_plan`,
    `status`,
    `created_at`
  )
VALUES
  (
    13,
    18,
    'Free Plan',
    'pending',
    '2026-08-20 12:09:09'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: plans
# ------------------------------------------------------------

INSERT INTO
  `plans` (
    `id`,
    `name`,
    `price`,
    `duration`,
    `description`,
    `features`,
    `buttonText`,
    `isPopular`,
    `created_at`,
    `created_by`,
    `employee_limit`
  )
VALUES
  (
    5,
    'Starter Plan',
    '999',
    'monthly',
    'Perfect For Small Teams',
    '[\"Up to 60 Employees\",\"Attendance Management\",\"Leave & Claims Management\",\"Payroll Management\",\"Kiosk Mode\",\"GPS Geofencing\"]',
    'Get Started',
    0,
    '2026-06-18 16:43:35',
    NULL,
    60
  );
INSERT INTO
  `plans` (
    `id`,
    `name`,
    `price`,
    `duration`,
    `description`,
    `features`,
    `buttonText`,
    `isPopular`,
    `created_at`,
    `created_by`,
    `employee_limit`
  )
VALUES
  (
    6,
    'Standard Plan',
    '1299',
    'monthly',
    'Designed For Growing Businesses',
    '[\"Up to 100 Employees\",\"Attendance Management\",\"Leave & Claims Management\",\"Payroll Management\",\"Kiosk Mode\",\"GPS Geofencing\"]',
    'Get Started',
    0,
    '2026-06-19 18:28:47',
    NULL,
    100
  );
INSERT INTO
  `plans` (
    `id`,
    `name`,
    `price`,
    `duration`,
    `description`,
    `features`,
    `buttonText`,
    `isPopular`,
    `created_at`,
    `created_by`,
    `employee_limit`
  )
VALUES
  (
    7,
    'Pro Plan',
    '1499',
    'monthly',
    'Built For Scaling Organizations',
    '[\"Up to 150 Employees\",\"Attendance Management\",\"Leave & Claims Management\",\"Payroll Management\",\"Kiosk Mode\",\"GPS Geofencing\"]',
    'Get Started',
    1,
    '2026-08-17 14:42:41',
    NULL,
    150
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: public_holidays
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: settings
# ------------------------------------------------------------

INSERT INTO
  `settings` (
    `id`,
    `machine_ip`,
    `machine_port`,
    `machine_alias`,
    `sync_interval`,
    `late_deduction`,
    `late_deduction_amount`,
    `salary_cycle`,
    `ot_multiplier`,
    `business_name`,
    `business_address`,
    `business_phone`,
    `business_email`,
    `standard_start_time`,
    `updated_at`,
    `company_id`,
    `timezone`,
    `currency`,
    `date_format`,
    `language`,
    `grace_period_mins`,
    `standard_end_time`,
    `weekends`,
    `salary_cycle_start_date`,
    `notify_leaves`,
    `notify_claims`,
    `notify_password_resets`,
    `contribution_enabled`,
    `default_employee_contribution_percentage`,
    `default_employer_contribution_percentage`,
    `country`
  )
VALUES
  (
    1,
    NULL,
    4370,
    'Main Entrance',
    30,
    1,
    50.00,
    'Monthly (1st to 30th)',
    1.50,
    'Nexus HRM',
    NULL,
    '',
    '',
    '09:00:00',
    '2026-09-30 11:29:58',
    NULL,
    'Asia/Kolkata',
    'INR',
    NULL,
    'English',
    15,
    '17:00:00',
    'Saturday,Sunday',
    1,
    1,
    1,
    1,
    0,
    0.00,
    0.00,
    'India'
  );
INSERT INTO
  `settings` (
    `id`,
    `machine_ip`,
    `machine_port`,
    `machine_alias`,
    `sync_interval`,
    `late_deduction`,
    `late_deduction_amount`,
    `salary_cycle`,
    `ot_multiplier`,
    `business_name`,
    `business_address`,
    `business_phone`,
    `business_email`,
    `standard_start_time`,
    `updated_at`,
    `company_id`,
    `timezone`,
    `currency`,
    `date_format`,
    `language`,
    `grace_period_mins`,
    `standard_end_time`,
    `weekends`,
    `salary_cycle_start_date`,
    `notify_leaves`,
    `notify_claims`,
    `notify_password_resets`,
    `contribution_enabled`,
    `default_employee_contribution_percentage`,
    `default_employer_contribution_percentage`,
    `country`
  )
VALUES
  (
    15,
    '',
    4370,
    'Main Entrance',
    30,
    1,
    50.00,
    '15 Days Cycle',
    1.50,
    'Sonu and Sons ',
    '',
    '64366436',
    'sonu@gmail.com',
    '09:00:00',
    '2026-10-01 12:16:06',
    26,
    'Asia/Kolkata',
    'INR',
    'DD/MM/YYYY',
    'English',
    15,
    '17:00:00',
    'Saturday,Sunday',
    1,
    1,
    1,
    1,
    0,
    0.00,
    0.00,
    'India'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: subscription_history
# ------------------------------------------------------------

INSERT INTO
  `subscription_history` (
    `id`,
    `company_id`,
    `previous_plan`,
    `new_plan`,
    `previous_employee_limit`,
    `new_employee_limit`,
    `previous_end_date`,
    `new_end_date`,
    `change_type`,
    `amount`,
    `changed_by`,
    `razorpay_payment_id`,
    `notes`,
    `created_at`
  )
VALUES
  (
    3,
    21,
    'Starter Plan',
    'Starter Plan',
    60,
    60,
    NULL,
    '2026-09-19',
    'initial',
    999.00,
    'user_checkout',
    'pay_test_1787216218405',
    'Activated via razorpay_checkout. Duration: monthly (+30 days).',
    '2026-08-20 14:26:58'
  );
INSERT INTO
  `subscription_history` (
    `id`,
    `company_id`,
    `previous_plan`,
    `new_plan`,
    `previous_employee_limit`,
    `new_employee_limit`,
    `previous_end_date`,
    `new_end_date`,
    `change_type`,
    `amount`,
    `changed_by`,
    `razorpay_payment_id`,
    `notes`,
    `created_at`
  )
VALUES
  (
    4,
    22,
    'Starter Plan',
    'Starter Plan',
    60,
    60,
    NULL,
    '2026-09-19',
    'initial',
    1.00,
    'user_checkout',
    'pay_TRxsFIa2K3qvMe',
    'Activated via razorpay_checkout. Duration: monthly (+30 days).',
    '2026-08-20 14:29:09'
  );
INSERT INTO
  `subscription_history` (
    `id`,
    `company_id`,
    `previous_plan`,
    `new_plan`,
    `previous_employee_limit`,
    `new_employee_limit`,
    `previous_end_date`,
    `new_end_date`,
    `change_type`,
    `amount`,
    `changed_by`,
    `razorpay_payment_id`,
    `notes`,
    `created_at`
  )
VALUES
  (
    5,
    22,
    'Starter Plan',
    'Pro Plan',
    60,
    150,
    '2026-08-19',
    '2026-09-19',
    'upgrade',
    1.00,
    'user_checkout',
    'pay_TRyBAOtYSwp0xm',
    'Activated via razorpay_checkout. Duration: monthly (+30 days).',
    '2026-08-20 14:40:34'
  );
INSERT INTO
  `subscription_history` (
    `id`,
    `company_id`,
    `previous_plan`,
    `new_plan`,
    `previous_employee_limit`,
    `new_employee_limit`,
    `previous_end_date`,
    `new_end_date`,
    `change_type`,
    `amount`,
    `changed_by`,
    `razorpay_payment_id`,
    `notes`,
    `created_at`
  )
VALUES
  (
    6,
    24,
    'Pro Plan',
    'Pro Plan',
    4,
    4,
    NULL,
    '2026-09-20',
    'initial',
    1.00,
    'user_checkout',
    'pay_TSJjiJcHLAZ1Zm',
    'Activated via razorpay_checkout. Duration: monthly (+30 days).',
    '2026-08-21 11:45:51'
  );
INSERT INTO
  `subscription_history` (
    `id`,
    `company_id`,
    `previous_plan`,
    `new_plan`,
    `previous_employee_limit`,
    `new_employee_limit`,
    `previous_end_date`,
    `new_end_date`,
    `change_type`,
    `amount`,
    `changed_by`,
    `razorpay_payment_id`,
    `notes`,
    `created_at`
  )
VALUES
  (
    7,
    25,
    'Free Trial',
    'Standard Plan',
    10,
    100,
    '2026-09-01',
    '2026-10-01',
    'initial',
    1.00,
    'user_checkout',
    'pay_TTvDL7YvFZIh8c',
    'Activated via razorpay_checkout. Duration: monthly (+30 days).',
    '2026-08-25 13:04:30'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: subscriptions
# ------------------------------------------------------------

INSERT INTO
  `subscriptions` (
    `id`,
    `company_id`,
    `plan_name`,
    `amount`,
    `billing_cycle`,
    `payment_status`,
    `order_id`,
    `payment_id`,
    `start_date`,
    `end_date`,
    `created_at`,
    `updated_at`
  )
VALUES
  (
    35,
    26,
    'Standard Plan',
    1299.00,
    'monthly',
    'paid',
    NULL,
    NULL,
    '2026-09-30',
    '2026-10-30',
    '2026-09-30 11:16:16',
    '2026-09-30 11:16:16'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: support_ticket_messages
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: support_tickets
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: system_logs
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: unknown_attempts
# ------------------------------------------------------------

INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (1, NULL, 0.6511, '2026-06-18 17:37:14');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (2, NULL, 0.6614, '2026-06-18 17:38:03');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (3, NULL, 0.7196, '2026-06-18 17:38:22');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (4, NULL, 0.7248, '2026-06-18 17:39:41');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (5, NULL, 0.6245, '2026-06-18 17:47:25');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (6, NULL, 0.5896, '2026-06-18 17:48:08');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (7, NULL, 0.6276, '2026-06-18 17:55:59');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (8, NULL, 0.4577, '2026-06-18 17:56:13');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (9, NULL, 0.6436, '2026-06-18 17:57:00');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (10, NULL, 0.6017, '2026-06-18 18:03:38');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (11, NULL, 0.6079, '2026-06-18 18:04:42');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (12, NULL, 0.6622, '2026-06-18 18:04:47');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (13, NULL, 0.5954, '2026-06-18 18:36:29');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (14, NULL, 0.6788, '2026-06-18 18:36:55');
INSERT INTO
  `unknown_attempts` (`id`, `photo`, `confidence`, `created_at`)
VALUES
  (15, NULL, 0.4706, '2026-06-22 15:02:31');

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: users
# ------------------------------------------------------------

INSERT INTO
  `users` (
    `id`,
    `employee_id`,
    `email`,
    `password`,
    `role`,
    `name`,
    `photo`,
    `created_by`,
    `company_id`
  )
VALUES
  (
    1,
    NULL,
    'lightlabcreation@gmail.com',
    '$2a$10$su7mzgmUB/Wp0Eb.UlJAVueAX/cL4.p05ZbrPxBBg0phXOdL1qTGa',
    'superadmin',
    'System SuperAdmin',
    NULL,
    NULL,
    NULL
  );
INSERT INTO
  `users` (
    `id`,
    `employee_id`,
    `email`,
    `password`,
    `role`,
    `name`,
    `photo`,
    `created_by`,
    `company_id`
  )
VALUES
  (
    35,
    NULL,
    'sonu@gmail.com',
    '$2a$10$EqwehKxMz4mTJ3IXtCwvTuKj8L3YhafoovL2Li6oOvsSAXusrW6eS',
    'admin',
    'Sonu ',
    NULL,
    NULL,
    26
  );
INSERT INTO
  `users` (
    `id`,
    `employee_id`,
    `email`,
    `password`,
    `role`,
    `name`,
    `photo`,
    `created_by`,
    `company_id`
  )
VALUES
  (
    36,
    15,
    'yashuchoudhary.com@gmail.com',
    '$2a$10$tZxYB68TiY/YE79XT6poM.pRfirxWG593IxrArjcli7tl12RM2yuO',
    'employee',
    'Rohit Sharma ',
    NULL,
    35,
    26
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: whatsapp_logs
# ------------------------------------------------------------

INSERT INTO
  `whatsapp_logs` (
    `id`,
    `company_id`,
    `recipient_phone`,
    `recipient_name`,
    `recipient_role`,
    `event_type`,
    `message`,
    `status`,
    `provider_message_id`,
    `error_message`,
    `created_at`
  )
VALUES
  (
    3,
    26,
    '917389492199',
    'Admin',
    'admin',
    'TEST_MESSAGE',
    'hy',
    'SENT',
    '3EB0BD259725E61EB64159',
    NULL,
    '2026-10-01 10:24:57'
  );
INSERT INTO
  `whatsapp_logs` (
    `id`,
    `company_id`,
    `recipient_phone`,
    `recipient_name`,
    `recipient_role`,
    `event_type`,
    `message`,
    `status`,
    `provider_message_id`,
    `error_message`,
    `created_at`
  )
VALUES
  (
    4,
    26,
    '917389492199',
    'Admin',
    'admin',
    'TEST_MESSAGE',
    'hloo\n',
    'SENT',
    '3EB009410C51268D5F467F',
    NULL,
    '2026-10-01 10:40:13'
  );
INSERT INTO
  `whatsapp_logs` (
    `id`,
    `company_id`,
    `recipient_phone`,
    `recipient_name`,
    `recipient_role`,
    `event_type`,
    `message`,
    `status`,
    `provider_message_id`,
    `error_message`,
    `created_at`
  )
VALUES
  (
    5,
    26,
    '8319399018',
    'Rohit Sharma ',
    'employee',
    'DIRECT_MESSAGE',
    '? *Sonu and Sons *\n*Hloo*\n? Priority: *NOTICE*\n\nHello *Rohit Sharma *,\n\nSonu & sons\n\n──────────────────\n_Sent by Company Admin • Sonu and Sons _',
    'SENT',
    '3EB034E35AE7D98F11D70A',
    NULL,
    '2026-10-01 11:15:57'
  );
INSERT INTO
  `whatsapp_logs` (
    `id`,
    `company_id`,
    `recipient_phone`,
    `recipient_name`,
    `recipient_role`,
    `event_type`,
    `message`,
    `status`,
    `provider_message_id`,
    `error_message`,
    `created_at`
  )
VALUES
  (
    6,
    26,
    '918319399018',
    'Rohit Sharma ',
    'employee',
    'DIRECT_MESSAGE',
    '? *Sonu and Sons *\n*hy*\n? Priority: *NOTICE*\n\nHello *Rohit Sharma *,\n\nsonu\n\n──────────────────\n_Sent by Company Admin • Sonu and Sons _',
    'SENT',
    '3EB0B94AD0CC416DC05A7E',
    NULL,
    '2026-10-01 11:19:54'
  );
INSERT INTO
  `whatsapp_logs` (
    `id`,
    `company_id`,
    `recipient_phone`,
    `recipient_name`,
    `recipient_role`,
    `event_type`,
    `message`,
    `status`,
    `provider_message_id`,
    `error_message`,
    `created_at`
  )
VALUES
  (
    7,
    26,
    '918319399018',
    'Rohit Sharma ',
    'employee',
    'ATTENDANCE_PUNCH',
    '*Sonu and Sons *\n\nHello *Rohit Sharma *,\n\nYour attendance punch has been recorded successfully.\n\n? *Date:* 2026-10-01\n⏰ *Time:* 09:00:00\n? *Status:* PRESENT\n\n_Thank you._',
    'SENT',
    '3EB0F3521888D1966E98E9',
    NULL,
    '2026-10-01 11:22:03'
  );
INSERT INTO
  `whatsapp_logs` (
    `id`,
    `company_id`,
    `recipient_phone`,
    `recipient_name`,
    `recipient_role`,
    `event_type`,
    `message`,
    `status`,
    `provider_message_id`,
    `error_message`,
    `created_at`
  )
VALUES
  (
    8,
    26,
    '918319399018',
    'Rohit Sharma ',
    'employee',
    'ANNOUNCEMENT',
    '? *Sonu and Sons *\n*hyy*\n? Priority: *URGENT*\n\nHello *Rohit Sharma *,\n\nhyy\n\n──────────────────\n_Sent by Company Admin • Sonu and Sons _',
    'SENT',
    '3EB0A282C096D553E5E1A0',
    NULL,
    '2026-10-01 11:22:47'
  );

/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
