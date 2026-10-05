-- Seed: roles.seed.sql
-- Description: Default system roles and permissions

INSERT INTO roles (role_name, description) VALUES
('ADMIN', 'Full system access, user management, global approvals, reports and audit logs'),
('PROCUREMENT_MANAGER', 'Manages PRs, RFQs, vendor selection, PO approvals and tracking'),
('PROCUREMENT', 'Creates PRs, sends inquiries, collects quotations, records goods receipts')
ON DUPLICATE KEY UPDATE description = VALUES(description);
