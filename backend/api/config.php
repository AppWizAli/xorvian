<?php
declare(strict_types=1);

$privateConfig = __DIR__ . '/config.private.php';

if (is_file($privateConfig)) {
    require_once $privateConfig;
    return;
}

const DB_HOST = 'CHANGE_ME_DATABASE_HOST';
const DB_NAME = 'CHANGE_ME_DATABASE_NAME';
const DB_USER = 'CHANGE_ME_DATABASE_USER';
const DB_PASS = 'CHANGE_ME_DATABASE_PASSWORD';
const API_TOKEN_TTL_DAYS = 30;
const N8N_SHARED_SECRET = 'n8n-shared-secret';
