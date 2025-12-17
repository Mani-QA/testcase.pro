-- Seed data for TestCase Pro
-- Default admin user (password: admin123)
INSERT OR IGNORE INTO users (email, password_hash, full_name) 
VALUES ('admin@testcasepro.com', '$argon2id$v=19$m=65536,t=3,p=4$random_salt$hashed_password', 'Admin User');

-- Sample folders
INSERT OR IGNORE INTO folders (name, parent_id, project_name) VALUES ('Login Module', NULL, 'Default');
INSERT OR IGNORE INTO folders (name, parent_id, project_name) VALUES ('Dashboard', NULL, 'Default');
INSERT OR IGNORE INTO folders (name, parent_id, project_name) VALUES ('User Management', NULL, 'Default');

-- Sample tags
INSERT OR IGNORE INTO tags (name) VALUES ('Smoke');
INSERT OR IGNORE INTO tags (name) VALUES ('Regression');
INSERT OR IGNORE INTO tags (name) VALUES ('Critical');
INSERT OR IGNORE INTO tags (name) VALUES ('UI');
INSERT OR IGNORE INTO tags (name) VALUES ('API');

