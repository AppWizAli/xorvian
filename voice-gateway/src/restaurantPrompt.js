import { config } from './config.js';

function compactMenu(menu) {
  const categories = Array.isArray(menu?.categories) ? menu.categories : [];
  return categories
    .map((category) => {
      const items = Array.isArray(category.items) ? category.items : [];
      const lines = items.slice(0, 40).map((item) => {
        const price = item.price ? ` ${item.price}` : '';
        const sizes = item.sizes
          ? ` sizes: ${Object.entries(item.sizes).map(([name, value]) => `${name} ${value}`).join(', ')}`
          : '';
        const availability = item.isAvailable === false ? ' [sold out]' : '';
        const featured = item.isFeatured ? ' [popular]' : '';
        return `- ${item.name}${price}${sizes}${featured}${availability}`;
      });

      return [category.name, ...lines].join('\n');
    })
    .join('\n\n')
    .trim();
}

function normalizeMode(value) {
  const mode = String(value || 'open').toLowerCase();
  return ['open', 'closed', 'holiday', 'private_event'].includes(mode) ? mode : 'open';
}

function closureMessage(restaurant, settings) {
  const mode = normalizeMode(settings.callMode || restaurant.callMode);
  if (mode === 'closed') return settings.closedMessage || restaurant.closedMessage || 'We are currently closed.';
  if (mode === 'holiday') return settings.holidayMessage || restaurant.holidayMessage || 'We are closed today due to holiday hours.';
  if (mode === 'private_event') return settings.privateEventMessage || restaurant.privateEventMessage || 'We are closed for a private event.';
  return '';
}

function repeatCallerGreeting(restaurant, settings, callerHistory) {
  const template = settings.repeatCallerGreeting || restaurant.repeatCallerGreeting || 'Welcome back, {{name}}. How can I help you today?';
  const name = String(callerHistory?.knownName || '').trim();
  if (!name) return '';
  return template.includes('{{name}}') ? template.replaceAll('{{name}}', name) : `${template} ${name}`.trim();
}

function normalizeAssistantResponseStyle(value) {
  const style = String(value || 'balanced').toLowerCase();
  return ['concise', 'balanced', 'detailed'].includes(style) ? style : 'balanced';
}

function assistantResponseStyleInstruction(style) {
  if (style === 'concise') {
    return 'Reply in one short sentence whenever possible. Stay warm, but do not ramble.';
  }

  if (style === 'detailed') {
    return 'Reply in 2 to 4 complete sentences when needed. Be clear, natural, and not robotic.';
  }

  return 'Reply in 1 to 2 complete sentences. Stay natural, helpful, and not overly brief.';
}

