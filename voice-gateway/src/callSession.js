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
    this.transcript = [];
    this.currentIntent = 'unknown';
    this.callSummary = '';
    this.finalStatus = 'completed';
    this.callLogSaved = false;
    this.silenceWarningHandle = null;
    this.silenceHangupHandle = null;
    this.lastCallerActivityAt = Date.now();
    this.lastAssistantActivityAt = Date.now();
    this.modelName = '';
    this.closed = false;
    this.startedAt = Date.now();
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
      this.callSummary = clean;
    }
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
    this.callLogSaved = true;

    try {
      await saveCallLog({
        restaurantId: this.restaurantId,
        callSid: this.callSid,
        callerPhone: this.from,
        callType: this.currentIntent || 'unknown',
        callStatus: this.finalStatus || 'completed',
        summary: this.summarizeTranscript(),
        transcript: this.transcript.map((entry) => `${entry.role}: ${entry.text}`).join('\n'),
        durationSeconds: Math.max(0, Math.round((Date.now() - this.startedAt) / 1000)),
      });
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
      callSid: this.callSid,
      onAudio: (payload) => this.sendAudio(payload),
    });

    try {
      await this.tts.connect();
    } catch (error) {
      await this.activateFailover(error);
      return;
    }

    const models = [
      settings.openaiModel || config.openaiRealtimeModel,
      settings.backupOpenaiModel || config.openaiFallbackRealtimeModel,
    ].filter((value, index, array) => value && array.indexOf(value) === index);

    let connectError = null;
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
        connectError = null;
        break;
      } catch (error) {
        connectError = error;
        logger.warn('OpenAI realtime connect failed', {
          callSid: this.callSid,
          model,
          error: error.message,
        });
      }
    }

    if (!this.openai || connectError) {
      await this.activateFailover(connectError || new Error('OpenAI connection unavailable.'));
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
    this.appendTranscript('assistant', chunk);
    this.tts?.speak(chunk, { flush: false }).catch((error) => {
      logger.warn('ElevenLabs speak failed', { callSid: this.callSid, error: error.message });
    });
    this.scheduleSilenceTimers();
  }

  flushModelText() {
    const chunk = this.textBuffer.trim();
    this.textBuffer = '';
    if (!chunk) return;

    this.appendTranscript('assistant', chunk);
    this.tts?.speak(chunk, { flush: true }).then(() => this.tts?.flush()).catch((error) => {
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

    if (name === 'create_order') {
      this.currentIntent = 'order';
      const orderData = {
        name: args.name || '',
        phone: normalizePhone(args.phone || this.from),
        address: args.address || '',
        order: args.order || '',
        fulfillment: args.fulfillment || 'unknown',
        notes: args.notes || '',
      };
      const result = await saveOrder({
        restaurantId: this.restaurantId,
        callSid: this.callSid,
        from: this.from,
        orderData,
      });
      this.callSummary = `Order saved for ${orderData.name || 'caller'} (${orderData.fulfillment}).`;
      return result;
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
