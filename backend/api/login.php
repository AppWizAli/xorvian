<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('POST');

$data = read_json_body();
$email = strtolower(clean_string($data, 'email', 190));
$password = (string)($data['password'] ?? '');

if ($email === '' || $password === '') {
    json_response(['ok' => false, 'message' => 'Email and password are required.'], 422);
}

$stmt = db()->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
$stmt->execute([':email' => $email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    json_response(['ok' => false, 'message' => 'Invalid email or password.'], 401);
}

if ($user['status'] !== 'active') {
    json_response(['ok' => false, 'message' => 'This account is disabled.'], 403);
}

ensure_customer_records((int)$user['id']);

json_response([
    'ok' => true,
    'message' => 'Login successful.',
    'token' => create_token((int)$user['id']),
    'user' => public_user($user),
]);
