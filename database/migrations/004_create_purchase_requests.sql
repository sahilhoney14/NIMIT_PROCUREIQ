-- Migration: 004_create_purchase_requests.sql
-- Description: Creates purchase_requests table

CREATE TABLE IF NOT EXISTS purchase_requests (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    pr_number VARCHAR(100) NOT NULL,
    pr_date DATE DEFAULT NULL,
    party_name VARCHAR(255) DEFAULT NULL,
    location VARCHAR(100) DEFAULT NULL,
    territory VARCHAR(100) DEFAULT NULL,
    product_category VARCHAR(150) DEFAULT NULL,
    item_name VARCHAR(255) DEFAULT NULL,
    product_remarks TEXT,
    make VARCHAR(100) DEFAULT NULL,
    model VARCHAR(150) DEFAULT NULL,
    qty DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(50) DEFAULT NULL,
    sales_rate DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    taxable_value DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_pr_number (pr_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
