<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('POST');

$data = read_json_body();
require_n8n_secret($data);

$userId = (int)($data['restaurantId'] ?? 0);
$order = is_array($data['orderData'] ?? null) ? $data['orderData'] : [];

if ($userId <= 0 || !$order) {
    json_response(['ok' => false, 'message' => 'restaurantId and orderData are required.'], 422);
}

$stmt = db()->prepare(
    'INSERT INTO orders (
        user_id, customer_name, customer_phone, order_status, order_total, order_items, special_notes, source
     ) VALUES (
        :user_id, :customer_name, :customer_phone, "new", NULL, :order_items, :special_notes, "voice_ai"
     )'
);
$stmt->execute([
    ':user_id' => $userId,
    ':customer_name' => substr((string)($order['name'] ?? ''), 0, 160),
    ':customer_phone' => substr((string)($order['phone'] ?? $data['from'] ?? ''), 0, 40),
    ':order_items' => (string)($order['order'] ?? ''),
    ':special_notes' => 'Address: ' . (string)($order['address'] ?? '') . ' | Call SID: ' . (string)($data['callSid'] ?? ''),
]);

$orderId = (int)db()->lastInsertId();
$callSid = substr((string)($data['callSid'] ?? ''), 0, 120);
$callerPhone = substr((string)($data['from'] ?? $order['phone'] ?? ''), 0, 40);
$summary = 'Order saved: ' . substr((string)($order['order'] ?? ''), 0, 180);

if ($callSid !== '' || $callerPhone !== '') {
    $updated = 0;

    if ($callSid !== '') {
        $updateSql = 'UPDATE call_logs
             SET call_type = "order",
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
                :user_id, :call_sid, :caller_phone, "order", "completed", :ai_summary, NULL
             )'
        )->execute([
            ':user_id' => $userId,
            ':call_sid' => $callSid ?: null,
            ':caller_phone' => $callerPhone ?: null,
            ':ai_summary' => $summary,
        ]);
    }
}

json_response(['ok' => true, 'message' => 'Order saved.', 'orderId' => $orderId]);
