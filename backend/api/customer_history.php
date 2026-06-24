<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('GET');

$user = current_user();
$userId = (int)$user['id'];
$isAdmin = ($user['role'] ?? '') === 'admin';

function normalized_customer_phone(?string $phone): string
{
    return preg_replace('/\D+/', '', (string)$phone) ?: '';
}

function customer_key(?string $phone, ?string $name): string
{
    $normalizedPhone = normalized_customer_phone($phone);
    if ($normalizedPhone !== '') {
        return 'phone:' . $normalizedPhone;
    }

    $normalizedName = strtolower(trim((string)$name));
    return 'unknown:' . ($normalizedName !== '' ? md5($normalizedName) : 'guest');
}

function newer_activity(?string $first, ?string $second): ?string
{
    if (!$first) {
        return $second;
    }
    if (!$second) {
        return $first;
    }

    return strtotime($second) > strtotime($first) ? $second : $first;
}

function blank_customer(string $name, string $phone): array
{
    return [
        'name' => $name !== '' ? $name : 'Guest',
        'phone' => $phone,
        'ordersCount' => 0,
        'reservationsCount' => 0,
        'callsCount' => 0,
        'handoffsCount' => 0,
        'lastActivity' => null,
        'latestOrder' => null,
        'latestReservation' => null,
        'latestCall' => null,
        'latestHandoff' => null,
        'orders' => [],
        'reservations' => [],
        'calls' => [],
        'handoffs' => [],
    ];
}

function customer_scope_params(bool $isAdmin, int $userId): array
{
    return [
        ':is_admin' => $isAdmin ? 1 : 0,
        ':user_id' => $userId,
    ];
}

$ordersStmt = db()->prepare(
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
            orders.created_at,
            orders.updated_at
     FROM orders
     INNER JOIN users ON users.id = orders.user_id
     WHERE (:is_admin = 1 OR orders.user_id = :user_id)
     ORDER BY orders.created_at DESC
     LIMIT 300'
);
$ordersStmt->execute(customer_scope_params($isAdmin, $userId));
$orders = $ordersStmt->fetchAll();

$reservationsStmt = db()->prepare(
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
     LIMIT 300'
);
$reservationsStmt->execute(customer_scope_params($isAdmin, $userId));
$reservations = $reservationsStmt->fetchAll();

$callsStmt = db()->prepare(
    'SELECT call_logs.id,
            call_logs.user_id,
            users.email AS account_email,
            call_logs.call_sid,
            call_logs.caller_phone,
            call_logs.call_type,
            call_logs.call_status,
            call_logs.transcript,
            call_logs.ai_summary,
            call_logs.duration_seconds,
            call_logs.created_at
     FROM call_logs
     INNER JOIN users ON users.id = call_logs.user_id
     WHERE (:is_admin = 1 OR call_logs.user_id = :user_id)
     ORDER BY call_logs.created_at DESC
     LIMIT 300'
);
$callsStmt->execute(customer_scope_params($isAdmin, $userId));
$calls = $callsStmt->fetchAll();

$handoffsStmt = db()->prepare(
    'SELECT handoff_requests.*,
            users.email AS account_email
     FROM handoff_requests
     INNER JOIN users ON users.id = handoff_requests.user_id
     WHERE (:is_admin = 1 OR handoff_requests.user_id = :user_id)
     ORDER BY handoff_requests.created_at DESC
     LIMIT 300'
);
$handoffsStmt->execute(customer_scope_params($isAdmin, $userId));
$handoffs = $handoffsStmt->fetchAll();

$customers = [];

foreach ($orders as $order) {
    $key = customer_key($order['customer_phone'] ?? '', $order['customer_name'] ?? '');
    if (!isset($customers[$key])) {
        $customers[$key] = blank_customer((string)($order['customer_name'] ?? ''), (string)($order['customer_phone'] ?? ''));
    }

    if (($customers[$key]['name'] ?? 'Guest') === 'Guest' && ($order['customer_name'] ?? '') !== '') {
        $customers[$key]['name'] = $order['customer_name'];
    }
    if (($customers[$key]['phone'] ?? '') === '' && ($order['customer_phone'] ?? '') !== '') {
        $customers[$key]['phone'] = $order['customer_phone'];
    }

    $customers[$key]['orders'][] = $order;
    $customers[$key]['ordersCount']++;
    $customers[$key]['latestOrder'] ??= $order;
    $customers[$key]['lastActivity'] = newer_activity($customers[$key]['lastActivity'], $order['created_at'] ?? null);
}

foreach ($reservations as $reservation) {
    $key = customer_key($reservation['guest_phone'] ?? '', $reservation['guest_name'] ?? '');
    if (!isset($customers[$key])) {
        $customers[$key] = blank_customer((string)($reservation['guest_name'] ?? ''), (string)($reservation['guest_phone'] ?? ''));
    }

    if (($customers[$key]['name'] ?? 'Guest') === 'Guest' && ($reservation['guest_name'] ?? '') !== '') {
        $customers[$key]['name'] = $reservation['guest_name'];
    }
    if (($customers[$key]['phone'] ?? '') === '' && ($reservation['guest_phone'] ?? '') !== '') {
        $customers[$key]['phone'] = $reservation['guest_phone'];
    }

    $customers[$key]['reservations'][] = $reservation;
    $customers[$key]['reservationsCount']++;
    $customers[$key]['latestReservation'] ??= $reservation;
    $customers[$key]['lastActivity'] = newer_activity($customers[$key]['lastActivity'], $reservation['created_at'] ?? null);
}

foreach ($calls as $call) {
    $key = customer_key($call['caller_phone'] ?? '', '');
    if (!isset($customers[$key])) {
        $customers[$key] = blank_customer('Guest', (string)($call['caller_phone'] ?? ''));
    }

    if (($customers[$key]['phone'] ?? '') === '' && ($call['caller_phone'] ?? '') !== '') {
        $customers[$key]['phone'] = $call['caller_phone'];
    }

    $customers[$key]['calls'][] = $call;
    $customers[$key]['callsCount']++;
    $customers[$key]['latestCall'] ??= $call;
    $customers[$key]['lastActivity'] = newer_activity($customers[$key]['lastActivity'], $call['created_at'] ?? null);
}

foreach ($handoffs as $handoff) {
    $key = customer_key($handoff['customer_phone'] ?? '', $handoff['customer_name'] ?? '');
    if (!isset($customers[$key])) {
        $customers[$key] = blank_customer((string)($handoff['customer_name'] ?? ''), (string)($handoff['customer_phone'] ?? ''));
    }

    if (($customers[$key]['name'] ?? 'Guest') === 'Guest' && ($handoff['customer_name'] ?? '') !== '') {
        $customers[$key]['name'] = $handoff['customer_name'];
    }
    if (($customers[$key]['phone'] ?? '') === '' && ($handoff['customer_phone'] ?? '') !== '') {
        $customers[$key]['phone'] = $handoff['customer_phone'];
    }

    $customers[$key]['handoffs'][] = $handoff;
    $customers[$key]['handoffsCount']++;
    $customers[$key]['latestHandoff'] ??= $handoff;
    $customers[$key]['lastActivity'] = newer_activity($customers[$key]['lastActivity'], $handoff['created_at'] ?? null);
}

$customerList = array_values($customers);
usort($customerList, static function (array $a, array $b): int {
    return strtotime((string)($b['lastActivity'] ?? '')) <=> strtotime((string)($a['lastActivity'] ?? ''));
});

json_response([
    'ok' => true,
    'customers' => $customerList,
]);
