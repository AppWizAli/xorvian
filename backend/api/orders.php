<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('GET');

$user = current_user();
$userId = (int)$user['id'];

$stmt = db()->prepare(
    'SELECT id, customer_name, customer_phone, order_status, order_total, order_items, special_notes, source, created_at
     FROM orders
     WHERE user_id = :user_id
     ORDER BY created_at DESC
     LIMIT 100'
);
$stmt->execute([':user_id' => $userId]);

json_response([
    'ok' => true,
    'orders' => $stmt->fetchAll(),
]);
