<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('POST');

$data = read_json_body();
require_n8n_secret($data);

$userId = (int)($data['restaurantId'] ?? 0);
$callSid = clean_string($data, 'callSid', 120);
$callerPhone = clean_string($data, 'callerPhone', 40);
$callType = clean_string($data, 'callType', 20);
$callStatus = clean_string($data, 'callStatus', 20);
$summary = clean_string($data, 'summary', 5000);
$transcript = clean_string($data, 'transcript', 50000);
$durationSeconds = isset($data['durationSeconds']) ? max(0, (int)$data['durationSeconds']) : null;

if ($userId <= 0 || $callSid === '') {
    json_response(['ok' => false, 'message' => 'restaurantId and callSid are required.'], 422);
}

if (!in_array($callType, ['order', 'reservation', 'faq', 'support', 'unknown'], true)) {
    $callType = 'unknown';
}

if (!in_array($callStatus, ['answered', 'missed', 'completed', 'failed'], true)) {
    $callStatus = 'completed';
}

$sql = 'SELECT id FROM call_logs WHERE user_id = :user_id AND call_sid = :call_sid LIMIT 1';
$stmt = db()->prepare($sql);
$stmt->execute([
    ':user_id' => $userId,
    ':call_sid' => $callSid,
]);
$existing = $stmt->fetch();

if ($existing) {
    $updateSql = 'UPDATE call_logs
                  SET caller_phone = :caller_phone,
                      call_type = :call_type,
                      call_status = :call_status,
                      ai_summary = :ai_summary,
                      transcript = CASE
                        WHEN :transcript = "" THEN transcript
                        ELSE :transcript
                      END,
                      duration_seconds = COALESCE(:duration_seconds, duration_seconds)
                  WHERE id = :id';
    db()->prepare($updateSql)->execute([
        ':caller_phone' => $callerPhone ?: null,
        ':call_type' => $callType,
        ':call_status' => $callStatus,
        ':ai_summary' => $summary,
        ':transcript' => $transcript,
        ':duration_seconds' => $durationSeconds,
        ':id' => (int)$existing['id'],
    ]);
} else {
    db()->prepare(
        'INSERT INTO call_logs (
            user_id,
            call_sid,
            caller_phone,
            call_type,
            call_status,
            transcript,
            ai_summary,
            duration_seconds
        ) VALUES (
            :user_id,
            :call_sid,
            :caller_phone,
            :call_type,
            :call_status,
            :transcript,
            :ai_summary,
            :duration_seconds
        )'
    )->execute([
        ':user_id' => $userId,
        ':call_sid' => $callSid,
        ':caller_phone' => $callerPhone ?: null,
        ':call_type' => $callType,
        ':call_status' => $callStatus,
        ':transcript' => $transcript ?: null,
        ':ai_summary' => $summary,
        ':duration_seconds' => $durationSeconds,
    ]);
}

json_response([
    'ok' => true,
    'message' => 'Call log saved.',
]);
