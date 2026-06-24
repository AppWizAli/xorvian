<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$user = current_user();
$userId = (int)$user['id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $agentStmt = db()->prepare('SELECT * FROM agent_settings WHERE user_id = :user_id LIMIT 1');
    $agentStmt->execute([':user_id' => $userId]);

    $workflowStmt = db()->prepare('SELECT * FROM workflow_settings WHERE user_id = :user_id LIMIT 1');
    $workflowStmt->execute([':user_id' => $userId]);

    json_response([
        'ok' => true,
        'agent' => $agentStmt->fetch(),
        'workflow' => $workflowStmt->fetch(),
    ]);
}

require_method('POST');

$data = read_json_body();

$agentFields = [
    ':agent_name' => clean_string($data, 'agentName', 120),
    ':language_code' => clean_string($data, 'languageCode', 20) ?: 'en-CA',
    ':voice_provider' => clean_string($data, 'voiceProvider', 80) ?: 'elevenlabs',
    ':voice_id' => clean_string($data, 'voiceId', 120),
    ':voice_model' => clean_string($data, 'voiceModel', 120) ?: 'eleven_flash_v2_5',
    ':twilio_phone' => clean_string($data, 'twilioPhone', 40),
    ':n8n_webhook_url' => clean_string($data, 'n8nWebhookUrl', 255),
    ':escalation_phone' => clean_string($data, 'escalationPhone', 40),
    ':notification_enabled' => !empty($data['notificationEnabled']) ? 1 : 0,
    ':notification_channel' => clean_string($data, 'notificationChannel', 30) ?: 'sms',
    ':notification_phone' => clean_string($data, 'notificationPhone', 40),
    ':notification_email' => clean_string($data, 'notificationEmail', 190),
    ':notification_min_urgency' => clean_string($data, 'notificationMinUrgency', 20) ?: 'urgent',
    ':call_mode' => in_array(clean_string($data, 'callMode', 20), ['open', 'closed', 'holiday', 'private_event'], true)
        ? clean_string($data, 'callMode', 20)
        : 'open',
    ':closed_message' => clean_string($data, 'closedMessage', 255) ?: 'We are currently closed.',
    ':holiday_message' => clean_string($data, 'holidayMessage', 255) ?: 'We are closed today due to holiday hours.',
    ':private_event_message' => clean_string($data, 'privateEventMessage', 255) ?: 'We are closed for a private event.',
    ':repeat_caller_greeting' => clean_string($data, 'repeatCallerGreeting', 255) ?: 'Welcome back, {{name}}. How can I help you today?',
    ':silence_prompt_seconds' => max(1, (int)($data['silencePromptSeconds'] ?? 10)),
    ':silence_hangup_seconds' => max(2, (int)($data['silenceHangupSeconds'] ?? 20)),
    ':backup_openai_model' => clean_string($data, 'backupOpenaiModel', 120),
    ':order_review_required' => !empty($data['orderReviewRequired']) ? 1 : 0,
    ':order_tax_rate' => max(0, (float)($data['orderTaxRate'] ?? 0)),
    ':delivery_fee' => max(0, (float)($data['deliveryFee'] ?? 0)),
    ':pickup_lead_minutes' => max(0, (int)($data['pickupLeadMinutes'] ?? 20)),
    ':delivery_lead_minutes' => max(0, (int)($data['deliveryLeadMinutes'] ?? 45)),
    ':catering_threshold_people' => max(0, (int)($data['cateringThresholdPeople'] ?? 25)),
    ':minimum_order_amount' => max(0, (float)($data['minimumOrderAmount'] ?? 0)),
    ':order_currency' => clean_string($data, 'orderCurrency', 8) ?: 'CAD',
    ':order_sms_enabled' => !empty($data['orderSmsEnabled']) ? 1 : 0,
    ':order_pos_provider' => clean_string($data, 'orderPosProvider', 40) ?: 'dashboard',
    ':order_pos_endpoint' => clean_string($data, 'orderPosEndpoint', 255),
    ':order_kitchen_channel' => clean_string($data, 'orderKitchenChannel', 40) ?: 'dashboard',
    ':system_prompt' => clean_string($data, 'systemPrompt', 50000),
    ':openai_model' => clean_string($data, 'openaiModel', 120) ?: 'gpt-4o-mini',
    ':openai_temperature' => (float)($data['openaiTemperature'] ?? 0.3),
    ':openai_max_tokens' => (int)($data['openaiMaxTokens'] ?? 300),
    ':order_enabled' => !empty($data['orderEnabled']) ? 1 : 0,
    ':reservation_enabled' => !empty($data['reservationEnabled']) ? 1 : 0,
    ':gather_message' => clean_string($data, 'gatherMessage', 255) ?: 'Is there anything else you need?',
    ':closing_message' => clean_string($data, 'closingMessage', 255) ?: 'Thank you. Goodbye.',
];

