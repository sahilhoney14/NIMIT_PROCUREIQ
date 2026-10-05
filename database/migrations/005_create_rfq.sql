-- Migration: 005_create_rfq.sql
-- Description: Creates vendor_inquiries table for RFQ process

CREATE TABLE IF NOT EXISTS vendor_inquiries (
    inquiry_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    pr_id INT UNSIGNED NOT NULL,
    status ENUM('OPEN', 'VENDOR_SELECTED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    remarks TEXT,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (inquiry_id),
    UNIQUE KEY uq_vendor_inquiry_pr (pr_id),
    CONSTRAINT fk_vendor_inquiries_pr FOREIGN KEY (pr_id) REFERENCES purchase_requests (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
