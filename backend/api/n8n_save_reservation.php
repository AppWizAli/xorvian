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

$reservationId = (int)db()->lastInsertId();
$callSid = substr((string)($data['callSid'] ?? ''), 0, 120);
$callerPhone = substr((string)($data['from'] ?? $reservation['phone'] ?? ''), 0, 40);
$summary = 'Reservation saved for ' . substr((string)($reservation['date'] ?? 'requested date'), 0, 80);

if ($callSid !== '' || $callerPhone !== '') {
    $updated = 0;

    if ($callSid !== '') {
        $updateStmt = db()->prepare(
            'UPDATE call_logs
             SET caller_phone = COALESCE(NULLIF(:caller_phone, ""), caller_phone),
                 call_type = "reservation",
                 call_status = "completed",
                 ai_summary = :ai_summary
             WHERE user_id = :user_id AND call_sid = :call_sid'
        );
        $updateStmt->execute([
            ':user_id' => $userId,
            ':call_sid' => $callSid,
            ':caller_phone' => $callerPhone,
            ':ai_summary' => $summary,
        ]);
        $updated = $updateStmt->rowCount();
    }

    if ($updated === 0) {
        db()->prepare(
            'INSERT INTO call_logs (
                user_id, call_sid, caller_phone, call_type, call_status, ai_summary, duration_seconds
             ) VALUES (
                :user_id, :call_sid, :caller_phone, "reservation", "completed", :ai_summary, NULL
             )'
        )->execute([
            ':user_id' => $userId,
            ':call_sid' => $callSid ?: null,
            ':caller_phone' => $callerPhone ?: null,
            ':ai_summary' => $summary,
        ]);
    }
}

json_response(['ok' => true, 'message' => 'Reservation saved.', 'reservationId' => $reservationId]);
