<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('GET');

$user = current_user();
$userId = (int)$user['id'];
$isAdmin = ($user['role'] ?? '') === 'admin';

$stmt = db()->prepare(
    'SELECT call_logs.id,
            call_logs.user_id,
            users.email AS account_email,
            call_logs.call_sid,
            call_logs.caller_phone,
            call_logs.call_type,
            call_logs.call_status,
            call_logs.transcript,
            call_logs.ai_summary,
            call_logs.duration_seconds,
            call_logs.created_at
     FROM call_logs
     INNER JOIN users ON users.id = call_logs.user_id
     WHERE (:is_admin = 1 OR call_logs.user_id = :user_id)
     ORDER BY call_logs.created_at DESC
     LIMIT 100'
);
$stmt->execute([
    ':is_admin' => $isAdmin ? 1 : 0,
    ':user_id' => $userId,
]);

json_response([
    'ok' => true,
    'calls' => $stmt->fetchAll(),
]);
