import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

function getArgValue(flagNames) {
  for (const flag of flagNames) {
    const idx = process.argv.indexOf(flag);
    if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('-')) {
      return process.argv[idx + 1];
    }
  }
  return null;
}

function findPositionalServerArg() {
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('-')) {
      if (arg === '--port' || arg === '-p' || arg === '--graywolf' || arg === '--url' || arg === '--target' || arg === '-s') {
        i++;
      }
      continue;
    }
    if (arg.includes('.') || arg.includes(':') || arg.startsWith('http')) {
      return arg;
    }
  }
  return null;
}

function normalizeUrl(url) {
  if (!url) return 'http://127.0.0.1:8080';
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }
  return url.replace(/\/+$/, '');
}

const portVal = getArgValue(['--port', '-p']);
const PORT = parseInt(portVal || process.env.PORT || '3000', 10);

const cliTarget = getArgValue(['--graywolf', '--target', '--url', '-s']) || findPositionalServerArg();
let currentGraywolfUrl = normalizeUrl(cliTarget || process.env.GRAYWOLF_URL || 'http://127.0.0.1:8080');
const isMock = process.argv.includes('--mock') || process.env.MOCK === 'true';

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

// --- Mock Data Store (for field testing & offline preview) ---
const mockStore = {
  station: {
    callsign: 'W1AW-7',
    disabled: []
  },
  status: {
    status: 'ok',
    uptime_seconds: 14520,
    rx_packets: 342,
    tx_packets: 88,
    version: '1.0.4-gw'
  },
  beacons: [
    {
      id: 1,
      callsign: 'W1AW-7',
      comment: 'Graywolf 7" Tablet Node [433.050/144.390]',
      channel: 1,
      interval: 600,
      enabled: true,
      destination: 'APGW01',
      latitude: 41.7148,
      longitude: -72.7272,
      messaging: true,
      use_gps: false
    },
    {
      id: 2,
      callsign: 'W1AW-7',
      comment: 'SAR Mobile Command / Field Ops',
      channel: 1,
      interval: 300,
      enabled: true,
      destination: 'APGW01',
      latitude: 41.7155,
      longitude: -72.7280,
      messaging: true,
      use_gps: false
    },
    {
      id: 3,
      callsign: 'W1AW-7',
      comment: 'Emergency Beacon - Grid FN31',
      channel: 2,
      interval: 120,
      enabled: false,
      destination: 'APGW01',
      latitude: 41.7148,
      longitude: -72.7272,
      messaging: false,
      use_gps: false
    }
  ],
  conversations: [
    {
      thread_key: 'N0CALL-9',
      thread_kind: 'dm',
      alias: 'Field Unit Alpha',
      last_snippet: 'Copy that. Arrived at checkpoint Bravo.',
      last_sender_call: 'N0CALL-9',
      last_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      unread_count: 1,
      total_count: 5,
      participant_count: 1,
      archived: false
    },
    {
      thread_key: 'SAR-NET',
      thread_kind: 'tactical',
      alias: 'Search & Rescue Ops',
      last_snippet: 'All teams check in on 146.520.',
      last_sender_call: 'K3SAR',
      last_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      unread_count: 0,
      total_count: 12,
      participant_count: 4,
      archived: false
    },
    {
      thread_key: 'WX-BOT',
      thread_kind: 'dm',
      alias: 'Weather Advisory',
      last_snippet: 'WX 68F Baro 30.14 steady Wind NW 6mph',
      last_sender_call: 'WX-BOT',
      last_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      unread_count: 0,
      total_count: 3,
      participant_count: 1,
      archived: false
    }
  ],
  messages: [
    {
      id: 101,
      thread_key: 'N0CALL-9',
      thread_kind: 'dm',
      from_call: 'W1AW-7',
      to_call: 'N0CALL-9',
      direction: 'out',
      text: 'Unit Alpha, what is your current GPS location?',
      sent_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      acked_at: new Date(Date.now() - 11.9 * 60 * 1000).toISOString(),
      status: 'acked',
      channel: 1,
      source: 'rf',
      attempts: 1,
      unread: false
    },
    {
      id: 102,
      thread_key: 'N0CALL-9',
      thread_kind: 'dm',
      from_call: 'N0CALL-9',
      to_call: 'W1AW-7',
      direction: 'in',
      text: 'En route to ridge line trail. 1.2mi out.',
      received_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      status: 'received',
      channel: 1,
      source: 'rf',
      unread: false
    },
    {
      id: 103,
      thread_key: 'N0CALL-9',
      thread_kind: 'dm',
      from_call: 'W1AW-7',
      to_call: 'N0CALL-9',
      direction: 'out',
      text: 'ROGER. Maintain radio silence until CP Bravo.',
      sent_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      acked_at: new Date(Date.now() - 4.9 * 60 * 1000).toISOString(),
      status: 'acked',
      channel: 1,
      source: 'rf',
      attempts: 1,
      unread: false
    },
    {
      id: 104,
      thread_key: 'N0CALL-9',
      thread_kind: 'dm',
      from_call: 'N0CALL-9',
      to_call: 'W1AW-7',
      direction: 'in',
      text: 'Copy that. Arrived at checkpoint Bravo.',
      received_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      status: 'received',
      channel: 1,
      source: 'rf',
      unread: true
    },
    {
      id: 201,
      thread_key: 'SAR-NET',
      thread_kind: 'tactical',
      from_call: 'K3SAR',
      to_call: 'SAR-NET',
      direction: 'in',
      text: 'Tactical net open. Incident command online.',
      received_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      status: 'received',
      channel: 1,
      source: 'rf',
      unread: false
    },
    {
      id: 202,
      thread_key: 'SAR-NET',
      thread_kind: 'tactical',
      from_call: 'W1AW-7',
      to_call: 'SAR-NET',
      direction: 'out',
      text: 'W1AW-7 standing by with tablet client.',
      sent_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      status: 'sent',
      channel: 1,
      source: 'rf',
      attempts: 1,
      unread: false
    },
    {
      id: 203,
      thread_key: 'SAR-NET',
      thread_kind: 'tactical',
      from_call: 'K3SAR',
      to_call: 'SAR-NET',
      direction: 'in',
      text: 'All teams check in on 146.520.',
      received_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      status: 'received',
      channel: 1,
      source: 'rf',
      unread: false
    }
  ]
};

