<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('POST');

$data = read_json_body();
$email = strtolower(clean_string($data, 'email', 190)) ?: 'admin@xorvian.ai';
$password = (string)($data['password'] ?? 'Admin@12345');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
    json_response(['ok' => false, 'message' => 'Valid email and 8 character password required.'], 422);
}

$stmt = db()->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
$stmt->execute([':email' => $email]);
$existing = $stmt->fetch();

if ($existing) {
    db()->prepare(
        'UPDATE users SET role = "admin", status = "active", password_hash = :password_hash WHERE id = :id'
    )->execute([
        ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
        ':id' => (int)$existing['id'],
    ]);
    $userId = (int)$existing['id'];
} else {
    db()->prepare(
        'INSERT INTO users (first_name, second_name, email, password_hash, role)
         VALUES ("Xorvian", "Admin", :email, :password_hash, "admin")'
    )->execute([
        ':email' => $email,
        ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
    ]);
    $userId = (int)db()->lastInsertId();
}

ensure_customer_records($userId);

json_response([
    'ok' => true,
    'message' => 'Admin account ready.',
    'email' => $email,
]);
