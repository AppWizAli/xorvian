<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$user = current_user();
$userId = (int)$user['id'];
$isAdmin = ($user['role'] ?? '') === 'admin';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = db()->prepare(
        'SELECT handoff_requests.*,
                users.email AS account_email,
                restaurant_profiles.restaurant_name
         FROM handoff_requests
         INNER JOIN users ON users.id = handoff_requests.user_id
         LEFT JOIN restaurant_profiles ON restaurant_profiles.user_id = users.id
         WHERE (:is_admin = 1 OR handoff_requests.user_id = :user_id)
         ORDER BY FIELD(handoff_requests.status, "new", "notified", "contacted", "resolved", "cancelled"),
                  FIELD(handoff_requests.urgency, "critical", "urgent", "normal"),
                  handoff_requests.created_at DESC
         LIMIT 100'
    );
    $stmt->execute([
        ':is_admin' => $isAdmin ? 1 : 0,
        ':user_id' => $userId,
    ]);

    json_response([
        'ok' => true,
        'handoffs' => $stmt->fetchAll(),
    ]);
}

require_method('POST');

$data = read_json_body();
$handoffId = (int)($data['id'] ?? 0);
$status = clean_string($data, 'status', 30);
$managerNotes = clean_string($data, 'managerNotes', 5000);

if ($handoffId <= 0) {
    json_response(['ok' => false, 'message' => 'handoff id is required.'], 422);
}

if (!in_array($status, ['new', 'notified', 'contacted', 'resolved', 'cancelled'], true)) {
    json_response(['ok' => false, 'message' => 'Invalid handoff status.'], 422);
}

$sql = 'UPDATE handoff_requests
        SET status = :status,
            manager_notes = :manager_notes
        WHERE id = :id';
$params = [
    ':status' => $status,
    ':manager_notes' => $managerNotes,
    ':id' => $handoffId,
];

if (!$isAdmin) {
    $sql .= ' AND user_id = :user_id';
    $params[':user_id'] = $userId;
}

$stmt = db()->prepare($sql);
$stmt->execute($params);

if ($stmt->rowCount() === 0) {
    $checkSql = 'SELECT id FROM handoff_requests WHERE id = :id';
    $checkParams = [':id' => $handoffId];
    if (!$isAdmin) {
        $checkSql .= ' AND user_id = :user_id';
        $checkParams[':user_id'] = $userId;
    }

    $checkStmt = db()->prepare($checkSql);
    $checkStmt->execute($checkParams);
    if (!$checkStmt->fetch()) {
        json_response(['ok' => false, 'message' => 'Handoff request not found.'], 404);
    }
}

json_response(['ok' => true, 'message' => 'Handoff request updated.']);