db()->prepare(
    'UPDATE agent_settings SET
        agent_name = :agent_name,
        language_code = :language_code,
        voice_provider = :voice_provider,
        voice_id = :voice_id,
        voice_model = :voice_model,
        twilio_phone = :twilio_phone,
        n8n_webhook_url = :n8n_webhook_url,
        escalation_phone = :escalation_phone,
        notification_enabled = :notification_enabled,
        notification_channel = :notification_channel,
        notification_phone = :notification_phone,
        notification_email = :notification_email,
        notification_min_urgency = :notification_min_urgency,
        call_mode = :call_mode,
        closed_message = :closed_message,
        holiday_message = :holiday_message,
        private_event_message = :private_event_message,
        repeat_caller_greeting = :repeat_caller_greeting,
        silence_prompt_seconds = :silence_prompt_seconds,
        silence_hangup_seconds = :silence_hangup_seconds,
        backup_openai_model = :backup_openai_model,
        order_review_required = :order_review_required,
        order_tax_rate = :order_tax_rate,
        delivery_fee = :delivery_fee,
        pickup_lead_minutes = :pickup_lead_minutes,
        delivery_lead_minutes = :delivery_lead_minutes,
        catering_threshold_people = :catering_threshold_people,
        minimum_order_amount = :minimum_order_amount,
        order_currency = :order_currency,
        order_sms_enabled = :order_sms_enabled,
        order_pos_provider = :order_pos_provider,
        order_pos_endpoint = :order_pos_endpoint,
        order_kitchen_channel = :order_kitchen_channel,
        system_prompt = :system_prompt,
        openai_model = :openai_model,
        openai_temperature = :openai_temperature,
        openai_max_tokens = :openai_max_tokens,
        order_enabled = :order_enabled,
        reservation_enabled = :reservation_enabled,
        gather_message = :gather_message,
        closing_message = :closing_message
      WHERE user_id = :user_id'
)->execute($agentFields + [':user_id' => $userId]);

$workflowFields = [
    ':n8n_webhook_path' => clean_string($data, 'n8nWebhookPath', 160),
    ':order_sheet_id' => clean_string($data, 'orderSheetId', 190),
    ':reservation_sheet_id' => clean_string($data, 'reservationSheetId', 190),
    ':order_sheet_name' => clean_string($data, 'orderSheetName', 120) ?: 'Sheet1',
    ':reservation_sheet_name' => clean_string($data, 'reservationSheetName', 120) ?: 'Sheet1',
    ':cloudinary_folder' => clean_string($data, 'cloudinaryFolder', 160) ?: 'xorvian-audio',
    ':twilio_language' => clean_string($data, 'twilioLanguage', 20) ?: 'en-CA',
    ':output_format' => clean_string($data, 'outputFormat', 80) ?: 'mp3_44100_128',
];

db()->prepare(
    'UPDATE workflow_settings SET
        n8n_webhook_path = :n8n_webhook_path,
        order_sheet_id = :order_sheet_id,
        reservation_sheet_id = :reservation_sheet_id,
        order_sheet_name = :order_sheet_name,
        reservation_sheet_name = :reservation_sheet_name,
        cloudinary_folder = :cloudinary_folder,
        twilio_language = :twilio_language,
        output_format = :output_format
      WHERE user_id = :user_id'
)->execute($workflowFields + [':user_id' => $userId]);

json_response(['ok' => true, 'message' => 'Agent settings saved.']);
