<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$user = current_user();
$userId = (int)$user['id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $categoryStmt = db()->prepare(
        'SELECT * FROM menu_categories WHERE user_id = :user_id ORDER BY sort_order, id'
    );
    $categoryStmt->execute([':user_id' => $userId]);
    $categories = $categoryStmt->fetchAll();

    $itemStmt = db()->prepare(
        'SELECT * FROM menu_items WHERE user_id = :user_id ORDER BY sort_order, id'
    );
    $itemStmt->execute([':user_id' => $userId]);
    $items = $itemStmt->fetchAll();

    foreach ($categories as &$category) {
        $category['items'] = array_values(array_filter($items, static function (array $item) use ($category): bool {
            return (int)$item['category_id'] === (int)$category['id'];
        }));
    }

    json_response(['ok' => true, 'categories' => $categories]);
}

require_method('POST');

$data = read_json_body();
$categories = $data['categories'] ?? [];

if (!is_array($categories)) {
    json_response(['ok' => false, 'message' => 'Categories must be an array.'], 422);
}

$pdo = db();
$pdo->beginTransaction();

try {
    $pdo->prepare('DELETE FROM menu_categories WHERE user_id = :user_id')->execute([':user_id' => $userId]);

    $categoryInsert = $pdo->prepare(
        'INSERT INTO menu_categories (user_id, name, sort_order) VALUES (:user_id, :name, :sort_order)'
    );
    $itemInsert = $pdo->prepare(
        'INSERT INTO menu_items (category_id, user_id, name, price, sizes_json, description, modifiers, is_available, sort_order)
         VALUES (:category_id, :user_id, :name, :price, :sizes_json, :description, :modifiers, :is_available, :sort_order)'
    );

    foreach ($categories as $categoryIndex => $category) {
        $categoryName = trim((string)($category['name'] ?? ''));
        if ($categoryName === '') {
            continue;
        }

        $categoryInsert->execute([
            ':user_id' => $userId,
            ':name' => substr($categoryName, 0, 120),
            ':sort_order' => $categoryIndex,
        ]);
        $categoryId = (int)$pdo->lastInsertId();

        $items = is_array($category['items'] ?? null) ? $category['items'] : [];
        foreach ($items as $itemIndex => $item) {
            $itemName = trim((string)($item['name'] ?? ''));
            if ($itemName === '') {
                continue;
            }

            $sizes = $item['sizes'] ?? null;
            $itemInsert->execute([
                ':category_id' => $categoryId,
                ':user_id' => $userId,
                ':name' => substr($itemName, 0, 160),
                ':price' => isset($item['price']) && $item['price'] !== '' ? (float)$item['price'] : null,
                ':sizes_json' => is_array($sizes) ? json_encode($sizes) : null,
                ':description' => substr((string)($item['description'] ?? ''), 0, 5000),
                ':modifiers' => substr((string)($item['modifiers'] ?? ''), 0, 5000),
                ':is_available' => array_key_exists('isAvailable', $item) ? (int)(bool)$item['isAvailable'] : 1,
                ':sort_order' => $itemIndex,
            ]);
        }
    }

    $pdo->commit();
} catch (Throwable $error) {
    $pdo->rollBack();
    json_response(['ok' => false, 'message' => 'Menu save failed.'], 500);
}

json_response(['ok' => true, 'message' => 'Menu saved.']);
