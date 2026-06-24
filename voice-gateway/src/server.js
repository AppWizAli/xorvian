import http from 'node:http';
import { WebSocketServer } from 'ws';
import { config, publicWebSocketUrl, requireRuntimeConfig } from './config.js';
import { logger } from './logger.js';
import { escapeXml, twimlResponse } from './xml.js';
import { CallSession } from './callSession.js';

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function parseRequestParams(req, body) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const params = new URLSearchParams(url.search);

  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = new URLSearchParams(body);
    for (const [key, value] of form.entries()) params.set(key, value);
  } else if (contentType.includes('application/json') && body) {
    try {
      const json = JSON.parse(body);
      for (const [key, value] of Object.entries(json)) params.set(key, String(value ?? ''));
    } catch {
      // Twilio normally sends form encoding; invalid JSON is ignored here.
    }
  }

  return params;
}

function authorized(req) {
  if (!config.gatewayToken) return true;
  const url = new URL(req.url, `http://${req.headers.host}`);
  return url.searchParams.get('token') === config.gatewayToken;
}

function mediaPath() {
  return config.gatewayToken ? `/media/${encodeURIComponent(config.gatewayToken)}` : '/media';
}

function authorizedMediaPath(pathname) {
  return pathname === mediaPath();
}

async function handleIncomingCall(req, res) {
  if (!authorized(req)) {
    send(res, 401, 'Unauthorized');
    return;
  }

  const body = await readBody(req);
  const params = parseRequestParams(req, body);
  const streamUrl = publicWebSocketUrl(mediaPath(), req);

  const customParameters = {
    restaurantId: params.get('restaurantId') || '',
    callSid: params.get('CallSid') || '',
    from: params.get('From') || '',
    to: params.get('To') || '',
  };

  const parameterXml = Object.entries(customParameters)
    .map(([name, value]) => `<Parameter name="${escapeXml(name)}" value="${escapeXml(value)}"/>`)
    .join('');

  const twiml = twimlResponse(
    `<Connect><Stream url="${escapeXml(streamUrl)}">${parameterXml}</Stream></Connect>`
  );

  send(res, 200, twiml, { 'Content-Type': 'text/xml; charset=utf-8' });
}

async function handleSquareWebhook(req, res) {
  const body = await readBody(req);

  logger.info('Square webhook received', {
    contentType: req.headers['content-type'] || '',
    squareEventType: req.headers['x-square-event-type'] || '',
    squareSignaturePresent: Boolean(req.headers['x-square-hmacsha256-signature']),
    bodyPreview: body.slice(0, 1000),
  });

  send(res, 200, JSON.stringify({ ok: true }), {
    'Content-Type': 'application/json; charset=utf-8',
  });
}

function handleHealth(req, res) {
  send(
    res,
    200,
    JSON.stringify({
      ok: true,
      service: 'xorvian-voice-gateway',
      countryDefault: config.defaultCountry,
      elevenLabsVoice: true,
      realtime: true,
    }),
    { 'Content-Type': 'application/json; charset=utf-8' }
  );
}

function handleNotFound(res) {
  send(res, 404, JSON.stringify({ ok: false, message: 'Not found.' }), {
    'Content-Type': 'application/json; charset=utf-8',
  });
}

requireRuntimeConfig();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      handleHealth(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/twilio/incoming') {
      await handleIncomingCall(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/square/webhook') {
      await handleSquareWebhook(req, res);
      return;
    }

    handleNotFound(res);
  } catch (error) {
    logger.error('HTTP request failed', { error: error.message });
    send(res, 500, JSON.stringify({ ok: false, message: 'Server error.' }), {
      'Content-Type': 'application/json; charset=utf-8',
    });
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (!authorizedMediaPath(url.pathname)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  const session = new CallSession(ws);

  ws.on('message', async (raw) => {
    let message;

    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    try {
      if (message.event === 'start') {
        await session.start(message);
      } else {
        session.handleTwilioMessage(message);
      }
    } catch (error) {
      logger.error('Call session error', {
        callSid: session.callSid,
        error: error.message,
      });
      session.close();
      ws.close(1011, 'session error');
    }
  });

  ws.on('close', () => session.close());
  ws.on('error', (error) => {
    logger.warn('Twilio WebSocket error', { callSid: session.callSid, error: error.message });
    session.close();
  });
});

server.listen(config.port, () => {
  logger.info('Xorvian voice gateway listening', {
    port: config.port,
    publicBaseUrl: config.publicBaseUrl || '(derived from request host)',
  });
});
