-- Seed: users.seed.sql
-- Description: Default system users with bcrypt hashes (Password@123)

INSERT INTO users (username, password_hash, role, is_active) VALUES
('admin', '$2b$10$7zB3Hl9iR1f8YpG.wL6EeeH7XzT0qP5X8s8M6k7Z.y6b0qV2W3K5.', 'ADMIN', 1),
('manager', '$2b$10$7zB3Hl9iR1f8YpG.wL6EeeH7XzT0qP5X8s8M6k7Z.y6b0qV2W3K5.', 'PROCUREMENT_MANAGER', 1),
('procurement', '$2b$10$7zB3Hl9iR1f8YpG.wL6EeeH7XzT0qP5X8s8M6k7Z.y6b0qV2W3K5.', 'PROCUREMENT', 1)
ON DUPLICATE KEY UPDATE role = VALUES(role), is_active = VALUES(is_active);
