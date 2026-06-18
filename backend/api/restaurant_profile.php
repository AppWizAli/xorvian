<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$user = current_user();
$userId = (int)$user['id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = db()->prepare('SELECT * FROM restaurant_profiles WHERE user_id = :user_id LIMIT 1');
    $stmt->execute([':user_id' => $userId]);
    json_response(['ok' => true, 'profile' => $stmt->fetch()]);
}

require_method('POST');

$data = read_json_body();

$fields = [
    'restaurant_name' => clean_string($data, 'restaurantName', 160),
    'business_phone' => clean_string($data, 'businessPhone', 40),
    'address' => clean_string($data, 'address', 255),
    'city' => clean_string($data, 'city', 100),
    'country' => clean_string($data, 'country', 100) ?: 'Canada',
    'cuisine_type' => clean_string($data, 'cuisineType', 100),
    'timezone' => clean_string($data, 'timezone', 80) ?: 'America/Toronto',
    'opening_hours' => clean_string($data, 'openingHours', 5000),
    'delivery_zones' => clean_string($data, 'deliveryZones', 5000),
    'reservation_policy' => clean_string($data, 'reservationPolicy', 5000),
    'menu_notes' => clean_string($data, 'menuNotes', 20000),
    'knowledge_base' => clean_string($data, 'knowledgeBase', 50000),
];

$sql = 'UPDATE restaurant_profiles
        SET restaurant_name = :restaurant_name,
            business_phone = :business_phone,
            address = :address,
            city = :city,
            country = :country,
            cuisine_type = :cuisine_type,
            timezone = :timezone,
            opening_hours = :opening_hours,
            delivery_zones = :delivery_zones,
            reservation_policy = :reservation_policy,
            menu_notes = :menu_notes,
            knowledge_base = :knowledge_base
        WHERE user_id = :user_id';

$fields['user_id'] = $userId;
db()->prepare($sql)->execute(array_combine(
    array_map(static fn(string $key): string => ':' . $key, array_keys($fields)),
    array_values($fields)
));

$stmt = db()->prepare('SELECT * FROM restaurant_profiles WHERE user_id = :user_id LIMIT 1');
$stmt->execute([':user_id' => $userId]);

json_response([
    'ok' => true,
    'message' => 'Restaurant profile saved.',
    'profile' => $stmt->fetch(),
]);
