-- GeoSafe MySQL Schema
CREATE DATABASE IF NOT EXISTS geosafe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE geosafe;

DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS family_groups;

CREATE TABLE family_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  invite_code VARCHAR(12) NOT NULL UNIQUE,
  head_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('resident', 'admin', 'responder') NOT NULL DEFAULT 'resident',
  family_group_id INT DEFAULT NULL,
  is_family_head TINYINT(1) NOT NULL DEFAULT 0,
  family_relationship VARCHAR(50) DEFAULT 'Member',
  safety_status ENUM('safe', 'need_help', 'injured', 'no_response') NOT NULL DEFAULT 'safe',
  last_latitude DECIMAL(10, 8) DEFAULT NULL,
  last_longitude DECIMAL(11, 8) DEFAULT NULL,
  last_location_at TIMESTAMP NULL DEFAULT NULL,
  battery_level TINYINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_group_id) REFERENCES family_groups(id) ON DELETE SET NULL
);

ALTER TABLE family_groups
  ADD CONSTRAINT fk_family_head FOREIGN KEY (head_user_id) REFERENCES users(id) ON DELETE RESTRICT;

CREATE TABLE reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  incident_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  severity ENUM('low', 'medium', 'high') DEFAULT NULL,
  status ENUM('pending', 'verified', 'responding', 'on_site', 'resolved') NOT NULL DEFAULT 'pending',
  assigned_to INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message TEXT NOT NULL,
  severity ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Run `npm run seed` in backend/ to create default admin & responder accounts
