USE xorvian;

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
  JSON_ARRAY('Timestamp', 'Restaurant ID', 'Order Type', 'Customer Name', 'Phone', 'Address', 'Apartment', 'Instructions', 'Scheduled For', 'Items', 'Modifiers', 'Subtotal', 'Tax', 'Delivery Fee', 'Discount', 'Total', 'Caller ID', 'Call SID'),
  JSON_ARRAY('Timestamp', 'Restaurant ID', 'Name', 'Phone', 'Date', 'Time', 'Guests', 'Caller ID', 'Call SID')
FROM users
WHERE email = 'admin@gmail.com';
