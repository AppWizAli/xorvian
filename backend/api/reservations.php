<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('GET');

$user = current_user();
$userId = (int)$user['id'];
$isAdmin = ($user['role'] ?? '') === 'admin';

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
            reservations.created_at
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
