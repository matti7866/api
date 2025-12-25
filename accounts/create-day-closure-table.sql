-- Table to store daily account closures
CREATE TABLE IF NOT EXISTS `account_day_closures` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `closure_date` date NOT NULL COMMENT 'The date for which balances are being closed',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int(11) DEFAULT NULL COMMENT 'Staff ID who created the closure',
  `total_accounts` int(11) DEFAULT 0 COMMENT 'Number of accounts in the statement',
  `statement_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON data of all account balances',
  `email_sent_to` varchar(255) DEFAULT NULL COMMENT 'Email address where statement was sent',
  `email_sent_at` datetime DEFAULT NULL COMMENT 'When the email was sent',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_closure_date` (`closure_date`),
  KEY `idx_closure_date` (`closure_date`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores daily account balance closures and statements';

