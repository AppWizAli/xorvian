<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('GET');
require_admin();

$totalUsers = (int)db()->query('SELECT COUNT(*) AS total FROM users WHERE role = "customer"')->fetch()['total'];
$activeUsers = (int)db()->query('SELECT COUNT(*) AS total FROM users WHERE status = "active"')->fetch()['total'];
$totalOrders = (int)db()->query('SELECT COUNT(*) AS total FROM orders')->fetch()['total'];
$totalReservations = (int)db()->query('SELECT COUNT(*) AS total FROM reservations')->fetch()['total'];
$totalCalls = (int)db()->query('SELECT COUNT(*) AS total FROM call_logs')->fetch()['total'];
$configuredAgents = (int)db()->query('SELECT COUNT(*) AS total FROM agent_settings WHERE voice_id <> "" OR n8n_webhook_url <> ""')->fetch()['total'];

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
        agent_settings.voice_model,
        agent_settings.voice_id,
        workflow_settings.n8n_webhook_path
     FROM users
     LEFT JOIN restaurant_profiles ON restaurant_profiles.user_id = users.id
     LEFT JOIN agent_settings ON agent_settings.user_id = users.id
     LEFT JOIN workflow_settings ON workflow_settings.user_id = users.id
     WHERE users.role = "customer"
     ORDER BY users.created_at DESC
     LIMIT 25'
);

$customers = $customersStmt->fetchAll();

json_response([
    'ok' => true,
    'summary' => [
        'totalCustomers' => $totalUsers,
        'activeUsers' => $activeUsers,
        'orders' => $totalOrders,
        'reservations' => $totalReservations,
        'calls' => $totalCalls,
        'configuredAgents' => $configuredAgents,
        'monthlyRevenue' => $totalUsers * 99,
    ],
    'customers' => $customers,
    'workflowTemplate' => [
        'openaiModel' => 'gpt-4o-mini',
        'voiceProvider' => 'elevenlabs',
        'voiceId' => 'ugPTAEnkrnbtfSNMzaSY',
        'voiceModel' => 'eleven_flash_v2',
        'twilioLanguage' => 'en-US',
        'outputFormat' => 'mp3_44100_128',
        'orderFields' => ['Timestamp', 'Restaurant ID', 'Name', 'Phone', 'Address', 'Order', 'Caller ID', 'Call SID'],
        'reservationFields' => ['Timestamp', 'Restaurant ID', 'Name', 'Phone', 'Date', 'Time', 'Guests', 'Caller ID', 'Call SID'],
    ],
]);
