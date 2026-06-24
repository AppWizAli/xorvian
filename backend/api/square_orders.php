<?php
declare(strict_types=1);

function square_config_value(string $name, string $fallback = ''): string
{
    if (defined($name)) {
        $value = constant($name);
        if (is_string($value) && $value !== '' && strpos($value, 'CHANGE_ME_') !== 0) {
            return $value;
        }
    }

    $env = getenv($name);
    if (is_string($env) && $env !== '') {
        return $env;
    }

    return $fallback;
}

function square_settings(): array
{
    $environment = strtolower(square_config_value('SQUARE_ENVIRONMENT', 'sandbox'));

    return [
        'accessToken' => square_config_value('SQUARE_ACCESS_TOKEN'),
        'locationId' => square_config_value('SQUARE_LOCATION_ID'),
        'environment' => in_array($environment, ['production', 'prod', 'live'], true) ? 'production' : 'sandbox',
        'apiVersion' => square_config_value('SQUARE_API_VERSION', '2026-05-20'),
    ];
}

function square_base_url(array $settings): string
{
    return $settings['environment'] === 'production'
        ? 'https://connect.squareup.com'
        : 'https://connect.squareupsandbox.com';
}

function square_money_cents(mixed $value): int
{
    if ($value === null || $value === '') {
        return 0;
    }

    return max(0, (int)round(((float)$value) * 100));
}

function square_text(array $data, string $key, string $fallback = ''): string
{
    return trim((string)($data[$key] ?? $fallback));
}

function square_line_item_note(array $item): string
{
    $notes = [];

    if (!empty($item['size'])) {
      $notes[] = 'Size: ' . trim((string)$item['size']);
    }

    $modifiers = array_filter(array_map('trim', (array)($item['modifiers'] ?? [])));
    if ($modifiers) {
        $notes[] = 'Modifiers: ' . implode(', ', $modifiers);
    }

    $instructions = trim((string)($item['specialInstructions'] ?? ''));
    if ($instructions !== '') {
        $notes[] = 'Instructions: ' . $instructions;
    }

    return implode(' | ', $notes);
}

function square_build_line_items(array $orderPayload): array
{
    $items = [];
    foreach ($orderPayload['items'] ?? [] as $item) {
        $quantity = max(1, (int)($item['quantity'] ?? 1));
        $name = trim((string)($item['name'] ?? 'Item'));
        $size = trim((string)($item['size'] ?? ''));
        if ($size !== '') {
            $name .= ' (' . $size . ')';
        }

        $lineSubtotal = square_money_cents($item['lineSubtotal'] ?? null);
        $unitPrice = square_money_cents($item['unitPrice'] ?? null);
        if ($lineSubtotal <= 0 && $unitPrice > 0) {
            $lineSubtotal = $unitPrice * $quantity;
        }
        if ($lineSubtotal <= 0) {
            $lineSubtotal = 1;
        }

        $perUnit = max(1, (int)round($lineSubtotal / $quantity));

        $items[] = [
            'name' => $name,
            'quantity' => (string)$quantity,
            'base_price_money' => [
                'amount' => $perUnit,
                'currency' => strtoupper((string)($orderPayload['pricing']['currency'] ?? 'CAD')) ?: 'CAD',
            ],
            'note' => square_line_item_note($item),
        ];
    }

    $deliveryFee = square_money_cents($orderPayload['pricing']['deliveryFee'] ?? null);
    if (($orderPayload['orderType'] ?? '') === 'delivery' && $deliveryFee > 0) {
        $items[] = [
            'name' => 'Delivery fee',
            'quantity' => '1',
            'base_price_money' => [
                'amount' => $deliveryFee,
                'currency' => strtoupper((string)($orderPayload['pricing']['currency'] ?? 'CAD')) ?: 'CAD',
            ],
            'note' => 'Xorvian delivery charge',
        ];
    }

    return $items;
}

function square_parse_iso_duration_minutes(int $minutes): string
{
    return 'PT' . max(1, $minutes) . 'M';
}

