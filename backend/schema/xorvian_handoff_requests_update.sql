USE xorvian;

ALTER TABLE agent_settings
  ADD COLUMN IF NOT EXISTS notification_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notification_channel VARCHAR(30) NOT NULL DEFAULT 'sms',
  ADD COLUMN IF NOT EXISTS notification_phone VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notification_email VARCHAR(190) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notification_min_urgency VARCHAR(20) NOT NULL DEFAULT 'urgent';

UPDATE agent_settings
SET notification_phone = escalation_phone
WHERE notification_phone = '' AND escalation_phone <> '';

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
