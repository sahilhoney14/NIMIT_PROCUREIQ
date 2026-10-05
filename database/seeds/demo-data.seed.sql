-- Seed: demo-data.seed.sql
-- Description: Sample PRs, RFQs, Quotations and Purchase Orders for testing and demonstration

INSERT INTO purchase_requests (
    pr_number, pr_date, party_name, location, territory, product_category,
    item_name, product_remarks, make, model, qty, unit, sales_rate, taxable_value
) VALUES (
    'NEE/26-27/PR/0001', '2026-04-10', 'JSW Steel Ltd.', 'Vadodara', 'West', 'Electrical',
    'Industrial LED Flood Light 150W', 'High-mast lighting', 'Philips', 'BVP150', 50, 'Units', 2400.00, 120000.00
) ON DUPLICATE KEY UPDATE item_name = VALUES(item_name);
