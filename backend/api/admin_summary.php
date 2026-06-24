<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('GET');
require_admin();

$totalUsers = (int)db()->query('SELECT COUNT(*) AS total FROM users WHERE role = "customer"')->fetch()['total'];
$activeUsers = (int)db()->query('SELECT COUNT(*) AS total FROM users WHERE role = "customer" AND status = "active"')->fetch()['total'];
$totalOrders = (int)db()->query('SELECT COUNT(*) AS total FROM orders')->fetch()['total'];
$totalReservations = (int)db()->query('SELECT COUNT(*) AS total FROM reservations')->fetch()['total'];
$totalCalls = (int)db()->query('SELECT COUNT(*) AS total FROM call_logs')->fetch()['total'];
$configuredAgents = (int)db()->query('SELECT COUNT(*) AS total FROM agent_settings WHERE voice_id <> "" OR n8n_webhook_url <> ""')->fetch()['total'];
$pendingProfiles = (int)db()->query(
    'SELECT COUNT(*) AS total
     FROM users
     LEFT JOIN restaurant_profiles ON restaurant_profiles.user_id = users.id
     WHERE users.role = "customer"
       AND (restaurant_profiles.restaurant_name IS NULL OR restaurant_profiles.restaurant_name = "")'
)->fetch()['total'];

$customersStmt = db()->query(
    'SELECT
        users.id,
        users.first_name,
        users.second_name,
        users.email,
        users.status,
        users.created_at,
        restaurant_profiles.restaurant_name,
        restaurant_profiles.business_phone,
        restaurant_profiles.city,
        restaurant_profiles.country,
        restaurant_profiles.cuisine_type,
        agent_settings.voice_model,
        agent_settings.voice_id,
        agent_settings.twilio_phone,
        agent_settings.order_enabled,
        agent_settings.reservation_enabled,
        workflow_settings.n8n_webhook_path,
        COALESCE(order_counts.total_orders, 0) AS total_orders,
        COALESCE(reservation_counts.total_reservations, 0) AS total_reservations,
        COALESCE(call_counts.total_calls, 0) AS total_calls
     FROM users
     LEFT JOIN restaurant_profiles ON restaurant_profiles.user_id = users.id
     LEFT JOIN agent_settings ON agent_settings.user_id = users.id
     LEFT JOIN workflow_settings ON workflow_settings.user_id = users.id
     LEFT JOIN (
        SELECT user_id, COUNT(*) AS total_orders FROM orders GROUP BY user_id
     ) order_counts ON order_counts.user_id = users.id
     LEFT JOIN (
        SELECT user_id, COUNT(*) AS total_reservations FROM reservations GROUP BY user_id
     ) reservation_counts ON reservation_counts.user_id = users.id
     LEFT JOIN (
        SELECT user_id, COUNT(*) AS total_calls FROM call_logs GROUP BY user_id
     ) call_counts ON call_counts.user_id = users.id
     WHERE users.role = "customer"
     ORDER BY users.created_at DESC
     LIMIT 100'
);

$customers = $customersStmt->fetchAll();

$ordersStmt = db()->query(
    'SELECT
        orders.id,
        orders.user_id,
        orders.customer_name,
        orders.customer_phone,
        orders.order_status,
        orders.order_items,
        orders.created_at,
        users.email AS account_email,
        restaurant_profiles.restaurant_name
     FROM orders
     INNER JOIN users ON users.id = orders.user_id
     LEFT JOIN restaurant_profiles ON restaurant_profiles.user_id = users.id
     ORDER BY orders.created_at DESC
     LIMIT 50'
);

$reservationsStmt = db()->query(
    'SELECT
        reservations.id,
        reservations.user_id,
        reservations.guest_name,
        reservations.guest_phone,
        reservations.party_size,
        reservations.reservation_date,
        reservations.reservation_time,
        reservations.status,
        reservations.created_at,
        users.email AS account_email,
        restaurant_profiles.restaurant_name
     FROM reservations
     INNER JOIN users ON users.id = reservations.user_id
     LEFT JOIN restaurant_profiles ON restaurant_profiles.user_id = users.id
     ORDER BY reservations.created_at DESC
     LIMIT 50'
);

$callsStmt = db()->query(
    'SELECT
        call_logs.id,
        call_logs.user_id,
        call_logs.call_sid,
        call_logs.caller_phone,
        call_logs.call_type,
        call_logs.call_status,
        call_logs.transcript,
        call_logs.ai_summary,
        call_logs.duration_seconds,
        call_logs.created_at,
        users.email AS account_email,
        restaurant_profiles.restaurant_name
     FROM call_logs
     INNER JOIN users ON users.id = call_logs.user_id
     LEFT JOIN restaurant_profiles ON restaurant_profiles.user_id = users.id
     ORDER BY call_logs.created_at DESC
     LIMIT 50'
);

json_response([
    'ok' => true,
    'summary' => [
        'totalCustomers' => $totalUsers,
        'activeUsers' => $activeUsers,
        'orders' => $totalOrders,
        'reservations' => $totalReservations,
        'calls' => $totalCalls,
        'configuredAgents' => $configuredAgents,
        'pendingProfiles' => $pendingProfiles,
        'monthlyRevenue' => $totalUsers * 99,
    ],
    'customers' => $customers,
    'orders' => $ordersStmt->fetchAll(),
    'reservations' => $reservationsStmt->fetchAll(),
    'calls' => $callsStmt->fetchAll(),
    'workflowTemplate' => [
        'openaiModel' => 'gpt-4o-mini',
        'openaiTemperature' => 0.30,
        'voiceProvider' => 'elevenlabs',
        'voiceId' => 'ugPTAEnkrnbtfSNMzaSY',
        'voiceModel' => 'eleven_flash_v2_5',
        'assistantResponseStyle' => 'balanced',
        'assistantMinResponseChars' => 60,
        'assistantBufferChars' => 120,
        'assistantFlushDelayMs' => 300,
        'elevenLabsStreamingLatency' => 3,
        'twilioLanguage' => 'en-CA',
        'outputFormat' => 'mp3_44100_128',
        'orderFields' => ['Timestamp', 'Restaurant ID', 'Name', 'Phone', 'Address', 'Order', 'Caller ID', 'Call SID'],
        'reservationFields' => ['Timestamp', 'Restaurant ID', 'Name', 'Phone', 'Date', 'Time', 'Guests', 'Caller ID', 'Call SID'],
    ],
]);
