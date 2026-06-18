<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$user = current_user();
$userId = (int)$user['id'];
$isAdmin = ($user['role'] ?? '') === 'admin';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = read_json_body();
    $reservationId = (int)($data['id'] ?? 0);
    $status = clean_string($data, 'status', 40);
    $customStatus = clean_string($data, 'customStatus', 500);

    if ($reservationId <= 0) {
        json_response(['ok' => false, 'message' => 'Reservation id is required.'], 422);
    }

    if (!in_array($status, ['requested', 'confirmed', 'modified', 'cancelled', 'completed'], true)) {
        json_response(['ok' => false, 'message' => 'Invalid reservation status.'], 422);
    }

    $noteSql = '';
    $params = [
        ':status' => $status,
        ':id' => $reservationId,
    ];

    if ($customStatus !== '') {
        $noteSql = ", notes = TRIM(CONCAT(COALESCE(notes, ''), CHAR(10), 'Manager update: ', :custom_status))";
        $params[':custom_status'] = $customStatus;
    }

    $sql = 'UPDATE reservations
            SET status = :status' . $noteSql . '
            WHERE id = :id';

    if (!$isAdmin) {
        $sql .= ' AND user_id = :user_id';
        $params[':user_id'] = $userId;
    }

    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    if ($stmt->rowCount() === 0) {
        $checkSql = 'SELECT id FROM reservations WHERE id = :id';
        $checkParams = [':id' => $reservationId];
        if (!$isAdmin) {
            $checkSql .= ' AND user_id = :user_id';
            $checkParams[':user_id'] = $userId;
        }

        $checkStmt = db()->prepare($checkSql);
        $checkStmt->execute($checkParams);
        if (!$checkStmt->fetch()) {
            json_response(['ok' => false, 'message' => 'Reservation not found.'], 404);
        }
    }

    json_response(['ok' => true, 'message' => 'Reservation updated.']);
}

require_method('GET');

$stmt = db()->prepare(
    'SELECT reservations.id,
            reservations.user_id,
            users.email AS account_email,
            reservations.guest_name,
            reservations.guest_phone,
            reservations.party_size,
            reservations.reservation_date,
            reservations.reservation_time,
            reservations.status,
            reservations.notes,
            reservations.source,
            reservations.created_at,
            reservations.updated_at
     FROM reservations
     INNER JOIN users ON users.id = reservations.user_id
     WHERE (:is_admin = 1 OR reservations.user_id = :user_id)
     ORDER BY reservations.created_at DESC
     LIMIT 100'
);
$stmt->execute([
    ':is_admin' => $isAdmin ? 1 : 0,
    ':user_id' => $userId,
]);

json_response([
    'ok' => true,
    'reservations' => $stmt->fetchAll(),
]);