const sseClients = new Set();

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Mock APRSOTA Bot Simulator State
let mockOtaBotState = {
  hostOpActive: false,
  hostOpNumber: 47,
  pendingBeacon: false,
  description: '',
  startedAt: null,
  qsos: 0,
  points: 0
};

function simulateOtaBotMessage(text, delayMs = 1200) {
  setTimeout(() => {
    const botCall = 'APRSOTA';
    const msgId = Date.now() + Math.floor(Math.random() * 1000);
    const inMsg = {
      id: msgId,
      thread_key: botCall,
      thread_kind: 'dm',
      from_call: botCall,
      to_call: mockStore.station.callsign,
      direction: 'in',
      text: text,
      received_at: new Date().toISOString(),
      status: 'received',
      channel: 1,
      source: 'rf',
      unread: true
    };
    mockStore.messages.push(inMsg);
    mockStore.status.rx_packets += 1;

    let conv = mockStore.conversations.find(c => c.thread_key.toUpperCase() === botCall);
    if (!conv) {
      conv = {
        thread_key: botCall,
        thread_kind: 'dm',
        alias: 'APRS OTA Bot',
        last_snippet: text,
        last_sender_call: botCall,
        last_at: inMsg.received_at,
        unread_count: 1,
        total_count: 1,
        participant_count: 1,
        archived: false
      };
      mockStore.conversations.unshift(conv);
    } else {
      conv.last_snippet = text;
      conv.last_sender_call = botCall;
      conv.last_at = inMsg.received_at;
      conv.total_count += 1;
      conv.unread_count += 1;
    }

    broadcastSSE({
      id: inMsg.id,
      kind: 'in',
      message: inMsg
    });
  }, delayMs);
}

