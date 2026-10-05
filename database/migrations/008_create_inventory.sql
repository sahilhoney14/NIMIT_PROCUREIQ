-- Migration: 008_create_inventory.sql
-- Description: Creates goods_received and goods_returns tables

CREATE TABLE IF NOT EXISTS goods_received (
    receipt_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    po_id BIGINT UNSIGNED NOT NULL,
    received_quantity DECIMAL(12,2) NOT NULL,
    defective_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    received_date DATE NOT NULL,
    received_by BIGINT UNSIGNED NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (receipt_id),
    KEY idx_gr_po (po_id),
    KEY idx_gr_user (received_by),

    CONSTRAINT fk_gr_po FOREIGN KEY (po_id) REFERENCES purchase_orders (po_id),
    CONSTRAINT fk_gr_user FOREIGN KEY (received_by) REFERENCES users (user_id),

    CHECK (received_quantity > 0),
    CHECK (defective_quantity >= 0),
    CHECK (defective_quantity <= received_quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS goods_returns (
    return_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    po_id BIGINT UNSIGNED NOT NULL,
    receipt_id BIGINT UNSIGNED DEFAULT NULL,
    return_quantity DECIMAL(12,2) NOT NULL,
    return_date DATE NOT NULL,
    return_reason TEXT NOT NULL,
    returned_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (return_id),
    KEY idx_ret_po (po_id),
    KEY idx_ret_receipt (receipt_id),
    KEY idx_ret_user (returned_by),

    CONSTRAINT fk_ret_po FOREIGN KEY (po_id) REFERENCES purchase_orders (po_id),
    CONSTRAINT fk_ret_receipt FOREIGN KEY (receipt_id) REFERENCES goods_received (receipt_id),
    CONSTRAINT fk_ret_user FOREIGN KEY (returned_by) REFERENCES users (user_id),

    CHECK (return_quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
