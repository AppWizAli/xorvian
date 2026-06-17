<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('GET');

$dbOk = false;
$dbError = null;

try {
    db()->query('SELECT 1');
    $dbOk = true;
} catch (Throwable $error) {
    $dbError = $error->getMessage();
}

json_response([
    'ok' => true,
    'php' => PHP_VERSION,
    'database' => [
        'ok' => $dbOk,
        'name' => DB_NAME,
        'user' => DB_USER,
        'error' => $dbError,
    ],
]);
