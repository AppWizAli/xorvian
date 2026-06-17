# Xorvian Dynamic n8n Workflow Setup

## Files Created

- Dynamic workflow import file:
  `E:\Xorvian\Xorvian Dynamic Restaurant Employee.json`

- Backend endpoints:
  `C:\xampp\htdocs\Xorvian backend\api\n8n_context.php`
  `C:\xampp\htdocs\Xorvian backend\api\n8n_save_order.php`
  `C:\xampp\htdocs\Xorvian backend\api\n8n_save_reservation.php`

## How The Dynamic System Works

1. Twilio sends the call to n8n.
2. n8n calls `n8n_context.php`.
3. PHP/MySQL finds the correct customer using:
   - Twilio `To` phone number, or
   - dashboard `n8n webhook path`, or
   - `restaurantId` query parameter.
4. Backend returns that customer's:
   - restaurant profile
   - menu JSON
   - knowledge base
   - AI settings
   - ElevenLabs voice/model
   - Twilio language
   - webhook path
5. n8n builds the prompt dynamically.
6. OpenAI replies.
7. ElevenLabs generates voice.
8. Cloudinary hosts the audio.
9. Twilio plays the audio.
10. Completed orders/reservations save into MySQL through backend endpoints.

## Import Steps

1. Open n8n.
2. Import:
   `E:\Xorvian\Xorvian Dynamic Restaurant Employee.json`
3. Confirm credentials are still selected for:
   - OpenAI bearer auth
   - ElevenLabs
   - Cloudinary
4. Activate the workflow.
5. Copy the production webhook URL from the `Twilio Webhook` node.
6. Put that webhook URL/path into the customer's dashboard workflow settings.

## Important Backend URL Note

The generated workflow currently calls:

`http://localhost/Xorvian%20backend/api`

This works only if n8n runs on the same machine as XAMPP.

If you use n8n cloud, Hostinger, or another server, replace this in the imported workflow:

`http://localhost/Xorvian%20backend/api`

with your public backend URL, for example:

`https://yourdomain.com/Xorvian%20backend/api`

or a cleaner production path such as:

`https://yourdomain.com/api`

## Shared Secret

The workflow and backend use:

`xorvian_n8n_secret`

Backend value is in:

`C:\xampp\htdocs\Xorvian backend\api\config.php`

If you change it there, also update it inside n8n nodes:

- `Restaurant Config`
- `Save Order`
- `Save Reservation`

## Customer Setup Required

For each customer, fill these dashboard fields:

1. Restaurant Profile:
   - restaurant name
   - phone
   - address
   - hours
   - delivery zones
   - reservation policy

2. Menu & Knowledge:
   - paste menu text
   - convert to JSON
   - save menu
   - add FAQ/policies/knowledge base

3. AI Assistant:
   - ElevenLabs voice ID
   - voice model
   - OpenAI model
   - Twilio phone number

4. Workflow:
   - n8n webhook path
   - full webhook URL if needed
   - order/reservation storage settings

## Recommended Dynamic Customer Routing

Best production method:

- Give each restaurant its own Twilio number.
- Save that number in the dashboard field `Twilio Phone`.
- n8n sends Twilio `To` number to the backend.
- Backend uses `To` number to find the right customer.

Alternative:

- Add `?restaurantId=USER_ID` to the Twilio webhook URL.

## Current Save Behavior

Orders save to MySQL table:

`orders`

Reservations save to MySQL table:

`reservations`

Google Sheets nodes were replaced with backend HTTP nodes so the dashboard can show the data later.
