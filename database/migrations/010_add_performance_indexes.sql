-- Migration: 010_add_performance_indexes.sql
-- Description: Adds high-impact B-Tree indexes for fast searches, status filtering, date range scans, and lead-time calculations

-- 1. Purchase Orders (optimizes past-price search, status filtering, analytics date ranges)
CREATE INDEX IF NOT EXISTS idx_po_model ON purchase_orders (model);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders (status);
CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders (po_date);
CREATE INDEX IF NOT EXISTS idx_po_status_date ON purchase_orders (status, po_date);

-- 2. Purchase Requests (optimizes management-insights and order-tracking date filters)
CREATE INDEX IF NOT EXISTS idx_pr_date ON purchase_requests (pr_date);

-- 3. Vendor Inquiries (optimizes lookup of active inquiries)
CREATE INDEX IF NOT EXISTS idx_vi_status ON vendor_inquiries (status);

-- 4. Goods Received & Goods Returns (optimizes receipt dates and stock tracking)
CREATE INDEX IF NOT EXISTS idx_gr_date ON goods_received (received_date);
CREATE INDEX IF NOT EXISTS idx_gr_poid_date ON goods_received (po_id, received_date);
CREATE INDEX IF NOT EXISTS idx_ret_poid ON goods_returns (po_id);
