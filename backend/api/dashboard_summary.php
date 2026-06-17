<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('GET');

$user = current_user();
$userId = (int)$user['id'];
$isAdmin = ($user['role'] ?? '') === 'admin';

$ordersStmt = db()->prepare('SELECT COUNT(*) AS total FROM orders WHERE (:is_admin = 1 OR user_id = :user_id)');
$ordersStmt->execute([
    ':is_admin' => $isAdmin ? 1 : 0,
    ':user_id' => $userId,
]);
$ordersCount = (int)$ordersStmt->fetch()['total'];

$reservationsStmt = db()->prepare('SELECT COUNT(*) AS total FROM reservations WHERE (:is_admin = 1 OR user_id = :user_id)');
$reservationsStmt->execute([
    ':is_admin' => $isAdmin ? 1 : 0,
    ':user_id' => $userId,
]);
$reservationsCount = (int)$reservationsStmt->fetch()['total'];

$callsStmt = db()->prepare('SELECT COUNT(*) AS total FROM call_logs WHERE (:is_admin = 1 OR user_id = :user_id)');
$callsStmt->execute([
    ':is_admin' => $isAdmin ? 1 : 0,
    ':user_id' => $userId,
]);
$callsCount = (int)$callsStmt->fetch()['total'];

$profileStmt = db()->prepare('SELECT * FROM restaurant_profiles WHERE user_id = :user_id LIMIT 1');
$profileStmt->execute([':user_id' => $userId]);
$profile = $profileStmt->fetch();

$agentStmt = db()->prepare('SELECT * FROM agent_settings WHERE user_id = :user_id LIMIT 1');
$agentStmt->execute([':user_id' => $userId]);
$agent = $agentStmt->fetch();

$workflowStmt = db()->prepare('SELECT * FROM workflow_settings WHERE user_id = :user_id LIMIT 1');
$workflowStmt->execute([':user_id' => $userId]);
$workflow = $workflowStmt->fetch();

json_response([
    'ok' => true,
    'user' => public_user($user),
    'summary' => [
        'orders' => $ordersCount,
        'reservations' => $reservationsCount,
        'calls' => $callsCount,
        'profileComplete' => $profile && $profile['restaurant_name'] !== '',
        'agentConfigured' => $agent && $agent['voice_id'] !== '',
    ],
    'profile' => $profile,
    'agent' => $agent,
    'workflow' => $workflow,
]);
