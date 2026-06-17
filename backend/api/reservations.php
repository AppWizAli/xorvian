<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('GET');

$user = current_user();
$userId = (int)$user['id'];

$stmt = db()->prepare(
    'SELECT id, guest_name, guest_phone, party_size, reservation_date, reservation_time, status, notes, source, created_at
     FROM reservations
     WHERE user_id = :user_id
     ORDER BY created_at DESC
     LIMIT 100'
);
$stmt->execute([':user_id' => $userId]);

json_response([
    'ok' => true,
    'reservations' => $stmt->fetchAll(),
]);
