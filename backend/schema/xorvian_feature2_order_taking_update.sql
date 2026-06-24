USE xorvian;

ALTER TABLE agent_settings
  ADD COLUMN IF NOT EXISTS order_review_required TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS order_tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS pickup_lead_minutes INT UNSIGNED NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS delivery_lead_minutes INT UNSIGNED NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS catering_threshold_people INT UNSIGNED NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS minimum_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS order_currency VARCHAR(8) NOT NULL DEFAULT 'CAD',
  ADD COLUMN IF NOT EXISTS order_sms_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS order_pos_provider VARCHAR(40) NOT NULL DEFAULT 'dashboard',
  ADD COLUMN IF NOT EXISTS order_pos_endpoint VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS order_kitchen_channel VARCHAR(40) NOT NULL DEFAULT 'dashboard';

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS search_keywords VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS allergen_notes VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS is_featured TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS modifier_prices_json JSON NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type ENUM('pickup', 'delivery', 'catering', 'scheduled', 'asap', 'dine_in') NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS review_status ENUM('draft', 'reviewed', 'confirmed') NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(8) NOT NULL DEFAULT 'CAD',
  ADD COLUMN IF NOT EXISTS customer_address VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS apartment_number VARCHAR(60) NULL,
  ADD COLUMN IF NOT EXISTS delivery_instructions TEXT NULL,
  ADD COLUMN IF NOT EXISTS scheduled_for DATETIME NULL,
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS guest_count INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS budget_amount DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS order_payload JSON NULL,
  ADD COLUMN IF NOT EXISTS duplicate_hash CHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS duplicate_of_order_id BIGINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS parent_order_id BIGINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS estimated_ready_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS estimated_delivery_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS pos_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pos_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_sms_status VARCHAR(30) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_sms_error TEXT NULL,
  ADD INDEX IF NOT EXISTS idx_orders_type (order_type),
  ADD INDEX IF NOT EXISTS idx_orders_duplicate_hash (duplicate_hash),
  ADD INDEX IF NOT EXISTS idx_orders_phone (customer_phone),
  ADD INDEX IF NOT EXISTS idx_orders_scheduled_for (scheduled_for);

UPDATE workflow_settings
SET order_fields_json = JSON_ARRAY(
  'Timestamp',
  'Restaurant ID',
  'Order Type',
  'Customer Name',
  'Phone',
  'Address',
  'Apartment',
  'Instructions',
  'Scheduled For',
  'Items',
  'Modifiers',
  'Subtotal',
  'Tax',
  'Delivery Fee',
  'Discount',
  'Total',
  'Caller ID',
  'Call SID'
)
WHERE order_fields_json IS NULL OR JSON_LENGTH(order_fields_json) < 10;
