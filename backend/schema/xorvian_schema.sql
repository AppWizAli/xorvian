CREATE DATABASE IF NOT EXISTS xorvian
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE xorvian;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  second_name VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_auth_tokens_hash (token_hash),
  KEY idx_auth_tokens_user_id (user_id),
  CONSTRAINT fk_auth_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS restaurant_profiles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  restaurant_name VARCHAR(160) NOT NULL DEFAULT '',
  business_phone VARCHAR(40) NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '',
  city VARCHAR(100) NOT NULL DEFAULT '',
  country VARCHAR(100) NOT NULL DEFAULT 'Canada',
  cuisine_type VARCHAR(100) NOT NULL DEFAULT '',
  timezone VARCHAR(80) NOT NULL DEFAULT 'America/Toronto',
  opening_hours TEXT NULL,
  delivery_zones TEXT NULL,
  reservation_policy TEXT NULL,
  menu_notes MEDIUMTEXT NULL,
  knowledge_base MEDIUMTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_restaurant_profiles_user_id (user_id),
  CONSTRAINT fk_restaurant_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  agent_name VARCHAR(120) NOT NULL DEFAULT 'Xorvian Assistant',
  language_code VARCHAR(20) NOT NULL DEFAULT 'en-CA',
  voice_provider VARCHAR(80) NOT NULL DEFAULT 'elevenlabs',
  voice_id VARCHAR(120) NOT NULL DEFAULT '',
  voice_model VARCHAR(120) NOT NULL DEFAULT 'eleven_flash_v2_5',
  twilio_phone VARCHAR(40) NOT NULL DEFAULT '',
  n8n_webhook_url VARCHAR(255) NOT NULL DEFAULT '',
  escalation_phone VARCHAR(40) NOT NULL DEFAULT '',
  notification_enabled TINYINT(1) NOT NULL DEFAULT 1,
  notification_channel VARCHAR(30) NOT NULL DEFAULT 'sms',
  notification_phone VARCHAR(40) NOT NULL DEFAULT '',
  notification_email VARCHAR(190) NOT NULL DEFAULT '',
  notification_min_urgency VARCHAR(20) NOT NULL DEFAULT 'urgent',
  call_mode ENUM('open', 'closed', 'holiday', 'private_event') NOT NULL DEFAULT 'open',
  closed_message VARCHAR(255) NOT NULL DEFAULT 'We are currently closed.',
  holiday_message VARCHAR(255) NOT NULL DEFAULT 'We are closed today due to holiday hours.',
  private_event_message VARCHAR(255) NOT NULL DEFAULT 'We are closed for a private event.',
  repeat_caller_greeting VARCHAR(255) NOT NULL DEFAULT 'Welcome back, {{name}}. How can I help you today?',
  silence_prompt_seconds INT UNSIGNED NOT NULL DEFAULT 10,
  silence_hangup_seconds INT UNSIGNED NOT NULL DEFAULT 20,
  backup_openai_model VARCHAR(120) NOT NULL DEFAULT '',
  system_prompt MEDIUMTEXT NULL,
  openai_model VARCHAR(120) NOT NULL DEFAULT 'gpt-4o-mini',
  openai_temperature DECIMAL(3,2) NOT NULL DEFAULT 0.30,
  openai_max_tokens INT UNSIGNED NOT NULL DEFAULT 300,
  order_enabled TINYINT(1) NOT NULL DEFAULT 1,
  reservation_enabled TINYINT(1) NOT NULL DEFAULT 1,
  gather_message VARCHAR(255) NOT NULL DEFAULT 'Is there anything else you need?',
  closing_message VARCHAR(255) NOT NULL DEFAULT 'Thank you. Goodbye.',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_agent_settings_user_id (user_id),
  CONSTRAINT fk_agent_settings_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workflow_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  n8n_webhook_path VARCHAR(160) NOT NULL DEFAULT '',
  order_sheet_id VARCHAR(190) NOT NULL DEFAULT '',
  reservation_sheet_id VARCHAR(190) NOT NULL DEFAULT '',
  order_sheet_name VARCHAR(120) NOT NULL DEFAULT 'Sheet1',
  reservation_sheet_name VARCHAR(120) NOT NULL DEFAULT 'Sheet1',
  cloudinary_folder VARCHAR(160) NOT NULL DEFAULT 'xorvian-audio',
  twilio_language VARCHAR(20) NOT NULL DEFAULT 'en-CA',
  output_format VARCHAR(80) NOT NULL DEFAULT 'mp3_44100_128',
  order_fields_json JSON NULL,
  reservation_fields_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_workflow_settings_user_id (user_id),
  CONSTRAINT fk_workflow_settings_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_menu_categories_user_id (user_id),
  CONSTRAINT fk_menu_categories_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  price DECIMAL(10,2) NULL,
  sizes_json JSON NULL,
  description TEXT NULL,
  modifiers TEXT NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_menu_items_user_id (user_id),
  KEY idx_menu_items_category_id (category_id),
  CONSTRAINT fk_menu_items_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_menu_items_category
    FOREIGN KEY (category_id) REFERENCES menu_categories(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  customer_name VARCHAR(160) NULL,
  customer_phone VARCHAR(40) NULL,
  order_status ENUM('new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled') NOT NULL DEFAULT 'new',
  order_total DECIMAL(10,2) NULL,
  order_items MEDIUMTEXT NULL,
  special_notes TEXT NULL,
  source VARCHAR(60) NOT NULL DEFAULT 'voice_ai',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_orders_user_id (user_id),
  KEY idx_orders_status (order_status),
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  guest_name VARCHAR(160) NULL,
  guest_phone VARCHAR(40) NULL,
  party_size INT UNSIGNED NULL,
  reservation_date DATE NULL,
  reservation_time TIME NULL,
  status ENUM('requested', 'confirmed', 'modified', 'cancelled', 'completed') NOT NULL DEFAULT 'requested',
  notes TEXT NULL,
  source VARCHAR(60) NOT NULL DEFAULT 'voice_ai',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_reservations_user_id (user_id),
  KEY idx_reservations_date (reservation_date),
  CONSTRAINT fk_reservations_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS call_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  call_sid VARCHAR(120) NULL,
  caller_phone VARCHAR(40) NULL,
  call_type ENUM('order', 'reservation', 'faq', 'support', 'unknown') NOT NULL DEFAULT 'unknown',
  call_status ENUM('answered', 'missed', 'completed', 'failed') NOT NULL DEFAULT 'answered',
  transcript MEDIUMTEXT NULL,
  ai_summary TEXT NULL,
  duration_seconds INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_call_logs_user_id (user_id),
  KEY idx_call_logs_type (call_type),
  CONSTRAINT fk_call_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS handoff_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  call_sid VARCHAR(120) NULL,
  customer_name VARCHAR(160) NULL,
  customer_phone VARCHAR(40) NULL,
  reason VARCHAR(255) NOT NULL DEFAULT '',
  urgency ENUM('normal', 'urgent', 'critical') NOT NULL DEFAULT 'normal',
  status ENUM('new', 'notified', 'contacted', 'resolved', 'cancelled') NOT NULL DEFAULT 'new',
  related_type VARCHAR(60) NOT NULL DEFAULT '',
  related_details MEDIUMTEXT NULL,
  conversation_summary MEDIUMTEXT NULL,
  best_callback_time VARCHAR(120) NOT NULL DEFAULT '',
  notification_channel VARCHAR(30) NOT NULL DEFAULT '',
  notification_status VARCHAR(30) NOT NULL DEFAULT '',
  notification_target VARCHAR(190) NOT NULL DEFAULT '',
  notification_error TEXT NULL,
  manager_notes TEXT NULL,
  source VARCHAR(60) NOT NULL DEFAULT 'voice_ai',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_handoff_requests_user_id (user_id),
  KEY idx_handoff_requests_status (status),
  KEY idx_handoff_requests_urgency (urgency),
  CONSTRAINT fk_handoff_requests_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (
  first_name,
  second_name,
  email,
  password_hash,
  role,
  status
) VALUES (
  'Xorvian',
  'Admin',
  'admin@gmail.com',
  '$2y$10$ZV6wLWJWiRUjj69TbhUbG.LXhK6PAkpUkTsSx7xe3k0AKDpx/fvoa',
  'admin',
  'active'
)
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  second_name = VALUES(second_name),
  password_hash = VALUES(password_hash),
  role = 'admin',
  status = 'active';

INSERT IGNORE INTO restaurant_profiles (user_id)
SELECT id FROM users WHERE email = 'admin@gmail.com';

INSERT IGNORE INTO agent_settings (user_id)
SELECT id FROM users WHERE email = 'admin@gmail.com';

INSERT IGNORE INTO workflow_settings (
  user_id,
  n8n_webhook_path,
  order_sheet_id,
  reservation_sheet_id,
  order_fields_json,
  reservation_fields_json
)
SELECT
  id,
  '7d1e2d95-94bc-4f30-8b40-39a01a8415ca',
  '1JGntuge-QWJo41kErND2ffWsvfLnbG-Akd9nqNt75mI',
  '1ptUzstPHCQxiBH2VLvsdTdMllXbc7R0cJCDj2Ti1cwU',
  JSON_ARRAY('Timestamp', 'Restaurant ID', 'Name', 'Phone', 'Address', 'Order', 'Caller ID', 'Call SID'),
  JSON_ARRAY('Timestamp', 'Restaurant ID', 'Name', 'Phone', 'Date', 'Time', 'Guests', 'Caller ID', 'Call SID')
FROM users
WHERE email = 'admin@gmail.com';