// --- Body Parser Helper ---
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// --- Mock API Router ---
async function handleMockApi(req, res, pathname, query) {
  res.setHeader('Content-Type', 'application/json');

  // Station Config
  if (req.method === 'GET' && pathname === '/api/station/config') {
    res.writeHead(200);
    return res.end(JSON.stringify(mockStore.station));
  }

  // System Status
  if (req.method === 'GET' && pathname === '/api/status') {
    res.writeHead(200);
    return res.end(JSON.stringify(mockStore.status));
  }

  // Auth Login / Logout
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    res.setHeader('Set-Cookie', 'graywolf_session=mock-valid-session; Path=/; HttpOnly; SameSite=Lax');
    res.writeHead(200);
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    res.setHeader('Set-Cookie', 'graywolf_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    res.writeHead(200);
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  // Beacons List
  if (req.method === 'GET' && pathname === '/api/beacons') {
    res.writeHead(200);
    return res.end(JSON.stringify(mockStore.beacons));
  }

  // Manual Beacon Trigger: POST /api/beacons/{id}/send
  const beaconSendMatch = pathname.match(/^\/api\/beacons\/(\d+)\/send$/);
  if (req.method === 'POST' && beaconSendMatch) {
    const beaconId = parseInt(beaconSendMatch[1], 10);
    const beacon = mockStore.beacons.find(b => b.id === beaconId);
    if (!beacon) {
      res.writeHead(404);
      return res.end(JSON.stringify({ error: `Beacon ${beaconId} not found` }));
    }

    mockStore.status.tx_packets += 1;
    console.log(`[MOCK BEACON TRIGGERED] Beacon #${beacon.id} (${beacon.callsign}) transmitted: "${beacon.comment}"`);

    // Broadcast SSE beacon event
    broadcastSSE({
      type: 'beacon_sent',
      beacon_id: beacon.id,
      callsign: beacon.callsign,
      timestamp: new Date().toISOString()
    });

    if (mockOtaBotState.pendingBeacon) {
      mockOtaBotState.pendingBeacon = false;
      mockOtaBotState.hostOpActive = true;
      mockOtaBotState.startedAt = new Date().toISOString();
      otaNowCache.timestamp = 0;
      const baseCall = mockStore.station.callsign.split('-')[0];
      simulateOtaBotMessage(`${mockStore.station.callsign} is on the air from FN00al. aprsota.org/${baseCall}/ops/${mockOtaBotState.hostOpNumber}`, 1200);

      // Simulate incoming chasers arriving over RF after a realistic short delay
      setTimeout(() => {
        simulateOtaBotMessage('DE K3SAR-7 FN09lv greetings from summit', 500);
      }, 4000);
      setTimeout(() => {
        simulateOtaBotMessage('DE N0CALL-9 FN00xk 599 mike portable', 500);
      }, 9000);
    }

    res.writeHead(200);
    return res.end(JSON.stringify({ status: 'sent' }));
  }

  // Conversations List
  if (req.method === 'GET' && pathname === '/api/messages/conversations') {
    res.writeHead(200);
    return res.end(JSON.stringify(mockStore.conversations));
  }

  // Message Events (SSE)
  if (req.method === 'GET' && pathname === '/api/messages/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('retry: 5000\n\n');
    res.write(': connected to mock event stream\n\n');

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // List Messages: GET /api/messages?thread_kind=...&thread_key=...
  if (req.method === 'GET' && pathname === '/api/messages') {
    const threadKind = query.get('thread_kind');
    const threadKey = query.get('thread_key');

    let filtered = mockStore.messages;
    if (threadKind && threadKey) {
      filtered = filtered.filter(m => m.thread_kind === threadKind && m.thread_key.toUpperCase() === threadKey.toUpperCase());
    }

    const changes = filtered.map(msg => ({
      id: msg.id,
      kind: msg.kind || 'text',
      message: msg
    }));

    res.writeHead(200);
    return res.end(JSON.stringify({
      changes,
      cursor: ''
    }));
  }

  // Send Message: POST /api/messages
  if (req.method === 'POST' && pathname === '/api/messages') {
    const payload = await parseJsonBody(req);
    if (!payload.to || !payload.text) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Missing "to" or "text"' }));
    }

    const toCall = payload.to.trim().toUpperCase();
    const isTactical = toCall.includes('SAR') || toCall.includes('NET') || payload.kind === 'invite';
    const threadKind = isTactical ? 'tactical' : 'dm';

    const newMsg = {
      id: Date.now(),
      thread_key: toCall,
      thread_kind: threadKind,
      from_call: mockStore.station.callsign,
      to_call: toCall,
      direction: 'out',
      text: payload.text,
      sent_at: new Date().toISOString(),
      channel: payload.channel || 1,
      source: payload.prefer_is ? 'is' : 'rf',
      status: 'pending',
      attempts: 1,
      unread: false,
      extended: payload.text.length > 67,
      client_id: payload.client_id
    };

    mockStore.messages.push(newMsg);
    mockStore.status.tx_packets += 1;

    // Update or create conversation summary
    let conv = mockStore.conversations.find(c => c.thread_key.toUpperCase() === toCall);
    if (!conv) {
      conv = {
        thread_key: toCall,
        thread_kind: threadKind,
        alias: '',
        last_snippet: payload.text,
        last_sender_call: mockStore.station.callsign,
        last_at: newMsg.sent_at,
        unread_count: 0,
        total_count: 1,
        participant_count: 1,
        archived: false
      };
      mockStore.conversations.unshift(conv);
    } else {
      conv.last_snippet = payload.text;
      conv.last_sender_call = mockStore.station.callsign;
      conv.last_at = newMsg.sent_at;
      conv.total_count += 1;
    }

    // Broadcast SSE change
    broadcastSSE({
      id: newMsg.id,
      kind: 'out',
      message: newMsg
    });

    // Simulate RF transmission and ACK delivery after 1.5s
    setTimeout(() => {
      newMsg.status = 'acked';
      newMsg.acked_at = new Date().toISOString();
      broadcastSSE({
        id: newMsg.id,
        kind: 'ack',
        message: newMsg
      });
    }, 1500);

    // Mock APRSOTA Bot Logic
    if (toCall === 'APRSOTA' || toCall === 'OTA') {
      const trimmedText = payload.text.trim();
      if (/^(HOST|QRV)\b/i.test(trimmedText)) {
        mockOtaBotState.pendingBeacon = true;
        mockOtaBotState.description = trimmedText.replace(/^(HOST|QRV)\s*/i, '');
        mockOtaBotState.qsos = 0;
        mockOtaBotState.points = 0;
        mockOtaBotState.hostOpNumber = (mockOtaBotState.hostOpNumber || 46) + 1;
        otaNowCache.timestamp = 0;
        simulateOtaBotMessage('Send a position report within 5 mins to go on the air', 1000);
      } else if (/^QSL\b/i.test(trimmedText) || /^@[A-Za-z0-9/-]+\s+QSL\b/i.test(trimmedText)) {
        const match = trimmedText.match(/^(?:@([A-Za-z0-9/-]+)\s+QSL|QSL\s+([A-Za-z0-9/-]+))/i);
        const chaserCall = match ? (match[1] || match[2]).toUpperCase() : 'STATION';
        mockOtaBotState.qsos += 1;
        mockOtaBotState.points += 3;
        otaNowCache.timestamp = 0;
        simulateOtaBotMessage(`DE ${chaserCall} QSL thx for the contact 73`, 1200);
      } else if (/^STAY\b/i.test(trimmedText)) {
        simulateOtaBotMessage('Staying on the air. Off the air in 55 minutes, max 95 minutes', 1000);
      } else if (/^(TIME|QRT\?)\b/i.test(trimmedText)) {
        simulateOtaBotMessage('Off the air in 45 minutes, max 95 minutes. STAY adds 30 mins', 1000);
      } else if (/^CHASERS\b/i.test(trimmedText)) {
        simulateOtaBotMessage('K3SAR-7 N0CALL-9', 1000);
      } else if (/^BLAST\b/i.test(trimmedText)) {
        simulateOtaBotMessage(`BLAST ${mockStore.station.callsign}: ${trimmedText.replace(/^BLAST\s+/i, '')}`, 1000);
      } else if (/^(DONE|QRT)\b/i.test(trimmedText)) {
        mockOtaBotState.hostOpActive = false;
        mockOtaBotState.pendingBeacon = false;
        otaNowCache.timestamp = 0;
        simulateOtaBotMessage(`Op complete: ${mockOtaBotState.qsos || 0} QSOs, ${mockOtaBotState.points || 0} pts. aprsota.org/${mockStore.station.callsign.split('-')[0]}`, 1200);
      }
    }

    res.writeHead(202);
    return res.end(JSON.stringify(newMsg));
  }

  // Mark Message Read: POST /api/messages/{id}/read
  const readMatch = pathname.match(/^\/api\/messages\/(\d+)\/read$/);
  if (req.method === 'POST' && readMatch) {
    const id = parseInt(readMatch[1], 10);
    const msg = mockStore.messages.find(m => m.id === id);
    if (msg) {
      msg.unread = false;
      const conv = mockStore.conversations.find(c => c.thread_key === msg.thread_key);
      if (conv && conv.unread_count > 0) conv.unread_count -= 1;
    }
    res.writeHead(204);
    return res.end();
  }

  // Resend Message: POST /api/messages/{id}/resend
  const resendMatch = pathname.match(/^\/api\/messages\/(\d+)\/resend$/);
  if (req.method === 'POST' && resendMatch) {
    const id = parseInt(resendMatch[1], 10);
    const msg = mockStore.messages.find(m => m.id === id);
    if (!msg) {
      res.writeHead(404);
      return res.end(JSON.stringify({ error: 'Message not found' }));
    }
    msg.attempts = (msg.attempts || 1) + 1;
    msg.status = 'sent';
    res.writeHead(202);
    return res.end(JSON.stringify(msg));
  }

  // Delete Thread: DELETE /api/messages/threads/{kind}/{key}
  const deleteThreadMatch = pathname.match(/^\/api\/messages\/threads\/([^/]+)\/([^/]+)$/);
  if (req.method === 'DELETE' && deleteThreadMatch) {
    const kind = decodeURIComponent(deleteThreadMatch[1]);
    const key = decodeURIComponent(deleteThreadMatch[2]).toUpperCase();
    mockStore.conversations = mockStore.conversations.filter(c => !(c.thread_kind === kind && c.thread_key.toUpperCase() === key));
    mockStore.messages = mockStore.messages.filter(m => !(m.thread_kind === kind && m.thread_key.toUpperCase() === key));
    res.writeHead(204);
    return res.end();
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: `Not found: ${pathname}` }));
}

