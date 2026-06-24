<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_method('POST');

$data = read_json_body();
require_n8n_secret($data);

function normalize_phone_value(?string $value): string
{
    return preg_replace('/\D+/', '', (string)$value) ?: '';
}

function canonicalize_value(mixed $value): mixed
{
    if (!is_array($value)) {
        return $value;
    }

    $isList = array_keys($value) === range(0, count($value) - 1);
    if ($isList) {
        return array_map('canonicalize_value', $value);
    }

    ksort($value);
    foreach ($value as $key => $child) {
        $value[$key] = canonicalize_value($child);
    }

    return $value;
}

function normalize_order_type(string $value): string
{
    $type = strtolower(trim($value));
    return in_array($type, ['pickup', 'delivery', 'catering', 'scheduled', 'asap', 'dine_in'], true)
        ? $type
        : 'pickup';
}

function as_money(mixed $value): ?float
{
    if ($value === null || $value === '') {
        return null;
    }

    return round((float)$value, 2);
}

function normalize_datetime_value(?string $value): ?string
{
    $clean = trim((string)$value);
    if ($clean === '') {
        return null;
    }

    try {
        return (new DateTimeImmutable($clean))->format('Y-m-d H:i:s');
    } catch (Throwable) {
        return null;
    }
}

function summarize_items(array $items): string
{
    if (!$items) {
        return '';
    }

    $parts = [];
    foreach ($items as $item) {
        $qty = max(1, (int)($item['quantity'] ?? 1));
        $name = trim((string)($item['name'] ?? $item['itemName'] ?? 'Item'));
        $size = trim((string)($item['size'] ?? ''));
        $mods = array_filter(array_map('trim', (array)($item['modifiers'] ?? [])));
        $notes = trim((string)($item['specialInstructions'] ?? $item['notes'] ?? ''));

        $label = $qty . ' x ' . $name;
        if ($size !== '') {
            $label .= ' (' . $size . ')';
        }
        if ($mods) {
            $label .= ' [' . implode(', ', $mods) . ']';
        }
        if ($notes !== '') {
            $label .= ' {' . $notes . '}';
        }
        $parts[] = $label;
    }

    return implode(' | ', $parts);
}