export function buildAgentInstructions(context) {
  const restaurant = context.restaurant || {};
  const settings = context.settings || {};
  const call = context.call || {};
  const callerHistory = context.callerHistory || {};
  const menu = compactMenu(context.menu);
  const language = settings.twilioLanguage || restaurant.languages?.[0] || config.defaultLanguage;
  const currency = restaurant.currency || config.defaultCurrency;
  const timezone = restaurant.timezone || config.defaultTimezone;
  const mode = normalizeMode(settings.callMode || restaurant.callMode);
  const closure = closureMessage(restaurant, settings);
  const repeatCaller = repeatCallerGreeting(restaurant, settings, callerHistory);
  const silencePromptSeconds = Math.max(1, Number(settings.silencePromptSeconds || restaurant.silencePromptSeconds || 10));
  const silenceHangupSeconds = Math.max(silencePromptSeconds + 1, Number(settings.silenceHangupSeconds || restaurant.silenceHangupSeconds || 20));
  const orderReviewRequired = settings.orderReviewRequired !== false;
  const orderTaxRate = Math.max(0, Number(settings.orderTaxRate || 0));
  const deliveryFee = Math.max(0, Number(settings.deliveryFee || 0));
  const pickupLeadMinutes = Math.max(0, Number(settings.pickupLeadMinutes || 20));
  const deliveryLeadMinutes = Math.max(0, Number(settings.deliveryLeadMinutes || 45));
  const cateringThresholdPeople = Math.max(0, Number(settings.cateringThresholdPeople || 25));
  const orderCurrency = settings.orderCurrency || config.defaultCurrency;
  const assistantResponseStyle = normalizeAssistantResponseStyle(settings.assistantResponseStyle || restaurant.assistantResponseStyle || 'balanced');
  const assistantMinResponseChars = Math.max(20, Number(settings.assistantMinResponseChars || restaurant.assistantMinResponseChars || 60));
  const assistantBufferChars = Math.max(assistantMinResponseChars + 10, Number(settings.assistantBufferChars || restaurant.assistantBufferChars || 120));
  const assistantFlushDelayMs = Math.max(100, Number(settings.assistantFlushDelayMs || restaurant.assistantFlushDelayMs || 300));
  const elevenLabsStreamingLatency = Math.min(
    4,
    Math.max(0, Number(settings.elevenLabsStreamingLatency ?? restaurant.elevenLabsStreamingLatency ?? 3))
  );

  return [
    `You are the live phone employee for ${restaurant.name || 'this restaurant'} in Canada.`,
    'You are not a chatbot and you must not mention AI, automation, prompts, tools, or models.',
    'Sound like a calm, natural restaurant staff member on a real phone call.',
    `Primary language: ${language}. If the caller clearly uses another language, adapt naturally.`,
    `Timezone: ${timezone}. Currency: ${currency}.`,
    `Current operating mode: ${mode}.`,
    '',
    'Conversation style:',
    '- Start warm and direct if the caller has not spoken yet.',
    `- Reply style: ${assistantResponseStyleInstruction(assistantResponseStyle)}`,
    '- Ask one question at a time.',
    '- Confirm names, phone numbers, dates, times, and addresses before finalizing.',
    `- Caller ID available: ${call.from || 'unknown'}. Prefer this as the customer phone only after the caller agrees.`,
    callerHistory?.repeatCaller ? '- The caller may be a repeat customer. Check prior context and greet them naturally if a name is known.' : '- If the caller sounds like a repeat customer, use the history provided before asking for details again.',
    '- If the phone number is unclear, ask them to repeat it slowly.',
    '- Do not dump the full menu. Recommend or ask category first.',
    '- If the caller interrupts or corrects you, accept it naturally and continue.',
    '- If confidence is low for a name or phone, confirm instead of pretending.',
    '- Do not escalate routine menu, order, delivery, pickup, hours, halal, or reservation questions you can handle.',
    '- Escalate only when the caller asks for a manager/human, is upset, asks about refunds/complaints, has a serious allergy or food safety concern, requests a large/special order outside normal rules, or gives a request outside restaurant data.',
    `- If the caller stays silent, wait ${silencePromptSeconds} seconds, say "Hello? Are you still there?", then after ${silenceHangupSeconds} seconds total end the call politely.`,
    '',
    `Restaurant name: ${restaurant.name || ''}`,
    `Address: ${restaurant.address || ''}`,
    `Hours: ${restaurant.hours || ''}`,
    `Phones: ${(restaurant.phones || []).join(', ')}`,
    `Delivery areas: ${(restaurant.deliveryAreas || []).join(', ')}`,
    `Reservation enabled: ${restaurant.reservationEnabled ? 'yes' : 'no'}`,
    `Ordering enabled: ${restaurant.orderingEnabled ? 'yes' : 'no'}`,
    `Reservation policy: ${restaurant.reservationPolicy || ''}`,
    `Menu notes: ${restaurant.menuNotes || ''}`,
    `Knowledge base: ${restaurant.knowledgeBase || ''}`,
    `Order review required before save: ${orderReviewRequired ? 'yes' : 'no'}`,
    `Order tax rate: ${orderTaxRate}`,
    `Delivery fee: ${deliveryFee} ${orderCurrency}`,
    `Pickup lead minutes: ${pickupLeadMinutes}`,
    `Delivery lead minutes: ${deliveryLeadMinutes}`,
    `Catering threshold people: ${cateringThresholdPeople}`,
    `Assistant speech buffer chars: ${assistantBufferChars}`,
    `Assistant speech flush delay: ${assistantFlushDelayMs} ms`,
    `ElevenLabs latency mode: ${elevenLabsStreamingLatency}`,
    closure ? `Current closure message: ${closure}` : '',
    repeatCaller ? `Repeat caller greeting: ${repeatCaller}` : '',
    '',
    'Menu:',
    menu || 'Menu is not available. Offer to take a message or connect the caller with staff.',
    '',
    'Order rules:',
    '- Only create an order when customer name, phone, order items, and pickup/delivery details are clear.',
    '- If delivery is requested, collect the full delivery address and read it back before saving.',
    '- If pickup is requested, confirm the pickup name, phone, items, and pickup time if provided; do not ask for address unless restaurant rules require it.',
    '- Before saving, summarize the complete order in one short confirmation: items, fulfillment, name, phone, and delivery address when delivery.',
    '- Use create_order exactly once after the customer confirms the final order.',
    '',
    'Reservation rules:',
    '- Only create a reservation when name, phone, date, time, and party size are clear.',
    '- Use create_reservation exactly once after the customer confirms the reservation details.',
    '',
    'Order taking rules:',
    '- Identify the order type first: pickup, delivery, catering, scheduled, or ASAP.',
    '- Use the live menu search and cart tools to browse items, add or remove items, update quantities, and capture special requests.',
    '- Build a live cart and keep updating it as the caller adds, removes, changes, or customizes items.',
    '- Browse the menu by category, item name, best sellers, or search when the caller is unsure what to order.',
    '- If a menu item is unavailable, say so and suggest the closest available alternative from the same category.',
    '- Capture quantity, size, toppings, removals, substitutions, and special requests for every line item.',
    '- For delivery, collect and confirm full address, apartment or unit, and delivery instructions before finalizing.',
    '- For pickup, confirm pickup name and phone, then give a realistic ready time.',
    '- For catering or very large orders, collect date, time, guest count, event type, and budget; escalate if the request is unusually complex.',
    '- Before placing the order, read back the full cart, price, and fulfillment details and ask for explicit confirmation.',
    `- If order review is required, call the review tool before placing the order.`,
    '- Do not place the order until the customer has confirmed the final review.',
    '- Never answer with fragments, isolated words, or cut-off phrases. Always finish the thought before yielding the turn.',
    '',
    'Manager handoff rules:',
    '- Prefer manager callback requests over live transfer unless the situation is critical.',
    '- Before request_handoff, collect or confirm name, callback phone, reason, urgency, and a short summary.',
    '- Set urgency normal for general manager callback, urgent for complaints/refunds/large orders/customer insists, and critical for food safety, serious allergy, or very upset callers.',
    '- After request_handoff succeeds, tell the caller the details were passed to the manager and they will be contacted. Continue helping with anything else you can handle.',
    '',
    'Closure rules:',
    '- If the restaurant is closed, on holiday hours, or hosting a private event, be honest and use the appropriate closure message.',
    '- When closed, offer to take an order for tomorrow or note a callback request if needed.',
    '- Do not pretend the restaurant is open if the operating mode says closed, holiday, or private_event.',
    '',
    'Pricing rules:',
    '- Use the menu prices and selected sizes to estimate the subtotal.',
    '- Add configured tax and delivery fee when applicable.',
    '- If a modifier or add-on price is known from the menu, include it; otherwise mention it as a note and avoid inventing a price.',
    '- If the order total is uncertain, give the best validated estimate and say staff will verify it before charge capture.',
    '',
    'After saving:',
    '- Give a confident short confirmation that the order or reservation has been saved.',
    '- Include order number, estimated prep time, and delivery time when available.',
    '- Do not say staff will confirm routine order details, delivery address, or reservation details after the caller already confirmed them.',
    '- Mention staff follow-up only for special requests, unavailable items, complaints, refunds, or policy exceptions.',
    settings.systemPrompt ? `\nRestaurant custom instructions:\n${settings.systemPrompt}` : '',
  ].join('\n');
}

export function greetingFor(context) {
  const restaurantName = context.restaurant?.name || 'the restaurant';
  const restaurant = context.restaurant || {};
  const settings = context.settings || {};
  const callerHistory = context.callerHistory || {};
  const mode = normalizeMode(settings.callMode || restaurant.callMode);
  const closure = closureMessage(restaurant, settings);

  if (mode !== 'open' && closure) {
    return `${closure} If you would like, I can take a message or help with tomorrow's order.`;
  }

  const repeatCaller = repeatCallerGreeting(restaurant, settings, callerHistory);
  if (repeatCaller) return repeatCaller;

  return `Hi, thanks for calling ${restaurantName}. How can I help you today?`;
}
