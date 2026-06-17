<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('POST');
require_admin();

$data = read_json_body();
$customerId = (int)($data['customerId'] ?? 0);
$status = clean_string($data, 'status', 20);

if ($customerId <= 0 || !in_array($status, ['active', 'disabled'], true)) {
    json_response(['ok' => false, 'message' => 'Valid customerId and status are required.'], 422);
}

$stmt = db()->prepare(
    'UPDATE users
     SET status = :status
     WHERE id = :id
       AND role = "customer"'
);
$stmt->execute([
    ':status' => $status,
    ':id' => $customerId,
]);

if ($stmt->rowCount() === 0) {
    json_response(['ok' => false, 'message' => 'Customer not found or status unchanged.'], 404);
}

json_response(['ok' => true, 'message' => 'Customer status updated.']);
