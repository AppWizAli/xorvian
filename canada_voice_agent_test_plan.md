# Canada Voice Agent Test Plan

## Goal

Test Xorvian as a Canada-first restaurant phone agent using:

```text
Canadian Twilio number
-> Node voice-gateway
-> OpenAI Realtime for listening/reasoning/tool calls
-> ElevenLabs streaming voice
-> existing PHP APIs for restaurant context, orders, and reservations
```

## What Changed

- Added `voice-gateway/`, a standalone Node.js WebSocket voice service.
- Removed Cloudinary from the realtime call path.
- Kept ElevenLabs as the caller-facing voice.
- Added agent tool calls for orders, reservations, and handoff.
- Updated defaults to Canada-oriented values: `Canada`, `America/Toronto`, `en-CA`, `CAD`.
- Added `backend/schema/xorvian_canada_voice_gateway_update.sql` for live database defaults.

## Local Test

```bash
cd voice-gateway
npm install
copy .env.example .env
npm run check
npm start
```

Expose it:

```bash
ngrok http 8080
```

Set in `.env`:

```text
PUBLIC_BASE_URL=https://your-ngrok-domain.ngrok-free.app
XORVIAN_API_BASE=https://aliportfolio.org/xorvian/backend/api
XORVIAN_SHARED_SECRET=xorvian_n8n_secret
OPENAI_API_KEY=your-openai-key
ELEVENLABS_API_KEY=your-elevenlabs-key
VOICE_GATEWAY_TOKEN=long-random-token
```

Health check:

```text
https://your-ngrok-domain.ngrok-free.app/health
```

## Twilio Canada Setup

Set the Canadian Twilio number voice webhook:

```text
POST https://your-ngrok-domain.ngrok-free.app/twilio/incoming?token=long-random-token
```

For the restaurant's original number, start with forwarding only:

```text
No answer after 15-20 seconds -> Canadian Twilio number
Busy -> Canadian Twilio number
After-hours -> Canadian Twilio number
```

Do full-time forwarding only after the agent passes real order/reservation tests.

## First Restaurant Test Data

In the dashboard/API, make sure the restaurant has:

- `twilio_phone`: the Canadian Twilio number in E.164 format, for example `+14165550123`
- `country`: `Canada`
- `timezone`: `America/Toronto`
- `languageCode` / `twilioLanguage`: `en-CA`
- `voiceProvider`: `elevenlabs`
- `voiceModel`: `eleven_flash_v2_5`
- `voiceId`: the ElevenLabs voice you want
- menu categories and items
- reservation/order enabled as needed

## Test Calls

Run these manually before selling:

1. Basic greeting: agent answers naturally in under 2 seconds after call connects.
2. Menu question: caller asks about pizza/burger/special; agent does not dump full menu.
3. Name capture: say a noisy or uncommon name; agent confirms it.
4. Phone capture: agent asks to use caller ID or confirms slowly.
5. Pickup order: agent collects name, phone, items, pickup time/details, confirms, saves order.
6. Delivery order: agent collects address and confirms before saving.
7. Reservation: agent collects name, phone, date, time, guests, confirms, saves reservation.
8. Interruption: speak while the agent is talking; audio should clear and the agent should listen.
9. Human request: caller asks for staff; agent should hand off or explain staff will follow up.
10. Failure path: temporarily disable the PHP API and confirm the agent apologizes instead of crashing.

## Launch Rules

- Do not sell unlimited minutes.
- Start with overflow, missed-call, and after-hours answering.
- Track cost per call minute before marketing spend.
- Keep n8n for background workflows only.
- Use a VPS/Cloud Run/Fargate-style runtime for `voice-gateway`; shared PHP hosting is not suitable for this service.
