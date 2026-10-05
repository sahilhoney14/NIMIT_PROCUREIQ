-- Migration: 006_create_quotations.sql
-- Description: Creates vendor_inquiry_vendors table for quotation comparison and selection

CREATE TABLE IF NOT EXISTS vendor_inquiry_vendors (
    inquiry_vendor_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    inquiry_id INT UNSIGNED NOT NULL,
    vendor_id INT UNSIGNED NOT NULL,

    price_per_unit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    is_selected TINYINT(1) NOT NULL DEFAULT 0,
    remarks TEXT,

    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    expected_delivery_date DATE DEFAULT NULL,

    payment_type ENUM(
        'ADVANCE',
        'CREDIT',
        'ADVANCE_PLUS_BALANCE',
        'CUSTOM'
    ) NOT NULL DEFAULT 'CREDIT',

    advance_type ENUM(
        'PERCENTAGE',
        'FIXED_AMOUNT'
    ) DEFAULT NULL,

    advance_value DECIMAL(15,2) DEFAULT NULL,
    advance_amount DECIMAL(15,2) DEFAULT NULL,
    balance_due_days SMALLINT UNSIGNED DEFAULT NULL,
    payment_terms_remarks TEXT,

    PRIMARY KEY (inquiry_vendor_id),
    UNIQUE KEY uq_inquiry_vendor (inquiry_id, vendor_id),
    KEY idx_vendor_id (vendor_id),

    CONSTRAINT fk_viv_inquiry FOREIGN KEY (inquiry_id) REFERENCES vendor_inquiries (inquiry_id) ON DELETE CASCADE,
    CONSTRAINT fk_viv_vendor FOREIGN KEY (vendor_id) REFERENCES vendor_oem_masters (vendor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