function square_pickup_at(array $orderPayload, int $defaultLeadMinutes): string
{
    $scheduledFor = trim((string)($orderPayload['schedule']['scheduledFor'] ?? $orderPayload['catering']['date'] ?? ''));
    if ($scheduledFor !== '') {
        try {
            return (new DateTimeImmutable($scheduledFor))->format(DateTimeInterface::ATOM);
        } catch (Throwable) {
            // Fall through to ASAP estimate.
        }
    }

    return (new DateTimeImmutable('now'))->modify('+' . max(1, $defaultLeadMinutes) . ' minutes')->format(DateTimeInterface::ATOM);
}

function square_build_fulfillment(array $orderPayload, array $agentSettings): ?array
{
    $orderType = strtolower((string)($orderPayload['orderType'] ?? 'pickup'));
    $customer = $orderPayload['customer'] ?? [];
    $name = trim((string)($customer['name'] ?? 'Guest'));
    $phone = trim((string)($customer['phone'] ?? ''));
    $instructions = trim((string)($orderPayload['delivery']['instructions'] ?? $orderPayload['pickup']['instructions'] ?? $customer['instructions'] ?? ''));
    $currencyLeadMinutes = (int)(($orderType === 'delivery')
        ? ($agentSettings['deliveryLeadMinutes'] ?? 45)
        : ($agentSettings['pickupLeadMinutes'] ?? 20));

    if (in_array($orderType, ['pickup', 'scheduled', 'asap', 'dine_in', 'catering'], true)) {
        return [
            'type' => 'PICKUP',
            'state' => 'PROPOSED',
            'pickup_details' => [
                'recipient' => array_filter([
                    'display_name' => $name,
                    'phone_number' => $phone !== '' ? $phone : null,
                ], static fn ($value) => $value !== null && $value !== ''),
                'pickup_at' => square_pickup_at($orderPayload, $currencyLeadMinutes),
                'schedule_type' => !empty($orderPayload['schedule']['scheduledFor']) ? 'SCHEDULED' : 'ASAP',
                'prep_time_duration' => square_parse_iso_duration_minutes($currencyLeadMinutes),
                'note' => $instructions !== '' ? $instructions : null,
            ],
        ];
    }

    if ($orderType === 'delivery') {
        $address = trim((string)($customer['address'] ?? $orderPayload['delivery']['address'] ?? ''));
        $apartment = trim((string)($customer['apartmentNumber'] ?? $orderPayload['delivery']['apartmentNumber'] ?? ''));

        return [
            'type' => 'DELIVERY',
            'state' => 'PROPOSED',
            'delivery_details' => [
                'recipient' => array_filter([
                    'display_name' => $name,
                    'phone_number' => $phone !== '' ? $phone : null,
                    'address' => array_filter([
                        'address_line_1' => $address !== '' ? $address : null,
                        'address_line_2' => $apartment !== '' ? $apartment : null,
                        'locality' => null,
                        'administrative_district_level_1' => null,
                        'postal_code' => null,
                        'country' => square_config_value('SQUARE_DEFAULT_COUNTRY', 'CA'),
                    ], static fn ($value) => $value !== null && $value !== ''),
                ]),
                'note' => $instructions !== '' ? $instructions : null,
            ],
        ];
    }

    return null;
}

function square_api_request(array $settings, string $method, string $path, array $body): array
{
    if (empty($settings['accessToken']) || empty($settings['locationId'])) {
        throw new RuntimeException('Square credentials are not configured.');
    }

    $url = rtrim(square_base_url($settings), '/') . $path;
    $payload = json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        throw new RuntimeException('Failed to encode Square request payload.');
    }

    $headers = [
        'Authorization: Bearer ' . $settings['accessToken'],
        'Content-Type: application/json',
        'Accept: application/json',
        'Square-Version: ' . $settings['apiVersion'],
    ];

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_TIMEOUT => 25,
        ]);

        $responseBody = curl_exec($ch);
        $curlError = curl_error($ch);
        $statusCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($responseBody === false) {
            throw new RuntimeException($curlError ?: 'Square request failed.');
        }

        $decoded = json_decode((string)$responseBody, true);
        if ($statusCode < 200 || $statusCode >= 300) {
            $detail = $decoded['errors'][0]['detail'] ?? trim((string)$responseBody) ?: 'Square request failed.';
            throw new RuntimeException($detail);
        }

        return is_array($decoded) ? $decoded : [];
    }

    $context = stream_context_create([
        'http' => [
            'method' => strtoupper($method),
            'header' => implode("\r\n", $headers),
            'content' => $payload,
            'timeout' => 25,
            'ignore_errors' => true,
        ],
    ]);

    $responseBody = file_get_contents($url, false, $context);
    $statusLine = $http_response_header[0] ?? 'HTTP/1.1 500';
    preg_match('/\s(\d{3})\s/', $statusLine, $matches);
    $statusCode = isset($matches[1]) ? (int)$matches[1] : 500;
    $decoded = json_decode((string)$responseBody, true);

    if ($statusCode < 200 || $statusCode >= 300) {
        $detail = $decoded['errors'][0]['detail'] ?? trim((string)$responseBody) ?: 'Square request failed.';
        throw new RuntimeException($detail);
    }

    return is_array($decoded) ? $decoded : [];
}

