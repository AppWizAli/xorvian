<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('POST');

$data = read_json_body();
require_n8n_secret($data);

$toPhone = clean_string($data, 'to', 40);
$toPhoneDigits = preg_replace('/\D+/', '', $toPhone);
$restaurantId = clean_string($data, 'restaurantId', 80);
$webhookPath = clean_string($data, 'webhookPath', 160);

$sql = 'SELECT
            users.id AS user_id,
            restaurant_profiles.*,
            agent_settings.*,
            workflow_settings.*
        FROM users
        LEFT JOIN restaurant_profiles ON restaurant_profiles.user_id = users.id
        LEFT JOIN agent_settings ON agent_settings.user_id = users.id
        LEFT JOIN workflow_settings ON workflow_settings.user_id = users.id
        WHERE users.status = "active"
          AND users.role = "customer"';

$params = [];
$where = [];

if ($toPhone !== '') {
    $phoneExprAgent = "REPLACE(REPLACE(REPLACE(REPLACE(agent_settings.twilio_phone, '+', ''), ' ', ''), '-', ''), '(', '')";
    $phoneExprBusiness = "REPLACE(REPLACE(REPLACE(REPLACE(restaurant_profiles.business_phone, '+', ''), ' ', ''), '-', ''), '(', '')";
    $where[] = '(agent_settings.twilio_phone = :to_phone_agent
        OR restaurant_profiles.business_phone = :to_phone_business
        OR ' . $phoneExprAgent . ' = :to_phone_digits_agent
        OR ' . $phoneExprBusiness . ' = :to_phone_digits_business)';
    $params[':to_phone_agent'] = $toPhone;
    $params[':to_phone_business'] = $toPhone;
    $params[':to_phone_digits_agent'] = $toPhoneDigits;
    $params[':to_phone_digits_business'] = $toPhoneDigits;
}

if ($restaurantId !== '') {
    $where[] = 'CAST(users.id AS CHAR) = :restaurant_id';
    $params[':restaurant_id'] = $restaurantId;
}

if ($webhookPath !== '') {
    $where[] = 'workflow_settings.n8n_webhook_path = :webhook_path';
    $params[':webhook_path'] = $webhookPath;
}

if ($where) {
    $sql .= ' AND (' . implode(' OR ', $where) . ')';
}

$sql .= ' ORDER BY users.id ASC LIMIT 1';

$stmt = db()->prepare($sql);
$stmt->execute($params);
$row = $stmt->fetch();

if (!$row) {
    json_response(['ok' => false, 'message' => 'No matching restaurant found for this call.'], 404);
}

$userId = (int)$row['user_id'];
$menu = format_menu_for_user($userId);
$callSid = clean_string($data, 'callSid', 120);
$fromPhone = clean_string($data, 'from', 40);
$fromPhoneDigits = preg_replace('/\D+/', '', $fromPhone) ?: '';
$country = trim((string)($row['country'] ?? '')) ?: 'Canada';
$isCanada = strcasecmp($country, 'Canada') === 0 || strcasecmp($country, 'CA') === 0;
$timezone = $row['timezone'] ?: ($isCanada ? 'America/Toronto' : 'Asia/Karachi');
$languageCode = $row['language_code'] ?: ($isCanada ? 'en-CA' : 'en-US');
$twilioLanguage = $row['twilio_language'] ?: $languageCode;
$currency = $isCanada ? 'CAD' : 'PKR';

