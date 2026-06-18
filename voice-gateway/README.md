# Xorvian Voice Gateway

Canada-first realtime voice service for restaurant calls.

The PHP app remains the dashboard and business API. This Node service handles live calls:

```text
Restaurant original number
-> forwards to Canadian Twilio number
-> /twilio/incoming
-> Twilio bidirectional Media Stream
-> OpenAI Realtime for listening, reasoning, and tool calls
-> ElevenLabs streaming TTS in ulaw_8000
-> Twilio caller audio
```

## Why This Exists

The old n8n flow waits for several network hops before speaking: Twilio STT, n8n, OpenAI, ElevenLabs file creation, Cloudinary upload, then Twilio playback. This service removes Cloudinary and streams the caller-facing voice directly from ElevenLabs to Twilio.

## Local Setup

```bash
cd voice-gateway
npm install
cp .env.example .env
npm run check
npm start
```

Expose the local service for Twilio testing:

```bash
ngrok http 8080
```

Set `PUBLIC_BASE_URL` to the HTTPS ngrok URL.

## Required Environment

```bash
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
XORVIAN_API_BASE=https://aliportfolio.org/xorvian/backend/api
XORVIAN_SHARED_SECRET=...
PUBLIC_BASE_URL=https://voice.example.com
VOICE_GATEWAY_TOKEN=long-random-token
```

Use `eleven_flash_v2_5` where available for lower latency. The service requests `ulaw_8000`, which Twilio can play directly over a bidirectional Media Stream.
The default OpenAI realtime model is `gpt-realtime-2`; keep it configurable because model availability can vary by account. Incoming Twilio 8 kHz μ-law audio is converted to 24 kHz PCM before it is sent to OpenAI, and ElevenLabs returns `ulaw_8000` for direct Twilio playback.

## Twilio Canada Setup

1. Buy or use a Canadian Twilio phone number.
2. In the Twilio number voice settings, set **A call comes in** to:

```text
POST https://voice.example.com/twilio/incoming?token=long-random-token
```

3. For a restaurant's original number, configure the restaurant phone provider to forward:

```text
Busy / no-answer / after-hours -> Canadian Twilio number
```

For early customers, avoid full-time forwarding until the agent is proven. Busy/no-answer forwarding lets the AI act as overflow and missed-call recovery first.

## Restaurant Matching

The service asks the existing PHP API for context using:

```text
backend/api/n8n_context.php
```

It passes Twilio `To`, `From`, `CallSid`, and optional `restaurantId`. The PHP API matches by `agent_settings.twilio_phone`, `restaurant_profiles.business_phone`, or explicit `restaurantId`.

## Tool Calls

The realtime agent can save data through the existing PHP endpoints:

```text
create_order       -> backend/api/n8n_save_order.php
create_reservation -> backend/api/n8n_save_reservation.php
request_handoff    -> returns a handoff request to the model
```

The agent is instructed to call tools only after confirming details with the caller.

## Production Notes

- Host this on a real Node runtime, not shared PHP hosting.
- Use a small VPS, Cloud Run, Fly.io, or AWS ECS/Fargate for launch.
- Put HTTPS/WSS behind a load balancer or reverse proxy.
- Run multiple instances when call volume grows.
- Add Redis before scale-out if you add cross-call state, rate limits, or queues.
- Keep n8n for background automations only.
- Do not offer unlimited minutes; use included-minute plans and extra-minute billing.

## Canada Launch Defaults

The `.env.example` defaults are Canada-oriented:

```text
DEFAULT_LANGUAGE=en-CA
DEFAULT_TIMEZONE=America/Toronto
DEFAULT_CURRENCY=CAD
DEFAULT_COUNTRY=Canada
```

Restaurant-level settings from the PHP dashboard override language, voice ID, voice model, prompt, ordering, and reservation behavior.
