# Deploy Xorvian To aliportfolio.org/xorvian

## Why You Saw The n8n Error

n8n blocked this URL:

`127.0.0.1`

That is normal security behavior. n8n cloud/server cannot call your local XAMPP backend. The backend must be uploaded to a public URL.

## Upload Structure

Upload the contents of `E:\Xorvian` into:

`public_html/xorvian`

Your live structure should look like:

```text
public_html/
  xorvian/
    index.html
    login.html
    signup.html
    dashboard.html
    admin.html
    index.css
    index.js
    assets/
    backend/
      api/
      schema/
```

## Backend URL

After upload, the backend API should be reachable at:

`https://aliportfolio.org/xorvian/backend/api`

Example:

`https://aliportfolio.org/xorvian/backend/api/login.php`

## Database Setup

1. Open hosting cPanel / hPanel.
2. Create a MySQL database.
3. Create a MySQL user.
4. Assign the user to the database with all privileges.
5. Open phpMyAdmin.
6. Import:

`backend/schema/xorvian_schema.sql`

## Update Live Database Config

Edit this file after upload:

`backend/api/config.php`

Set these values:

```php
const DB_HOST = 'localhost';
const DB_NAME = 'YOUR_HOSTING_DATABASE_NAME';
const DB_USER = 'YOUR_HOSTING_DATABASE_USER';
const DB_PASS = 'YOUR_HOSTING_DATABASE_PASSWORD';
```

Keep this the same unless you also update the n8n workflow:

```php
const N8N_SHARED_SECRET = 'xorvian_n8n_secret';
```

## Admin Login

The schema creates:

Email:

`admin@gmail.com`

Password:

`admin`

Login here:

`https://aliportfolio.org/xorvian/login.html`

Admin redirects to:

`https://aliportfolio.org/xorvian/admin.html`

## n8n Workflow To Import

Import this file into n8n:

`E:\Xorvian\Xorvian Dynamic Restaurant Employee LIVE.json`

This workflow uses:

`https://aliportfolio.org/xorvian/backend/api`

instead of localhost.

## Customer Setup Flow

1. Customer signs up from:
   `https://aliportfolio.org/xorvian/signup.html`
2. Customer fills dashboard:
   - Restaurant Profile
   - AI Assistant
   - Menu & Knowledge
   - Workflow
3. In n8n, use the LIVE workflow.
4. In Twilio, point the phone number webhook to the n8n production webhook.
5. In the customer's dashboard, save the Twilio phone number in AI Assistant settings.

## Best Dynamic Routing Method

For every restaurant customer:

- Give them a separate Twilio number.
- Save that Twilio number in dashboard field `Twilio Phone`.
- When a call comes in, n8n sends Twilio `To` number to backend.
- Backend finds the matching customer and returns their menu, voice, prompt, and settings.