if ($callSid !== '' || $fromPhone !== '') {
    $existingCallId = null;

    if ($callSid !== '') {
        $callStmt = db()->prepare(
            'SELECT id FROM call_logs WHERE user_id = :user_id AND call_sid = :call_sid LIMIT 1'
        );
        $callStmt->execute([
            ':user_id' => $userId,
            ':call_sid' => $callSid,
        ]);
        $existingCall = $callStmt->fetch();
        $existingCallId = $existingCall ? (int)$existingCall['id'] : null;
    }

    if ($existingCallId) {
        $updateSql = 'UPDATE call_logs SET call_status = "answered"';
        $updateParams = [':id' => $existingCallId];

        if ($fromPhone !== '') {
            $updateSql .= ', caller_phone = :caller_phone';
            $updateParams[':caller_phone'] = $fromPhone;
        }

        $updateSql .= ' WHERE id = :id';
        db()->prepare($updateSql)->execute($updateParams);
    } else {
        db()->prepare(
            'INSERT INTO call_logs (
                user_id, call_sid, caller_phone, call_type, call_status, ai_summary, duration_seconds
             ) VALUES (
                :user_id, :call_sid, :caller_phone, "unknown", "answered", "Incoming voice call started.", NULL
             )'
        )->execute([
            ':user_id' => $userId,
            ':call_sid' => $callSid ?: null,
            ':caller_phone' => $fromPhone ?: null,
        ]);
    }
}

$callerHistory = [
    'repeatCaller' => false,
    'knownName' => '',
    'recentItems' => [],
];

