<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

set_exception_handler(static function (Throwable $error): void {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => 'Server error.',
        'error' => $error->getMessage(),
    ], JSON_UNESCAPED_SLASHES);
    exit;
});

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    foreach ([DB_HOST, DB_NAME, DB_USER, DB_PASS] as $configValue) {
        if ($configValue === '' || strpos($configValue, 'CHANGE_ME_') === 0) {
            throw new RuntimeException('Missing database config. Create backend/api/config.private.php on the server with the real Hostinger database credentials.');
        }
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        json_response(['ok' => false, 'message' => 'Invalid JSON request body.'], 400);
    }

    return $data;
}

function require_method(string $method): void
{
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
    }
}

function clean_string(array $data, string $key, int $maxLength = 255): string
{
    $value = trim((string)($data[$key] ?? ''));
    return substr($value, 0, $maxLength);
}

function create_token(int $userId): string
{
    $plainToken = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $plainToken);
    $expiresAt = (new DateTimeImmutable('now'))
        ->modify('+' . API_TOKEN_TTL_DAYS . ' days')
        ->format('Y-m-d H:i:s');

    $stmt = db()->prepare(
        'INSERT INTO auth_tokens (user_id, token_hash, expires_at) VALUES (:user_id, :token_hash, :expires_at)'
    );
    $stmt->execute([
        ':user_id' => $userId,
        ':token_hash' => $tokenHash,
        ':expires_at' => $expiresAt,
    ]);

    return $plainToken;
}

function public_user(array $user): array
{
    return [
        'id' => (int)$user['id'],
        'firstName' => $user['first_name'],
        'secondName' => $user['second_name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'status' => $user['status'],
        'createdAt' => $user['created_at'],
    ];
}

function bearer_token(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

    if ($header === '' && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }

    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        json_response(['ok' => false, 'message' => 'Missing bearer token.'], 401);
    }

    return trim($matches[1]);
}

function current_user(): array
{
    $tokenHash = hash('sha256', bearer_token());
    $stmt = db()->prepare(
        'SELECT users.*
         FROM auth_tokens
         INNER JOIN users ON users.id = auth_tokens.user_id
         WHERE auth_tokens.token_hash = :token_hash
           AND auth_tokens.expires_at > NOW()
           AND users.status = "active"
         LIMIT 1'
    );
    $stmt->execute([':token_hash' => $tokenHash]);
    $user = $stmt->fetch();

    if (!$user) {
        json_response(['ok' => false, 'message' => 'Invalid or expired token.'], 401);
    }

    db()->prepare('UPDATE auth_tokens SET last_used_at = NOW() WHERE token_hash = :token_hash')
        ->execute([':token_hash' => $tokenHash]);

    return $user;
}

function require_admin(): array
{
    $user = current_user();

    if (($user['role'] ?? '') !== 'admin') {
        json_response(['ok' => false, 'message' => 'Admin access required.'], 403);
    }

    return $user;
}

function ensure_customer_records(int $userId): void
{
    db()->prepare('INSERT IGNORE INTO restaurant_profiles (user_id) VALUES (:user_id)')
        ->execute([':user_id' => $userId]);

    db()->prepare('INSERT IGNORE INTO agent_settings (user_id) VALUES (:user_id)')
        ->execute([':user_id' => $userId]);

    db()->prepare(
        'INSERT IGNORE INTO workflow_settings (
            user_id,
            n8n_webhook_path,
            order_sheet_id,
            reservation_sheet_id,
            order_fields_json,
            reservation_fields_json
        ) VALUES (
            :user_id,
            "7d1e2d95-94bc-4f30-8b40-39a01a8415ca",
            "1JGntuge-QWJo41kErND2ffWsvfLnbG-Akd9nqNt75mI",
            "1ptUzstPHCQxiBH2VLvsdTdMllXbc7R0cJCDj2Ti1cwU",
            :order_fields_json,
            :reservation_fields_json
        )'
    )->execute([
        ':user_id' => $userId,
        ':order_fields_json' => json_encode(['Timestamp', 'Restaurant ID', 'Name', 'Phone', 'Address', 'Order', 'Caller ID', 'Call SID']),
        ':reservation_fields_json' => json_encode(['Timestamp', 'Restaurant ID', 'Name', 'Phone', 'Date', 'Time', 'Guests', 'Caller ID', 'Call SID']),
    ]);
}

function require_n8n_secret(array $data): void
{
    $headerSecret = $_SERVER['HTTP_X_XORVIAN_SECRET'] ?? '';
    $bodySecret = (string)($data['secret'] ?? '');

    if (!hash_equals(N8N_SHARED_SECRET, $headerSecret ?: $bodySecret)) {
        json_response(['ok' => false, 'message' => 'Invalid n8n secret.'], 401);
    }
}

function format_menu_for_user(int $userId): array
{
    $categoryStmt = db()->prepare(
        'SELECT * FROM menu_categories WHERE user_id = :user_id ORDER BY sort_order, id'
    );
    $categoryStmt->execute([':user_id' => $userId]);
    $categories = $categoryStmt->fetchAll();

    $itemStmt = db()->prepare(
        'SELECT * FROM menu_items WHERE user_id = :user_id AND is_available = 1 ORDER BY sort_order, id'
    );
    $itemStmt->execute([':user_id' => $userId]);
    $items = $itemStmt->fetchAll();

    foreach ($categories as &$category) {
        $categoryItems = [];
        foreach ($items as $item) {
            if ((int)$item['category_id'] !== (int)$category['id']) {
                continue;
            }

            $formatted = [
                'name' => $item['name'],
            ];

            if ($item['price'] !== null) {
                $formatted['price'] = (float)$item['price'];
            }

            if ($item['sizes_json']) {
                $sizes = json_decode($item['sizes_json'], true);
                if (is_array($sizes)) {
                    $formatted['sizes'] = $sizes;
                }
            }

            if ($item['description']) {
                $formatted['description'] = $item['description'];
            }

            if ($item['modifiers']) {
                $formatted['modifiers'] = $item['modifiers'];
            }

            $categoryItems[] = $formatted;
        }

        $category = [
            'name' => $category['name'],
            'items' => $categoryItems,
        ];
    }

    return ['categories' => array_values($categories)];
}
