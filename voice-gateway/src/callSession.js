import { ElevenLabsStream } from './elevenLabsStream.js';
import { OpenAiRealtime } from './openAiRealtime.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { buildAgentInstructions, greetingFor } from './restaurantPrompt.js';
import { fetchRestaurantContext, saveOrder, saveReservation } from './xorvianApi.js';
import { twilioClear, twilioMark, twilioMedia } from './twilioProtocol.js';
import { twilioMulawToPcm24kBase64 } from './audioCodec.js';

const WS_OPEN = 1;

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').slice(0, 40);
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
    this.closed = false;
    this.startedAt = Date.now();
  }

  async start(startEvent) {
    this.streamSid = startEvent.streamSid || '';
    this.callSid = startEvent.start?.callSid || startEvent.callSid || '';

    const params = startEvent.start?.customParameters || {};
    this.restaurantId = params.restaurantId || '';
    this.callSid = this.callSid || params.callSid || '';
    this.from = params.from || startEvent.start?.from || '';
    this.to = params.to || startEvent.start?.to || '';

    this.context = await fetchRestaurantContext({
      restaurantId: this.restaurantId,
      callSid: this.callSid,
      from: this.from,
      to: this.to,
    });
    this.restaurantId = this.context.restaurantId || this.restaurantId;

    const settings = this.context.settings || {};
    const instructions = buildAgentInstructions(this.context);

    this.tts = new ElevenLabsStream({
      voiceId: settings.voiceId || config.elevenLabsDefaultVoiceId,
      modelId: settings.voiceModel || config.elevenLabsDefaultModel,
      callSid: this.callSid,
      onAudio: (payload) => this.sendAudio(payload),
    });

    this.openai = new OpenAiRealtime({
      instructions,
      callSid: this.callSid,
      onText: (delta) => this.handleModelText(delta),
      onResponseDone: () => this.flushModelText(),
      onSpeechStarted: () => this.handleCallerInterrupt(),
      onFunctionCall: (name, args) => this.handleFunctionCall(name, args),
    });

    await Promise.all([this.openai.connect(), this.tts.connect()]);

    const greeting = greetingFor(this.context);
    this.openai.addAssistantMessage(greeting);
    await this.tts.speak(greeting, { flush: true });
    await this.tts.flush();

    logger.info('Voice call started', {
      callSid: this.callSid,
      restaurantId: this.restaurantId,
      from: this.from,
      to: this.to,
    });
  }

  handleTwilioMessage(message) {
    if (message.event === 'media' && message.media?.payload) {
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
    this.textBuffer = '';
    this.clearAudio();
    this.tts?.close();
    const settings = this.context?.settings || {};
    this.tts = new ElevenLabsStream({
      voiceId: settings.voiceId || config.elevenLabsDefaultVoiceId,
      modelId: settings.voiceModel || config.elevenLabsDefaultModel,
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

    const ready = /[.!?]\s$/.test(this.textBuffer) || this.textBuffer.length >= 120;
    if (!ready) return;

    const chunk = this.textBuffer;
    this.textBuffer = '';
    this.tts?.speak(chunk, { flush: false }).catch((error) => {
      logger.warn('ElevenLabs speak failed', { callSid: this.callSid, error: error.message });
    });
  }

  flushModelText() {
    const chunk = this.textBuffer.trim();
    this.textBuffer = '';
    if (!chunk) return;

    this.tts?.speak(chunk, { flush: true }).then(() => this.tts?.flush()).catch((error) => {
      logger.warn('ElevenLabs flush failed', { callSid: this.callSid, error: error.message });
    });

    if (this.streamSid && this.twilioWs.readyState === WS_OPEN) {
      this.twilioWs.send(twilioMark(this.streamSid, `reply-${Date.now()}`));
    }
  }

  async handleFunctionCall(name, args) {
    logger.info('Agent function call', { callSid: this.callSid, name, restaurantId: this.restaurantId });

    if (name === 'create_order') {
      const orderData = {
        name: args.name || '',
        phone: normalizePhone(args.phone || this.from),
        address: args.address || '',
        order: args.order || '',
        fulfillment: args.fulfillment || 'unknown',
        notes: args.notes || '',
      };
      return saveOrder({
        restaurantId: this.restaurantId,
        callSid: this.callSid,
        from: this.from,
        orderData,
      });
    }

    if (name === 'create_reservation') {
      const reservationData = {
        name: args.name || '',
        phone: normalizePhone(args.phone || this.from),
        date: args.date || '',
        time: args.time || '',
        guests: args.guests || '',
        notes: args.notes || '',
      };
      return saveReservation({
        restaurantId: this.restaurantId,
        callSid: this.callSid,
        from: this.from,
        reservationData,
      });
    }

    if (name === 'request_handoff') {
      return {
        ok: true,
        message: 'Human handoff requested.',
        escalationPhone: this.context?.restaurant?.phones?.[0] || '',
        reason: args.reason || '',
      };
    }

    return { ok: false, message: `Unknown function: ${name}` };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.tts?.close();
    this.openai?.close();
    logger.info('Voice call ended', {
      callSid: this.callSid,
      restaurantId: this.restaurantId,
      durationMs: Date.now() - this.startedAt,
    });
  }
}
