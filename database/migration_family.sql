-- Existing database: add Family Tracker tables/columns (run once)
USE geosafe;

CREATE TABLE IF NOT EXISTS family_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  invite_code VARCHAR(12) NOT NULL UNIQUE,
  head_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE users
  ADD COLUMN family_group_id INT DEFAULT NULL,
  ADD COLUMN is_family_head TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN family_relationship VARCHAR(50) DEFAULT 'Member',
  ADD COLUMN safety_status ENUM('safe', 'need_help', 'injured', 'no_response') NOT NULL DEFAULT 'safe',
  ADD COLUMN last_latitude DECIMAL(10, 8) DEFAULT NULL,
  ADD COLUMN last_longitude DECIMAL(11, 8) DEFAULT NULL,
  ADD COLUMN last_location_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN battery_level TINYINT UNSIGNED DEFAULT NULL;

ALTER TABLE users
  ADD CONSTRAINT fk_users_family FOREIGN KEY (family_group_id) REFERENCES family_groups(id) ON DELETE SET NULL;
