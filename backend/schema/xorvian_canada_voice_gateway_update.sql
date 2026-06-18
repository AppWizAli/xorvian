USE xorvian;

ALTER TABLE restaurant_profiles
  ALTER country SET DEFAULT 'Canada',
  ALTER timezone SET DEFAULT 'America/Toronto';

ALTER TABLE agent_settings
  ALTER language_code SET DEFAULT 'en-CA',
  ALTER voice_model SET DEFAULT 'eleven_flash_v2_5';

ALTER TABLE workflow_settings
  ALTER twilio_language SET DEFAULT 'en-CA';

UPDATE restaurant_profiles
SET country = 'Canada'
WHERE country = '';

UPDATE restaurant_profiles
SET timezone = 'America/Toronto'
WHERE timezone = '' OR timezone = 'Asia/Karachi';

UPDATE agent_settings
SET language_code = 'en-CA'
WHERE language_code = '' OR language_code = 'en-US';

UPDATE agent_settings
SET voice_model = 'eleven_flash_v2_5'
WHERE voice_model = '' OR voice_model = 'eleven_flash_v2';

UPDATE workflow_settings
SET twilio_language = 'en-CA'
WHERE twilio_language = '' OR twilio_language = 'en-US';
