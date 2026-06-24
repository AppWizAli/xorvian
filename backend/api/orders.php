<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$user = current_user();
$userId = (int)$user['id'];
$isAdmin = ($user['role'] ?? '') === 'admin';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = read_json_body();
    $orderId = (int)($data['id'] ?? 0);
    $status = clean_string($data, 'status', 40);
    $customStatus = clean_string($data, 'customStatus', 500);

    if ($orderId <= 0) {
        json_response(['ok' => false, 'message' => 'Order id is required.'], 422);
    }

    if (!in_array($status, ['new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'], true)) {
        json_response(['ok' => false, 'message' => 'Invalid order status.'], 422);
    }

    $noteSql = '';
    $params = [
      ':status' => $status,
      ':id' => $orderId,
    ];

    if ($customStatus !== '') {
      $noteSql = ", special_notes = TRIM(CONCAT(COALESCE(special_notes, ''), CHAR(10), 'Manager update: ', :custom_status))";
      $params[':custom_status'] = $customStatus;
    }

    $timestampSql = '';
    if ($status === 'confirmed') {
        $timestampSql = ', confirmed_at = COALESCE(confirmed_at, NOW())';
    } elseif ($status === 'cancelled') {
        $timestampSql = ', cancelled_at = NOW()';
    }

    $sql = 'UPDATE orders
            SET order_status = :status' . $timestampSql . $noteSql . '
            WHERE id = :id';

    if (!$isAdmin) {
        $sql .= ' AND user_id = :user_id';
        $params[':user_id'] = $userId;
    }

    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    if ($stmt->rowCount() === 0) {
        $checkSql = 'SELECT id FROM orders WHERE id = :id';
        $checkParams = [':id' => $orderId];
        if (!$isAdmin) {
            $checkSql .= ' AND user_id = :user_id';
            $checkParams[':user_id'] = $userId;
        }

        $checkStmt = db()->prepare($checkSql);
        $checkStmt->execute($checkParams);
        if (!$checkStmt->fetch()) {
            json_response(['ok' => false, 'message' => 'Order not found.'], 404);
        }
    }

    json_response(['ok' => true, 'message' => 'Order updated.']);
}

require_method('GET');

$stmt = db()->prepare(
    'SELECT orders.id,
            orders.user_id,
            users.email AS account_email,
            orders.customer_name,
            orders.customer_phone,
            orders.order_type,
            orders.order_status,
            orders.order_total,
            orders.subtotal,
            orders.tax_amount,
            orders.delivery_fee,
            orders.discount_amount,
            orders.currency,
            orders.customer_address,
            orders.apartment_number,
            orders.delivery_instructions,
            orders.scheduled_for,
            orders.event_type,
            orders.guest_count,
            orders.order_payload,
            orders.order_items,
            orders.special_notes,
            orders.duplicate_hash,
            orders.pos_status,
            orders.pos_error,
            orders.customer_sms_status,
            orders.customer_sms_error,
            orders.source,
            orders.created_at,
            orders.updated_at
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
