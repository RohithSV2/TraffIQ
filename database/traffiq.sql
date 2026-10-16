-- ========================================================
-- TraffIQ Database Schema & Seed Data
-- AI-Powered Traffic Prediction and Smart Route Recommendation System
-- Compatible with MySQL 8.0+ / MariaDB / MySQL Workbench
-- ========================================================

CREATE DATABASE IF NOT EXISTS `traffiq_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `traffiq_db`;

-- 1. Roads Table
DROP TABLE IF EXISTS `roads`;
CREATE TABLE `roads` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `road_code` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `road_type` ENUM('Highway', 'Arterial', 'Urban', 'Residential') NOT NULL DEFAULT 'Arterial',
  `length_km` DECIMAL(6, 2) NOT NULL,
  `speed_limit` INT NOT NULL,
  `capacity_vph` INT NOT NULL,
  `current_volume` INT NOT NULL DEFAULT 500,
  `current_avg_speed` DECIMAL(5, 2) NOT NULL DEFAULT 40.0,
  `current_congestion` ENUM('Low', 'Moderate', 'High') NOT NULL DEFAULT 'Low',
  `start_lat` DECIMAL(9, 6) NOT NULL,
  `start_lng` DECIMAL(9, 6) NOT NULL,
  `end_lat` DECIMAL(9, 6) NOT NULL,
  `end_lng` DECIMAL(9, 6) NOT NULL,
  `coordinates_json` TEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Traffic Predictions Table
DROP TABLE IF EXISTS `traffic_predictions`;
CREATE TABLE `traffic_predictions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `road_id` INT NULL,
  `road_type` VARCHAR(50) NOT NULL,
  `traffic_volume` INT NOT NULL,
  `avg_speed` DECIMAL(5, 2) NOT NULL,
  `time_of_day` INT NOT NULL,
  `day_of_week` INT NOT NULL,
  `weather` VARCHAR(50) NOT NULL,
  `incident_reported` INT DEFAULT 0,
  `emergency_vehicle` INT DEFAULT 0,
  `predicted_congestion` ENUM('Low', 'Moderate', 'High') NOT NULL,
  `confidence` DECIMAL(5, 4) NOT NULL,
  `probabilities_json` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`road_id`) REFERENCES `roads`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3. Community Incidents & Road Reports Table
DROP TABLE IF EXISTS `incidents`;
CREATE TABLE `incidents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(150) NOT NULL,
  `incident_type` ENUM('Accident', 'Roadwork', 'Heavy Congestion', 'Hazard', 'Waterlogging', 'Vehicle Breakdown') NOT NULL,
  `severity` ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium',
  `road_name` VARCHAR(150) NOT NULL,
  `latitude` DECIMAL(9, 6) NOT NULL,
  `longitude` DECIMAL(9, 6) NOT NULL,
  `description` TEXT,
  `reporter_name` VARCHAR(100) DEFAULT 'Anonymous Commuter',
  `status` ENUM('Reported', 'Verified', 'Resolved', 'Dismissed') NOT NULL DEFAULT 'Reported',
  `upvotes` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. Emergency Alerts & Announcements Table
DROP TABLE IF EXISTS `alerts`;
CREATE TABLE `alerts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `alert_type` ENUM('Emergency', 'Weather', 'Road Closure', 'Congestion Warning') NOT NULL,
  `priority` ENUM('Normal', 'High', 'Urgent') NOT NULL DEFAULT 'Normal',
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 5. Emergency Vehicles Table
DROP TABLE IF EXISTS `emergency_vehicles`;
CREATE TABLE `emergency_vehicles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `vehicle_code` VARCHAR(50) NOT NULL UNIQUE,
  `vehicle_type` ENUM('Ambulance', 'Fire Truck', 'Police Patrol') NOT NULL,
  `current_route` VARCHAR(150) NOT NULL,
  `latitude` DECIMAL(9, 6) NOT NULL,
  `longitude` DECIMAL(9, 6) NOT NULL,
  `speed_kmh` DECIMAL(5, 2) NOT NULL DEFAULT 55.0,
  `destination` VARCHAR(150) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 6. Admin Users Table
DROP TABLE IF EXISTS `admin_users`;
CREATE TABLE `admin_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ========================================================
-- Seed Data
-- ========================================================