function normalize_order_payload(array $order, array $sourceData): array
{
    $customer = is_array($order['customer'] ?? null) ? $order['customer'] : [];
    $delivery = is_array($order['delivery'] ?? null) ? $order['delivery'] : [];
    $pickup = is_array($order['pickup'] ?? null) ? $order['pickup'] : [];
    $schedule = is_array($order['schedule'] ?? null) ? $order['schedule'] : [];
    $catering = is_array($order['catering'] ?? null) ? $order['catering'] : [];
    $pricing = is_array($order['pricing'] ?? null) ? $order['pricing'] : [];
    $items = is_array($order['items'] ?? null) ? array_values($order['items']) : [];

    $legacyOrderText = trim((string)($order['order'] ?? $sourceData['order'] ?? ''));
    if (!$items && $legacyOrderText !== '') {
        $items = [[
            'name' => $legacyOrderText,
            'quantity' => 1,
            'specialInstructions' => trim((string)($order['notes'] ?? '')),
        ]];
    }

    $orderType = normalize_order_type((string)($order['type'] ?? $order['orderType'] ?? $order['fulfillment'] ?? 'pickup'));
    $fulfillment = normalize_order_type((string)($order['fulfillment'] ?? $orderType));
    if ($fulfillment === 'asap') {
        $fulfillment = $orderType === 'delivery' ? 'delivery' : 'pickup';
    }

    return [
        'orderType' => $orderType,
        'fulfillment' => $fulfillment,
        'customer' => [
            'name' => trim((string)($customer['name'] ?? $order['name'] ?? $sourceData['name'] ?? '')),
            'phone' => trim((string)($customer['phone'] ?? $order['phone'] ?? $sourceData['from'] ?? '')),
            'address' => trim((string)($customer['address'] ?? $delivery['address'] ?? $order['address'] ?? '')),
            'apartmentNumber' => trim((string)($customer['apartmentNumber'] ?? $delivery['apartmentNumber'] ?? $order['apartmentNumber'] ?? '')),
            'instructions' => trim((string)($customer['instructions'] ?? $delivery['instructions'] ?? $order['instructions'] ?? '')),
        ],
        'delivery' => [
            'address' => trim((string)($delivery['address'] ?? $order['address'] ?? '')),
            'apartmentNumber' => trim((string)($delivery['apartmentNumber'] ?? $order['apartmentNumber'] ?? '')),
            'instructions' => trim((string)($delivery['instructions'] ?? $order['deliveryInstructions'] ?? '')),
        ],
        'pickup' => [
            'instructions' => trim((string)($pickup['instructions'] ?? $order['pickupInstructions'] ?? '')),
            'readyBy' => trim((string)($pickup['readyBy'] ?? $order['pickupReadyBy'] ?? '')),
        ],
        'schedule' => [
            'scheduledFor' => trim((string)($schedule['scheduledFor'] ?? $order['scheduledFor'] ?? '')),
            'eventType' => trim((string)($schedule['eventType'] ?? $order['eventType'] ?? '')),
            'guestCount' => (int)($schedule['guestCount'] ?? $catering['guestCount'] ?? $order['guestCount'] ?? 0),
            'budget' => as_money($schedule['budget'] ?? $catering['budget'] ?? $order['budget'] ?? null),
        ],
        'catering' => [
            'eventType' => trim((string)($catering['eventType'] ?? $order['eventType'] ?? '')),
            'guestCount' => (int)($catering['guestCount'] ?? $order['guestCount'] ?? 0),
            'budget' => as_money($catering['budget'] ?? $order['budget'] ?? null),
            'date' => trim((string)($catering['date'] ?? $schedule['date'] ?? $order['date'] ?? '')),
            'time' => trim((string)($catering['time'] ?? $schedule['time'] ?? $order['time'] ?? '')),
        ],
        'items' => $items,
        'notes' => trim((string)($order['notes'] ?? $order['specialNotes'] ?? $sourceData['notes'] ?? '')),
        'reviewConfirmed' => (bool)($order['reviewConfirmed'] ?? true),
        'pricing' => [
            'subtotal' => as_money($pricing['subtotal'] ?? $order['subtotal'] ?? null),
            'tax' => as_money($pricing['tax'] ?? $pricing['taxAmount'] ?? $order['taxAmount'] ?? null),
            'deliveryFee' => as_money($pricing['deliveryFee'] ?? $order['deliveryFee'] ?? null),
            'discount' => as_money($pricing['discount'] ?? $order['discountAmount'] ?? null),
            'total' => as_money($pricing['total'] ?? $order['total'] ?? $order['orderTotal'] ?? null),
            'currency' => strtoupper(trim((string)($pricing['currency'] ?? $order['currency'] ?? $sourceData['currency'] ?? 'CAD'))) ?: 'CAD',
        ],
        'meta' => [
            'callSid' => substr((string)($sourceData['callSid'] ?? ''), 0, 120),
            'from' => substr((string)($sourceData['from'] ?? ''), 0, 40),
            'restaurantId' => (int)($sourceData['restaurantId'] ?? 0),
        ],
    ];
}

function build_order_item_summary(array $orderPayload): string
{
    $summary = summarize_items($orderPayload['items'] ?? []);
    if ($summary !== '') {
        return $summary;
    }

    $type = $orderPayload['orderType'] ?? 'pickup';
    $customer = $orderPayload['customer']['name'] ?? 'Guest';
    return sprintf('%s order for %s', ucfirst((string)$type), $customer);
}

$userId = (int)($data['restaurantId'] ?? 0);
$orderInput = is_array($data['orderData'] ?? null) ? $data['orderData'] : [];

if ($userId <= 0 || !$orderInput) {
    json_response(['ok' => false, 'message' => 'restaurantId and orderData are required.'], 422);
}

