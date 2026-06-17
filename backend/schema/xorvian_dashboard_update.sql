USE xorvian;

ALTER TABLE agent_settings
  ADD COLUMN IF NOT EXISTS openai_model VARCHAR(120) NOT NULL DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS openai_temperature DECIMAL(3,2) NOT NULL DEFAULT 0.30,
  ADD COLUMN IF NOT EXISTS openai_max_tokens INT UNSIGNED NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS order_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reservation_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS gather_message VARCHAR(255) NOT NULL DEFAULT 'Is there anything else you need?',
  ADD COLUMN IF NOT EXISTS closing_message VARCHAR(255) NOT NULL DEFAULT 'Thank you. Goodbye.';

CREATE TABLE IF NOT EXISTS workflow_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  n8n_webhook_path VARCHAR(160) NOT NULL DEFAULT '',
  order_sheet_id VARCHAR(190) NOT NULL DEFAULT '',
  reservation_sheet_id VARCHAR(190) NOT NULL DEFAULT '',
  order_sheet_name VARCHAR(120) NOT NULL DEFAULT 'Sheet1',
  reservation_sheet_name VARCHAR(120) NOT NULL DEFAULT 'Sheet1',
  cloudinary_folder VARCHAR(160) NOT NULL DEFAULT 'xorvian-audio',
  twilio_language VARCHAR(20) NOT NULL DEFAULT 'en-US',
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
