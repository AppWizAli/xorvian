<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('POST');

$data = read_json_body();
require_n8n_secret($data);

$toPhone = clean_string($data, 'to', 40);
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
    $where[] = '(agent_settings.twilio_phone = :to_phone_agent OR restaurant_profiles.business_phone = :to_phone_business)';
    $params[':to_phone_agent'] = $toPhone;
    $params[':to_phone_business'] = $toPhone;
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

json_response([
    'ok' => true,
    'restaurantId' => (string)$userId,
    'restaurant' => [
        'name' => $row['restaurant_name'] ?: 'Restaurant',
        'tagline' => 'AI powered restaurant service',
        'address' => $row['address'] ?: '',
        'phones' => array_values(array_filter([$row['business_phone'] ?: '', $row['twilio_phone'] ?: ''])),
        'mobile' => array_values(array_filter([$row['business_phone'] ?: ''])),
        'hours' => $row['opening_hours'] ?: '',
        'timezone' => $row['timezone'] ?: 'Asia/Karachi',
        'languages' => [$row['language_code'] ?: 'en-US'],
        'voice' => $row['voice_provider'] ?: 'elevenlabs',
        'currency' => 'PKR',
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
        'webhookPath' => $row['n8n_webhook_path'] ?: $webhookPath,
        'reservationPolicy' => $row['reservation_policy'] ?: '',
        'menuNotes' => $row['menu_notes'] ?: '',
        'knowledgeBase' => $row['knowledge_base'] ?: '',
    ],
    'menu' => $menu,
    'settings' => [
        'openaiModel' => $row['openai_model'] ?: 'gpt-4o-mini',
        'openaiTemperature' => (float)($row['openai_temperature'] ?? 0.3),
        'openaiMaxTokens' => (int)($row['openai_max_tokens'] ?? 300),
        'voiceProvider' => $row['voice_provider'] ?: 'elevenlabs',
        'voiceId' => $row['voice_id'] ?: 'ugPTAEnkrnbtfSNMzaSY',
        'voiceModel' => $row['voice_model'] ?: 'eleven_flash_v2',
        'outputFormat' => $row['output_format'] ?: 'mp3_44100_128',
        'twilioLanguage' => $row['twilio_language'] ?: 'en-US',
        'systemPrompt' => $row['system_prompt'] ?: '',
    ],
]);