$orderPayload = normalize_order_payload($orderInput, $data);
$payloadForStorage = canonicalize_value($orderPayload);
$payloadJson = json_encode($payloadForStorage, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
$duplicateHash = hash('sha256', $payloadJson ?: '');

$duplicateStmt = db()->prepare(
    'SELECT id, order_status, created_at
     FROM orders
     WHERE user_id = :user_id
       AND duplicate_hash = :duplicate_hash
     ORDER BY id DESC
     LIMIT 1'
);
$duplicateStmt->execute([
    ':user_id' => $userId,
    ':duplicate_hash' => $duplicateHash,
]);
$duplicate = $duplicateStmt->fetch();
$duplicateOfOrderId = $duplicate ? (int)$duplicate['id'] : null;

$customerName = substr((string)($orderPayload['customer']['name'] ?? ''), 0, 160);
$customerPhone = substr(normalize_phone_value($orderPayload['customer']['phone'] ?? null), 0, 40);
$customerAddress = substr((string)($orderPayload['customer']['address'] ?? ''), 0, 255);
$apartmentNumber = substr((string)($orderPayload['customer']['apartmentNumber'] ?? ''), 0, 60);
$deliveryInstructions = substr((string)($orderPayload['delivery']['instructions'] ?? $orderPayload['customer']['instructions'] ?? ''), 0, 5000);
$scheduledFor = normalize_datetime_value((string)(($orderPayload['schedule']['scheduledFor'] ?? '') ?: ($orderPayload['catering']['date'] ?? '')));
$eventType = substr((string)($orderPayload['catering']['eventType'] ?? $orderPayload['schedule']['eventType'] ?? ''), 0, 80);
$guestCount = (int)($orderPayload['schedule']['guestCount'] ?? $orderPayload['catering']['guestCount'] ?? 0);
$budgetAmount = $orderPayload['schedule']['budget'] ?? $orderPayload['catering']['budget'] ?? null;
$summary = build_order_item_summary($orderPayload);
$subtotal = $orderPayload['pricing']['subtotal'];
$taxAmount = $orderPayload['pricing']['tax'];
$deliveryFee = $orderPayload['pricing']['deliveryFee'];
$discountAmount = $orderPayload['pricing']['discount'];
$totalAmount = $orderPayload['pricing']['total'];
$currency = $orderPayload['pricing']['currency'] ?: 'CAD';
$orderType = $orderPayload['orderType'] ?: 'pickup';
$fulfillment = $orderPayload['fulfillment'] ?: $orderType;
$specialNotes = trim(implode("\n", array_filter([
    $orderPayload['notes'] !== '' ? 'Order notes: ' . $orderPayload['notes'] : '',
    $customerAddress !== '' ? 'Address: ' . $customerAddress : '',
    $apartmentNumber !== '' ? 'Apartment: ' . $apartmentNumber : '',
    $deliveryInstructions !== '' ? 'Delivery instructions: ' . $deliveryInstructions : '',
    $scheduledFor ? 'Scheduled for: ' . $scheduledFor : '',
    $eventType !== '' ? 'Event type: ' . $eventType : '',
    $guestCount > 0 ? 'Guest count: ' . $guestCount : '',
    $budgetAmount !== null ? 'Budget: ' . number_format((float)$budgetAmount, 2, '.', '') : '',
    $duplicateOfOrderId ? 'Possible duplicate of order #' . $duplicateOfOrderId : '',
    $fulfillment !== '' ? 'Fulfillment: ' . $fulfillment : '',
    $customerPhone !== '' ? 'Caller phone: ' . $customerPhone : '',
    $customerName !== '' ? 'Customer: ' . $customerName : '',
])));

$stmt = db()->prepare(
    'INSERT INTO orders (
        user_id,
        customer_name,
        customer_phone,
        order_status,
        order_type,
        review_status,
        order_total,
        subtotal,
        tax_amount,
        delivery_fee,
        discount_amount,
        currency,
        customer_address,
        apartment_number,
        delivery_instructions,
        scheduled_for,
        event_type,
        guest_count,
        budget_amount,
        order_payload,
        duplicate_hash,
        duplicate_of_order_id,
        parent_order_id,
        estimated_ready_at,
        estimated_delivery_at,
        confirmed_at,
        pos_status,
        pos_error,
        customer_sms_status,
        customer_sms_error,
        order_items,
        special_notes,
        source
     ) VALUES (
        :user_id,
        :customer_name,
        :customer_phone,
        "new",
        :order_type,
        "confirmed",
        :order_total,
        :subtotal,
        :tax_amount,
        :delivery_fee,
        :discount_amount,
        :currency,
        :customer_address,
        :apartment_number,
        :delivery_instructions,
        :scheduled_for,
        :event_type,
        :guest_count,
        :budget_amount,
        :order_payload,
        :duplicate_hash,
        :duplicate_of_order_id,
        :parent_order_id,
        :estimated_ready_at,
        :estimated_delivery_at,
        NOW(),
        "pending",
        NULL,
        "",
        NULL,
        :order_items,
        :special_notes,
        "voice_ai"
     )'
);

