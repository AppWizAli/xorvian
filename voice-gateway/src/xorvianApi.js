import { config } from './config.js';

async function post(path, payload) {
  const response = await fetch(`${config.xorvianApiBase}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Xorvian-Secret': config.xorvianSharedSecret,
    },
    body: JSON.stringify({
      secret: config.xorvianSharedSecret,
      ...payload,
    }),
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { ok: false, message: text || 'Invalid JSON response from Xorvian API.' };
  }

  if (!response.ok || data.ok === false) {
    const message = data.message || `Xorvian API request failed: ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function fetchRestaurantContext({ restaurantId = '', callSid = '', from = '', to = '' }) {
  return post('n8n_context.php', {
    restaurantId,
    callSid,
    from,
    to,
  });
}

export async function saveOrder({ restaurantId, callSid, from, orderData }) {
  return post('n8n_save_order.php', {
    restaurantId,
    callSid,
    from,
    timestamp: new Date().toISOString(),
    orderData,
  });
}

export async function saveReservation({ restaurantId, callSid, from, reservationData }) {
  return post('n8n_save_reservation.php', {
    restaurantId,
    callSid,
    from,
    timestamp: new Date().toISOString(),
    reservationData,
  });
}
