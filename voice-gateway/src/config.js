import 'dotenv/config';

function env(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function integerEnv(name, fallback) {
  const value = Number.parseInt(env(name), 10);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  port: integerEnv('PORT', 8080),
  nodeEnv: env('NODE_ENV', 'development'),
  publicBaseUrl: env('PUBLIC_BASE_URL'),
  gatewayToken: env('VOICE_GATEWAY_TOKEN'),
  openaiApiKey: env('OPENAI_API_KEY'),
  openaiRealtimeModel: env('OPENAI_REALTIME_MODEL', 'gpt-realtime-2'),
  openaiTranscriptionModel: env('OPENAI_TRANSCRIPTION_MODEL', 'whisper-1'),
  elevenLabsApiKey: env('ELEVENLABS_API_KEY'),
  elevenLabsDefaultVoiceId: env('ELEVENLABS_DEFAULT_VOICE_ID', 'ugPTAEnkrnbtfSNMzaSY'),
  elevenLabsDefaultModel: env('ELEVENLABS_DEFAULT_MODEL', 'eleven_flash_v2_5'),
  elevenLabsOutputFormat: env('ELEVENLABS_OUTPUT_FORMAT', 'ulaw_8000'),
  elevenLabsOptimizeStreamingLatency: env('ELEVENLABS_OPTIMIZE_STREAMING_LATENCY', '3'),
  twilioAccountSid: env('TWILIO_ACCOUNT_SID'),
  twilioAuthToken: env('TWILIO_AUTH_TOKEN'),
  twilioFromPhone: env('TWILIO_FROM_PHONE'),
  twilioWhatsappFrom: env('TWILIO_WHATSAPP_FROM'),
  xorvianApiBase: env('XORVIAN_API_BASE').replace(/\/+$/, ''),
  xorvianSharedSecret: env('XORVIAN_SHARED_SECRET'),
  defaultRestaurantId: env('DEFAULT_RESTAURANT_ID'),
  defaultLanguage: env('DEFAULT_LANGUAGE', 'en-CA'),
  defaultTimezone: env('DEFAULT_TIMEZONE', 'America/Toronto'),
  defaultCurrency: env('DEFAULT_CURRENCY', 'CAD'),
  defaultCountry: env('DEFAULT_COUNTRY', 'Canada'),
  logLevel: env('LOG_LEVEL', 'info'),
};

export function requireRuntimeConfig() {
  const missing = [];

  for (const [key, value] of Object.entries({
    OPENAI_API_KEY: config.openaiApiKey,
    ELEVENLABS_API_KEY: config.elevenLabsApiKey,
    XORVIAN_API_BASE: config.xorvianApiBase,
    XORVIAN_SHARED_SECRET: config.xorvianSharedSecret,
  })) {
    if (!value) missing.push(key);
  }

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export function publicWebSocketUrl(path, req) {
  const base = config.publicBaseUrl || `https://${req.headers.host}`;
  const url = new URL(path, base);

  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  return url.toString();
}