$estimatedReadyAt = null;
if (in_array($orderType, ['pickup', 'dine_in', 'asap'], true)) {
    $estimatedReadyAt = (new DateTimeImmutable('now'))->modify('+25 minutes')->format('Y-m-d H:i:s');
} elseif ($orderType === 'delivery') {
    $estimatedReadyAt = (new DateTimeImmutable('now'))->modify('+40 minutes')->format('Y-m-d H:i:s');
}

$estimatedDeliveryAt = null;
if ($orderType === 'delivery') {
    $estimatedDeliveryAt = (new DateTimeImmutable('now'))->modify('+55 minutes')->format('Y-m-d H:i:s');
}

$stmt->execute([
    ':user_id' => $userId,
    ':customer_name' => $customerName,
    ':customer_phone' => $customerPhone ?: null,
    ':order_type' => $orderType,
    ':order_total' => $totalAmount,
    ':subtotal' => $subtotal,
    ':tax_amount' => $taxAmount,
    ':delivery_fee' => $deliveryFee,
    ':discount_amount' => $discountAmount,
    ':currency' => $currency,
    ':customer_address' => $customerAddress ?: null,
    ':apartment_number' => $apartmentNumber ?: null,
    ':delivery_instructions' => $deliveryInstructions ?: null,
    ':scheduled_for' => $scheduledFor,
    ':event_type' => $eventType ?: null,
    ':guest_count' => $guestCount > 0 ? $guestCount : null,
    ':budget_amount' => $budgetAmount !== null ? (float)$budgetAmount : null,
    ':order_payload' => $payloadJson ?: null,
    ':duplicate_hash' => $duplicateHash,
    ':duplicate_of_order_id' => $duplicateOfOrderId,
    ':parent_order_id' => $duplicateOfOrderId,
    ':estimated_ready_at' => $estimatedReadyAt,
    ':estimated_delivery_at' => $estimatedDeliveryAt,
    ':order_items' => $summary,
    ':special_notes' => $specialNotes ?: null,
]);

$orderId = (int)db()->lastInsertId();
$callSid = substr((string)($data['callSid'] ?? ''), 0, 120);
$callerPhone = substr((string)($data['from'] ?? $customerPhone ?? ''), 0, 40);

if ($callSid !== '' || $callerPhone !== '') {
    $updated = 0;

    if ($callSid !== '') {
        $updateSql = 'UPDATE call_logs
             SET call_type = "order",
                 call_status = "completed",
                 ai_summary = :ai_summary';
        $updateParams = [
            ':user_id' => $userId,
            ':call_sid' => $callSid,
            ':ai_summary' => trim(sprintf(
                '%s | Type: %s | Total: %s %s',
                $summary ?: 'Order saved',
                ucfirst($orderType),
                $currency,
                $totalAmount !== null ? number_format((float)$totalAmount, 2, '.', '') : '0.00'
            )),
        ];

        if ($callerPhone !== '') {
            $updateSql .= ', caller_phone = :caller_phone';
            $updateParams[':caller_phone'] = $callerPhone;
        }

        $updateSql .= ' WHERE user_id = :user_id AND call_sid = :call_sid';
        $updateStmt = db()->prepare($updateSql);
        $updateStmt->execute($updateParams);
        $updated = $updateStmt->rowCount();
    }

    if ($updated === 0) {
        db()->prepare(
            'INSERT INTO call_logs (
                user_id, call_sid, caller_phone, call_type, call_status, ai_summary, duration_seconds
             ) VALUES (
                :user_id, :call_sid, :caller_phone, "order", "completed", :ai_summary, NULL
             )'
        )->execute([
            ':user_id' => $userId,
            ':call_sid' => $callSid ?: null,
            ':caller_phone' => $callerPhone ?: null,
            ':ai_summary' => trim(sprintf(
                '%s | Type: %s | Total: %s %s',
                $summary ?: 'Order saved',
                ucfirst($orderType),
                $currency,
                $totalAmount !== null ? number_format((float)$totalAmount, 2, '.', '') : '0.00'
            )),
        ]);
    }
}

json_response([
    'ok' => true,
    'message' => 'Order saved.',
    'orderId' => $orderId,
    'duplicateOfOrderId' => $duplicateOfOrderId,
    'isDuplicate' => $duplicateOfOrderId !== null,
]);