function square_create_order(array $orderPayload, array $context = []): array
{
    $settings = square_settings();
    if (empty($settings['accessToken']) || empty($settings['locationId'])) {
        return [
            'ok' => false,
            'status' => 'failed',
            'message' => 'Square credentials are not configured.',
        ];
    }

    $lineItems = square_build_line_items($orderPayload);
    if (!$lineItems) {
        return [
            'ok' => false,
            'status' => 'failed',
            'message' => 'No order line items were available for Square.',
        ];
    }

    $orderType = strtolower((string)($orderPayload['orderType'] ?? 'pickup'));
    $customerName = trim((string)($orderPayload['customer']['name'] ?? 'Guest'));
    $customerPhone = trim((string)($orderPayload['customer']['phone'] ?? ''));
    $summary = trim((string)($orderPayload['summary'] ?? ''));
    $specialNotes = trim((string)($orderPayload['notes'] ?? ''));
    $fulfillment = square_build_fulfillment($orderPayload, array_merge($context['settings'] ?? [], [
        'pickupLeadMinutes' => $context['pickupLeadMinutes'] ?? null,
        'deliveryLeadMinutes' => $context['deliveryLeadMinutes'] ?? null,
    ]));

    $squareOrder = [
        'location_id' => $settings['locationId'],
        'reference_id' => trim((string)($context['referenceId'] ?? 'xorvian-' . ($context['orderId'] ?? time()))),
        'metadata' => array_filter([
            'xorvian_order_id' => (string)($context['orderId'] ?? ''),
            'xorvian_restaurant_id' => (string)($context['restaurantId'] ?? ''),
            'xorvian_call_sid' => (string)($context['callSid'] ?? ''),
            'xorvian_order_type' => $orderType,
            'xorvian_customer_name' => $customerName,
            'xorvian_customer_phone' => $customerPhone,
            'xorvian_summary' => $summary,
            'xorvian_notes' => $specialNotes,
        ], static fn ($value) => $value !== ''),
        'line_items' => $lineItems,
    ];

    if ($fulfillment) {
        $squareOrder['fulfillments'] = [$fulfillment];
    }

    if (!empty($context['orderNote'])) {
        $squareOrder['note'] = $context['orderNote'];
    } elseif ($summary !== '') {
        $squareOrder['note'] = $summary;
    }

    $idempotencySource = json_encode([
        'orderId' => $context['orderId'] ?? '',
        'callSid' => $context['callSid'] ?? '',
        'restaurantId' => $context['restaurantId'] ?? '',
        'orderHash' => $context['orderHash'] ?? '',
        'orderType' => $orderType,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    $request = [
        'idempotency_key' => hash('sha256', $idempotencySource ?: uniqid('square-', true)),
        'order' => $squareOrder,
    ];

    $response = square_api_request($settings, 'POST', '/v2/orders', $request);
    $squareOrderId = $response['order']['id'] ?? $response['order_id'] ?? '';
    $squareOrderVersion = $response['order']['version'] ?? null;

    return [
        'ok' => true,
        'status' => 'sent',
        'squareOrderId' => $squareOrderId,
        'squareOrderVersion' => $squareOrderVersion,
        'request' => $request,
        'response' => $response,
        'message' => 'Square order created.',
        'environment' => $settings['environment'],
        'locationId' => $settings['locationId'],
    ];
}