-- Insert Sample Roads (Metropolitan area layout)
INSERT INTO `roads` (`road_code`, `name`, `road_type`, `length_km`, `speed_limit`, `capacity_vph`, `current_volume`, `current_avg_speed`, `current_congestion`, `start_lat`, `start_lng`, `end_lat`, `end_lng`, `coordinates_json`) VALUES
('RD-01', 'Express Ring Highway (Northeast)', 'Highway', 18.5, 90, 3000, 2450, 42.0, 'Moderate', 12.9716, 77.5946, 13.0425, 77.6350, '[[12.9716, 77.5946], [12.9950, 77.6100], [13.0210, 77.6250], [13.0425, 77.6350]]'),
('RD-02', 'Central Tech Corridor Arterial', 'Arterial', 12.2, 60, 1800, 1680, 21.0, 'High', 12.9352, 77.6245, 12.9850, 77.6450, '[[12.9352, 77.6245], [12.9550, 77.6350], [12.9720, 77.6400], [12.9850, 77.6450]]'),
('RD-03', 'Metro Green Line Bypass', 'Arterial', 14.8, 60, 1800, 790, 52.0, 'Low', 12.9220, 77.5850, 12.9810, 77.5980, '[[12.9220, 77.5850], [12.9430, 77.5890], [12.9650, 77.5920], [12.9810, 77.5980]]'),
('RD-04', 'Airport Express Elevated Corridor', 'Highway', 26.0, 90, 3200, 1400, 78.0, 'Low', 13.0200, 77.6000, 13.1986, 77.7066, '[[13.0200, 77.6000], [13.0800, 77.6300], [13.1400, 77.6700], [13.1986, 77.7066]]'),
('RD-05', 'Downtown Old City Heritage Way', 'Urban', 7.5, 45, 1200, 1150, 16.5, 'High', 12.9650, 77.5750, 12.9900, 77.5820, '[[12.9650, 77.5750], [12.9750, 77.5780], [12.9900, 77.5820]]'),
('RD-06', 'South Ring Suburban Link', 'Residential', 9.4, 35, 700, 320, 31.0, 'Low', 12.9050, 77.6020, 12.9300, 77.6380, '[[12.9050, 77.6020], [12.9180, 77.6200], [12.9300, 77.6380]]');

-- Insert Initial Incidents
INSERT INTO `incidents` (`title`, `incident_type`, `severity`, `road_name`, `latitude`, `longitude`, `description`, `reporter_name`, `status`, `upvotes`) VALUES
('Two-car fender bender near Exit 4', 'Accident', 'Medium', 'Central Tech Corridor Arterial', 12.9550, 77.6350, 'Minor collision blocking the right lane. Recovery vehicle on site.', 'Rohith (Commuter)', 'Verified', 14),
('Flyover Expansion Joint Repair', 'Roadwork', 'High', 'Express Ring Highway (Northeast)', 13.0210, 77.6250, 'Roadwork underway. Lane narrowed from 3 lanes to 1 lane.', 'Traffic Control Room', 'Verified', 29),
('Waterlogging beneath Underpass', 'Waterlogging', 'Medium', 'Downtown Old City Heritage Way', 12.9750, 77.5780, 'Heavy rain accumulation causing vehicle slow down. Low ground vehicles avoid.', 'City Patrol', 'Reported', 8);

-- Insert Initial Alerts
INSERT INTO `alerts` (`title`, `message`, `alert_type`, `priority`, `active`) VALUES
('Priority Corridor Activated', 'Emergency corridor active on MG Road towards Apollo Memorial Hospital. Motorists requested to keep left.', 'Emergency', 'Urgent', TRUE),
('Monsoon Downpour Warning', 'Scattered heavy showers reported across North sectors. Reduce vehicle speed by 20% to avoid hydroplaning.', 'Weather', 'High', TRUE),
('Weekend Maintenance Notice', 'Elevated highway maintenance scheduled between 23:00 and 05:00 on Sunday.', 'Road Closure', 'Normal', TRUE);

-- Insert Emergency Vehicles
INSERT INTO `emergency_vehicles` (`vehicle_code`, `vehicle_type`, `current_route`, `latitude`, `longitude`, `speed_kmh`, `destination`, `active`) VALUES
('AMB-108', 'Ambulance', 'Central Tech Corridor Arterial', 12.9620, 77.6380, 62.0, 'General Multi-Speciality Hospital', TRUE),
('FIRE-04', 'Fire Truck', 'Express Ring Highway (Northeast)', 13.0100, 77.6200, 58.0, 'Sector 7 Industrial Complex', TRUE);

-- Insert Admin Account (default credentials: admin / traffiq2026)
INSERT INTO `admin_users` (`username`, `password_hash`, `role`) VALUES
('admin', 'traffiq2026', 'admin');
