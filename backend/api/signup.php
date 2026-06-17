<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('POST');

$data = read_json_body();
$firstName = clean_string($data, 'firstName', 80);
$secondName = clean_string($data, 'secondName', 80);
$email = strtolower(clean_string($data, 'email', 190));
$password = (string)($data['password'] ?? '');

if ($firstName === '' || $secondName === '' || $email === '' || $password === '') {
    json_response(['ok' => false, 'message' => 'All fields are required.'], 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'message' => 'Please enter a valid email address.'], 422);
}

if (strlen($password) < 8) {
    json_response(['ok' => false, 'message' => 'Password must be at least 8 characters.'], 422);
}

$existing = db()->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
$existing->execute([':email' => $email]);

if ($existing->fetch()) {
    json_response(['ok' => false, 'message' => 'An account already exists with this email.'], 409);
}

$stmt = db()->prepare(
    'INSERT INTO users (first_name, second_name, email, password_hash)
     VALUES (:first_name, :second_name, :email, :password_hash)'
);
$stmt->execute([
    ':first_name' => $firstName,
    ':second_name' => $secondName,
    ':email' => $email,
    ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
]);

$userId = (int)db()->lastInsertId();
ensure_customer_records($userId);

$userStmt = db()->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
$userStmt->execute([':id' => $userId]);
$user = $userStmt->fetch();

json_response([
    'ok' => true,
    'message' => 'Account created successfully.',
    'token' => create_token($userId),
    'user' => public_user($user),
], 201);
