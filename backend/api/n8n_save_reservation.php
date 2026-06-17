<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('POST');

$data = read_json_body();
require_n8n_secret($data);

$userId = (int)($data['restaurantId'] ?? 0);
$reservation = is_array($data['reservationData'] ?? null) ? $data['reservationData'] : [];

if ($userId <= 0 || !$reservation) {
    json_response(['ok' => false, 'message' => 'restaurantId and reservationData are required.'], 422);
}

$stmt = db()->prepare(
    'INSERT INTO reservations (
        user_id, guest_name, guest_phone, party_size, reservation_date, reservation_time, status, notes, source
     ) VALUES (
        :user_id, :guest_name, :guest_phone, :party_size, :reservation_date, :reservation_time, "requested", :notes, "voice_ai"
     )'
);
$stmt->execute([
    ':user_id' => $userId,
    ':guest_name' => substr((string)($reservation['name'] ?? ''), 0, 160),
    ':guest_phone' => substr((string)($reservation['phone'] ?? $data['from'] ?? ''), 0, 40),
    ':party_size' => isset($reservation['guests']) ? (int)$reservation['guests'] : null,
    ':reservation_date' => $reservation['date'] ?: null,
    ':reservation_time' => $reservation['time'] ?: null,
    ':notes' => 'Call SID: ' . (string)($data['callSid'] ?? ''),
]);

json_response(['ok' => true, 'message' => 'Reservation saved.', 'reservationId' => (int)db()->lastInsertId()]);
