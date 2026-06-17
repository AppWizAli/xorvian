<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('POST');

$tokenHash = hash('sha256', bearer_token());
db()->prepare('DELETE FROM auth_tokens WHERE token_hash = :token_hash')
    ->execute([':token_hash' => $tokenHash]);

json_response([
    'ok' => true,
    'message' => 'Logged out successfully.',
]);
