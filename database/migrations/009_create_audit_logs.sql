-- Migration: 009_create_audit_logs.sql
-- Description: Creates report_logs and audit_logs in ProcureIQ_Logs

CREATE TABLE IF NOT EXISTS report_logs (
    report_log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    log_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    username VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    report TEXT NOT NULL,
    PRIMARY KEY (report_log_id),
    KEY idx_username (username),
    KEY idx_action (action),
    KEY idx_timestamp (log_timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    audit_log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    log_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    username VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    old_value JSON DEFAULT NULL,
    new_value JSON DEFAULT NULL,
    PRIMARY KEY (audit_log_id),
    KEY idx_username (username),
    KEY idx_action (action),
    KEY idx_timestamp (log_timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
