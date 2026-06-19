import { FastifyReply, FastifyRequest } from 'fastify';
import { sessionService } from './session.service';
import { sendSuccess } from '../common/response';
import { z } from 'zod';
import { ValidationError } from '../common/errors';
import { env } from '../config/env';

const createSessionSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  label: z.string().optional(),
});

export const createSession = async (request: FastifyRequest, reply: FastifyReply) => {
  const result = createSessionSchema.safeParse(request.body);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.format());
  }

  const { sessionId, label } = result.data;
  const session = await sessionService.createSession(sessionId, label);

  return sendSuccess(reply, {
    sessionId: session.sessionId,
    status: session.status,
  }, 201);
};

export const getSessionStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as { sessionId: string };
  const session = await sessionService.getSessionStatus(sessionId);

  return sendSuccess(reply, {
    sessionId: session.sessionId,
    status: session.status,
    phoneNumber: session.phoneNumber,
    lastConnectedAt: session.lastConnectedAt,
    lastDisconnectedAt: session.lastDisconnectedAt,
  });
};

export const getSessionQr = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as { sessionId: string };
  const qrData = await sessionService.getSessionQr(sessionId);

  return sendSuccess(reply, qrData);
};

export const logoutSession = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as { sessionId: string };
  const session = await sessionService.logoutSession(sessionId);

  return sendSuccess(reply, {
    sessionId: session.sessionId,
    status: session.status,
  });
};

export const listSessions = async (request: FastifyRequest, reply: FastifyReply) => {
  const sessions = await sessionService.listSessions();
  const data = sessions.map((s) => ({
    sessionId: s.sessionId,
    label: s.label,
    status: s.status,
    phoneNumber: s.phoneNumber,
  }));
  return sendSuccess(reply, data);
};

export const getSessionQrPage = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as { sessionId: string };
  const apiKey = env.API_KEY;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp QR - ${sessionId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #0a0a23 0%, #1a1a3e 50%, #0d0d2b 100%);
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #e0e0e0;
    }
    .card {
      background: rgba(22, 33, 62, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      max-width: 420px;
      width: 90vw;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    h2 { color: #25d366; margin-bottom: 8px; font-size: 1.4em; }
    .session-id { color: #888; font-size: 0.85em; margin-bottom: 20px; }
    #qrImage {
      width: 280px; height: 280px;
      border-radius: 12px;
      border: 3px solid rgba(37,211,102,0.3);
      display: none;
      margin: 0 auto;
    }
    #statusText {
      margin-top: 20px; font-size: 1.1em;
      padding: 10px 20px;
      border-radius: 8px;
      background: rgba(255,255,255,0.05);
    }
    .connected { color: #25d366 !important; background: rgba(37,211,102,0.1) !important; }
    .waiting { color: #f0ad4e; }
    .error { color: #e74c3c; }
    .spinner {
      width: 40px; height: 40px;
      border: 4px solid rgba(37,211,102,0.2);
      border-top-color: #25d366;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .refresh-info { color: #666; font-size: 0.75em; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>\uD83D\uDCF1 WhatsApp Gateway</h2>
    <div class="session-id">Session: <strong>${sessionId}</strong></div>
    <div id="spinner" class="spinner"></div>
    <img id="qrImage" alt="QR Code" />
    <div id="statusText" class="waiting">Initializing...</div>
    <div class="refresh-info">Auto-refreshes every 5 seconds</div>
  </div>
  <script>
    const SESSION_ID = '${sessionId}';
    const API_KEY = '${apiKey}';
    const BASE = window.location.origin + '/v1/sessions/' + SESSION_ID;
    let connected = false;

    async function fetchQR() {
      if (connected) return;
      try {
        const res = await fetch(BASE + '/qr', { headers: { 'X-API-Key': API_KEY } });
        const json = await res.json();
        if (json.data && json.data.qr) {
          document.getElementById('qrImage').src = json.data.qr;
          document.getElementById('qrImage').style.display = 'inline';
          document.getElementById('spinner').style.display = 'none';
          document.getElementById('statusText').className = 'waiting';
          document.getElementById('statusText').innerText = 'Scan this QR with WhatsApp';
        } else {
          const sRes = await fetch(BASE + '/status', { headers: { 'X-API-Key': API_KEY } });
          const sJson = await sRes.json();
          if (sJson.data && sJson.data.status === 'CONNECTED') {
            connected = true;
            document.getElementById('qrImage').style.display = 'none';
            document.getElementById('spinner').style.display = 'none';
            document.getElementById('statusText').className = 'connected';
            document.getElementById('statusText').innerHTML = '\u2705 CONNECTED<br><small>' + (sJson.data.phoneNumber || '') + '</small>';
          } else {
            document.getElementById('statusText').innerText = 'Status: ' + (sJson.data ? sJson.data.status : 'Waiting for QR...');
          }
        }
      } catch (e) {
        document.getElementById('statusText').className = 'error';
        document.getElementById('statusText').innerText = 'Connection error. Retrying...';
      }
    }
    fetchQR();
    setInterval(fetchQR, 5000);
  </script>
</body>
</html>`;

  reply
    .header('Content-Type', 'text/html; charset=utf-8')
    .header('Content-Security-Policy', "default-src 'self' 'unsafe-inline'; img-src 'self' data:;")
    .send(html);
};
