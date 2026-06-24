import WebSocket from 'ws';
import { config } from './config.js';
import { logger } from './logger.js';

export class ElevenLabsStream {
  constructor({ voiceId, modelId, outputFormat, optimizeStreamingLatency, onAudio, callSid }) {
    this.voiceId = voiceId || config.elevenLabsDefaultVoiceId;
    this.modelId = modelId || config.elevenLabsDefaultModel;
    this.outputFormat = outputFormat || config.elevenLabsOutputFormat;
    this.optimizeStreamingLatency = String(
      optimizeStreamingLatency ?? config.elevenLabsOptimizeStreamingLatency
    );
    this.onAudio = onAudio;
    this.callSid = callSid;
    this.ws = null;
    this.openPromise = null;
    this.closed = false;
  }

  async connect() {
    if (this.openPromise) return this.openPromise;

    const url = new URL(`wss://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream-input`);
    url.searchParams.set('model_id', this.modelId);
    url.searchParams.set('output_format', this.outputFormat);
    url.searchParams.set('optimize_streaming_latency', this.optimizeStreamingLatency);

    this.openPromise = new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      const fail = (error) => {
        logger.error('ElevenLabs stream failed to open', {
          callSid: this.callSid,
          error: error.message,
        });
        reject(error);
      };

      this.ws.once('error', fail);
      this.ws.once('open', () => {
        this.ws.off('error', fail);
        this.ws.on('error', (error) => {
          logger.warn('ElevenLabs stream error', { callSid: this.callSid, error: error.message });
        });
        this.ws.on('message', (raw) => this.handleMessage(raw));
        this.ws.on('close', () => {
          this.closed = true;
          logger.debug('ElevenLabs stream closed', { callSid: this.callSid });
        });
        this.send({
          text: ' ',
          xi_api_key: config.elevenLabsApiKey,
          voice_settings: {
            stability: 0.48,
            similarity_boost: 0.82,
            style: 0.18,
            use_speaker_boost: true,
          },
          generation_config: {
            chunk_length_schedule: [80, 120, 160, 240],
          },
        });
        resolve();
      });
    });

    return this.openPromise;
  }

  handleMessage(raw) {
    let message;

    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (message.audio) {
      this.onAudio(message.audio);
    }
  }

  send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  async speak(text, { flush = false } = {}) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return;

    await this.connect();
    this.send({
      text: `${clean} `,
      try_trigger_generation: flush,
    });
  }

  async flush() {
    await this.connect();
    this.send({ text: '', try_trigger_generation: true });
  }

  close() {
    this.closed = true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'call ended');
    }
  }
}
