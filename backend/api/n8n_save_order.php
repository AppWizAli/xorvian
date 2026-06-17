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

json_response(['ok' => true, 'message' => 'Order saved.', 'orderId' => (int)db()->lastInsertId()]);
