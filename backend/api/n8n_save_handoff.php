<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('POST');

$data = read_json_body();
require_n8n_secret($data);

$userId = (int)($data['restaurantId'] ?? 0);
$handoff = is_array($data['handoffData'] ?? null) ? $data['handoffData'] : [];

if ($userId <= 0 || !$handoff) {
    json_response(['ok' => false, 'message' => 'restaurantId and handoffData are required.'], 422);
}

$urgency = strtolower(substr((string)($handoff['urgency'] ?? 'normal'), 0, 20));
if (!in_array($urgency, ['normal', 'urgent', 'critical'], true)) {
    $urgency = 'normal';
}

$notificationChannel = substr((string)($data['notificationChannel'] ?? ''), 0, 30);
$notificationStatus = substr((string)($data['notificationStatus'] ?? ''), 0, 30);
$notificationTarget = substr((string)($data['notificationTarget'] ?? ''), 0, 190);
$notificationError = substr((string)($data['notificationError'] ?? ''), 0, 1000);

if ($notificationChannel === 'email' && $notificationTarget !== '' && $notificationStatus === 'pending') {
    $subject = 'Xorvian handoff request: ' . $urgency;
    $message = implode("\n", array_filter([
        'A manager callback request was created.',
        'Customer: ' . (string)($handoff['name'] ?? 'Customer'),
        'Phone: ' . (string)($handoff['phone'] ?? $data['from'] ?? ''),
        'Reason: ' . (string)($handoff['reason'] ?? ''),
        'Summary: ' . (string)($handoff['summary'] ?? ''),
        'Related details: ' . (string)($handoff['relatedDetails'] ?? ''),
        'Best callback time: ' . (string)($handoff['bestCallbackTime'] ?? ''),
    ]));

    if (@mail($notificationTarget, $subject, $message)) {
        $notificationStatus = 'sent';
        $notificationError = '';
    } else {
        $notificationStatus = 'failed';
        $notificationError = 'PHP mail() could not send the notification.';
    }
}

$status = $notificationStatus === 'sent' ? 'notified' : 'new';

$stmt = db()->prepare(
    'INSERT INTO handoff_requests (
        user_id,
        call_sid,
        customer_name,
        customer_phone,
        reason,
        urgency,
        status,
        related_type,
        related_details,
        conversation_summary,
        best_callback_time,
        notification_channel,
        notification_status,
        notification_target,
        notification_error,
        source
     ) VALUES (
        :user_id,
        :call_sid,
        :customer_name,
        :customer_phone,
        :reason,
        :urgency,
        :status,
        :related_type,
        :related_details,
        :conversation_summary,
        :best_callback_time,
        :notification_channel,
        :notification_status,
        :notification_target,
        :notification_error,
        "voice_ai"
     )'
);

$stmt->execute([
    ':user_id' => $userId,
    ':call_sid' => substr((string)($data['callSid'] ?? ''), 0, 120) ?: null,
    ':customer_name' => substr((string)($handoff['name'] ?? ''), 0, 160) ?: null,
    ':customer_phone' => substr((string)($handoff['phone'] ?? $data['from'] ?? ''), 0, 40) ?: null,
    ':reason' => substr((string)($handoff['reason'] ?? 'Manager callback requested'), 0, 255),
    ':urgency' => $urgency,
    ':status' => $status,
    ':related_type' => substr((string)($handoff['relatedType'] ?? ''), 0, 60),
    ':related_details' => substr((string)($handoff['relatedDetails'] ?? ''), 0, 50000),
    ':conversation_summary' => substr((string)($handoff['summary'] ?? ''), 0, 50000),
    ':best_callback_time' => substr((string)($handoff['bestCallbackTime'] ?? ''), 0, 120),
    ':notification_channel' => $notificationChannel,
    ':notification_status' => $notificationStatus,
    ':notification_target' => $notificationTarget,
    ':notification_error' => $notificationError ?: null,
]);

$handoffId = (int)db()->lastInsertId();
$callSid = substr((string)($data['callSid'] ?? ''), 0, 120);
$callerPhone = substr((string)($data['from'] ?? $handoff['phone'] ?? ''), 0, 40);
$summary = 'Handoff requested: ' . substr((string)($handoff['reason'] ?? ''), 0, 180);

if ($callSid !== '' || $callerPhone !== '') {
    $updated = 0;

    if ($callSid !== '') {
        $updateSql = 'UPDATE call_logs
             SET call_type = "support",
                 call_status = "completed",
                 ai_summary = :ai_summary';
        $updateParams = [
            ':user_id' => $userId,
            ':call_sid' => $callSid,
            ':ai_summary' => $summary,
        ];

        if ($callerPhone !== '') {
            $updateSql .= ', caller_phone = :caller_phone';
            $updateParams[':caller_phone'] = $callerPhone;
        }

        $updateSql .= ' WHERE user_id = :user_id AND call_sid = :call_sid';
        $updateStmt = db()->prepare($updateSql);
        $updateStmt->execute($updateParams);
        $updated = $updateStmt->rowCount();
    }

    if ($updated === 0) {
        db()->prepare(
            'INSERT INTO call_logs (
                user_id, call_sid, caller_phone, call_type, call_status, ai_summary, duration_seconds
             ) VALUES (
                :user_id, :call_sid, :caller_phone, "support", "completed", :ai_summary, NULL
             )'
        )->execute([
            ':user_id' => $userId,
            ':call_sid' => $callSid ?: null,
            ':caller_phone' => $callerPhone ?: null,
            ':ai_summary' => $summary,
        ]);
    }
}

json_response([
    'ok' => true,
    'message' => 'Handoff request saved.',
    'handoffId' => $handoffId,
    'status' => $status,
]);