if ($fromPhoneDigits !== '') {
    $phoneExprOrder = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(customer_phone, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')";
    $phoneExprReservation = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(guest_phone, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')";
    $phoneExprCall = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(caller_phone, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')";
    $phoneExprHandoff = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(customer_phone, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')";

    $historyStmt = db()->prepare(
        "SELECT source, name, summary, created_at FROM (
            SELECT 'order' AS source,
                   NULLIF(customer_name, '') AS name,
                   NULLIF(order_items, '') AS summary,
                   created_at
            FROM orders
            WHERE user_id = :user_id_order
              AND $phoneExprOrder = :phone_digits_order
            UNION ALL
            SELECT 'reservation' AS source,
                   NULLIF(guest_name, '') AS name,
                   CONCAT('Reservation ', COALESCE(reservation_date, ''), ' ', COALESCE(reservation_time, '')) AS summary,
                   created_at
            FROM reservations
            WHERE user_id = :user_id_reservation
              AND $phoneExprReservation = :phone_digits_reservation
            UNION ALL
            SELECT 'handoff' AS source,
                   NULLIF(customer_name, '') AS name,
                   NULLIF(reason, '') AS summary,
                   created_at
            FROM handoff_requests
            WHERE user_id = :user_id_handoff
              AND $phoneExprHandoff = :phone_digits_handoff
            UNION ALL
            SELECT 'call' AS source,
                   NULL AS name,
                   NULLIF(ai_summary, '') AS summary,
                   created_at
            FROM call_logs
            WHERE user_id = :user_id_call
              AND $phoneExprCall = :phone_digits_call
        ) AS history
        ORDER BY created_at DESC
        LIMIT 6"
    );
    $historyStmt->execute([
        ':user_id_order' => $userId,
        ':user_id_reservation' => $userId,
        ':user_id_handoff' => $userId,
        ':user_id_call' => $userId,
        ':phone_digits_order' => $fromPhoneDigits,
        ':phone_digits_reservation' => $fromPhoneDigits,
        ':phone_digits_handoff' => $fromPhoneDigits,
        ':phone_digits_call' => $fromPhoneDigits,
    ]);
    $historyRows = $historyStmt->fetchAll();
    $knownName = '';

    foreach ($historyRows as $historyRow) {
        $name = trim((string)($historyRow['name'] ?? ''));
        if ($knownName === '' && $name !== '') {
            $knownName = $name;
        }
    }

    $callerHistory = [
        'repeatCaller' => count($historyRows) > 0,
        'knownName' => $knownName,
        'recentItems' => array_map(static function (array $historyRow): array {
            return [
                'source' => $historyRow['source'] ?? '',
                'name' => $historyRow['name'] ?? '',
                'summary' => $historyRow['summary'] ?? '',
                'createdAt' => $historyRow['created_at'] ?? '',
            ];
        }, $historyRows),
    ];
}

json_response([
    'ok' => true,
    'restaurantId' => (string)$userId,
    'restaurant' => [
        'name' => $row['restaurant_name'] ?: 'Restaurant',
        'tagline' => 'AI powered restaurant service',
        'address' => $row['address'] ?: '',
        'country' => $country,
        'phones' => array_values(array_filter([$row['business_phone'] ?: '', $row['twilio_phone'] ?: ''])),
        'mobile' => array_values(array_filter([$row['business_phone'] ?: ''])),
        'hours' => $row['opening_hours'] ?: '',
        'timezone' => $timezone,
        'languages' => [$languageCode],
        'voice' => $row['voice_provider'] ?: 'elevenlabs',
        'currency' => $currency,
        'delivery' => trim((string)$row['delivery_zones']) !== '',
        'deliveryAreas' => array_values(array_filter(array_map('trim', explode(',', (string)$row['delivery_zones'])))),
        'pickup' => true,
        'dineIn' => true,
        'reservationEnabled' => (bool)$row['reservation_enabled'],
        'orderingEnabled' => (bool)$row['order_enabled'],
        'minimumOrder' => 0,
        'deliveryCharges' => 0,
        'estimatedDelivery' => '',
        'specialOffers' => [],
        'social' => ['facebook' => '', 'instagram' => '', 'website' => ''],
        'gatherMessage' => $row['gather_message'] ?: 'Is there anything else you need?',
        'closingMessage' => $row['closing_message'] ?: 'Thank you. Goodbye.',
        'callMode' => $row['call_mode'] ?: 'open',
        'closedMessage' => $row['closed_message'] ?: 'We are currently closed.',
        'holidayMessage' => $row['holiday_message'] ?: 'We are closed today due to holiday hours.',
        'privateEventMessage' => $row['private_event_message'] ?: 'We are closed for a private event.',
        'repeatCallerGreeting' => $row['repeat_caller_greeting'] ?: 'Welcome back, {{name}}. How can I help you today?',
        'silencePromptSeconds' => (int)($row['silence_prompt_seconds'] ?? 10),
        'silenceHangupSeconds' => (int)($row['silence_hangup_seconds'] ?? 20),
        'backupOpenaiModel' => $row['backup_openai_model'] ?: '',
        'assistantResponseStyle' => $row['assistant_response_style'] ?: 'balanced',
        'assistantMinResponseChars' => (int)($row['assistant_min_response_chars'] ?? 60),
        'assistantBufferChars' => (int)($row['assistant_buffer_chars'] ?? 120),
        'assistantFlushDelayMs' => (int)($row['assistant_flush_delay_ms'] ?? 300),
        'elevenLabsStreamingLatency' => (int)($row['elevenlabs_streaming_latency'] ?? 3),
        'orderReviewRequired' => (bool)($row['order_review_required'] ?? true),
        'orderTaxRate' => (float)($row['order_tax_rate'] ?? 0),
        'deliveryFee' => (float)($row['delivery_fee'] ?? 0),
        'pickupLeadMinutes' => (int)($row['pickup_lead_minutes'] ?? 20),
        'deliveryLeadMinutes' => (int)($row['delivery_lead_minutes'] ?? 45),
        'cateringThresholdPeople' => (int)($row['catering_threshold_people'] ?? 25),
        'minimumOrderAmount' => (float)($row['minimum_order_amount'] ?? 0),
        'orderCurrency' => $row['order_currency'] ?: 'CAD',
        'orderSmsEnabled' => (bool)($row['order_sms_enabled'] ?? true),
        'orderPosProvider' => $row['order_pos_provider'] ?: 'dashboard',
        'orderPosEndpoint' => $row['order_pos_endpoint'] ?: '',
        'orderKitchenChannel' => $row['order_kitchen_channel'] ?: 'dashboard',
        'webhookPath' => $row['n8n_webhook_path'] ?: $webhookPath,
        'reservationPolicy' => $row['reservation_policy'] ?: '',
        'menuNotes' => $row['menu_notes'] ?: '',
        'knowledgeBase' => $row['knowledge_base'] ?: '',
    ],
    'menu' => $menu,
    'callerHistory' => $callerHistory,
    'settings' => [
        'openaiModel' => $row['openai_model'] ?: 'gpt-4o-mini',
        'openaiTemperature' => (float)($row['openai_temperature'] ?? 0.3),
        'openaiMaxTokens' => (int)($row['openai_max_tokens'] ?? 300),
        'voiceProvider' => $row['voice_provider'] ?: 'elevenlabs',
        'voiceId' => $row['voice_id'] ?: 'ugPTAEnkrnbtfSNMzaSY',
        'voiceModel' => $row['voice_model'] ?: 'eleven_flash_v2_5',
        'assistantResponseStyle' => $row['assistant_response_style'] ?: 'balanced',
        'assistantMinResponseChars' => (int)($row['assistant_min_response_chars'] ?? 60),
        'assistantBufferChars' => (int)($row['assistant_buffer_chars'] ?? 120),
        'assistantFlushDelayMs' => (int)($row['assistant_flush_delay_ms'] ?? 300),
        'elevenLabsStreamingLatency' => (int)($row['elevenlabs_streaming_latency'] ?? 3),
        'outputFormat' => $row['output_format'] ?: 'mp3_44100_128',
        'twilioLanguage' => $twilioLanguage,
        'escalationPhone' => $row['escalation_phone'] ?: '',
        'notificationEnabled' => (bool)($row['notification_enabled'] ?? true),
        'notificationChannel' => $row['notification_channel'] ?: 'sms',
        'notificationPhone' => $row['notification_phone'] ?: ($row['escalation_phone'] ?: ''),
        'notificationEmail' => $row['notification_email'] ?: '',
        'notificationMinUrgency' => $row['notification_min_urgency'] ?: 'urgent',
        'callMode' => $row['call_mode'] ?: 'open',
        'closedMessage' => $row['closed_message'] ?: 'We are currently closed.',
        'holidayMessage' => $row['holiday_message'] ?: 'We are closed today due to holiday hours.',
        'privateEventMessage' => $row['private_event_message'] ?: 'We are closed for a private event.',
        'repeatCallerGreeting' => $row['repeat_caller_greeting'] ?: 'Welcome back, {{name}}. How can I help you today?',
        'silencePromptSeconds' => (int)($row['silence_prompt_seconds'] ?? 10),
        'silenceHangupSeconds' => (int)($row['silence_hangup_seconds'] ?? 20),
        'backupOpenaiModel' => $row['backup_openai_model'] ?: '',
        'orderReviewRequired' => (bool)($row['order_review_required'] ?? true),
        'orderTaxRate' => (float)($row['order_tax_rate'] ?? 0),
        'deliveryFee' => (float)($row['delivery_fee'] ?? 0),
        'pickupLeadMinutes' => (int)($row['pickup_lead_minutes'] ?? 20),
        'deliveryLeadMinutes' => (int)($row['delivery_lead_minutes'] ?? 45),
        'cateringThresholdPeople' => (int)($row['catering_threshold_people'] ?? 25),
        'minimumOrderAmount' => (float)($row['minimum_order_amount'] ?? 0),
        'orderCurrency' => $row['order_currency'] ?: 'CAD',
        'orderSmsEnabled' => (bool)($row['order_sms_enabled'] ?? true),
        'orderPosProvider' => $row['order_pos_provider'] ?: 'dashboard',
        'orderPosEndpoint' => $row['order_pos_endpoint'] ?: '',
        'orderKitchenChannel' => $row['order_kitchen_channel'] ?: 'dashboard',
        'systemPrompt' => $row['system_prompt'] ?: '',
    ],
]);
