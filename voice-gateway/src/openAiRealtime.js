import WebSocket from 'ws';
import { config } from './config.js';
import { logger } from './logger.js';

const tools = [
  {
    type: 'function',
    name: 'create_order',
    description: 'Create a confirmed restaurant order after the caller confirms all details.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        order: { type: 'string', description: 'Food and drink items, sizes, quantities, and notes.' },
        fulfillment: { type: 'string', enum: ['pickup', 'delivery', 'dine_in', 'unknown'] },
        address: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['name', 'phone', 'order', 'fulfillment'],
    },
  },
  {
    type: 'function',
    name: 'create_reservation',
    description: 'Create a reservation request after the caller confirms all details.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        date: { type: 'string', description: 'Reservation date in YYYY-MM-DD when possible.' },
        time: { type: 'string', description: 'Reservation time in HH:MM 24-hour time when possible.' },
        guests: { type: 'integer' },
        notes: { type: 'string' },
      },
      required: ['name', 'phone', 'date', 'time', 'guests'],
    },
  },
  {
    type: 'function',
    name: 'request_handoff',
    description: 'Create a manager callback request after collecting caller details and the reason handoff is needed.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'Customer name, confirmed when possible.' },
        phone: { type: 'string', description: 'Best callback phone number.' },
        reason: { type: 'string' },
        urgency: { type: 'string', enum: ['normal', 'urgent', 'critical'] },
        summary: { type: 'string', description: 'Short manager-facing summary of the issue and conversation.' },
        relatedType: { type: 'string', enum: ['order', 'reservation', 'complaint', 'allergy', 'refund', 'large_order', 'other'] },
        relatedDetails: { type: 'string', description: 'Order, reservation, allergy, complaint, or special request details.' },
        bestCallbackTime: { type: 'string' },
      },
      required: ['name', 'phone', 'reason', 'urgency', 'summary', 'relatedType'],
    },
  },
];

function reasoningConfig() {
  return config.openaiRealtimeModel === 'gpt-realtime-2' ? { effort: 'low' } : undefined;
}

export class OpenAiRealtime {
  constructor({
    instructions,
    onText,
    onResponseDone,
    onSpeechStarted,
    onFunctionCall,
    onTranscript,
    callSid,
    model,
    transcriptionModel,
  }) {
    this.instructions = instructions;
    this.onText = onText;
    this.onResponseDone = onResponseDone;
    this.onSpeechStarted = onSpeechStarted;
    this.onFunctionCall = onFunctionCall;
    this.onTranscript = onTranscript;
    this.callSid = callSid;
    this.model = model || config.openaiRealtimeModel;
    this.transcriptionModel = transcriptionModel || config.openaiTranscriptionModel;
    this.ws = null;
    this.openPromise = null;
    this.functionArgs = new Map();
    this.invokedFunctionCalls = new Set();
  }

  async connect() {
    if (this.openPromise) return this.openPromise;

    const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.model)}`;
    this.openPromise = new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
      });

      const fail = (error) => {
        logger.error('OpenAI Realtime failed to open', { callSid: this.callSid, error: error.message });
        reject(error);
      };

      this.ws.once('error', fail);
      this.ws.once('open', () => {
        this.ws.off('error', fail);
        this.ws.on('message', (raw) => this.handleMessage(raw));
        this.ws.on('error', (error) => {
          logger.warn('OpenAI Realtime error', { callSid: this.callSid, error: error.message });
        });
        this.ws.on('close', () => {
          logger.debug('OpenAI Realtime closed', { callSid: this.callSid });
        });
        this.sessionUpdate();
        resolve();
      });
    });

    return this.openPromise;
  }

  sessionUpdate() {
    this.send({
      type: 'session.update',
        session: {
          type: 'realtime',
          model: this.model,
          output_modalities: ['text'],
          instructions: this.instructions,
          audio: {
            input: {
            format: {
              type: 'audio/pcm',
              rate: 24000,
            },
            transcription: {
              model: this.transcriptionModel,
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.45,
              prefix_padding_ms: 250,
              silence_duration_ms: 350,
              create_response: true,
            },
          },
        },
        reasoning: reasoningConfig(),
        tools,
        tool_choice: 'auto',
      },
    });
  }

  handleMessage(raw) {
    let event;

    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }

    logger.debug('OpenAI event', { callSid: this.callSid, type: event.type });

    if (event.type === 'input_audio_buffer.speech_started') {
      this.onSpeechStarted?.();
      return;
    }

    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      const text = event.transcript || event.text || event.item?.content?.[0]?.text || '';
      if (text) {
        this.onTranscript?.({
          role: 'user',
          text,
        });
      }
      return;
    }

    if (event.type === 'response.output_text.delta' || event.type === 'response.text.delta') {
      this.onText?.(event.delta || '');
      return;
    }

    if (event.type === 'response.function_call_arguments.delta') {
      const key = event.call_id || event.item_id;
      this.functionArgs.set(key, (this.functionArgs.get(key) || '') + (event.delta || ''));
      return;
    }

    if (event.type === 'response.function_call_arguments.done') {
      const key = event.call_id || event.item_id;
      const args = event.arguments || this.functionArgs.get(key) || '';
      this.invokeFunction(event.name, key, args);
      return;
    }

    if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') {
      this.invokeFunction(event.item.name, event.item.call_id, event.item.arguments || '{}');
      return;
    }

    if (event.type === 'response.done') {
      this.onResponseDone?.();
      return;
    }

    if (event.type === 'error') {
      logger.warn('OpenAI Realtime API error', {
        callSid: this.callSid,
        error: event.error?.message || event.message || 'Unknown error',
      });
    }
  }

  async invokeFunction(name, callId, rawArgs) {
    if (!name || !callId) return;
    if (this.invokedFunctionCalls.has(callId)) return;
    this.invokedFunctionCalls.add(callId);

    let args = {};
    try {
      args = rawArgs ? JSON.parse(rawArgs) : {};
    } catch {
      args = {};
    }

    try {
      const result = await this.onFunctionCall(name, args);
      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(result),
        },
      });
      this.send({
        type: 'response.create',
        response: {
          output_modalities: ['text'],
        },
      });
    } catch (error) {
      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify({ ok: false, message: error.message }),
        },
      });
      this.send({
        type: 'response.create',
        response: {
          output_modalities: ['text'],
          instructions: 'Apologize briefly and say the restaurant may need to confirm this with staff.',
        },
      });
    }
  }

  appendAudio(base64Audio) {
    this.send({
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    });
  }

  addAssistantMessage(text) {
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text,
          },
        ],
      },
    });
  }

  send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'call ended');
    }
  }
}
