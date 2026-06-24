import { randomUUID } from 'node:crypto';
import { ElevenLabsStream } from './elevenLabsStream.js';
import { OpenAiRealtime } from './openAiRealtime.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { buildAgentInstructions, greetingFor } from './restaurantPrompt.js';
import { fetchRestaurantContext, saveCallLog, saveHandoff, saveOrder, saveReservation } from './xorvianApi.js';
import { twilioClear, twilioMark, twilioMedia } from './twilioProtocol.js';
import { twilioMulawToPcm24kBase64 } from './audioCodec.js';

const WS_OPEN = 1;
const URGENCY_RANK = { normal: 1, urgent: 2, critical: 3 };

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').slice(0, 40);
}

function normalizeUrgency(value) {
  const urgency = String(value || 'normal').toLowerCase();
  return URGENCY_RANK[urgency] ? urgency : 'normal';
}

function truncate(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeModelName(value) {
  return String(value || '').trim();
}

function isRealtimeModelName(value) {
  return /realtime/i.test(String(value || ''));
}

function shouldNotify(settings, urgency) {
  if (settings.notificationEnabled === false) return false;
  const channel = String(settings.notificationChannel || 'sms').toLowerCase();
  if (channel === 'none') return false;
  const minimum = normalizeUrgency(settings.notificationMinUrgency || 'urgent');
  return URGENCY_RANK[urgency] >= URGENCY_RANK[minimum];
}

function twilioTarget(channel, target) {
  if (channel === 'whatsapp' && !String(target).startsWith('whatsapp:')) {
    return `whatsapp:${target}`;
  }
  return target;
}

function twilioFrom(channel) {
  if (channel === 'whatsapp') {
    return config.twilioWhatsappFrom || (config.twilioFromPhone ? `whatsapp:${config.twilioFromPhone}` : '');
  }
  return config.twilioFromPhone;
}

function normalizeOrderType(value) {
  const orderType = String(value || 'pickup').toLowerCase();
  return ['pickup', 'delivery', 'catering', 'scheduled', 'asap', 'dine_in'].includes(orderType)
    ? orderType
    : 'pickup';
}

function normalizeTextList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  if (value == null) {
    return [];
  }

  return String(value)
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseMaybeJson(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return value;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export class CallSession {
  constructor(twilioWs) {
    this.twilioWs = twilioWs;
    this.streamSid = '';
    this.callSid = '';
    this.from = '';
    this.to = '';
    this.restaurantId = '';
    this.context = null;
    this.openai = null;
    this.tts = null;
    this.textBuffer = '';
    this.orderDraft = this.createEmptyOrderDraft();
    this.transcript = [];
    this.currentIntent = 'unknown';
    this.callSummary = '';
    this.orderCompleted = false;
    this.finalStatus = 'completed';
    this.callLogSaved = false;
    this.silenceWarningHandle = null;
    this.silenceHangupHandle = null;
    this.textFlushHandle = null;
    this.lastCallerActivityAt = Date.now();
    this.lastAssistantActivityAt = Date.now();
    this.modelName = '';
    this.closed = false;
    this.startedAt = Date.now();
  }

  createEmptyOrderDraft() {
    return {
      orderType: 'pickup',
      fulfillment: 'pickup',
      customer: {
        name: '',
        phone: '',
        address: '',
        apartmentNumber: '',
        instructions: '',
      },
      delivery: {
        address: '',
        apartmentNumber: '',
        instructions: '',
      },
      pickup: {
        instructions: '',
        readyBy: '',
      },
      schedule: {
        scheduledFor: '',
        eventType: '',
        guestCount: 0,
        budget: null,
      },
      catering: {
        eventType: '',
        guestCount: 0,
        budget: null,
        date: '',
        time: '',
      },
      items: [],
      notes: '',
      reviewConfirmed: false,
      pricing: {
        subtotal: null,
        tax: null,
        deliveryFee: null,
        discount: null,
        total: null,
        currency: this.context?.settings?.orderCurrency || config.defaultCurrency,
      },
      lastReviewSummary: '',
    };
  }

  markCallerActivity() {
    this.lastCallerActivityAt = Date.now();
    this.clearSilenceTimers();
    this.scheduleSilenceTimers();
  }

  clearSilenceTimers() {
    if (this.silenceWarningHandle) {
      clearTimeout(this.silenceWarningHandle);
      this.silenceWarningHandle = null;
    }

    if (this.silenceHangupHandle) {
      clearTimeout(this.silenceHangupHandle);
      this.silenceHangupHandle = null;
    }
  }

  clearTextFlushTimer() {
    if (this.textFlushHandle) {
      clearTimeout(this.textFlushHandle);
      this.textFlushHandle = null;
    }
  }

  scheduleTextFlush(delayMs = this.getAssistantFlushDelayMs()) {
    this.clearTextFlushTimer();

    this.textFlushHandle = setTimeout(() => {
      this.textFlushHandle = null;
      if (this.closed) return;
      if (!this.textBuffer.trim()) return;
      void this.flushModelText();
    }, Math.max(100, Number(delayMs) || 300));
  }

  scheduleSilenceTimers() {
    const settings = this.context?.settings || {};
    const firstPromptSeconds = Math.max(1, Number(settings.silencePromptSeconds || 10));
    const totalSilenceSeconds = Math.max(firstPromptSeconds + 1, Number(settings.silenceHangupSeconds || 20));

    this.clearSilenceTimers();

    this.silenceWarningHandle = setTimeout(() => {
      if (this.closed || Date.now() - this.lastCallerActivityAt < firstPromptSeconds * 1000) return;
      const warning = 'Hello? Are you still there?';
      this.callSummary = this.callSummary || warning;
      this.appendTranscript('assistant', warning);
      this.tts?.speak(warning, { flush: true })
        .then(() => this.tts?.flush())
        .catch((error) => {
          logger.warn('Silence warning speech failed', { callSid: this.callSid, error: error.message });
        });
    }, firstPromptSeconds * 1000);

    this.silenceHangupHandle = setTimeout(() => {
      if (this.closed || Date.now() - this.lastCallerActivityAt < totalSilenceSeconds * 1000) return;
      this.finalStatus = 'completed';
      void this.speakAndEnd('I cannot hear you. Please call again.');
    }, totalSilenceSeconds * 1000);
  }

  appendTranscript(role, text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return;

    this.transcript.push({ role, text: clean, time: new Date().toISOString() });
    if (role === 'assistant') {
      this.lastAssistantActivityAt = Date.now();
      if (!this.orderCompleted || !this.callSummary) {
        this.callSummary = clean;
      }
    }
  }

  getOrderSettings() {
    return this.context?.settings || {};
  }

  getAssistantResponseStyle() {
    const style = String(this.getOrderSettings().assistantResponseStyle || 'balanced').toLowerCase();
    return ['concise', 'balanced', 'detailed'].includes(style) ? style : 'balanced';
  }

  getAssistantMinResponseChars() {
    const settings = this.getOrderSettings();
    const style = this.getAssistantResponseStyle();
    const fallback = style === 'concise' ? 40 : style === 'detailed' ? 90 : 60;
    return Math.max(20, Number(settings.assistantMinResponseChars || fallback));
  }

  getAssistantBufferChars() {
    const settings = this.getOrderSettings();
    const minChars = this.getAssistantMinResponseChars();
    return Math.max(minChars + 10, Number(settings.assistantBufferChars || (minChars + 60)));
  }

  getAssistantFlushDelayMs() {
    const settings = this.getOrderSettings();
    return Math.max(100, Number(settings.assistantFlushDelayMs || 300));
  }

  getMenuEntries() {
    const categories = Array.isArray(this.context?.menu?.categories) ? this.context.menu.categories : [];
    const entries = [];

    for (const category of categories) {
      const items = Array.isArray(category.items) ? category.items : [];
      for (const item of items) {
        entries.push({
          category: String(category.name || '').trim(),
          name: String(item.name || '').trim(),
          price: item.price === '' || item.price == null ? null : Number(item.price),
          sizes: item.sizes || parseMaybeJson(item.sizes_json) || null,
          description: String(item.description || '').trim(),
          modifiers: item.modifiers || '',
          modifierPrices: item.modifierPrices || parseMaybeJson(item.modifier_prices_json) || null,
          isAvailable: item.isAvailable !== undefined ? Boolean(item.isAvailable) : String(item.is_available ?? '1') === '1',
          searchKeywords: String(item.searchKeywords || item.search_keywords || '').trim(),
          allergenNotes: String(item.allergenNotes || item.allergen_notes || '').trim(),
          isFeatured: item.isFeatured !== undefined ? Boolean(item.isFeatured) : String(item.is_featured ?? '0') === '1',
        });
      }
    }

    return entries;
  }

  searchMenuItems(query, category = '', limit = 8) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    const normalizedCategory = String(category || '').trim().toLowerCase();
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const matches = this.getMenuEntries().map((entry) => {
      const haystack = [
        entry.category,
        entry.name,
        entry.description,
        entry.modifiers,
        entry.searchKeywords,
        entry.allergenNotes,
      ]
        .join(' ')
        .toLowerCase();

      let score = 0;
      if (normalizedCategory && entry.category.toLowerCase().includes(normalizedCategory)) score += 4;
      if (normalizedQuery && entry.name.toLowerCase() === normalizedQuery) score += 30;
      if (normalizedQuery && entry.name.toLowerCase().includes(normalizedQuery)) score += 15;
      for (const token of tokens) {
        if (haystack.includes(token)) score += 2;
      }
      if (entry.isFeatured) score += 2;
      if (!entry.isAvailable) score -= 6;

      return { ...entry, score };
    });

    return matches
      .filter((entry) => !normalizedCategory || entry.category.toLowerCase().includes(normalizedCategory) || entry.name.toLowerCase().includes(normalizedCategory))
      .filter((entry) => entry.score > 0 || !normalizedQuery)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, Math.max(1, Math.min(20, Number(limit || 8))))
      .map((entry) => ({
        category: entry.category,
        name: entry.name,
        price: entry.price,
        sizes: entry.sizes,
        description: entry.description,
        modifiers: entry.modifiers,
        isAvailable: entry.isAvailable,
        isFeatured: entry.isFeatured,
        searchKeywords: entry.searchKeywords,
        allergenNotes: entry.allergenNotes,
      }));
  }

  resolveMenuItem(query, category = '', size = '') {
    const [best] = this.searchMenuItems(query, category, 1);
    if (!best) return null;

    const entry = this.getMenuEntries().find((item) => item.name === best.name && item.category === best.category);
    if (!entry) return null;

    let unitPrice = entry.price;
    if (entry.sizes && typeof entry.sizes === 'object' && size) {
      const matchKey = Object.keys(entry.sizes).find((key) => key.toLowerCase() === String(size).trim().toLowerCase());
      if (matchKey) {
        unitPrice = Number(entry.sizes[matchKey]);
      }
    } else if (entry.sizes && typeof entry.sizes === 'object') {
      const firstSize = Object.keys(entry.sizes)[0];
      if (firstSize) {
        unitPrice = Number(entry.sizes[firstSize]);
      }
    }

    return {
      ...entry,
      unitPrice: Number.isFinite(unitPrice) ? Number(unitPrice) : null,
    };
  }

  resolveModifierPrice(entry, modifierName) {
    const modifierPrices = entry?.modifierPrices;
    if (!modifierPrices || typeof modifierPrices !== 'object') return 0;

    const normalized = String(modifierName || '').trim().toLowerCase();
    for (const [key, value] of Object.entries(modifierPrices)) {
      if (String(key).trim().toLowerCase() === normalized) {
        const price = Number(value);
        return Number.isFinite(price) ? price : 0;
      }
    }

    return 0;
  }

  calculateCartPricing() {
    const settings = this.getOrderSettings();
    const orderCurrency = settings.orderCurrency || config.defaultCurrency;
    const orderTaxRate = Math.max(0, Number(settings.orderTaxRate || 0));
    const deliveryFee = Math.max(0, Number(settings.deliveryFee || 0));

    const items = this.orderDraft.items.map((item) => {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const unitPrice = Number(item.unitPrice || 0);
      const modifierPrice = (item.modifiers || []).reduce((sum, modifier) => sum + this.resolveModifierPrice(item.menuEntry, modifier), 0);
      const lineSubtotal = (unitPrice + modifierPrice) * quantity;
      return {
        ...item,
        quantity,
        lineSubtotal,
        lineSubtotalDisplay: lineSubtotal.toFixed(2),
      };
    });

    const subtotal = items.reduce((sum, item) => sum + Number(item.lineSubtotal || 0), 0);
    const taxableBase = subtotal;
    const tax = taxableBase * orderTaxRate;
    const needsDeliveryFee = normalizeOrderType(this.orderDraft.orderType) === 'delivery';
    const delivery = needsDeliveryFee ? deliveryFee : 0;
    const discount = Math.max(0, Number(this.orderDraft.pricing.discount || 0));
    const total = Math.max(0, subtotal + tax + delivery - discount);

    this.orderDraft.items = items;
    this.orderDraft.pricing = {
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      deliveryFee: Number(delivery.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      total: Number(total.toFixed(2)),
      currency: orderCurrency,
    };

    return this.orderDraft.pricing;
  }

  cartSummaryText() {
    const pricing = this.calculateCartPricing();
    const items = this.orderDraft.items.map((item) => {
      const modifiers = item.modifiers?.length ? ` (${item.modifiers.join(', ')})` : '';
      const size = item.size ? ` ${item.size}` : '';
      const notes = item.specialInstructions ? ` - ${item.specialInstructions}` : '';
      return `${item.quantity} x ${item.name}${size}${modifiers}${notes}`;
    });

    const contextBits = [
      `Type: ${this.orderDraft.orderType}`,
      this.orderDraft.customer.name ? `Name: ${this.orderDraft.customer.name}` : '',
      this.orderDraft.customer.phone ? `Phone: ${this.orderDraft.customer.phone}` : '',
      this.orderDraft.orderType === 'delivery' && this.orderDraft.customer.address ? `Address: ${this.orderDraft.customer.address}` : '',
      this.orderDraft.orderType === 'catering' && this.orderDraft.catering.eventType ? `Event: ${this.orderDraft.catering.eventType}` : '',
      this.orderDraft.schedule.scheduledFor ? `Scheduled: ${this.orderDraft.schedule.scheduledFor}` : '',
    ].filter(Boolean);

    return [
      ...contextBits,
      ...items,
      `Subtotal: ${pricing.currency} ${pricing.subtotal.toFixed(2)}`,
      `Tax: ${pricing.currency} ${pricing.tax.toFixed(2)}`,
      `Delivery fee: ${pricing.currency} ${pricing.deliveryFee.toFixed(2)}`,
      `Total: ${pricing.currency} ${pricing.total.toFixed(2)}`,
    ].join(' | ');
  }

  applyOrderDetails(details = {}) {
    if (details.orderType) {
      this.orderDraft.orderType = normalizeOrderType(details.orderType);
    }

    if (details.fulfillment) {
      this.orderDraft.fulfillment = normalizeOrderType(details.fulfillment);
    } else if (details.orderType) {
      this.orderDraft.fulfillment = normalizeOrderType(details.orderType === 'scheduled' ? this.orderDraft.fulfillment || 'pickup' : details.orderType);
    }

    if (details.customerName !== undefined) this.orderDraft.customer.name = String(details.customerName || '').trim();
    if (details.customerPhone !== undefined) this.orderDraft.customer.phone = normalizePhone(details.customerPhone);
    if (details.address !== undefined) {
      this.orderDraft.customer.address = String(details.address || '').trim();
      this.orderDraft.delivery.address = this.orderDraft.customer.address;
    }
    if (details.apartmentNumber !== undefined) {
      this.orderDraft.customer.apartmentNumber = String(details.apartmentNumber || '').trim();
      this.orderDraft.delivery.apartmentNumber = this.orderDraft.customer.apartmentNumber;
    }
    if (details.instructions !== undefined) {
      this.orderDraft.customer.instructions = String(details.instructions || '').trim();
      this.orderDraft.delivery.instructions = this.orderDraft.customer.instructions;
      this.orderDraft.pickup.instructions = this.orderDraft.customer.instructions;
    }
    if (details.scheduledFor !== undefined) this.orderDraft.schedule.scheduledFor = String(details.scheduledFor || '').trim();
    if (details.eventType !== undefined) this.orderDraft.catering.eventType = String(details.eventType || '').trim();
    if (details.guestCount !== undefined) {
      const guestCount = Math.max(0, parseInt(details.guestCount, 10) || 0);
      this.orderDraft.schedule.guestCount = guestCount;
      this.orderDraft.catering.guestCount = guestCount;
    }
    if (details.budget !== undefined) {
      const budget = Number(details.budget);
      this.orderDraft.schedule.budget = Number.isFinite(budget) ? budget : null;
      this.orderDraft.catering.budget = Number.isFinite(budget) ? budget : null;
    }

    if (this.orderDraft.orderType === 'pickup') {
      this.orderDraft.fulfillment = 'pickup';
    } else if (this.orderDraft.orderType === 'delivery') {
      this.orderDraft.fulfillment = 'delivery';
    } else if (this.orderDraft.orderType === 'dine_in') {
      this.orderDraft.fulfillment = 'dine_in';
    }

    this.calculateCartPricing();
    return {
      ok: true,
      orderType: this.orderDraft.orderType,
      fulfillment: this.orderDraft.fulfillment,
      customer: this.orderDraft.customer,
      schedule: this.orderDraft.schedule,
      catering: this.orderDraft.catering,
      pricing: this.orderDraft.pricing,
    };
  }

  applyCartAction(action, payload = {}) {
    const normalizedAction = String(action || '').toLowerCase();
    const quantity = Math.max(1, parseInt(payload.quantity, 10) || 1);

    if (normalizedAction === 'clear') {
      this.orderDraft.items = [];
      this.calculateCartPricing();
      return { ok: true, message: 'Cart cleared.', cart: this.orderDraft.items, pricing: this.orderDraft.pricing };
    }

    if (normalizedAction === 'replace' && payload.query) {
      this.orderDraft.items = [];
    }

    if (normalizedAction === 'remove') {
      const removeToken = String(payload.itemId || payload.query || payload.itemName || '').toLowerCase();
      this.orderDraft.items = this.orderDraft.items.filter((item) => {
        const match = [
          item.id,
          item.name,
        ]
          .map((value) => String(value || '').toLowerCase())
          .some((value) => value && removeToken && value.includes(removeToken));
        return !match;
      });
      this.calculateCartPricing();
      return { ok: true, message: 'Item removed.', cart: this.orderDraft.items, pricing: this.orderDraft.pricing };
    }

    const itemSpec = {
      query: payload.query || payload.itemName || '',
      category: payload.category || '',
      size: payload.size || '',
      quantity,
      modifiers: normalizeTextList(payload.modifiers),
      specialInstructions: String(payload.specialInstructions || '').trim(),
    };

    const resolved = this.resolveMenuItem(itemSpec.query, itemSpec.category, itemSpec.size);
    if (!resolved) {
      return { ok: false, message: `Could not match menu item: ${itemSpec.query}` };
    }

    if (!resolved.isAvailable) {
      return {
        ok: false,
        unavailable: true,
        message: `${resolved.name} is currently unavailable.`,
        alternatives: this.searchMenuItems(resolved.category || itemSpec.category || itemSpec.query, resolved.category || itemSpec.category || '', 5).filter((entry) => entry.name !== resolved.name),
      };
    }

    const existing = normalizedAction === 'update'
      ? this.orderDraft.items.find((item) => item.id === payload.itemId)
      : this.orderDraft.items.find((item) =>
          item.name === resolved.name &&
          item.size === itemSpec.size &&
          JSON.stringify(item.modifiers || []) === JSON.stringify(itemSpec.modifiers || []) &&
          String(item.specialInstructions || '') === String(itemSpec.specialInstructions || '')
        );

    const line = {
      id: existing?.id || payload.itemId || randomUUID(),
      menuEntry: resolved,
      name: resolved.name,
      category: resolved.category,
      size: itemSpec.size || '',
      quantity: existing ? (normalizedAction === 'update' ? quantity : Math.max(1, (existing.quantity || 1) + quantity)) : quantity,
      unitPrice: resolved.unitPrice,
      modifiers: itemSpec.modifiers,
      specialInstructions: itemSpec.specialInstructions,
      isAvailable: resolved.isAvailable,
    };

    if (normalizedAction === 'update' && existing) {
      existing.quantity = Math.max(1, quantity);
      existing.size = line.size;
      existing.modifiers = line.modifiers;
      existing.specialInstructions = line.specialInstructions;
      existing.unitPrice = line.unitPrice;
      existing.menuEntry = resolved;
    } else {
      this.orderDraft.items.push(line);
    }

    this.calculateCartPricing();
    return {
      ok: true,
      message: `${resolved.name} added to the cart.`,
      item: line,
      cart: this.orderDraft.items,
      pricing: this.orderDraft.pricing,
    };
  }

  lookupRecentOrder(limit = 5) {
    const recentItems = Array.isArray(this.context?.callerHistory?.recentItems) ? this.context.callerHistory.recentItems : [];
    const orderItems = recentItems.filter((item) => String(item.source || '').toLowerCase() === 'order').slice(0, Math.max(1, Math.min(10, Number(limit || 5))));
    return {
      ok: true,
      recentOrders: orderItems,
      callerHistory: this.context?.callerHistory || {},
    };
  }

  reviewCurrentOrder() {
    const pricing = this.calculateCartPricing();
    const summary = this.cartSummaryText();
    this.orderDraft.reviewConfirmed = true;
    this.orderDraft.lastReviewSummary = summary;
    return {
      ok: true,
      summary,
      cart: this.orderDraft.items,
      pricing,
      orderType: this.orderDraft.orderType,
      fulfillment: this.orderDraft.fulfillment,
      customer: this.orderDraft.customer,
      schedule: this.orderDraft.schedule,
      catering: this.orderDraft.catering,
    };
  }

  buildOrderPayload() {
    const pricing = this.calculateCartPricing();
    const orderType = normalizeOrderType(this.orderDraft.orderType);
    const summary = this.cartSummaryText();
    const orderNotes = this.orderDraft.notes || '';
    const scheduledFor = this.orderDraft.schedule.scheduledFor || this.orderDraft.catering.date || '';
    return {
      orderType,
      fulfillment: this.orderDraft.fulfillment || orderType,
      customer: this.orderDraft.customer,
      delivery: this.orderDraft.delivery,
      pickup: this.orderDraft.pickup,
      schedule: this.orderDraft.schedule,
      catering: this.orderDraft.catering,
      items: this.orderDraft.items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        size: item.size,
        modifiers: item.modifiers,
        specialInstructions: item.specialInstructions,
        unitPrice: item.unitPrice,
        lineSubtotal: item.lineSubtotal,
        isAvailable: item.isAvailable,
      })),
      notes: orderNotes,
      pricing,
      reviewConfirmed: this.orderDraft.reviewConfirmed,
      summary,
      meta: {
        scheduledFor,
        orderMode: orderType,
        calledFrom: this.from,
        callSid: this.callSid,
        restaurantId: this.restaurantId,
      },
    };
  }

  async sendCustomerSmsConfirmation(orderResult) {
    const settings = this.getOrderSettings();
    if (settings.orderSmsEnabled === false) {
      return { status: 'skipped', error: '' };
    }

    const customerPhone = normalizePhone(this.orderDraft.customer.phone || this.from);
    const from = config.twilioFromPhone;
    if (!config.twilioAccountSid || !config.twilioAuthToken || !from || !customerPhone) {
      return { status: 'skipped', error: 'Missing SMS credentials or customer phone.' };
    }

    const total = this.orderDraft.pricing?.total ?? orderResult?.orderTotal ?? 0;
    const currency = this.orderDraft.pricing?.currency || settings.orderCurrency || config.defaultCurrency;
    const orderNumber = orderResult?.orderId || orderResult?.orderNumber || '';
    const readyText = this.orderDraft.orderType === 'delivery'
      ? 'Delivery estimate will be confirmed by the restaurant.'
      : 'Prep time will be confirmed by the kitchen.';

    const body = [
      `Your Xorvian order${orderNumber ? ` #${orderNumber}` : ''} has been received.`,
      `Total: ${currency} ${Number(total || 0).toFixed(2)}`,
      readyText,
    ].join(' ');

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.twilioAccountSid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: from,
            To: customerPhone,
            Body: body,
          }),
        }
      );

      const text = await response.text();
      if (!response.ok) {
        return { status: 'failed', error: truncate(text || `SMS failed: ${response.status}`, 1000) };
      }

      return { status: 'sent', error: '' };
    } catch (error) {
      return { status: 'failed', error: truncate(error.message, 1000) };
    }
  }

  async finalizeOrder() {
    if (this.orderDraft.reviewConfirmed !== true) {
      return { ok: false, message: 'Please review the cart before placing the order.' };
    }

    if (!this.orderDraft.items.length) {
      return { ok: false, message: 'The cart is empty.' };
    }

    const orderPayload = this.buildOrderPayload();
    const orderData = {
      type: orderPayload.orderType,
      fulfillment: orderPayload.fulfillment,
      customer: orderPayload.customer,
      delivery: orderPayload.delivery,
      pickup: orderPayload.pickup,
      schedule: orderPayload.schedule,
      catering: orderPayload.catering,
      items: orderPayload.items,
      pricing: orderPayload.pricing,
      notes: orderPayload.notes,
      reviewConfirmed: orderPayload.reviewConfirmed,
      summary: orderPayload.summary,
      order: orderPayload.items.map((item) => `${item.quantity} x ${item.name}${item.size ? ` (${item.size})` : ''}`).join(', '),
      name: orderPayload.customer.name,
      phone: orderPayload.customer.phone,
      address: orderPayload.delivery.address || orderPayload.customer.address,
      apartmentNumber: orderPayload.delivery.apartmentNumber || orderPayload.customer.apartmentNumber,
      deliveryInstructions: orderPayload.delivery.instructions || orderPayload.customer.instructions,
      scheduledFor: orderPayload.schedule.scheduledFor || orderPayload.catering.date || '',
      eventType: orderPayload.catering.eventType || orderPayload.schedule.eventType || '',
      guestCount: orderPayload.catering.guestCount || orderPayload.schedule.guestCount || 0,
      budget: orderPayload.catering.budget || orderPayload.schedule.budget || null,
      subtotal: orderPayload.pricing.subtotal,
      taxAmount: orderPayload.pricing.tax,
      deliveryFee: orderPayload.pricing.deliveryFee,
      discountAmount: orderPayload.pricing.discount,
      total: orderPayload.pricing.total,
      currency: orderPayload.pricing.currency,
      notes: orderPayload.notes,
      specialNotes: orderPayload.notes,
    };

    const saved = await saveOrder({
      restaurantId: this.restaurantId,
      callSid: this.callSid,
      from: this.from,
      orderData,
    });

    const sms = await this.sendCustomerSmsConfirmation(saved);
    const estimatedReadyMinutes = this.orderDraft.orderType === 'delivery'
      ? Number(this.getOrderSettings().deliveryLeadMinutes || 45)
      : Number(this.getOrderSettings().pickupLeadMinutes || 20);
    const estimatedReadyText = this.orderDraft.orderType === 'delivery'
      ? `Delivery estimate around ${estimatedReadyMinutes} minutes.`
      : `Ready in about ${estimatedReadyMinutes} minutes.`;

    this.currentIntent = 'order';
    this.orderCompleted = true;
    this.finalStatus = 'completed';
    const squareStatus = String(saved.posStatus || '').toLowerCase();
    const squareSummary = squareStatus === 'sent'
      ? 'Sent to Square POS.'
      : squareStatus === 'failed'
        ? 'Square push failed, but the order was saved locally.'
        : '';
    this.callSummary = `Order #${saved.orderId || ''} saved for ${this.orderDraft.customer.name || 'caller'}. ${squareSummary}`.trim();
    this.orderDraft = this.createEmptyOrderDraft();

    return {
      ok: true,
      orderId: saved.orderId,
      duplicateOfOrderId: saved.duplicateOfOrderId || null,
      isDuplicate: Boolean(saved.isDuplicate),
      smsStatus: sms.status,
      posStatus: saved.posStatus || 'pending',
      posError: saved.posError || '',
      squareOrderId: saved.squareOrderId || '',
      message: `Your order has been placed. ${estimatedReadyText} ${squareSummary}`.trim(),
      orderSummary: orderPayload.summary,
      estimatedReadyMinutes,
    };
  }

  summarizeTranscript() {
    if (this.callSummary) return this.callSummary;
    const lastAssistant = [...this.transcript].reverse().find((entry) => entry.role === 'assistant' && entry.text);
    if (lastAssistant) return lastAssistant.text;
    const lastUser = [...this.transcript].reverse().find((entry) => entry.role === 'user' && entry.text);
    if (lastUser) return `Caller said: ${lastUser.text}`;
    return 'Incoming call handled by AI voice assistant.';
  }

  async saveFinalCallLog() {
    if (this.callLogSaved || !this.callSid || !this.restaurantId) return;

    try {
      await saveCallLog({
        restaurantId: this.restaurantId,
        callSid: this.callSid,
        callerPhone: this.from,
        callType: this.currentIntent || 'unknown',
        callStatus: this.finalStatus || 'completed',
        summary: this.summarizeTranscript(),
        transcript: this.transcript.map((entry) => `[${entry.time}] ${entry.role}: ${entry.text}`).join('\n'),
        durationSeconds: Math.max(0, Math.round((Date.now() - this.startedAt) / 1000)),
      });
      this.callLogSaved = true;
    } catch (error) {
      logger.warn('Failed to save final call log', {
        callSid: this.callSid,
        error: error.message,
      });
    }
  }

  async speakAndEnd(message) {
    try {
      this.appendTranscript('assistant', message);
      await this.tts?.speak(message, { flush: true });
      await this.tts?.flush();
    } catch (error) {
      logger.warn('Failed to speak fallback message', {
        callSid: this.callSid,
        error: error.message,
      });
    } finally {
      this.close();
    }
  }

  async activateFailover(reason) {
    this.finalStatus = 'failed';
    const message = 'Sorry, our voice system is having trouble right now. Please try again or hold for staff.';

    logger.error('Voice call failover activated', {
      callSid: this.callSid,
      restaurantId: this.restaurantId,
      reason: reason?.message || reason,
    });

    try {
      this.appendTranscript('assistant', message);
      await this.tts?.speak(message, { flush: true });
      await this.tts?.flush();
    } catch (error) {
      logger.warn('Failover message speech failed', {
        callSid: this.callSid,
        error: error.message,
      });
    }

    try {
      await saveHandoff({
        restaurantId: this.restaurantId,
        callSid: this.callSid,
        from: this.from,
        handoffData: {
          name: '',
          phone: this.from,
          reason: 'Voice AI failed over to human staff',
          urgency: 'critical',
          summary: reason?.message || 'OpenAI or voice service failed to start.',
          relatedType: 'other',
          relatedDetails: reason?.stack || reason?.message || 'Unknown failure',
          bestCallbackTime: 'as soon as possible',
        },
        notificationChannel: this.context?.settings?.notificationChannel || 'sms',
        notificationStatus: 'pending',
        notificationTarget: this.context?.settings?.notificationPhone || this.context?.settings?.escalationPhone || '',
        notificationError: 'Failover triggered by the voice gateway.',
      });
    } catch (error) {
      logger.warn('Failover handoff save failed', {
        callSid: this.callSid,
        error: error.message,
      });
    }

    this.close();
  }

  async start(startEvent) {
    this.streamSid = startEvent.streamSid || '';
    this.callSid = startEvent.start?.callSid || startEvent.callSid || '';

    const params = startEvent.start?.customParameters || {};
    this.restaurantId = params.restaurantId || '';
    this.callSid = this.callSid || params.callSid || '';
    this.from = params.from || startEvent.start?.from || '';
    this.to = params.to || startEvent.start?.to || '';

    try {
      this.context = await fetchRestaurantContext({
        restaurantId: this.restaurantId || '',
        callSid: this.callSid,
        from: this.from,
        to: this.to,
      });
    } catch (error) {
      logger.warn('Failed to fetch restaurant context, falling back to defaults', {
        callSid: this.callSid,
        error: error.message,
      });
      this.context = {
        restaurantId: this.restaurantId || '',
        restaurant: {
          name: 'the restaurant',
          address: '',
          hours: '',
          phones: [],
          deliveryAreas: [],
          reservationEnabled: true,
          orderingEnabled: true,
        },
        menu: { categories: [] },
        settings: {},
        callerHistory: {},
      };
    }

    this.restaurantId = this.context.restaurantId || this.restaurantId;

    const settings = this.context.settings || {};
    this.orderDraft = this.createEmptyOrderDraft();
    const instructions = buildAgentInstructions({
      ...this.context,
      call: {
        from: this.from,
        to: this.to,
      },
    });

    this.tts = new ElevenLabsStream({
      voiceId: settings.voiceId || config.elevenLabsDefaultVoiceId,
      modelId: settings.voiceModel || config.elevenLabsDefaultModel,
      outputFormat: settings.outputFormat || config.elevenLabsOutputFormat,
      optimizeStreamingLatency: settings.elevenLabsStreamingLatency ?? config.elevenLabsOptimizeStreamingLatency,
      callSid: this.callSid,
      onAudio: (payload) => this.sendAudio(payload),
    });

    const ttsConnectPromise = this.tts.connect();
    const realtimeFallback = isRealtimeModelName(config.openaiRealtimeModel)
      ? normalizeModelName(config.openaiRealtimeModel)
      : 'gpt-realtime-2';
    const requestedModels = [
      normalizeModelName(settings.openaiModel),
      normalizeModelName(settings.backupOpenaiModel || config.openaiFallbackRealtimeModel),
      realtimeFallback,
    ].filter(Boolean);
    const models = [];

    for (const model of requestedModels) {
      if (!isRealtimeModelName(model)) {
        logger.warn('Skipping unsupported OpenAI model for realtime voice', {
          callSid: this.callSid,
          model,
        });
        continue;
      }

      if (!models.includes(model)) {
        models.push(model);
      }
    }

    let openaiConnectError = null;
    const openaiConnectPromise = (async () => {
      for (const model of models) {
        this.openai = new OpenAiRealtime({
          instructions,
          callSid: this.callSid,
          model,
          transcriptionModel: config.openaiTranscriptionModel,
          onText: (delta) => this.handleModelText(delta),
          onResponseDone: () => this.flushModelText(),
          onSpeechStarted: () => this.handleCallerInterrupt(),
          onFunctionCall: (name, args) => this.handleFunctionCall(name, args),
          onTranscript: (entry) => this.appendTranscript(entry.role || 'user', entry.text || ''),
        });

        try {
          await this.openai.connect();
          this.modelName = model;
          return;
        } catch (error) {
          openaiConnectError = error;
          logger.warn('OpenAI realtime connect failed', {
            callSid: this.callSid,
            model,
            error: error.message,
          });
        }
      }

      throw openaiConnectError || new Error('OpenAI connection unavailable.');
    })();

    const [ttsResult, openaiResult] = await Promise.allSettled([ttsConnectPromise, openaiConnectPromise]);

    if (ttsResult.status === 'rejected') {
      await this.activateFailover(ttsResult.reason);
      return;
    }

    if (openaiResult.status === 'rejected') {
      await this.activateFailover(openaiResult.reason || new Error('OpenAI connection unavailable.'));
      return;
    }

    const greeting = greetingFor(this.context);
    this.appendTranscript('assistant', greeting);
    this.openai.addAssistantMessage(greeting);
    await this.tts.speak(greeting, { flush: true });
    await this.tts.flush();
    this.scheduleSilenceTimers();

    logger.info('Voice call started', {
      callSid: this.callSid,
      restaurantId: this.restaurantId,
      from: this.from,
      to: this.to,
    });
  }

  handleTwilioMessage(message) {
    if (message.event === 'media' && message.media?.payload) {
      this.markCallerActivity();
      this.openai?.appendAudio(twilioMulawToPcm24kBase64(message.media.payload));
      return;
    }

    if (message.event === 'stop') {
      this.close();
    }
  }

  sendAudio(payload) {
    if (!this.streamSid || this.twilioWs.readyState !== WS_OPEN) return;
    this.twilioWs.send(twilioMedia(this.streamSid, payload));
  }

  clearAudio() {
    if (!this.streamSid || this.twilioWs.readyState !== WS_OPEN) return;
    this.twilioWs.send(twilioClear(this.streamSid));
  }

  handleCallerInterrupt() {
    this.markCallerActivity();
    this.clearTextFlushTimer();
    this.textBuffer = '';
    this.clearAudio();
    this.tts?.close();
    const settings = this.context?.settings || {};
    this.tts = new ElevenLabsStream({
      voiceId: settings.voiceId || config.elevenLabsDefaultVoiceId,
      modelId: settings.voiceModel || config.elevenLabsDefaultModel,
      outputFormat: settings.outputFormat || config.elevenLabsOutputFormat,
      optimizeStreamingLatency: settings.elevenLabsStreamingLatency ?? config.elevenLabsOptimizeStreamingLatency,
      callSid: this.callSid,
      onAudio: (payload) => this.sendAudio(payload),
    });
    this.tts.connect().catch((error) => {
      logger.warn('Failed to restart ElevenLabs after interruption', {
        callSid: this.callSid,
        error: error.message,
      });
    });
  }

  handleModelText(delta) {
    this.textBuffer += delta;
    const cleanLength = this.textBuffer.trim().length;
    const sentenceReady = /[.!?]\s*$/.test(this.textBuffer) || /[.!?]\s/.test(this.textBuffer);
    const sentenceReadyForFlush = sentenceReady && cleanLength >= this.getAssistantMinResponseChars();
    const longEnough = cleanLength >= this.getAssistantBufferChars();

    if (sentenceReadyForFlush) {
      void this.flushModelText({ immediate: true });
      return;
    }

    if (longEnough) {
      this.scheduleTextFlush(this.getAssistantFlushDelayMs());
      return;
    }

    this.clearTextFlushTimer();
  }

  flushModelText({ immediate = false } = {}) {
    this.clearTextFlushTimer();
    const chunk = this.textBuffer.trim();
    this.textBuffer = '';
    if (!chunk) return;

    this.appendTranscript('assistant', chunk);
    this.tts?.speak(chunk, { flush: immediate }).then(() => this.tts?.flush()).catch((error) => {
      logger.warn('ElevenLabs flush failed', { callSid: this.callSid, error: error.message });
    });
    this.scheduleSilenceTimers();

    if (this.streamSid && this.twilioWs.readyState === WS_OPEN) {
      this.twilioWs.send(twilioMark(this.streamSid, `reply-${Date.now()}`));
    }
  }

  async handleFunctionCall(name, args) {
    logger.info('Agent function call', { callSid: this.callSid, name, restaurantId: this.restaurantId });
    this.markCallerActivity();

    if (name === 'search_menu') {
      return {
        ok: true,
        results: this.searchMenuItems(args.query || '', args.category || '', args.limit || 8),
      };
    }

    if (name === 'set_order_details') {
      this.currentIntent = 'order';
      return this.applyOrderDetails(args);
    }

    if (name === 'order_cart_action') {
      this.currentIntent = 'order';
      return this.applyCartAction(args.action, args);
    }

    if (name === 'review_order') {
      this.currentIntent = 'order';
      return this.reviewCurrentOrder();
    }

    if (name === 'place_order') {
      if (!args.confirmed) {
        return { ok: false, message: 'Order was not confirmed.' };
      }
      return this.finalizeOrder();
    }

    if (name === 'lookup_recent_order') {
      return this.lookupRecentOrder(args.limit || 5);
    }

    if (name === 'create_order') {
      this.currentIntent = 'order';
      this.applyOrderDetails({
        orderType: args.orderType || args.fulfillment || this.orderDraft.orderType,
        fulfillment: args.fulfillment || this.orderDraft.fulfillment,
        customerName: args.name || this.orderDraft.customer.name,
        customerPhone: args.phone || this.orderDraft.customer.phone,
        address: args.address || this.orderDraft.customer.address,
        apartmentNumber: args.apartmentNumber || this.orderDraft.customer.apartmentNumber,
        instructions: args.instructions || args.notes || this.orderDraft.customer.instructions,
        scheduledFor: args.scheduledFor || this.orderDraft.schedule.scheduledFor,
        eventType: args.eventType || this.orderDraft.catering.eventType,
        guestCount: args.guestCount || this.orderDraft.schedule.guestCount,
        budget: args.budget || this.orderDraft.schedule.budget,
      });

      if (args.order && this.orderDraft.items.length === 0) {
        const added = this.applyCartAction('add', {
          query: args.order,
          quantity: 1,
          specialInstructions: args.notes || '',
        });
        if (!added.ok) {
          this.orderDraft.items.push({
            id: randomUUID(),
            menuEntry: {
              name: String(args.order || 'Order item').trim(),
              category: '',
              isAvailable: true,
              price: null,
              sizes: null,
              modifierPrices: null,
            },
            name: String(args.order || 'Order item').trim(),
            category: '',
            size: '',
            quantity: 1,
            unitPrice: null,
            modifiers: [],
            specialInstructions: String(args.notes || '').trim(),
            isAvailable: true,
          });
          this.calculateCartPricing();
        }
      }

      if (args.reviewConfirmed !== false) {
        this.orderDraft.reviewConfirmed = true;
      }

      return this.finalizeOrder();
    }

    if (name === 'create_reservation') {
      this.currentIntent = 'reservation';
      const reservationData = {
        name: args.name || '',
        phone: normalizePhone(args.phone || this.from),
        date: args.date || '',
        time: args.time || '',
        guests: args.guests || '',
        notes: args.notes || '',
      };
      const result = await saveReservation({
        restaurantId: this.restaurantId,
        callSid: this.callSid,
        from: this.from,
        reservationData,
      });
      this.callSummary = `Reservation saved for ${reservationData.name || 'caller'} on ${reservationData.date || 'requested date'}.`;
      return result;
    }

    if (name === 'request_handoff') {
      this.currentIntent = 'support';
      const result = await this.handleHandoffRequest(args);
      return result;
    }

    this.currentIntent = 'faq';
    return { ok: false, message: `Unknown function: ${name}` };
  }

  async sendManagerNotification(handoffData) {
    const settings = this.context?.settings || {};
    const channel = String(settings.notificationChannel || 'sms').toLowerCase();
    const urgency = normalizeUrgency(handoffData.urgency);
    const target = normalizePhone(settings.notificationPhone || settings.escalationPhone || '');

    if (!shouldNotify(settings, urgency)) {
      return { channel, status: 'skipped', target: '', error: '' };
    }

    if (!['sms', 'whatsapp'].includes(channel)) {
      return {
        channel,
        status: 'pending',
        target: settings.notificationEmail || target,
        error: channel === 'email' ? 'Email delivery is dashboard-only until SMTP is configured.' : '',
      };
    }

    const from = twilioFrom(channel);
    if (!config.twilioAccountSid || !config.twilioAuthToken || !from || !target) {
      return {
        channel,
        status: 'failed',
        target,
        error: 'Twilio notification credentials, from number, or manager phone are missing.',
      };
    }

    const restaurantName = this.context?.restaurant?.name || 'Restaurant';
    const body = [
      `Xorvian ${urgency.toUpperCase()} handoff for ${restaurantName}.`,
      `Customer: ${handoffData.name || 'Customer'} ${handoffData.phone || this.from || ''}`.trim(),
      `Reason: ${handoffData.reason}`,
      `Summary: ${handoffData.summary || handoffData.relatedDetails || 'See dashboard for details.'}`,
    ].join('\n');

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.twilioAccountSid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: from,
            To: twilioTarget(channel, target),
            Body: body,
          }),
        }
      );

      const text = await response.text();
      if (!response.ok) {
        return {
          channel,
          status: 'failed',
          target,
          error: truncate(text || `Twilio notification failed: ${response.status}`, 1000),
        };
      }

      return { channel, status: 'sent', target, error: '' };
    } catch (error) {
      return { channel, status: 'failed', target, error: truncate(error.message, 1000) };
    }
  }

  async handleHandoffRequest(args) {
    const handoffData = {
      name: truncate(args.name || '', 160),
      phone: normalizePhone(args.phone || this.from),
      reason: truncate(args.reason || 'Manager callback requested', 255),
      urgency: normalizeUrgency(args.urgency),
      summary: truncate(args.summary || '', 50000),
      relatedType: truncate(args.relatedType || 'other', 60),
      relatedDetails: truncate(args.relatedDetails || '', 50000),
      bestCallbackTime: truncate(args.bestCallbackTime || '', 120),
    };

    const notification = await this.sendManagerNotification(handoffData);
    const saved = await saveHandoff({
      restaurantId: this.restaurantId,
      callSid: this.callSid,
      from: this.from,
      handoffData,
      notificationChannel: notification.channel,
      notificationStatus: notification.status,
      notificationTarget: notification.target,
      notificationError: notification.error,
    });

    logger.info('Handoff request saved', {
      callSid: this.callSid,
      restaurantId: this.restaurantId,
      handoffId: saved.handoffId,
      urgency: handoffData.urgency,
      notificationStatus: notification.status,
    });

    this.callSummary = `Handoff saved for ${handoffData.name || 'caller'}: ${handoffData.reason}`;

    return {
      ok: true,
      handoffId: saved.handoffId,
      notificationStatus: notification.status,
      message:
        notification.status === 'sent'
          ? 'Manager notification sent and callback request saved.'
          : 'Callback request saved for the manager.',
    };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.clearSilenceTimers();
    this.clearTextFlushTimer();
    this.tts?.close();
    this.openai?.close();
    void this.saveFinalCallLog();
    logger.info('Voice call ended', {
      callSid: this.callSid,
      restaurantId: this.restaurantId,
      durationMs: Date.now() - this.startedAt,
    });
  }
}
