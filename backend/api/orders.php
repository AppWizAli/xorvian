<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('GET');

$user = current_user();
$userId = (int)$user['id'];
$isAdmin = ($user['role'] ?? '') === 'admin';

$stmt = db()->prepare(
    'SELECT orders.id,
            orders.user_id,
            users.email AS account_email,
            orders.customer_name,
            orders.customer_phone,
            orders.order_status,
            orders.order_total,
            orders.order_items,
            orders.special_notes,
            orders.source,
            orders.created_at
     FROM orders
     INNER JOIN users ON users.id = orders.user_id
     WHERE (:is_admin = 1 OR orders.user_id = :user_id)
     ORDER BY orders.created_at DESC
     LIMIT 100'
);
$stmt->execute([
    ':is_admin' => $isAdmin ? 1 : 0,
    ':user_id' => $userId,
]);

json_response([
    'ok' => true,
    'orders' => $stmt->fetchAll(),
]);
