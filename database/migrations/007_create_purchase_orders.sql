-- Migration: 007_create_purchase_orders.sql
-- Description: Creates purchase_orders table and sequence trackers

CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    po_number VARCHAR(100) NOT NULL,
    po_date DATE NOT NULL,

    pr_id INT UNSIGNED NOT NULL,
    inquiry_id INT UNSIGNED NOT NULL,
    inquiry_vendor_id INT UNSIGNED NOT NULL,
    vendor_id INT UNSIGNED NOT NULL,

    pr_number VARCHAR(100) DEFAULT NULL,
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

    vendor_code VARCHAR(50) DEFAULT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    vendor_address TEXT,

    price_per_unit DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,

    expected_delivery_date DATE DEFAULT NULL,

    payment_type ENUM(
        'ADVANCE',
        'CREDIT',
        'ADVANCE_PLUS_BALANCE',
        'CUSTOM'
    ) NOT NULL,

    advance_type ENUM(
        'PERCENTAGE',
        'FIXED_AMOUNT'
    ) DEFAULT NULL,

    advance_value DECIMAL(15,2) DEFAULT NULL,
    balance_due_days SMALLINT UNSIGNED DEFAULT NULL,
    payment_terms_remarks TEXT,

    status ENUM(
        'DRAFT',
        'ISSUED',
        'CANCELLED',
        'COMPLETED'
    ) NOT NULL DEFAULT 'DRAFT',
    issued_po_path TEXT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (po_id),
    UNIQUE KEY uq_po_number (po_number),
    UNIQUE KEY uq_po_inquiry (inquiry_id),

    KEY idx_po_pr (pr_id),
    KEY idx_po_vendor (vendor_id),

    CONSTRAINT fk_po_pr FOREIGN KEY (pr_id) REFERENCES purchase_requests (id),
    CONSTRAINT fk_po_inquiry FOREIGN KEY (inquiry_id) REFERENCES vendor_inquiries (inquiry_id),
    CONSTRAINT fk_po_viv FOREIGN KEY (inquiry_vendor_id) REFERENCES vendor_inquiry_vendors (inquiry_vendor_id),
    CONSTRAINT fk_po_vendor FOREIGN KEY (vendor_id) REFERENCES vendor_oem_masters (vendor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
