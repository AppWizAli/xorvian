USE xorvian;

ALTER TABLE agent_settings
  ADD COLUMN IF NOT EXISTS call_mode ENUM('open', 'closed', 'holiday', 'private_event') NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS closed_message VARCHAR(255) NOT NULL DEFAULT 'We are currently closed.',
  ADD COLUMN IF NOT EXISTS holiday_message VARCHAR(255) NOT NULL DEFAULT 'We are closed today due to holiday hours.',
  ADD COLUMN IF NOT EXISTS private_event_message VARCHAR(255) NOT NULL DEFAULT 'We are closed for a private event.',
  ADD COLUMN IF NOT EXISTS repeat_caller_greeting VARCHAR(255) NOT NULL DEFAULT 'Welcome back, {{name}}. How can I help you today?',
  ADD COLUMN IF NOT EXISTS silence_prompt_seconds INT UNSIGNED NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS silence_hangup_seconds INT UNSIGNED NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS backup_openai_model VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS assistant_response_style VARCHAR(20) NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS assistant_min_response_chars INT UNSIGNED NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS assistant_buffer_chars INT UNSIGNED NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS assistant_flush_delay_ms INT UNSIGNED NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS elevenlabs_streaming_latency TINYINT UNSIGNED NOT NULL DEFAULT 3;