// --- Live Reverse Proxy to Graywolf Daemon ---
function proxyToGraywolf(req, res, targetUrl) {
  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: `Invalid Graywolf URL: ${targetUrl}` }));
  }

  const isHttps = parsedTarget.protocol === 'https:';
  const clientMod = isHttps ? https : http;

  const options = {
    hostname: parsedTarget.hostname,
    port: parsedTarget.port || (isHttps ? 443 : 80),
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: parsedTarget.host
    }
  };

  const proxyReq = clientMod.request(options, proxyRes => {
    const headers = { ...proxyRes.headers };

    // Clean Set-Cookie: strip Domain & Secure attributes so tablet browser on HTTP accepts session cookies
    if (headers['set-cookie']) {
      const cookies = Array.isArray(headers['set-cookie']) ? headers['set-cookie'] : [headers['set-cookie']];
      headers['set-cookie'] = cookies.map(cookieStr =>
        cookieStr
          .replace(/;\s*Domain=[^;]+/gi, '')
          .replace(/;\s*Secure/gi, '')
          .replace(/;\s*SameSite=[^;]+/gi, '; SameSite=Lax')
      );
    }

    // Disable caching & proxy buffering for SSE streams
    if (req.url.includes('/events')) {
      delete headers['content-length'];
      headers['cache-control'] = 'no-cache, no-transform';
      headers['connection'] = 'keep-alive';
      headers['x-accel-buffering'] = 'no';

      if (req.socket && typeof req.socket.setNoDelay === 'function') {
        req.socket.setNoDelay(true);
      }
      if (proxyReq.socket && typeof proxyReq.socket.setNoDelay === 'function') {
        proxyReq.socket.setNoDelay(true);
      }

      res.writeHead(proxyRes.statusCode, headers);
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      proxyRes.on('data', chunk => {
        res.write(chunk);
        if (typeof res.flush === 'function') res.flush();
      });
      proxyRes.on('end', () => res.end());
      proxyRes.on('error', err => {
        console.error('[SSE PROXY RES ERROR]', err.message);
        res.end();
      });
      return;
    }

    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });

  res.on('close', () => {
    if (!res.writableEnded) {
      proxyReq.destroy();
    }
  });

  proxyReq.on('error', err => {
    console.error(`[PROXY ERROR] Failed to connect to Graywolf at ${targetUrl}:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: `Could not connect to Graywolf daemon at ${targetUrl}. (${err.message})`,
        hint: 'Check that Graywolf is running and accessible at this IP and port.'
      }));
    }
  });

  req.pipe(proxyReq);
}

// --- APRS OTA Configuration & In-Memory Cache ---
const CONFIG_FILE = path.join(__dirname, 'config.json');

function loadConfig() {
  let cfg = {
    aprsota_token: process.env.APRSOTA_TOKEN || '',
    bot_callsign: process.env.APRSOTA_BOT || 'APRSOTA',
    client_uuid: ''
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      cfg = { ...cfg, ...JSON.parse(data) };
    }
  } catch (err) {
    console.warn('[CONFIG] Failed to read config.json:', err.message);
  }
  if (!cfg.client_uuid) {
    cfg.client_uuid = crypto.randomUUID();
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
    } catch {
      // ignore
    }
  }
  return cfg;
}

function saveConfig(updates) {
  const current = loadConfig();
  const merged = { ...current, ...updates };
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
    console.log('[CONFIG] Saved config.json successfully.');
  } catch (err) {
    console.error('[CONFIG] Error saving config.json:', err.message);
  }
  return merged;
}

let otaNowCache = {
  timestamp: 0,
  etag: null,
  data: null
};

let otaClientCache = {
  token: null,
  name: null,
  timestamp: 0
};

async function verifyOtaToken(token) {
  if (!token || isMock) {
    return { valid: false, name: null };
  }
  if (otaClientCache.token === token && (Date.now() - otaClientCache.timestamp < 300000)) {
    return { valid: true, name: otaClientCache.name };
  }

  const config = loadConfig();

  return new Promise(resolve => {
    const options = {
      hostname: 'aprsota.org',
      port: 443,
      path: '/api/v1/client',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Graywolf-Tablet-Client/1.0 (amateur-radio)',
        'OTA-User': config.client_uuid || 'graywolf-terminal',
        'Accept': 'application/json'
      },
      timeout: 5000
    };

    const upstreamReq = https.request(options, upstreamRes => {
      let body = '';
      upstreamRes.on('data', chunk => { body += chunk; });
      upstreamRes.on('end', () => {
        if (upstreamRes.statusCode === 200) {
          try {
            const data = JSON.parse(body);
            otaClientCache = {
              token,
              name: data.name || 'APRSOTA Client',
              timestamp: Date.now()
            };
            return resolve({ valid: true, name: data.name });
          } catch {
            // ignore
          }
        }
        resolve({ valid: false, name: null });
      });
    });

    upstreamReq.on('error', () => resolve({ valid: false, name: null }));
    upstreamReq.on('timeout', () => {
      upstreamReq.destroy();
      resolve({ valid: false, name: null });
    });
    upstreamReq.end();
  });
}

const MOCK_OTA_SPOTS = {
  generated_at: new Date().toISOString(),
  on_air: [
    {
      callsign: 'K3NG',
      station: 'K3NG-7',
      number: 42,
      state: 'on_air',
      description: 'Point State Park 7.032 CW & 144.39 APRS',
      reference: 'K-1234',
      grid: 'FN00al',
      position: { lat: 40.4414, lon: -80.0078 },
      country: { code: 'US', name: 'United States of America' },
      water: null,
      on_air_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 135 * 60 * 1000).toISOString(),
      ended_at: null,
      end_reason: null,
      signoff: null,
      qsos: 14,
      incomplete: 0,
      points: 24,
      url: 'https://aprsota.org/K3NG/ops/42',
      card_image_url: null
    },
    {
      callsign: 'W3ATV',
      station: 'W3ATV-1',
      number: 43,
      state: 'on_air',
      description: 'Mount Davis High Point 2m packet & voice',
      reference: 'W3/PW-001',
      grid: 'FN09lv',
      position: { lat: 39.7865, lon: -79.1764 },
      country: { code: 'US', name: 'United States of America' },
      water: null,
      on_air_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 150 * 60 * 1000).toISOString(),
      ended_at: null,
      end_reason: null,
      signoff: null,
      qsos: 8,
      incomplete: 0,
      points: 18,
      url: 'https://aprsota.org/W3ATV/ops/43',
      card_image_url: null
    },
    {
      callsign: 'XE3JCL',
      station: 'XE3JCL-1',
      number: 110,
      state: 'on_air',
      description: 'happy Tuesday 73',
      reference: null,
      grid: 'EL51fa',
      position: { lat: 21.005833, lon: -89.5625 },
      country: { code: 'MX', name: 'Mexico' },
      water: null,
      on_air_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
      ended_at: null,
      end_reason: null,
      signoff: null,
      qsos: 5,
      incomplete: 0,
      points: 16,
      url: 'https://aprsota.org/XE3JCL/ops/110',
      card_image_url: null
    },
    {
      callsign: 'DL7PJ',
      station: 'DL7PJ-7',
      number: 209,
      state: 'on_air',
      description: 'Last OP📡from Eifel🌋 via TD-H9📻',
      reference: null,
      grid: 'JN39jv',
      position: { lat: 49.8985, lon: 6.7585 },
      country: { code: 'DE', name: 'Germany' },
      water: null,
      on_air_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      ended_at: null,
      end_reason: null,
      signoff: null,
      qsos: 4,
      incomplete: 0,
      points: 15,
      url: 'https://aprsota.org/DL7PJ/ops/209',
      card_image_url: null
    }
  ]
};

async function handleOtaApi(req, res, pathname, query) {
  res.setHeader('Content-Type', 'application/json');

  if (pathname === '/api/ota/now') {
    const config = loadConfig();
    const token = (config.aprsota_token || process.env.APRSOTA_TOKEN || '').trim();
    const now = Date.now();
    const isManualRefresh = Boolean(query && (query.refresh === '1' || query.refresh === 'true'));

    // Polite cache: serve if refreshed within 30s, unless a manual refresh is requested
    if (!isManualRefresh && otaNowCache.data && (now - otaNowCache.timestamp < 30000)) {
      res.setHeader('X-Cache', 'HIT');
      res.writeHead(200);
      return res.end(JSON.stringify(otaNowCache.data));
    }

    // Return mock spots if in mock mode or token not yet configured
    if (isMock || !token) {
      const baseCall = mockStore.station.callsign.split('-')[0];
      const activeHostOp = mockOtaBotState.hostOpActive ? [{
        callsign: baseCall,
        station: mockStore.station.callsign,
        number: mockOtaBotState.hostOpNumber,
        state: 'on_air',
        description: mockOtaBotState.description || 'Portable Activation',
        reference: 'K-1234',
        grid: 'FN00al',
        position: { lat: 40.4414, lon: -80.0078 },
        country: { code: 'US', name: 'United States of America' },
        water: null,
        on_air_at: mockOtaBotState.startedAt || new Date().toISOString(),
        expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
        qsos: mockOtaBotState.qsos,
        points: mockOtaBotState.points,
        url: `https://aprsota.org/${baseCall}/ops/${mockOtaBotState.hostOpNumber}`
      }] : [];

      const filteredMock = MOCK_OTA_SPOTS.on_air.filter(
        s => s.station !== mockStore.station.callsign && s.callsign !== baseCall
      );

      otaNowCache = {
        timestamp: now,
        etag: '"mock-spots-etag"',
        data: {
          ...MOCK_OTA_SPOTS,
          on_air: [...activeHostOp, ...filteredMock]
        }
      };
      res.setHeader('X-Cache', isManualRefresh ? 'MOCK-REFRESH' : 'MOCK');
      res.writeHead(200);
      return res.end(JSON.stringify(otaNowCache.data));
    }

    // Upstream fetch to aprsota.org
    try {
      const options = {
        hostname: 'aprsota.org',
        port: 443,
        path: '/api/v1/now',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Graywolf-Tablet-Client/1.0 (amateur-radio)',
          'OTA-User': config.client_uuid || 'graywolf-terminal',
          'Accept': 'application/json'
        },
        timeout: 8000
      };

      if (otaNowCache.etag) {
        options.headers['If-None-Match'] = otaNowCache.etag;
      }

      const upstreamReq = https.request(options, upstreamRes => {
        if (upstreamRes.statusCode === 304 && otaNowCache.data) {
          otaNowCache.timestamp = Date.now();
          if (!res.headersSent) {
            res.setHeader('X-Cache', '304-REVALIDATED');
            res.writeHead(200);
            return res.end(JSON.stringify(otaNowCache.data));
          }
          return;
        }

        let body = '';
        upstreamRes.on('data', chunk => { body += chunk; });
        upstreamRes.on('end', () => {
          if (res.headersSent) return;

          if (upstreamRes.statusCode === 200) {
            try {
              const parsed = JSON.parse(body);
              otaNowCache = {
                timestamp: Date.now(),
                etag: upstreamRes.headers.etag || null,
                data: parsed
              };
              res.setHeader('X-Cache', isManualRefresh ? 'REFRESHED' : 'MISS');
              res.writeHead(200);
              return res.end(JSON.stringify(parsed));
            } catch (err) {
              console.error('[OTA JSON PARSE ERROR]', err);
            }
          }

          if (upstreamRes.statusCode === 429) {
            const retryAfterSec = parseInt(upstreamRes.headers['retry-after'], 10) || 60;
            console.warn(`[OTA RATE LIMITED] HTTP 429 from aprsota.org. Backing off for ${retryAfterSec}s`);
            otaNowCache.timestamp = Date.now() + (retryAfterSec * 1000) - 60000;
          }

          if (otaNowCache.data) {
            res.setHeader('X-Cache', 'STALE-FALLBACK');
            res.writeHead(200);
            return res.end(JSON.stringify(otaNowCache.data));
          }

          res.writeHead(upstreamRes.statusCode || 502);
          res.end(body || JSON.stringify({ error: `Upstream error ${upstreamRes.statusCode}` }));
        });

        upstreamRes.on('error', err => {
          console.warn('[OTA UPSTREAM RES ERROR]', err.message);
          if (res.headersSent) return;
          if (otaNowCache.data) {
            res.setHeader('X-Cache', 'STALE-OFFLINE');
            res.writeHead(200);
            return res.end(JSON.stringify(otaNowCache.data));
          }
          res.writeHead(502);
          res.end(JSON.stringify({ error: `Connection interrupted: ${err.message}` }));
        });
      });

      upstreamReq.on('error', err => {
        console.warn('[OTA UPSTREAM ERROR]', err.message);
        if (res.headersSent) return;
        if (otaNowCache.data) {
          res.setHeader('X-Cache', 'STALE-OFFLINE');
          res.writeHead(200);
          return res.end(JSON.stringify(otaNowCache.data));
        }
        res.writeHead(502);
        res.end(JSON.stringify({ error: `Could not connect to aprsota.org: ${err.message}` }));
      });

      upstreamReq.on('timeout', () => {
        upstreamReq.destroy(new Error('Request timed out'));
      });

      upstreamReq.end();
    } catch (err) {
      console.error('[OTA DISPATCH ERROR]', err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    }
    return;
  }

  // Operator Info & Live Op status: GET /api/ota/operators/:callsign
  const operatorMatch = pathname.match(/^\/api\/ota\/operators\/([A-Za-z0-9_-]+)$/);
  if (operatorMatch) {
    const opCall = operatorMatch[1].toUpperCase();
    if (isMock) {
      res.writeHead(200);
      return res.end(JSON.stringify({
        callsign: opCall,
        first_heard_at: new Date(Date.now() - 30 * 86400000).toISOString(),
        totals: { points: 142, qsos: 48, ops_hosted: 12 },
        on_air: mockOtaBotState.hostOpActive ? {
          callsign: opCall,
          station: mockStore.station.callsign,
          number: mockOtaBotState.hostOpNumber,
          state: 'on_air',
          description: mockOtaBotState.description || 'Portable Activation',
          grid: 'FN00al',
          position: { lat: 40.4414, lon: -80.0078 },
          country: { code: 'US', name: 'United States of America' },
          water: null,
          on_air_at: mockOtaBotState.startedAt || new Date().toISOString(),
          expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
          qsos: mockOtaBotState.qsos,
          points: mockOtaBotState.points,
          url: `https://aprsota.org/${opCall}/ops/${mockOtaBotState.hostOpNumber}`
        } : null
      }));
    }

    const config = loadConfig();
    const token = (config.aprsota_token || process.env.APRSOTA_TOKEN || '').trim();
    if (!token) {
      res.writeHead(200);
      return res.end(JSON.stringify({ callsign: opCall, on_air: null }));
    }

    try {
      const options = {
        hostname: 'aprsota.org',
        port: 443,
        path: `/api/v1/operators/${encodeURIComponent(opCall)}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Graywolf-Tablet-Client/1.0 (amateur-radio)',
          'OTA-User': config.client_uuid || 'graywolf-terminal',
          'Accept': 'application/json'
        },
        timeout: 8000
      };

      const upstreamReq = https.request(options, upstreamRes => {
        let body = '';
        upstreamRes.on('data', chunk => { body += chunk; });
        upstreamRes.on('end', () => {
          if (res.headersSent) return;
          res.writeHead(upstreamRes.statusCode || 200);
          res.end(body);
        });
        upstreamRes.on('error', err => {
          console.warn('[OTA OPERATOR RES ERROR]', err.message);
          if (res.headersSent) return;
          res.writeHead(502);
          res.end(JSON.stringify({ error: err.message }));
        });
      });
      upstreamReq.on('error', err => {
        console.warn('[OTA OPERATOR UPSTREAM ERROR]', err.message);
        if (res.headersSent) return;
        res.writeHead(502);
        res.end(JSON.stringify({ error: err.message }));
      });
      upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('Timeout')));
      upstreamReq.end();
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
}

async function handleOtaClient(req, res, pathname) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && pathname === '/client/ota-status') {
    const config = loadConfig();
    const token = (config.aprsota_token || process.env.APRSOTA_TOKEN || '').trim();
    const hasToken = Boolean(token && token.length > 0);
    const masked = hasToken ? (token.substring(0, 8) + '...' + token.slice(-4)) : '';

    if (hasToken && !otaClientCache.name && !isMock) {
      await verifyOtaToken(token);
    }

    let opsCount = 0;
    if (otaNowCache.data) {
      if (Array.isArray(otaNowCache.data.on_air)) {
        opsCount = otaNowCache.data.on_air.length;
      } else if (Array.isArray(otaNowCache.data)) {
        opsCount = otaNowCache.data.length;
      }
    }

    res.writeHead(200);
    return res.end(JSON.stringify({
      configured: hasToken,
      token_preview: masked,
      client_name: otaClientCache.name || (hasToken ? 'APRSOTA Client' : null),
      bot_callsign: (config.bot_callsign || 'APRSOTA').toUpperCase(),
      last_sync: otaNowCache.timestamp ? new Date(otaNowCache.timestamp).toISOString() : null,
      ops_count: opsCount,
      spots_count: opsCount,
      mode: isMock ? 'mock' : (hasToken ? 'live-aprsota' : 'mock-preview')
    }));
  }

  if (req.method === 'POST' && pathname === '/client/ota-config') {
    try {
      const payload = await parseJsonBody(req);
      const updates = {};
      if (typeof payload.aprsota_token === 'string') {
        updates.aprsota_token = payload.aprsota_token.trim();
        otaClientCache.token = null;
        otaClientCache.name = null;
      }
      if (typeof payload.bot_callsign === 'string' && payload.bot_callsign.trim()) {
        updates.bot_callsign = payload.bot_callsign.trim().toUpperCase();
      }

      const saved = saveConfig(updates);
      // Reset cache timestamp to force fresh fetch
      otaNowCache.timestamp = 0;

      if (saved.aprsota_token && !isMock) {
        await verifyOtaToken(saved.aprsota_token);
      }

      res.writeHead(200);
      return res.end(JSON.stringify({
        status: 'ok',
        configured: Boolean(saved.aprsota_token),
        client_name: otaClientCache.name || null,
        bot_callsign: saved.bot_callsign || 'APRSOTA'
      }));
    } catch (err) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
}

// --- Static File Handler ---
function serveStatic(req, res, pathname) {
  let safePath = pathname;
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback for SPA routing if needed
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (err2, indexData) => {
        if (err2) {
          res.writeHead(404);
          return res.end('Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(indexData);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    fs.createReadStream(filePath).pipe(res);
  });
}

// --- Main HTTP Server ---
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Logging
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    if (pathname.startsWith('/api') || res.statusCode >= 400) {
      console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname} ${res.statusCode} (${elapsed}ms)`);
    }
  });

  // Dynamic Graywolf Target configuration: POST /client/target
  if (req.method === 'POST' && pathname === '/client/target') {
    try {
      const payload = await parseJsonBody(req);
      if (payload.target) {
        currentGraywolfUrl = normalizeUrl(payload.target);
        console.log(`[TARGET UPDATED] Switched Graywolf URL to: ${currentGraywolfUrl}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok', graywolf_url: currentGraywolfUrl }));
      }
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // APRS OTA Client Config & Status
  if (pathname.startsWith('/client/ota-')) {
    return handleOtaClient(req, res, pathname);
  }

  // APRS OTA Proxy & Cache (intercepted before Graywolf proxy)
  if (pathname.startsWith('/api/ota/')) {
    return handleOtaApi(req, res, pathname, parsedUrl.searchParams);
  }

  // Handle /api routes
  if (pathname.startsWith('/api/')) {
    if (isMock) {
      return handleMockApi(req, res, pathname, parsedUrl.searchParams).catch(err => {
        console.error('[MOCK ROUTE ERROR]', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else {
      return proxyToGraywolf(req, res, currentGraywolfUrl);
    }
  }

  // Health / Config ping
  if (pathname === '/client/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      mode: isMock ? 'mock' : 'live-proxy',
      graywolf_url: currentGraywolfUrl,
      version: '1.0.0'
    }));
  }

  // Static files
  serveStatic(req, res, pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` Graywolf 7" Tablet Web Client`);
  console.log(` Server running on http://0.0.0.0:${PORT}`);
  console.log(` Mode: ${isMock ? 'SIMULATED MOCK MODE' : `LIVE PROXY -> ${currentGraywolfUrl}`}`);
  console.log(` Target Graywolf Daemon: ${currentGraywolfUrl}`);
  console.log(` Optimizations: 7" Landscape (1024x600) & Portrait`);
  console.log(`====================================================`);
});
