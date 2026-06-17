<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('GET');

$user = current_user();
$userId = (int)$user['id'];

$stmt = db()->prepare(
    'SELECT id, call_sid, caller_phone, call_type, call_status, ai_summary, duration_seconds, created_at
     FROM call_logs
     WHERE user_id = :user_id
     ORDER BY created_at DESC
     LIMIT 100'
);
$stmt->execute([':user_id' => $userId]);

json_response([
    'ok' => true,
    'calls' => $stmt->fetchAll(),
]);
