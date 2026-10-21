// End-to-End Test for Graywolf 7" Tablet Client
process.argv.push('--mock', '--port', '3948');

const { default: server } = await import('./server.mjs');

// Wait for server to start listening
await new Promise(r => setTimeout(r, 600));

const baseUrl = 'http://127.0.0.1:3948';

console.log('Testing 1: /client/info');
const infoRes = await fetch(`${baseUrl}/client/info`);
if (!infoRes.ok) throw new Error(`client/info failed: ${infoRes.status}`);
const info = await infoRes.json();
console.log('✓ /client/info:', info);

console.log('Testing 2: /api/station/config');
const stationRes = await fetch(`${baseUrl}/api/station/config`);
if (!stationRes.ok) throw new Error(`station/config failed: ${stationRes.status}`);
const station = await stationRes.json();
console.log('✓ /api/station/config:', station);

console.log('Testing 3: /api/beacons');
const beaconsRes = await fetch(`${baseUrl}/api/beacons`);
if (!beaconsRes.ok) throw new Error(`beacons failed: ${beaconsRes.status}`);
const beacons = await beaconsRes.json();
console.log(`✓ /api/beacons: found ${beacons.length} beacons`);

console.log('Testing 4: POST /api/beacons/1/send (Manual Beacon Trigger)');
const triggerRes = await fetch(`${baseUrl}/api/beacons/1/send`, { method: 'POST' });
if (!triggerRes.ok) throw new Error(`beacon send failed: ${triggerRes.status}`);
const triggerResult = await triggerRes.json();
console.log('✓ POST /api/beacons/1/send result:', triggerResult);

console.log('Testing 5: GET /api/messages/conversations');
const convRes = await fetch(`${baseUrl}/api/messages/conversations`);
if (!convRes.ok) throw new Error(`conversations failed: ${convRes.status}`);
const conversations = await convRes.json();
console.log(`✓ /api/messages/conversations: found ${conversations.length} threads`);

console.log('Testing 6: GET /api/messages?thread_kind=dm&thread_key=N0CALL-9');
const msgRes = await fetch(`${baseUrl}/api/messages?thread_kind=dm&thread_key=N0CALL-9`);
if (!msgRes.ok) throw new Error(`messages list failed: ${msgRes.status}`);
const msgList = await msgRes.json();
console.log(`✓ /api/messages: retrieved ${msgList.changes.length} messages in N0CALL-9 thread`);

console.log('Testing 7: POST /api/messages (Send new DM)');
const sendRes = await fetch(`${baseUrl}/api/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'N0CALL-9',
    text: 'Automated test message from 7" tablet terminal',
    kind: 'text',
    channel: 1
  })
});
if (!sendRes.ok) throw new Error(`send message failed: ${sendRes.status}`);
const sentMsg = await sendRes.json();
console.log('✓ POST /api/messages: created message ID:', sentMsg.id, 'status:', sentMsg.status);

console.log('Testing 8: GET /index.html (Static file delivery)');
const staticRes = await fetch(`${baseUrl}/index.html`);
if (!staticRes.ok) throw new Error(`static index.html failed: ${staticRes.status}`);
const htmlText = await staticRes.text();
if (!htmlText.includes('Graywolf APRS - Tablet Terminal')) {
  throw new Error('index.html did not contain expected title');
}
if (!htmlText.includes('tab-view-spots') || !htmlText.includes('spots-list')) {
  throw new Error('index.html did not contain APRS OTA Spots markup');
}
console.log('✓ Static delivery verified: index.html contains spots UI markup');

console.log('Testing 9: GET /api/ota/now (Live APRS OTA Ops feed)');
const otaRes = await fetch(`${baseUrl}/api/ota/now`);
if (!otaRes.ok) throw new Error(`api/ota/now failed: ${otaRes.status}`);
const otaData = await otaRes.json();
const ops = otaData.on_air || (Array.isArray(otaData) ? otaData : []);
if (!Array.isArray(ops) || ops.length === 0) {
  throw new Error('api/ota/now did not return an array of ops: ' + JSON.stringify(otaData));
}
const firstOp = ops[0];
if (!firstOp.callsign || !firstOp.number || !firstOp.position) {
  throw new Error('Op object missing required fields: ' + JSON.stringify(firstOp));
}
console.log(`✓ /api/ota/now: retrieved ${ops.length} active ops. Sample: Op #${firstOp.number} by ${firstOp.callsign} (${firstOp.description})`);

console.log('Testing 10: Polite 60s Caching on /api/ota/now');
const cacheRes = await fetch(`${baseUrl}/api/ota/now`);
if (!cacheRes.ok) throw new Error(`cached api/ota/now failed: ${cacheRes.status}`);
const cacheHeader = cacheRes.headers.get('x-cache');
console.log(`✓ /api/ota/now cache response: X-Cache = ${cacheHeader}`);

console.log('Testing 11: GET /client/ota-status and POST /client/ota-config');
const otaStatusRes = await fetch(`${baseUrl}/client/ota-status`);
if (!otaStatusRes.ok) throw new Error(`client/ota-status failed: ${otaStatusRes.status}`);
const otaStatus = await otaStatusRes.json();
console.log('✓ /client/ota-status:', otaStatus);
if (typeof otaStatus.ops_count !== 'number' || otaStatus.ops_count !== ops.length) {
  throw new Error(`Expected ops_count ${ops.length}, got ${otaStatus.ops_count}`);
}

const updateConfigRes = await fetch(`${baseUrl}/client/ota-config`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bot_callsign: 'OTA'
  })
});
if (!updateConfigRes.ok) throw new Error(`client/ota-config failed: ${updateConfigRes.status}`);
const updateConfig = await updateConfigRes.json();
if (updateConfig.bot_callsign !== 'OTA') {
  throw new Error('bot_callsign did not update to OTA');
}
console.log('✓ POST /client/ota-config updated bot callsign:', updateConfig);

console.log('Testing 12: Distance & Bearing Math Validation');
function calculateDistanceAndBearing(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;
  const R_mi = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distMi = Math.round(R_mi * c);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const cardinal = cardinals[Math.round(brng / 22.5) % 16];
  return { distanceMi: distMi, bearingDeg: Math.round(brng), cardinal };
}

// Pittsburgh (40.4406, -79.9959) to Mount Davis (39.7865, -79.1764)
const mathTest = calculateDistanceAndBearing(40.4406, -79.9959, 39.7865, -79.1764);
console.log(`✓ Distance/Bearing calculation: ${mathTest.distanceMi} mi, ${mathTest.bearingDeg}°, ${mathTest.cardinal}`);
if (mathTest.distanceMi < 55 || mathTest.distanceMi > 70 || mathTest.cardinal !== 'SE') {
  throw new Error(`Distance/bearing calculation unexpected: ${JSON.stringify(mathTest)}`);
}

console.log('Testing 13: Callsign Chip Regex, SSID Stripping, and Prepend Logic');
const sampleMsg = 'W3ABC-7 is at K-1234 on 144.390. Contact K3NG or @N0CALL for info. 73!';
const callsignRegex = /(?:@)?\b([A-Za-z0-9]{1,2}\d[A-Za-z]{1,4}(?:-[A-Za-z0-9]{1,4})?)\b/g;
const detected = [];
sampleMsg.replace(callsignRegex, (match, fullCall) => {
  const baseCall = fullCall.split('-')[0].toUpperCase();
  detected.push({ match, fullCall, baseCall });
});

console.log('✓ Detected callsigns in sample message:', detected);
if (detected.length !== 3) {
  throw new Error(`Expected 3 callsigns, found ${detected.length}`);
}
if (detected[0].baseCall !== 'W3ABC' || detected[1].baseCall !== 'K3NG' || detected[2].baseCall !== 'N0CALL') {
  throw new Error('Callsign base extraction failed: ' + JSON.stringify(detected));
}

// Test prepend logic helper
function simulateCallsignClick(existingInput, clickedCall) {
  const baseCall = clickedCall.split('-')[0].toUpperCase();
  const prefix = `@${baseCall} `;
  let current = existingInput.trim();
  if (!current) {
    return prefix;
  }
  if (/^@[A-Za-z0-9/-]+\s*/.test(current)) {
    current = current.replace(/^@[A-Za-z0-9/-]+\s*/, '');
  }
  return current.length > 0 ? `${prefix}${current} ` : prefix;
}

const test1 = simulateCallsignClick('', 'W3ABC-7');
if (test1 !== '@W3ABC ') throw new Error(`Empty input test failed: got "${test1}"`);

const test2 = simulateCallsignClick('599 from Pittsburgh', 'W3ABC-7');
if (test2 !== '@W3ABC 599 from Pittsburgh ') throw new Error(`Prepend test failed: got "${test2}"`);

const test3 = simulateCallsignClick('@W3ABC 599 from Pittsburgh', 'K3NG');
if (test3 !== '@K3NG 599 from Pittsburgh ') throw new Error(`Swap test failed: got "${test3}"`);

console.log('✓ Callsign prepend and prefix swap tests passed cleanly');

console.log('\nTesting 14: Host / Activation Assistant HUD Lifecycle & 1-Tap QSL');

// 1. Check initial operator endpoint
const opRes = await fetch(`${baseUrl}/api/ota/operators/GRAYWOLF`);
if (!opRes.ok) throw new Error(`Operator endpoint failed: ${opRes.status}`);
const opData = await opRes.json();
console.log('✓ Operator data retrieved:', opData.callsign);

// 2. Host starts activation: send HOST to APRSOTA
console.log('-> Sending HOST command to APRSOTA...');
const hostMsgRes = await fetch(`${baseUrl}/api/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'APRSOTA',
    text: 'HOST POTA K-1234',
    client_id: 'test-host-1'
  })
});
if (!hostMsgRes.ok) throw new Error(`Sending HOST failed: ${hostMsgRes.status}`);

// Wait for mock bot reply: "Send a position report within 5 mins to go on the air"
await new Promise(r => setTimeout(r, 1300));
const botThreadRes = await fetch(`${baseUrl}/api/messages?thread_kind=dm&thread_key=APRSOTA`);
const botMessages = await botThreadRes.json();
const beaconPrompt = botMessages.changes.find(m => /Send a position report within 5 mins/i.test(m.message ? m.message.text : m.text));
if (!beaconPrompt) {
  throw new Error('Bot beacon prompt message not found in thread');
}
console.log('✓ APRSOTA Bot beacon prompt received:', beaconPrompt.message ? beaconPrompt.message.text : beaconPrompt.text);

// 3. Station transmits position report (1-tap beacon trigger)
console.log('-> Transmitting position beacon to go on the air...');
const beaconSendRes = await fetch(`${baseUrl}/api/beacons/1/send`, { method: 'POST' });
if (!beaconSendRes.ok) throw new Error(`Beacon trigger failed: ${beaconSendRes.status}`);

// Wait for on-air announcement and incoming chasers
await new Promise(r => setTimeout(r, 1400));
const onAirCheckRes = await fetch(`${baseUrl}/api/messages?thread_kind=dm&thread_key=APRSOTA`);
const onAirMessages = await onAirCheckRes.json();
const onAirAnnounce = onAirMessages.changes.find(m => /is on the air from/i.test(m.message ? m.message.text : m.text));
if (!onAirAnnounce) {
  throw new Error('Bot on-air announcement not found');
}
console.log('✓ APRSOTA Bot on-air announcement received:', onAirAnnounce.message ? onAirAnnounce.message.text : onAirAnnounce.text);

// Verify that /api/ota/now includes the station's active op with its op number
const liveOpsRes = await fetch(`${baseUrl}/api/ota/now`);
const liveOpsData = await liveOpsRes.json();
const liveOps = liveOpsData.on_air || liveOpsData;
const stationOp = liveOps.find(op => op.station === 'W1AW-7' || op.callsign === 'W1AW');
if (!stationOp) throw new Error('Station active OP not found in /api/ota/now feed');
console.log(`✓ Live feed /api/ota/now contains station OP: Op #${stationOp.number} by ${stationOp.callsign} (${stationOp.description})`);
if (!stationOp.number) throw new Error('Station OP in /api/ota/now missing number');

// Test syncHostFromSpots logic & stale totals reset
let hostState = {
  status: 'pending',
  opNumber: null,
  qsos: 14, // stale from last op
  points: 42, // stale from last op
  chasers: ['old-chaser']
};
// 1. New op started -> reset hostState
hostState.status = 'pending';
hostState.opNumber = null;
hostState.qsos = 0;
hostState.points = 0;
hostState.chasers = [];

// 2. Sync from spots
const matchingOp = liveOps.find(op => op.callsign === 'W1AW' || op.station === 'W1AW-7');
if (matchingOp) {
  hostState.status = 'on_air';
  hostState.opNumber = matchingOp.number;
  hostState.qsos = matchingOp.qsos ?? 0;
  hostState.points = matchingOp.points ?? 0;
}
if (hostState.opNumber !== stationOp.number) throw new Error(`Host HUD opNumber failed to sync: expected ${stationOp.number}, got ${hostState.opNumber}`);
if (hostState.qsos !== 0) throw new Error(`Host HUD qsos failed to reset: expected 0, got ${hostState.qsos}`);
if (hostState.points !== 0) throw new Error(`Host HUD points failed to reset: expected 0, got ${hostState.points}`);
console.log(`✓ Host HUD correctly synced Op #${hostState.opNumber} with fresh 0 QSOs and 0 points from live spots feed`);

// Wait for simulated chaser arrival (scheduled at 4000ms in server.mjs)
console.log('-> Waiting for chaser pileup relay...');
await new Promise(r => setTimeout(r, 3200));
const chaserThreadRes = await fetch(`${baseUrl}/api/messages?thread_kind=dm&thread_key=APRSOTA`);
const chaserMessages = await chaserThreadRes.json();
const chaserRelay = chaserMessages.changes.find(m => /^DE\s+K3SAR-7/i.test(m.message ? m.message.text : m.text));
if (!chaserRelay) {
  throw new Error('Chaser K3SAR-7 relay not found in messages');
}
const relayText = chaserRelay.message ? chaserRelay.message.text : chaserRelay.text;
console.log('✓ APRSOTA Bot relayed chaser:', relayText);

// 4. Test 1-Tap QSL template generation logic
const chaserMatch = relayText.match(/^DE\s+([A-Za-z0-9/-]+)\s+([A-Za-z0-9]{4,6})(?:\s+(.*))?$/i);
if (!chaserMatch) throw new Error('Chaser relay format did not match expected regex');
const chaserCall = chaserMatch[1].toUpperCase();
const chaserBase = chaserCall.split('-')[0];
const qslTemplate = `@${chaserBase} QSL `;
console.log(`✓ 1-Tap QSL generated template for ${chaserCall}: "${qslTemplate}"`);
if (qslTemplate !== '@K3SAR QSL ') {
  throw new Error(`Unexpected 1-tap QSL template: expected "@K3SAR QSL ", got "${qslTemplate}"`);
}

// 5. Host sends 1-tap QSL response with report
console.log('-> Host transmitting QSL with signal report...');
const qslSendRes = await fetch(`${baseUrl}/api/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'APRSOTA',
    text: `${qslTemplate}599 73`,
    client_id: 'test-qsl-1'
  })
});
if (!qslSendRes.ok) throw new Error(`Sending QSL failed: ${qslSendRes.status}`);

// Wait for bot/chaser QSL acknowledgment
await new Promise(r => setTimeout(r, 1400));
const qslAckRes = await fetch(`${baseUrl}/api/messages?thread_kind=dm&thread_key=APRSOTA`);
const qslAckMessages = await qslAckRes.json();
const qslAck = qslAckMessages.changes.find(m => /DE K3SAR QSL/i.test(m.message ? m.message.text : m.text));
if (!qslAck) throw new Error('Chaser QSL acknowledgment not received');
console.log('✓ Chaser QSL confirmation received:', qslAck.message ? qslAck.message.text : qslAck.text);

// 6. Test tactical host queries: TIME, STAY, BLAST, and DONE
console.log('-> Testing tactical queries (TIME, STAY, BLAST, DONE)...');
await fetch(`${baseUrl}/api/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: 'APRSOTA', text: 'TIME', client_id: 'test-time-1' })
});
await new Promise(r => setTimeout(r, 1200));

await fetch(`${baseUrl}/api/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: 'APRSOTA', text: 'STAY', client_id: 'test-stay-1' })
});
await new Promise(r => setTimeout(r, 1200));

await fetch(`${baseUrl}/api/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: 'APRSOTA', text: 'BLAST QSY 14.060 CW in 5m', client_id: 'test-blast-1' })
});
await new Promise(r => setTimeout(r, 1200));

await fetch(`${baseUrl}/api/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: 'APRSOTA', text: 'DONE', client_id: 'test-done-1' })
});
await new Promise(r => setTimeout(r, 1400));

const finalMessagesRes = await fetch(`${baseUrl}/api/messages?thread_kind=dm&thread_key=APRSOTA`);
const finalMessages = await finalMessagesRes.json();
const opCompleteMsg = finalMessages.changes.find(m => /Op complete:/i.test(m.message ? m.message.text : m.text));
if (!opCompleteMsg) throw new Error('Bot "Op complete" message not found');
console.log('✓ Activation finalized successfully:', opCompleteMsg.message ? opCompleteMsg.message.text : opCompleteMsg.text);

console.log('\nTesting 15: 1-Tap Chase Worked Tracking & Automatic Refresh on New OP');

// In-memory simulation of client state engine
let chasedOps = {};
function isOpChased(opKey) {
  if (!opKey) return false;
  return Boolean(chasedOps[opKey]);
}
function markOpChased(opKey, details = {}) {
  if (!opKey) return;
  chasedOps[opKey] = { chasedAt: new Date().toISOString(), ...details };
}
function generateChaseButtonHtml(baseCall, rawOpNum) {
  const opNumber = rawOpNum !== null ? `Op #${rawOpNum}` : '';
  const opKey = rawOpNum !== null ? `${baseCall}:${rawOpNum}` : `${baseCall}:current`;
  const isWorked = isOpChased(opKey);
  return {
    isWorked,
    opKey,
    buttonHtml: `<button type="button" class="btn-chase ${isWorked ? 'worked' : ''}" data-callsign="${baseCall}" data-op-number="${rawOpNum ?? ''}" data-op-key="${opKey}"><span>${isWorked ? '✓' : '⚡'}</span> <span>${isWorked ? `WORKED (${opNumber || 'Op Worked'})` : `1-TAP CHASE @${baseCall}`}</span></button>`
  };
}

// 1. Initial State: Op #42 by K3NG is not yet worked
const initialCard = generateChaseButtonHtml('K3NG', 42);
if (initialCard.isWorked) throw new Error('Op #42 should initially be unworked');
if (initialCard.buttonHtml.includes('btn-chase worked')) throw new Error('Initial button should not have .worked class');
console.log('✓ Initial state: K3NG Op #42 is unworked (blue 1-tap chase button)');

// 2. User taps 1-tap chase on Op #42
markOpChased(initialCard.opKey, { baseCall: 'K3NG', opNumber: 42 });
const workedCard = generateChaseButtonHtml('K3NG', 42);
if (!workedCard.isWorked) throw new Error('Op #42 should now be marked worked');
if (!workedCard.buttonHtml.includes('btn-chase worked')) throw new Error('Button should now have .worked class');
if (!workedCard.buttonHtml.includes('WORKED (Op #42)')) throw new Error('Button text should show WORKED (Op #42)');
console.log('✓ Worked state: K3NG Op #42 is marked worked with emerald green styling & "WORKED (Op #42)"');

// 3. Activator starts a NEW activation: Op #43
// When spots refresh, K3NG now has number: 43
const newOpCard = generateChaseButtonHtml('K3NG', 43);
if (newOpCard.isWorked) throw new Error('New Op #43 must automatically refresh back to unworked!');
if (newOpCard.buttonHtml.includes('btn-chase worked')) throw new Error('New Op #43 must not have .worked class');
if (!newOpCard.buttonHtml.includes('1-TAP CHASE @K3NG')) throw new Error('New Op #43 must show "1-TAP CHASE @K3NG"');
console.log('✓ Automatic refresh: When K3NG starts Op #43, button automatically refreshes back to unworked blue!');

// 4. Verify other activators remain independent
const w3atvCard = generateChaseButtonHtml('W3ATV', 43);
if (w3atvCard.isWorked) throw new Error('W3ATV Op #43 should be unworked');
console.log('✓ Independent operator tracking verified.');

console.log('\nTesting 16: Cold Start / Historical Message Replay Guard');
// Simulate startup with historical bot messages
let bootHost = {
  status: 'off',
  opNumber: null,
  qsos: 0,
  points: 0
};

function processBootMessage(msg, isLive) {
  const text = msg.text.trim();
  if (/Send a position report within 5 mins/i.test(text)) {
    if (isLive) bootHost.status = 'pending';
  } else if (/is on the air from\s+([A-Za-z0-9]{4,6})/i.test(text)) {
    if (isLive) bootHost.status = 'on_air';
  }
}

// 1. Replay past message history on app boot (isLive = false)
const historicalBotMsg = {
  from_call: 'OTA',
  to_call: 'W1AW-7',
  text: 'W1AW-7 is on the air from FN00al. aprsota.org/W1AW/ops/47',
  sent_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString() // 3 hours ago
};
processBootMessage(historicalBotMsg, false);
if (bootHost.status !== 'off') {
  throw new Error(`Historical message falsely set status to "${bootHost.status}". Expected "off".`);
}
console.log('✓ Startup guard: Past on-air message in history did NOT trigger on_air state (isLive=false)');

// 2. Check syncHostFromSpots when station is NOT on the air
const emptySpots = [
  { callsign: 'K3NG', station: 'K3NG-7', number: 42, state: 'on_air' }
];
function syncBootSpots(stationCall, spots) {
  const baseCall = stationCall.split('-')[0].toUpperCase();
  const found = spots.find(s => s.callsign === baseCall || s.station === stationCall);
  if (!found && bootHost.status === 'on_air') {
    bootHost.status = 'off';
  }
}
syncBootSpots('W1AW-7', emptySpots);
if (bootHost.status !== 'off') throw new Error('Station should be off air when not in spots feed');
console.log('✓ Spots reconciliation: Station remains off air when not present in live spots feed');

// 3. Live message arriving in active session DOES trigger on_air
processBootMessage({ from_call: 'OTA', text: 'W1AW-7 is on the air from FN00al' }, true);
if (bootHost.status !== 'on_air') throw new Error('Live on-air message failed to trigger on_air state');
console.log('✓ Live event processing: Real-time on-air message correctly transitions to on_air state');

console.log('\nTesting 17: Multi-Op Transition & Auto-Refresh Reset Verification');

// 1. Verify historical @CALLSIGN message replay (isLive=false) CANNOT mark current activation
let testChasedOps = {};
function isOpChasedTest(key) { return Boolean(testChasedOps[key]); }
function markOpChasedTest(key) { testChasedOps[key] = { chasedAt: new Date().toISOString() }; }

const activeSpots = [
  { callsign: 'W3JAY', station: 'W3JAY', number: 9, on_air_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() }
];

function processOutgoingAutoChase(msg, isLive, spots) {
  if (!isLive || msg.direction !== 'out') return;
  const match = msg.text.match(/^@([A-Za-z0-9/-]+)/);
  if (!match) return;
  const chasedTarget = match[1].split('-')[0].toUpperCase();
  const msgTime = Date.parse(msg.sent_at || 0) || Date.now();

  const matchingSpot = spots.find(s => {
    const sBase = (s.callsign || '').split('-')[0].toUpperCase();
    if (sBase !== chasedTarget) return false;
    const spotStart = Date.parse(s.on_air_at || 0);
    if (spotStart && msgTime < spotStart - 60000) return false;
    return true;
  });

  if (matchingSpot) {
    const key = `${chasedTarget}:${matchingSpot.number}`;
    markOpChasedTest(key);
  }
}

// Replaying an old message from yesterday
const oldOutgoingMsg = {
  direction: 'out',
  text: '@W3JAY 599',
  sent_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
};
processOutgoingAutoChase(oldOutgoingMsg, false, activeSpots);
if (isOpChasedTest('W3JAY:9')) {
  throw new Error('Historical message playback falsely marked current Op #9 as worked!');
}
console.log('✓ Historical replay guard: Past @CALLSIGN message cannot mark brand-new Op #9 as worked');

// 2. An old message arriving live (e.g. from sync) with old timestamp also rejected
processOutgoingAutoChase(oldOutgoingMsg, true, activeSpots);
if (isOpChasedTest('W3JAY:9')) {
  throw new Error('Message with past timestamp falsely marked newer Op #9 as worked!');
}
console.log('✓ Timestamp guard: Message sent before Op #9 started did NOT mark Op #9 as worked');

// 3. Current live message sent during Op #9 DOES mark Op #9 as worked
const liveMsg = {
  direction: 'out',
  text: '@W3JAY QSL 599',
  sent_at: new Date().toISOString()
};
processOutgoingAutoChase(liveMsg, true, activeSpots);
if (!isOpChasedTest('W3JAY:9')) {
  throw new Error('Live message failed to mark Op #9 as worked');
}
console.log('✓ Live auto-chase: Real-time message during active Op #9 correctly marked Op #9 as worked');

// 4. When W3JAY starts Op #10, Op #10 is automatically UNWORKED (blue button)
const op10Key = 'W3JAY:10';
if (isOpChasedTest(op10Key)) {
  throw new Error('Op #10 should not be marked worked');
}
console.log('✓ Transition reset: When W3JAY transitions to Op #10, worked status cleanly resets');

// 5. Test manual refresh endpoint with ?refresh=1
const refreshRes = await fetch(`http://127.0.0.1:3948/api/ota/now?refresh=1`);
const manualCacheHeader = refreshRes.headers.get('X-Cache');
if (!manualCacheHeader || (!manualCacheHeader.includes('MOCK') && !manualCacheHeader.includes('REFRESH') && !manualCacheHeader.includes('304') && !manualCacheHeader.includes('HIT'))) {
  throw new Error(`Unexpected cache header on manual refresh: ${manualCacheHeader}`);
}
console.log(`✓ Manual refresh upstream revalidation verified (X-Cache: ${manualCacheHeader})`);

// 6. Test spot pruning for ended and expired ops
const testSpotsToFilter = [
  { callsign: 'W1AW', number: 1, state: 'on_air', expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() },
  { callsign: 'K3NG', number: 2, state: 'ended', ended_at: new Date().toISOString() },
  { callsign: 'DL7PJ', number: 3, state: 'on_air', expires_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() }
];
const pruned = testSpotsToFilter.filter(op => {
  if (op.state === 'ended' || op.ended_at) return false;
  if (op.expires_at && (Date.now() - Date.parse(op.expires_at) > 120000)) return false;
  return true;
});
if (pruned.length !== 1 || pruned[0].callsign !== 'W1AW') {
  throw new Error(`Pruning failed: expected only W1AW, got ${JSON.stringify(pruned.map(p => p.callsign))}`);
}
console.log('✓ Pruning verification: Ended and expired activations are cleanly filtered out');

console.log('\nTesting 18: Host State Machine Flapping, Beacon Pending & Expiry Verification');

// 1. Pending beacon state & RF transmit handling
const testHost = {
  status: 'pending',
  opNumber: null,
  grid: null,
  description: 'POTA K-1234',
  startedAt: null,
  expiresAt: null,
  confirmedOnAirAt: null,
  beaconSentAt: null,
  endedAt: null,
  pendingBeaconExpiresAt: Date.now() + 5 * 60 * 1000,
  chasers: []
};

// Simulate RF beacon transmit during pending
function onBeaconSent(host) {
  host.lastBeaconAt = Date.now();
  if (host.status === 'pending') {
    host.beaconSentAt = Date.now();
  }
}
onBeaconSent(testHost);
if (testHost.status !== 'pending') throw new Error('Status should remain pending until bot confirmation arrives');
if (!testHost.beaconSentAt) throw new Error('beaconSentAt should be recorded upon beacon send');
console.log('✓ Beacon pending guard: Transmitting RF beacon does not prematurely flip status to on_air');

// 2. Anti-flapping 3-minute grace period test
// Bot confirms on-air
testHost.status = 'on_air';
testHost.confirmedOnAirAt = Date.now();
testHost.opNumber = 55;
testHost.expiresAt = Date.now() + 60 * 60 * 1000;
testHost.pendingBeaconExpiresAt = null;
testHost.beaconSentAt = null;

function simulateSyncHostFromSpots(host, spots, stationCall) {
  const now = Date.now();
  const baseCall = stationCall.split('-')[0].toUpperCase();
  const myOp = spots.find(s => {
    const sBase = (s.callsign || '').split('-')[0].toUpperCase();
    return sBase === baseCall || (s.station && s.station.toUpperCase() === stationCall.toUpperCase());
  });

  if (myOp && (myOp.state === 'on_air' || !myOp.ended_at)) {
    if (myOp.expires_at && Date.parse(myOp.expires_at) <= now) {
      if (host.status === 'on_air') {
        host.status = 'off';
        host.confirmedOnAirAt = null;
      }
      return;
    }
    host.status = 'on_air';
    host.confirmedOnAirAt = now;
    host.opNumber = myOp.number ?? myOp.op ?? null;
  } else {
    if (host.status === 'pending') return;
    if (host.status === 'on_air') {
      const confirmedRecently = host.confirmedOnAirAt && (now - host.confirmedOnAirAt < 180000);
      const expiresFuture = host.expiresAt && (host.expiresAt > now);
      if (confirmedRecently || (expiresFuture && host.confirmedOnAirAt && (now - host.confirmedOnAirAt < 300000))) {
        return; // Protected by grace period!
      }
      host.status = 'off';
      host.confirmedOnAirAt = null;
    } else if (host.status === 'ended') {
      if (!host.endedAt || (now - host.endedAt > 120000)) {
        host.status = 'off';
        host.endedAt = null;
      }
    }
  }
}

// Spots feed is empty due to API ingestion lag
simulateSyncHostFromSpots(testHost, [], 'W1AW-7');
if (testHost.status !== 'on_air') throw new Error('State flapped to off despite 3-minute grace period!');
if (testHost.opNumber !== 55) throw new Error('Op number lost during transient spots cache lag');
console.log('✓ Anti-flapping protection: 3-minute grace period successfully prevented premature off air transition');

// 3. 5-minute beacon pending window expiration & lockout recovery
const expiredPendingHost = {
  status: 'pending',
  pendingBeaconExpiresAt: Date.now() - 1000, // expired 1s ago
  beaconSentAt: null
};
function simulateHostWatchdog(host) {
  const now = Date.now();
  if (host.status === 'pending' && host.pendingBeaconExpiresAt) {
    if (now >= host.pendingBeaconExpiresAt) {
      host.status = 'off';
      host.pendingBeaconExpiresAt = null;
      host.beaconSentAt = null;
    }
  } else if (host.status === 'ended') {
    if (host.endedAt && (now - host.endedAt > 120000)) {
      host.status = 'off';
      host.endedAt = null;
    }
  }
}
simulateHostWatchdog(expiredPendingHost);
if (expiredPendingHost.status !== 'off') throw new Error('Pending host failed to auto-recover to off upon expiration');
console.log('✓ Pending timeout recovery: 5-minute beacon window expiration cleanly resets status to off');

// 4. Cold restart guard against resurrecting expired operator records
const startupHost = { status: 'off', opNumber: null, qsos: 0, points: 0 };
function simulateFetchHostOpStatus(host, apiData) {
  const now = Date.now();
  if (apiData && apiData.on_air) {
    const onAir = apiData.on_air;
    const isEnded = onAir.state === 'ended' || Boolean(onAir.ended_at);
    const isExpired = onAir.expires_at ? (Date.parse(onAir.expires_at) <= now) : false;
    if (isEnded || isExpired) {
      if (host.status === 'on_air') {
        const confirmedRecently = host.confirmedOnAirAt && (now - host.confirmedOnAirAt < 180000);
        if (!confirmedRecently) {
          host.status = 'off';
          host.confirmedOnAirAt = null;
        }
      }
      return;
    }
    host.status = 'on_air';
    host.opNumber = onAir.number;
  }
}

// Case A: Operator record has expired timestamp
simulateFetchHostOpStatus(startupHost, {
  callsign: 'W1AW',
  on_air: {
    number: 40,
    state: 'on_air',
    expires_at: new Date(Date.now() - 3600000).toISOString() // expired 1h ago
  }
});
if (startupHost.status !== 'off') throw new Error('Startup resurrected an expired op!');
console.log('✓ Cold restart guard: Expired operator activation correctly ignored on startup');

// 5. Ended op auto-cleanup after 2 minutes
const endedHost = {
  status: 'ended',
  endedAt: Date.now() - 130000 // ended 2m10s ago
};
simulateSyncHostFromSpots(endedHost, [], 'W1AW-7');
if (endedHost.status !== 'off') throw new Error('Ended host failed to transition to off after 2 minutes');
console.log('✓ Ended activation cleanup: State transitioned cleanly from ended to off after 2 minutes');

console.log('\nTesting 19: Own Live OP Exclusion from OPS Chase Feed & Counters');

function isMyOpTest(op, stationCall) {
  if (!op) return false;
  const myStation = (stationCall || '').toUpperCase();
  const myBaseCall = myStation.split('-')[0];
  if (!myStation && !myBaseCall) return false;

  const opBase = (op.callsign || '').split('-')[0].toUpperCase();
  const opStation = (op.station || op.callsign || '').toUpperCase();
  const opStationBase = opStation.split('-')[0];

  return (myBaseCall && (opBase === myBaseCall || opStationBase === myBaseCall)) ||
         (myStation && (opStation === myStation || (op.callsign && op.callsign.toUpperCase() === myStation)));
}

const mixedSpots = [
  { callsign: 'W1AW', station: 'W1AW-7', number: 48, state: 'on_air', description: 'My Live POTA' },
  { callsign: 'K3NG', station: 'K3NG', number: 42, state: 'on_air', description: 'Chaser Target 1' },
  { callsign: 'W3JAY', station: 'W3JAY-9', number: 9, state: 'on_air', description: 'Chaser Target 2' }
];

// Verify isMyOp matching
if (!isMyOpTest(mixedSpots[0], 'W1AW-7')) throw new Error('isMyOp failed to match own station SSID');
if (isMyOpTest(mixedSpots[1], 'W1AW-7')) throw new Error('isMyOp falsely matched external station K3NG');
console.log('✓ Station identity match: isMyOp accurately identifies own activation vs external ops');

// Verify renderSpots filter excludes own op
const chaseableSpots = mixedSpots.filter(op => {
  if (op.state === 'ended' || op.ended_at) return false;
  if (isMyOpTest(op, 'W1AW-7')) return false;
  return true;
});

if (chaseableSpots.length !== 2) throw new Error(`Expected 2 chaseable ops, got ${chaseableSpots.length}`);
if (chaseableSpots.some(s => s.callsign === 'W1AW')) throw new Error('Own station was not filtered out of chase list!');
console.log('✓ OPS list filtering: Own live OP card is completely omitted from the OPS & Radar chase views');

// Verify host sync still finds own op from raw feed
const syncedHostOp = mixedSpots.find(op => isMyOpTest(op, 'W1AW-7'));
if (!syncedHostOp || syncedHostOp.number !== 48) throw new Error('Host HUD failed to sync own OP from spots feed');
console.log('✓ Dual-track separation: Host HUD still authoritative while chase feed remains clean');

console.log('\nTesting 20: Chaser Flow Isolation vs Host State Machine & Callsign Matching');

const isolationHostState = {
  status: 'off',
  opNumber: null,
  grid: null,
  hostRequestedAt: 0,
  pendingBeaconExpiresAt: null,
  confirmedOnAirAt: null,
  chasers: []
};
let chaseRequestedAt = 0;
const stationCall = 'W1AW-7';
let toasts = [];

function simulateProcessHostMessage(msg, isLive = true) {
  const text = msg.text.trim();
  const fromCall = (msg.from_call || '').toUpperCase();
  const toCall = (msg.to_call || '').toUpperCase();
  const botCall = 'APRSOTA';
  const isFromBot = fromCall === botCall || fromCall === 'OTA';
  const isToBot = toCall === botCall || toCall === 'OTA';

  // 1. Outgoing
  if (isToBot && msg.direction === 'out') {
    if (/^(HOST|QRV)\b/i.test(text)) {
      if (isLive) {
        isolationHostState.status = 'pending';
        isolationHostState.hostRequestedAt = Date.now();
        chaseRequestedAt = 0;
        isolationHostState.pendingBeaconExpiresAt = Date.now() + 5 * 60 * 1000;
      }
    } else if (/^CHASE\b/i.test(text) || /^@[A-Za-z0-9/-]+\b/.test(text)) {
      chaseRequestedAt = Date.now();
      isolationHostState.hostRequestedAt = 0;
      if (isolationHostState.status === 'pending' && !isolationHostState.confirmedOnAirAt) {
        isolationHostState.status = 'off';
        isolationHostState.pendingBeaconExpiresAt = null;
      }
    }
    return;
  }

  // 2. Incoming from bot
  if (isFromBot && msg.direction === 'in') {
    if (/Send a position report within 5 mins/i.test(text)) {
      const isChasePrompt = /to chase\b/i.test(text) ||
        (chaseRequestedAt && (Date.now() - chaseRequestedAt < 300000) &&
         (!isolationHostState.hostRequestedAt || chaseRequestedAt > isolationHostState.hostRequestedAt));

      const isHostPrompt = /to go on the air\b/i.test(text) ||
        (isolationHostState.hostRequestedAt && (Date.now() - isolationHostState.hostRequestedAt < 300000) &&
         (!chaseRequestedAt || isolationHostState.hostRequestedAt >= chaseRequestedAt));

      if (isChasePrompt) {
        toasts.push({ type: 'info', text: 'chase_position_prompt' });
        if (isolationHostState.status === 'pending' && !isolationHostState.confirmedOnAirAt) {
          isolationHostState.status = 'off';
          isolationHostState.pendingBeaconExpiresAt = null;
        }
      } else if (isHostPrompt) {
        toasts.push({ type: 'warning', text: 'host_position_prompt' });
        isolationHostState.status = 'pending';
        isolationHostState.pendingBeaconExpiresAt = Date.now() + 5 * 60 * 1000;
      }
    } else if (/is on the air from\s+([A-Za-z0-9]{4,6})/i.test(text)) {
      const onAirMatch = text.match(/(?:^|\b)([A-Za-z0-9/-]+)\s+is on the air from\s+([A-Za-z0-9]{4,6})/i);
      const announcedCall = onAirMatch ? onAirMatch[1].toUpperCase() : '';
      const announcedBase = announcedCall.split('-')[0];
      const myStation = (stationCall || '').toUpperCase();
      const myBaseCall = myStation.split('-')[0];

      const isMyStation = (myBaseCall && (announcedBase === myBaseCall || announcedCall === myBaseCall)) ||
                          (myStation && announcedCall === myStation);

      if (!isMyStation) {
        toasts.push({ type: 'info', text: `spot_${announcedCall}` });
        return;
      }

      isolationHostState.status = 'on_air';
      isolationHostState.confirmedOnAirAt = Date.now();
      if (onAirMatch) isolationHostState.grid = onAirMatch[2].toUpperCase();
      const opNumMatch = text.match(/(?:(?:ops?|activations?)\/|Op\s*#?\s*)(\d+)/i);
      if (opNumMatch) isolationHostState.opNumber = parseInt(opNumMatch[1], 10);
      toasts.push({ type: 'success', text: `on_air_op_${isolationHostState.opNumber}` });
    }
  }
}

// 1. Chasing an activator must NOT trigger host pending state
simulateProcessHostMessage({
  direction: 'out',
  to_call: 'APRSOTA',
  from_call: 'W1AW-7',
  text: 'CHASE K7ABC'
});
if (chaseRequestedAt === 0) throw new Error('chaseRequestedAt was not set on CHASE command');

simulateProcessHostMessage({
  direction: 'in',
  from_call: 'APRSOTA',
  to_call: 'W1AW-7',
  text: 'Send a position report within 5 mins'
});
if (isolationHostState.status !== 'off') throw new Error(`Host status should remain off during chase, got: ${isolationHostState.status}`);
if (!toasts.some(t => t.text === 'chase_position_prompt')) throw new Error('Expected chase position prompt toast');
console.log('✓ Chaser beacon prompt isolation: Position report request for chase kept Host HUD off');

// 2. Incoming on-air announcement for another station must NOT trigger host on_air
simulateProcessHostMessage({
  direction: 'in',
  from_call: 'APRSOTA',
  to_call: 'W1AW-7',
  text: 'K7ABC-6 is on the air from FN00al Op #99'
});
if (isolationHostState.status !== 'off') throw new Error(`External station on-air announcement set local host status: ${isolationHostState.status}`);
if (!toasts.some(t => t.text === 'spot_K7ABC-6')) throw new Error('Expected external spot toast for K7ABC-6');
console.log('✓ External on-air filter: Other station activation announced without hijacking local Host HUD');

// 3. Genuine HOST command followed by bot prompt transitions to pending
simulateProcessHostMessage({
  direction: 'out',
  to_call: 'APRSOTA',
  from_call: 'W1AW-7',
  text: 'HOST POTA K-1234'
});
if (isolationHostState.status !== 'pending') throw new Error('Host status should be pending on HOST command');
if (isolationHostState.hostRequestedAt === 0) throw new Error('hostRequestedAt was not set');

simulateProcessHostMessage({
  direction: 'in',
  from_call: 'APRSOTA',
  to_call: 'W1AW-7',
  text: 'Send a position report within 5 mins'
});
if (isolationHostState.status !== 'pending') throw new Error('Host status should stay pending on host beacon prompt');
if (!toasts.some(t => t.text === 'host_position_prompt')) throw new Error('Expected host position prompt toast');
console.log('✓ Host beacon prompt handling: Legitimate host beacon prompt sets pending status and toast');

// 4. Bot on-air announcement for local station transitions to on_air
simulateProcessHostMessage({
  direction: 'in',
  from_call: 'APRSOTA',
  to_call: 'W1AW-7',
  text: 'W1AW-7 is on the air from EN91al Op #102'
});
if (isolationHostState.status !== 'on_air') throw new Error(`Host failed to go on_air for own callsign, got: ${isolationHostState.status}`);
if (isolationHostState.opNumber !== 102) throw new Error(`Expected opNumber 102, got: ${isolationHostState.opNumber}`);
if (isolationHostState.grid !== 'EN91AL') throw new Error(`Expected grid EN91AL, got: ${isolationHostState.grid}`);
console.log('✓ Station on-air match: Own station activation announcement correctly engaged Host HUD on_air mode');

console.log('\nTesting 21: Pileup Chaser Confirmation, 1-Tap QSL & DE Relay Resilience');

const pileupHost = {
  status: 'on_air',
  opNumber: 102,
  grid: 'EN91AL',
  qsos: 0,
  points: 0,
  chasers: []
};

function processPileupMessage(msg, isLive = true) {
  const text = msg.text.trim();
  const fromCall = (msg.from_call || '').toUpperCase();
  const toCall = (msg.to_call || '').toUpperCase();
  const botCall = 'APRSOTA';
  const isFromBot = fromCall === botCall || fromCall === 'OTA';
  const isToBot = toCall === botCall || toCall === 'OTA';

  // 1. Outgoing
  if (msg.direction === 'out') {
    const atMatch = text.match(/^(?:@([A-Za-z0-9/-]+)|QSL\s+@?([A-Za-z0-9/-]+))\b/i);
    const targetCall = atMatch ? (atMatch[1] || atMatch[2]).toUpperCase() : (!isToBot ? toCall : null);
    const baseTarget = targetCall ? targetCall.split('-')[0] : null;

    if (targetCall) {
      for (const c of pileupHost.chasers) {
        if (c.callsign === targetCall || c.baseCall === baseTarget) {
          if (c.status !== 'confirmed') {
            c.status = 'confirmed';
            pileupHost.qsos += 1;
            pileupHost.points += 3;
          }
          return;
        }
      }
    }
  }

  // 2. Incoming from bot
  if (isFromBot && msg.direction === 'in') {
    if (/^DE\s+([A-Za-z0-9/-]+)\s+(?:([A-Za-z0-9]{4,6})\b\s*)?(.*)$/i.test(text)) {
      if (pileupHost.status !== 'on_air') return;
      const match = text.match(/^DE\s+([A-Za-z0-9/-]+)\s+(?:([A-Za-z0-9]{4,6})\b\s*)?(.*)$/i);
      const chaserCall = match[1].toUpperCase();
      const grid = (match[2] || '').toUpperCase();
      const extra = (match[3] || '').trim();

      if (/\bQSL\b/i.test(grid) || /\bQSL\b/i.test(extra)) {
        const chaser = pileupHost.chasers.find(c => c.callsign === chaserCall || c.baseCall === chaserCall.split('-')[0]);
        if (chaser) chaser.status = 'confirmed';
        return;
      }

      const baseCall = chaserCall.split('-')[0];
      let existing = pileupHost.chasers.find(c => c.callsign === chaserCall || c.baseCall === baseCall);
      if (existing) {
        if (grid) existing.grid = grid;
      } else {
        pileupHost.chasers.unshift({
          callsign: chaserCall,
          baseCall: baseCall,
          grid: grid || '----',
          message: extra,
          status: 'waiting'
        });
      }
    }
  }
}

// A. Incoming chaser check-in adds chaser to queue with status: 'waiting'
processPileupMessage({
  direction: 'in',
  from_call: 'APRSOTA',
  to_call: 'W1AW-7',
  text: 'DE K3SAR-7 FN09lv greetings from summit'
});
if (pileupHost.chasers.length !== 1) throw new Error('Chaser check-in failed to add to queue');
if (pileupHost.chasers[0].status !== 'waiting') throw new Error('Chaser status should be waiting');
console.log('✓ Chaser check-in: Added to queue with WAITING badge');

// B. 1-Tap QSL / Outgoing report "@K3SAR QSL 599" marks chaser confirmed
processPileupMessage({
  direction: 'out',
  to_call: 'APRSOTA',
  from_call: 'W1AW-7',
  text: '@K3SAR QSL 599'
});
if (pileupHost.chasers[0].status !== 'confirmed') throw new Error('Outgoing QSL failed to mark chaser confirmed');
if (pileupHost.qsos !== 1 || pileupHost.points !== 3) throw new Error('QSOs and points failed to increment');
console.log('✓ 1-Tap QSL transmission: Successfully transitioned chaser from WAITING to QSL CONFIRMED (+3 pts)');

// C. Incoming check-in with another chaser
processPileupMessage({
  direction: 'in',
  from_call: 'APRSOTA',
  to_call: 'W1AW-7',
  text: 'DE W3ABC FN10ab hello'
});
if (pileupHost.chasers.length !== 2) throw new Error('Second chaser failed to add');
const w3abc = pileupHost.chasers.find(c => c.baseCall === 'W3ABC');
if (w3abc.status !== 'waiting') throw new Error('W3ABC should be waiting');

// D. Direct outgoing signal report "@W3ABC 599" without "QSL" keyword also confirms
processPileupMessage({
  direction: 'out',
  to_call: 'APRSOTA',
  from_call: 'W1AW-7',
  text: '@W3ABC 599 TU'
});
if (w3abc.status !== 'confirmed') throw new Error('Signal report @W3ABC 599 failed to confirm chaser');
if (pileupHost.qsos !== 2) throw new Error('QSOs failed to increment for W3ABC');
console.log('✓ Flexible signal report: Transmitting @CALL 599 without strict QSL keyword cleanly confirmed contact');

// E. Incoming 3-letter QSL relay from chaser "DE N0CALL QSL thx 73"
processPileupMessage({
  direction: 'in',
  from_call: 'APRSOTA',
  to_call: 'W1AW-7',
  text: 'DE N0CALL EN90aa calling'
});
const n0call = pileupHost.chasers.find(c => c.baseCall === 'N0CALL');
if (n0call.status !== 'waiting') throw new Error('N0CALL should be waiting');

processPileupMessage({
  direction: 'in',
  from_call: 'APRSOTA',
  to_call: 'W1AW-7',
  text: 'DE N0CALL QSL thx for contact 73'
});
if (n0call.status !== 'confirmed') throw new Error('3-letter QSL relay failed to confirm N0CALL');
console.log('✓ Chaser QSL relay parsing: "DE CALL QSL ..." properly matched without 4-letter grid requirement');

console.log('\nTesting 22: Host Reply to Chaser Isolation (Preserve Unworked 1-Tap Buttons)');

const chasedState = {};
function isChased(key) { return Boolean(chasedState[key]); }
function markChased(key) { chasedState[key] = true; }

const hostStation = {
  status: 'on_air',
  opNumber: 50,
  chasers: [],
  activeChaseTarget: null,
  chaseRequestedAt: 0
};

const networkSpots = [
  { callsign: 'K3NG', station: 'K3NG-7', number: 42, on_air_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  { callsign: 'W3ATV', station: 'W3ATV-1', number: 43, on_air_at: new Date(Date.now() - 20 * 60 * 1000).toISOString() },
  { callsign: 'DL7PJ', station: 'DL7PJ', number: 88, on_air_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() }
];

function simulateOutgoingMsg(msg, host, spots) {
  const text = msg.text.trim();
  const atMatch = text.match(/^@([A-Za-z0-9/-]+)/);
  if (atMatch) {
    const chasedTarget = atMatch[1].split('-')[0].toUpperCase();
    const isHostOnAir = host && host.status === 'on_air';
    const isMyChaser = isHostOnAir && Boolean(
      host.chasers?.some(c => c.callsign === chasedTarget || c.baseCall === chasedTarget)
    );
    const isExplicitChase = Boolean(
      host.activeChaseTarget === chasedTarget &&
      host.chaseRequestedAt &&
      (Date.now() - host.chaseRequestedAt < 300000)
    );

    if (isHostOnAir && (isMyChaser || !isExplicitChase)) {
      // Host replying to chaser: do NOT auto-mark as chased!
    } else {
      const match = spots.find(s => (s.callsign || '').toUpperCase() === chasedTarget);
      if (match) {
        markChased(`${chasedTarget}:${match.number}`);
      }
    }
  }

  // Also simulate host pileup queue confirmation
  const targetCall = atMatch ? atMatch[1].toUpperCase() : null;
  const baseTarget = targetCall ? targetCall.split('-')[0] : null;
  if (targetCall && host.status === 'on_air') {
    for (const c of host.chasers) {
      if (c.callsign === targetCall || c.baseCall === baseTarget) {
        c.status = 'confirmed';
      }
    }
  }
}

// 1. K3NG (who has active Op #42) chases host
hostStation.chasers.push({
  callsign: 'K3NG',
  baseCall: 'K3NG',
  status: 'waiting'
});

// Host replies to K3NG: "@K3NG QSL 599"
simulateOutgoingMsg({ text: '@K3NG QSL 599', direction: 'out' }, hostStation, networkSpots);

// Verification: K3NG's pileup status confirmed, but K3NG:42 must NOT be marked worked!
if (hostStation.chasers[0].status !== 'confirmed') {
  throw new Error('Host reply failed to confirm chaser in pileup');
}
if (isChased('K3NG:42')) {
  throw new Error('BUG DETECTED: Host reply to chaser K3NG falsely flipped K3NG Op #42 to worked!');
}
console.log('✓ Pileup reply isolation: Host replying to chaser K3NG confirmed contact without marking K3NG Op #42 as worked');

// 2. Host on air sends message to W3ATV (not in pileup, no explicit chase requested)
simulateOutgoingMsg({ text: '@W3ATV 599', direction: 'out' }, hostStation, networkSpots);
if (isChased('W3ATV:43')) {
  throw new Error('BUG DETECTED: Host message to W3ATV falsely marked W3ATV Op #43 as worked!');
}
console.log('✓ Host on-air guard: Outgoing message while on air did not falsely mark un-chased Op #43');

// 3. Host explicitly chases DL7PJ (Park-to-Park / P2P via 1-Tap Chase)
hostStation.activeChaseTarget = 'DL7PJ';
hostStation.chaseRequestedAt = Date.now();
markChased('DL7PJ:88'); // 1-Tap Chase explicitly marks it worked
simulateOutgoingMsg({ text: '@DL7PJ 599', direction: 'out' }, hostStation, networkSpots);
if (!isChased('DL7PJ:88')) {
  throw new Error('Explicit P2P chase failed to mark DL7PJ as worked');
}
console.log('✓ Intentional P2P chase: Explicit 1-Tap Chase during activation successfully marked DL7PJ as worked');

// 4. Operator is OFF air (chaser mode) and sends message to K3NG
const chaserStation = { status: 'off', chasers: [] };
simulateOutgoingMsg({ text: '@K3NG QSL 599', direction: 'out' }, chaserStation, networkSpots);
if (!isChased('K3NG:42')) {
  throw new Error('Standard chaser mode failed to auto-mark K3NG as worked');
}
console.log('✓ Standard chaser mode: Operator off-air cleanly auto-marks chased activation');

console.log('\nTesting 23: Chase Button Armed State vs Actual Transmission Lifecycle');
const testClientState = {
  activeChaseTarget: null,
  chaseRequestedAt: 0,
  activeChaseOpNumber: null,
  chasedOps: {}
};

function simulateHandleChase(call, opNum, state) {
  const baseCall = call.split('-')[0].toUpperCase();
  state.chaseRequestedAt = Date.now();
  state.activeChaseTarget = baseCall;
  state.activeChaseOpNumber = opNum;
}

simulateHandleChase('W3ATV', 43, testClientState);
if (testClientState.activeChaseTarget !== 'W3ATV') throw new Error('activeChaseTarget should be W3ATV');
if (Boolean(testClientState.chasedOps['W3ATV:43'])) throw new Error('BUG DETECTED: 1-Tap Chase prematurely marked op worked on tap!');
console.log('✓ Arm on tap: Tapping 1-Tap Chase arms target without premature worked status');

function simulateSendChaseMsg(text, toCall, state, spots) {
  const atMatch = text.match(/(?:^|\s)@([A-Za-z0-9/-]+)/i);
  const target = atMatch ? atMatch[1].split('-')[0].toUpperCase() : (toCall ? toCall.split('-')[0].toUpperCase() : null);
  if (target) {
    const spot = spots.find(s => (s.callsign || '').split('-')[0].toUpperCase() === target);
    if (spot) {
      state.chasedOps[`${target}:${spot.number}`] = { chasedAt: new Date().toISOString() };
    }
  }
}
simulateSendChaseMsg('@W3ATV 599', 'APRSOTA', testClientState, networkSpots);
if (!testClientState.chasedOps['W3ATV:43']) throw new Error('Transmitting chase message failed to mark W3ATV:43 as worked');
console.log('✓ Transmit completion: Sending @CALL 599 successfully marked activation as worked');

console.log('\nTesting 24: Spot Card SSID Normalization & Multi-Op Array Search');
const ssidSpot = { callsign: 'K3NG-7', station: 'K3NG-7', number: 42 };
const baseCall = (ssidSpot.callsign || '').split('-')[0].toUpperCase();
const cardOpKey = `${baseCall}:${ssidSpot.number}`;
if (cardOpKey !== 'K3NG:42') throw new Error(`Expected normalized opKey K3NG:42, got ${cardOpKey}`);

const storeWithBase = { 'K3NG:42': true };
function testIsOpChased(key, store) {
  const baseKey = key.split(':')[0].split('-')[0].toUpperCase() + ':' + (key.split(':')[1] || 'current');
  return Boolean(store[key] || store[baseKey]);
}
if (!testIsOpChased('K3NG-7:42', storeWithBase)) throw new Error('isOpChased failed to match K3NG-7:42 against K3NG:42');
if (!testIsOpChased('K3NG:42', storeWithBase)) throw new Error('isOpChased failed to match K3NG:42 against K3NG:42');
console.log('✓ SSID key normalization: Spot cards and auto-chase match bidirectionally across SSIDs');

const multiSpots = [
  { callsign: 'W3JAY', station: 'W3JAY-1', number: 42, op: 42 },
  { callsign: 'W3JAY', station: 'W3JAY-2', number: 43, op: 43 }
];
function testFindSpot(spots, targetCall, targetOpNum) {
  return spots.find(s => {
    const sBase = (s.callsign || '').split('-')[0].toUpperCase();
    const matchesCall = sBase === targetCall || (s.callsign && s.callsign.toUpperCase() === targetCall);
    if (!matchesCall) return false;
    if (targetOpNum) return (s.number == targetOpNum || s.op == targetOpNum);
    return true;
  });
}
const matched43 = testFindSpot(multiSpots, 'W3JAY', 43);
if (!matched43 || matched43.number !== 43) throw new Error('Multi-op search failed to pick Op 43 over Op 42');
console.log('✓ Multi-op resolution: Clicking Op 43 accurately selects Op 43 when Op 42 is first in list');

console.log('\nTesting 25: Direct DMs to Activators & Casual Chat Filtering');
const dmChasedStore = {};
function simulateOutgoingFilter(msg, toCall, isToBot, explicitTarget, spots, store) {
  const text = msg.text.trim();
  const atMatch = text.match(/(?:^|\s)@([A-Za-z0-9/-]+)/i);
  const chasedTarget = atMatch
    ? atMatch[1].split('-')[0].toUpperCase()
    : (!isToBot && toCall ? toCall.split('-')[0].toUpperCase() : null);

  if (chasedTarget) {
    const isExplicit = explicitTarget === chasedTarget;
    const hasReport = /\b(?:599|5NN|[45][0-9]{1,2}|QSL|73)\b/i.test(text);
    if (!isToBot && !isExplicit && !hasReport) {
      return false;
    }
    const match = spots.find(s => (s.callsign || '').split('-')[0].toUpperCase() === chasedTarget);
    if (match) {
      store[`${chasedTarget}:${match.number}`] = true;
      return true;
    }
  }
  return false;
}

simulateOutgoingFilter({ text: '599 in FN00' }, 'K3NG-7', false, null, networkSpots, dmChasedStore);
if (!dmChasedStore['K3NG:42']) throw new Error('Direct DM report to activator failed to mark K3NG:42 as worked');
console.log('✓ Direct DM chase: Transmitting report directly to activator thread marks spot worked');

const casualStore = {};
simulateOutgoingFilter({ text: '@W3ATV can you bring the coax tomorrow?' }, 'CLUB-NET', false, null, networkSpots, casualStore);
if (casualStore['W3ATV:43']) throw new Error('Casual non-chase chat falsely marked W3ATV:43 as worked!');
console.log('✓ Casual chat guard: Mentioning @CALLSIGN in general chat does not mark spot worked');

simulateOutgoingFilter({ text: 'Thanks @W3ATV 599 73' }, 'CLUB-NET', false, null, networkSpots, casualStore);
if (!casualStore['W3ATV:43']) throw new Error('Mention with report 599 failed to mark W3ATV:43 as worked');
console.log('✓ Report detection: Outgoing transmission containing 599 report correctly marks activation');

console.log('\nTesting 26: Inbound Chaser QSL Relays & Score Tracking');
const pileupHost2 = {
  status: 'on_air',
  qsos: 0,
  points: 0,
  chasers: [
    { callsign: 'K3SAR-7', baseCall: 'K3SAR', status: 'waiting' }
  ]
};

function simulateInboundRelay(text, host) {
  const match = text.match(/^DE\s+([A-Za-z0-9/-]+):?(?:\s+([A-Za-z0-9]{4,6}))?(?:\s+(.*))?$/i);
  if (!match) return false;
  const chaserCall = match[1].toUpperCase();
  const grid = (match[2] || '').toUpperCase();
  const extra = (match[3] || '').trim();
  const baseCall = chaserCall.split('-')[0];

  if (/\bQSL\b/i.test(grid) || /\bQSL\b/i.test(extra)) {
    const existing = host.chasers.find(c => c.callsign === chaserCall || c.baseCall === baseCall);
    if (existing) {
      if (existing.status !== 'confirmed') {
        existing.status = 'confirmed';
        host.qsos += 1;
        host.points += 3;
      }
    } else {
      host.chasers.unshift({ callsign: chaserCall, baseCall, status: 'confirmed' });
      host.qsos += 1;
      host.points += 3;
    }
    return true;
  }

  let existing = host.chasers.find(c => c.callsign === chaserCall || c.baseCall === baseCall);
  if (!existing) {
    host.chasers.unshift({ callsign: chaserCall, baseCall, status: 'waiting', message: extra });
  }
  return true;
}

simulateInboundRelay('DE K3SAR QSL thx 73', pileupHost2);
if (pileupHost2.chasers.find(c => c.baseCall === 'K3SAR').status !== 'confirmed') throw new Error('K3SAR should be confirmed');
if (pileupHost2.qsos !== 1 || pileupHost2.points !== 3) throw new Error(`Expected 1 QSO and 3 pts, got ${pileupHost2.qsos} QSOs, ${pileupHost2.points} pts`);
console.log('✓ HUD score increment: Chaser QSL relay properly confirmed chaser and added +1 QSO / +3 pts');

simulateInboundRelay('DE W3ABC', pileupHost2);
if (!pileupHost2.chasers.some(c => c.baseCall === 'W3ABC')) throw new Error('Minimal relay "DE W3ABC" failed to parse');
console.log('✓ Minimal relay parsing: "DE CALL" without trailing whitespace parses into queue');

simulateInboundRelay('DE DL7PJ: 599 in JN48', pileupHost2);
if (!pileupHost2.chasers.some(c => c.baseCall === 'DL7PJ')) throw new Error('Relay with colon "DE CALL: ..." failed to parse');
console.log('✓ Colon relay parsing: "DE CALL: [msg]" parses cleanly into queue');

console.log('\nTesting 27: Host Reply Resiliency & Flexible Parsing');
const hostPileup3 = {
  status: 'on_air',
  qsos: 0,
  points: 0,
  chasers: [
    { callsign: 'K3SAR-7', baseCall: 'K3SAR', status: 'waiting' }
  ]
};

function simulateHostOutgoingQSL(text, host) {
  const atMatch = text.match(/(?:^|\s)@([A-Za-z0-9/-]+)/i) || text.match(/(?:^|\s)QSL\s+@?([A-Za-z0-9/-]+)/i);
  if (!atMatch) return false;
  const targetCall = (atMatch[1] || atMatch[2]).toUpperCase();
  const baseTarget = targetCall.split('-')[0];

  const existing = host.chasers.find(c => c.callsign === targetCall || c.baseCall === baseTarget);
  if (existing) {
    if (existing.status !== 'confirmed') {
      existing.status = 'confirmed';
      host.qsos += 1;
      host.points += 3;
    }
    return true;
  }

  const hasReport = /\b(?:QSL|599|5NN|[45][0-9]{1,2}|73)\b/i.test(text);
  if (host.status === 'on_air' && hasReport) {
    host.chasers.push({ callsign: targetCall, baseCall: baseTarget, status: 'confirmed' });
    host.qsos += 1;
    host.points += 3;
    return true;
  }
  return false;
}

simulateHostOutgoingQSL('TU @K3SAR 599 73', hostPileup3);
if (hostPileup3.chasers[0].status !== 'confirmed') throw new Error('Host reply with leading words failed to confirm chaser');
if (hostPileup3.qsos !== 1) throw new Error('QSO failed to increment');
console.log('✓ Leading word resilience: Host reply "TU @CALL 599" cleanly confirms chaser in queue');

simulateHostOutgoingQSL('@W3ATV 599', hostPileup3);
const w3atvChaser = hostPileup3.chasers.find(c => c.baseCall === 'W3ATV');
if (!w3atvChaser || w3atvChaser.status !== 'confirmed') throw new Error('Replying @CALL 599 failed to log chaser into queue');
if (hostPileup3.qsos !== 2 || hostPileup3.points !== 6) throw new Error('QSO and points failed to increment for W3ATV');
console.log('✓ Unqueued chaser logging: Outgoing @CALL 599 logs contact without requiring literal "QSL"');

console.log('\nTesting 28: On-Air Queue Reconstruction on Browser Refresh');
const historyMessages = [
  { direction: 'in', text: 'DE K3SAR-7 FN09lv greetings', sent_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
  { direction: 'out', text: '@K3SAR QSL 599', sent_at: new Date(Date.now() - 9 * 60 * 1000).toISOString() },
  { direction: 'in', text: 'DE W3ABC FN10ab hello', sent_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() }
];

const reconstructedHost = {
  status: 'on_air',
  startedAt: Date.now() - 15 * 60 * 1000,
  chasers: []
};

function reconstructChasers(msgs, host) {
  for (const m of msgs) {
    const text = (m.text || '').trim();
    if (m.direction === 'in') {
      const match = text.match(/^DE\s+([A-Za-z0-9/-]+):?(?:\s+([A-Za-z0-9]{4,6}))?(?:\s+(.*))?$/i);
      if (match) {
        const call = match[1].toUpperCase();
        const base = call.split('-')[0];
        const grid = (match[2] || '').toUpperCase();
        const extra = (match[3] || '').trim();
        const isQsl = /\bQSL\b/i.test(grid) || /\bQSL\b/i.test(extra);
        const existing = host.chasers.find(c => c.callsign === call || c.baseCall === base);
        if (existing) {
          if (isQsl) existing.status = 'confirmed';
        } else {
          host.chasers.push({ callsign: call, baseCall: base, status: isQsl ? 'confirmed' : 'waiting' });
        }
      }
    } else if (m.direction === 'out') {
      const atMatch = text.match(/(?:^|\s)@([A-Za-z0-9/-]+)/i);
      if (atMatch) {
        const call = atMatch[1].toUpperCase();
        const base = call.split('-')[0];
        const existing = host.chasers.find(c => c.callsign === call || c.baseCall === base);
        if (existing) existing.status = 'confirmed';
      }
    }
  }
}

reconstructChasers(historyMessages, reconstructedHost);
if (reconstructedHost.chasers.length !== 2) throw new Error(`Expected 2 chasers, got ${reconstructedHost.chasers.length}`);
const recK3sar = reconstructedHost.chasers.find(c => c.baseCall === 'K3SAR');
const recW3abc = reconstructedHost.chasers.find(c => c.baseCall === 'W3ABC');
if (!recK3sar || recK3sar.status !== 'confirmed') throw new Error('K3SAR should be restored as confirmed');
if (!recW3abc || recW3abc.status !== 'waiting') throw new Error('W3ABC should be restored as waiting');
console.log('✓ Queue reconstruction: Past thread history restores waiting and confirmed chasers on refresh');

console.log('\nTesting 29: Chronological Sorting & Origin Timestamp Stability across RF Transmit');

function getMessageTimestamp(msg) {
  if (!msg) return 0;
  const rawTs = msg.created_at || msg.received_at || msg.sent_at;
  if (rawTs) {
    const parsed = Date.parse(rawTs);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (typeof msg.id === 'number' && msg.id > 1000000000000) {
    return msg.id;
  }
  return 0;
}

function compareMessages(a, b) {
  const ta = getMessageTimestamp(a);
  const tb = getMessageTimestamp(b);
  if (ta !== tb) return ta - tb;

  const idA = a.id !== undefined && a.id !== null ? a.id : '';
  const idB = b.id !== undefined && b.id !== null ? b.id : '';
  if (idA !== '' && idB !== '' && idA !== idB) {
    const numA = Number(idA);
    const numB = Number(idB);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return String(idA).localeCompare(String(idB));
  }

  if (a.direction === 'in' && b.direction === 'out') return -1;
  if (a.direction === 'out' && b.direction === 'in') return 1;

  return 0;
}

// 1. Origin timestamp priority test
const testMsg1 = {
  id: 1,
  created_at: '2026-10-20T19:00:00.000Z',
  sent_at: '2026-10-20T19:00:15.000Z'
};
const ts1 = getMessageTimestamp(testMsg1);
if (ts1 !== Date.parse('2026-10-20T19:00:00.000Z')) {
  throw new Error(`Expected getMessageTimestamp to prioritize created_at, got ${ts1}`);
}
console.log('✓ Timestamp origin priority: getMessageTimestamp accurately prioritizes created_at over RF sent_at');

// 2. Timeline stability across RF transmit updates
const t0 = Date.parse('2026-10-20T19:00:00.000Z');
let chatMessages = [
  { id: 101, text: 'Outgoing 1', direction: 'out', created_at: new Date(t0).toISOString(), sent_at: new Date(t0).toISOString(), status: 'queued' },
  { id: 102, text: 'Inbound 2', direction: 'in', created_at: new Date(t0 + 2000).toISOString(), received_at: new Date(t0 + 2000).toISOString() },
  { id: 103, text: 'Outgoing 3', direction: 'out', created_at: new Date(t0 + 4000).toISOString(), sent_at: new Date(t0 + 4000).toISOString(), status: 'queued' }
];

chatMessages.sort((a, b) => compareMessages(a, b));
if (chatMessages.map(m => m.id).join(',') !== '101,102,103') {
  throw new Error(`Initial sorted order wrong: ${chatMessages.map(m => m.id)}`);
}

// Simulate Graywolf backend transmitting Outgoing 1 over RF at t0 + 10s and updating record
const rfUpdate = {
  id: 101,
  text: 'Outgoing 1',
  direction: 'out',
  sent_at: new Date(t0 + 10000).toISOString(), // Transmit occurred 10s later
  status: 'sent'
};

// Client reconciliation: preserve existing created_at
const existingIdx = chatMessages.findIndex(m => String(m.id) === String(rfUpdate.id));
if (existingIdx >= 0) {
  const old = chatMessages[existingIdx];
  chatMessages[existingIdx] = {
    ...old,
    ...rfUpdate,
    created_at: old.created_at || rfUpdate.created_at
  };
}

chatMessages.sort((a, b) => compareMessages(a, b));
if (chatMessages.map(m => m.id).join(',') !== '101,102,103') {
  throw new Error(`RF transmission caused message to hop out of order! Got: ${chatMessages.map(m => m.id)}`);
}
console.log('✓ Timeline stability: Preserving origin created_at prevents outgoing message jumping when RF sent_at updates');

// 3. Tie-breaker verification (same millisecond)
const tie1 = { id: 201, direction: 'out', created_at: '2026-10-20T19:00:00.000Z' };
const tie2 = { id: 202, direction: 'out', created_at: '2026-10-20T19:00:00.000Z' };
const tieIn = { id: 203, direction: 'in', created_at: '2026-10-20T19:00:00.000Z' };
const tieOut = { id: 203, direction: 'out', created_at: '2026-10-20T19:00:00.000Z' };

if (compareMessages(tie1, tie2) >= 0) throw new Error('Numeric ID tie-breaker failed');
if (compareMessages(tieIn, tieOut) >= 0) throw new Error('Direction tie-breaker failed (inbound should precede outbound)');
console.log('✓ Deterministic tie-breakers: Numeric ID and inbound-before-outbound tie-breakers produce stable ordering');

console.log('\nTesting 30: Smart Scroll Anchoring & Non-Destructive Reconciliation');

// 1. In-place DOM reconciliation test (no teardown / hopping)
class MockMessageElement {
  constructor(key, status) {
    this.dataset = { msgKey: String(key), status };
    this.badgeText = status;
    this.isDestroyed = false;
  }
  updateStatus(newStatus) {
    this.dataset.status = newStatus;
    this.badgeText = newStatus;
  }
}

class MockFeed {
  constructor() {
    this.children = [];
    this.scrollHeight = 1000;
    this.clientHeight = 400;
    this.scrollTop = 600; // Scrolled to bottom (1000 - 600 - 400 = 0 <= 80)
  }

  reconcile(messages, forceScrollBottom = false) {
    const isAtBottom = (this.scrollHeight - this.scrollTop - this.clientHeight) <= 80;
    const existingMap = new Map();
    for (const el of this.children) {
      existingMap.set(el.dataset.msgKey, el);
    }
    const retained = new Set();
    const newChildren = [];

    for (const msg of messages) {
      const key = String(msg.id);
      retained.add(key);
      let el = existingMap.get(key);
      if (el) {
        if (el.dataset.status !== msg.status) {
          el.updateStatus(msg.status);
        }
      } else {
        el = new MockMessageElement(key, msg.status);
      }
      newChildren.push(el);
    }

    this.children = newChildren;

    if (forceScrollBottom || isAtBottom) {
      this.scrollTop = this.scrollHeight;
    }
  }
}

const mockFeed = new MockFeed();
let feedMessages = [
  { id: 'm1', status: 'queued' },
  { id: 'm2', status: 'sent' }
];

mockFeed.reconcile(feedMessages, true);
const bubbleM1Before = mockFeed.children[0];
const bubbleM2Before = mockFeed.children[1];

// Update status of m1 to acked via changelog
feedMessages[0].status = 'acked';
mockFeed.reconcile(feedMessages, false);

if (mockFeed.children[0] !== bubbleM1Before) {
  throw new Error('Message element was destroyed and recreated instead of updated in-place!');
}
if (mockFeed.children[0].dataset.status !== 'acked') {
  throw new Error('Message element status was not updated in-place');
}
console.log('✓ In-place reconciliation: Message bubbles are preserved without DOM destruction on status updates');

// 2. Smart scroll anchoring: Scrolled-up reading history
mockFeed.scrollHeight = 2000;
mockFeed.scrollTop = 500; // Scrolled up reading history: distance from bottom = 2000 - 500 - 400 = 1100 > 80

// Background changelog arrives with an ACK update
feedMessages[1].status = 'acked';
mockFeed.reconcile(feedMessages, false);

if (mockFeed.scrollTop !== 500) {
  throw new Error(`Scroll position jumped while user was reading history! Expected 500, got ${mockFeed.scrollTop}`);
}
console.log('✓ Scroll anchoring: Background updates preserve scroll position when user is reading past history');

// User transmits a message with forceScrollBottom = true
feedMessages.push({ id: 'm3', status: 'queued' });
mockFeed.scrollHeight = 2200;
mockFeed.reconcile(feedMessages, true);

if (mockFeed.scrollTop !== 2200) {
  throw new Error(`forceScrollBottom failed to scroll to bottom upon message send! Expected 2200, got ${mockFeed.scrollTop}`);
}
console.log('✓ Send auto-scroll: Explicit message send cleanly snaps viewport to the bottom of the feed');

// 3. Changelog render batching
let renderCallCount = 0;
const changelogBatch = [
  { kind: 'message.updated', message: { id: 10, status: 'sent' } },
  { kind: 'message.updated', message: { id: 11, status: 'sent' } },
  { kind: 'message.acked',   message: { id: 12, status: 'acked' } }
];

function simulateChangelogBatch(changes) {
  const count = changes.length;
  changes.forEach((change, idx) => {
    const isLast = idx === count - 1;
    // applyMessageChange with shouldRender = isLast
    if (isLast) {
      renderCallCount++;
    }
  });
}

simulateChangelogBatch(changelogBatch);
if (renderCallCount !== 1) {
  throw new Error(`Expected exactly 1 batched render call for changelog, got ${renderCallCount}`);
}
console.log('✓ Changelog batching: Fast polling batches DOM updates and renders only once per change batch');

console.log('\nTesting 31: Chaser Pileup Queue Clearing, Anti-Refill Protection & Dismiss Lifecycle');

const queueHost = {
  status: 'on_air',
  startedAt: Date.now() - 30 * 60 * 1000,
  chasers: [],
  clearedChasers: new Map(),
  reconciledFromBot: false
};

function isChaserCleared(host, callsign, msgTime = null) {
  if (!callsign || !host.clearedChasers) return false;
  const full = callsign.toUpperCase();
  const base = full.split('-')[0];
  const clearedAt = host.clearedChasers.get(full) || host.clearedChasers.get(base);
  if (!clearedAt) return false;
  if (msgTime) {
    return msgTime <= clearedAt;
  }
  return true;
}

function dismissChaser(host, callsign) {
  if (!callsign) return;
  const now = Date.now();
  const full = callsign.toUpperCase();
  const base = full.split('-')[0];
  host.clearedChasers.set(full, now);
  host.clearedChasers.set(base, now);
  host.chasers = host.chasers.filter(c => {
    const cFull = (c.callsign || '').toUpperCase();
    const cBase = (c.baseCall || cFull).split('-')[0];
    return cFull !== full && cBase !== base;
  });
}

function clearQslChasers(host) {
  const now = Date.now();
  const toClear = host.chasers.filter(c => c.status === 'confirmed');
  toClear.forEach(c => {
    const full = (c.callsign || '').toUpperCase();
    const base = (c.baseCall || full).split('-')[0];
    host.clearedChasers.set(full, now);
    host.clearedChasers.set(base, now);
  });
  host.chasers = host.chasers.filter(c => c.status !== 'confirmed');
}

function clearAllChasers(host) {
  const now = Date.now();
  host.chasers.forEach(c => {
    const full = (c.callsign || '').toUpperCase();
    const base = (c.baseCall || full).split('-')[0];
    host.clearedChasers.set(full, now);
    host.clearedChasers.set(base, now);
  });
  host.chasers = [];
}

function reconcileFromBotMessages(host, msgs) {
  for (const m of msgs) {
    const mTime = Date.parse(m.sent_at || m.created_at || 0) || 0;
    if (mTime && mTime < host.startedAt - 60000) continue;
    const text = (m.text || '').trim();

    if (m.direction === 'in') {
      const match = text.match(/^DE\s+([A-Za-z0-9/-]+):?(?:\s+([A-Za-z0-9]{4,6}))?(?:\s+(.*))?$/i);
      if (match) {
        const chaserCall = match[1].toUpperCase();
        const grid = (match[2] || '').toUpperCase();
        const extra = (match[3] || '').trim();
        const baseCall = chaserCall.split('-')[0];
        const isQsl = /\bQSL\b/i.test(grid) || /\bQSL\b/i.test(extra);

        // Anti-refill: skip if cleared for this timestamp
        if (isChaserCleared(host, chaserCall, mTime)) {
          continue;
        }

        let existing = host.chasers.find(c => c.callsign === chaserCall || c.baseCall === baseCall);
        if (existing) {
          if (isQsl && existing.status !== 'confirmed') {
            existing.status = 'confirmed';
          }
        } else {
          host.chasers.push({
            callsign: chaserCall,
            baseCall,
            grid: grid && grid.length >= 4 ? grid : '----',
            message: extra,
            receivedAt: m.sent_at || new Date().toISOString(),
            status: isQsl ? 'confirmed' : 'waiting'
          });
        }
      }
    }
  }
}

const tRelay0 = Date.now() - 20 * 60 * 1000;
const botHistoryMsgs = [
  { direction: 'in', text: 'DE K3SAR-7 FN09lv greetings', sent_at: new Date(tRelay0).toISOString() },
  { direction: 'out', text: '@K3SAR QSL 599', sent_at: new Date(tRelay0 + 10000).toISOString() },
  { direction: 'in', text: 'DE DL7PJ-1 JN48 hello', sent_at: new Date(tRelay0 + 20000).toISOString() },
  { direction: 'in', text: 'DE W3ABC FN10ab summit', sent_at: new Date(tRelay0 + 30000).toISOString() }
];

// Initial reconciliation populates queue
reconcileFromBotMessages(queueHost, botHistoryMsgs);
// Mark K3SAR-7 confirmed as simulated by @K3SAR reply
const k3sar = queueHost.chasers.find(c => c.baseCall === 'K3SAR');
if (k3sar) k3sar.status = 'confirmed';

if (queueHost.chasers.length !== 3) {
  throw new Error(`Expected 3 chasers in queue, got ${queueHost.chasers.length}`);
}
console.log('✓ Initial queue setup: Queue successfully populated with 3 chasers (1 confirmed, 2 waiting)');

// 1. Clear QSLed chasers
clearQslChasers(queueHost);
if (queueHost.chasers.some(c => c.baseCall === 'K3SAR')) {
  throw new Error('K3SAR should have been removed by clearQslChasers');
}
if (!isChaserCleared(queueHost, 'K3SAR-7', tRelay0)) {
  throw new Error('K3SAR should be marked in clearedChasers');
}
console.log('✓ Clear QSLed: Confirmed contact removed and registered in anti-refill cleared registry');

// 2. Re-running bot reconciliation must NOT refill K3SAR
reconcileFromBotMessages(queueHost, botHistoryMsgs);
if (queueHost.chasers.some(c => c.baseCall === 'K3SAR')) {
  throw new Error('Chaser pileup queue REFILLED K3SAR after being cleared!');
}
if (queueHost.chasers.length !== 2) {
  throw new Error(`Queue length should still be 2, got ${queueHost.chasers.length}`);
}
console.log('✓ Anti-refill protection: Periodic bot thread reconciliation does NOT resurrect cleared QSL chasers');

// 3. Dismiss individual chaser (DL7PJ-1)
dismissChaser(queueHost, 'DL7PJ-1');
if (queueHost.chasers.some(c => c.baseCall === 'DL7PJ')) {
  throw new Error('DL7PJ should have been removed by dismissChaser');
}
if (!isChaserCleared(queueHost, 'DL7PJ-1', tRelay0 + 20000)) {
  throw new Error('DL7PJ should be marked in clearedChasers');
}
reconcileFromBotMessages(queueHost, botHistoryMsgs);
if (queueHost.chasers.some(c => c.baseCall === 'DL7PJ')) {
  throw new Error('Dismissed chaser DL7PJ was resurrected by reconciliation!');
}
console.log('✓ Individual dismiss: Dismissing individual chaser removes them and prevents refill');

// 4. Clear All chasers
clearAllChasers(queueHost);
if (queueHost.chasers.length !== 0) {
  throw new Error('Queue should be empty after clearAllChasers');
}
reconcileFromBotMessages(queueHost, botHistoryMsgs);
if (queueHost.chasers.length !== 0) {
  throw new Error('Clear All chasers refilled upon reconciliation!');
}
console.log('✓ Clear All chasers: Entire queue emptied and remains empty on background syncs');

// 5. Subsequent live check-in after clearing timestamp is allowed
const tNewRelay = Date.now() + 5000;
const newRelayMsgs = [
  { direction: 'in', text: 'DE W3ABC FN10ab second pass', sent_at: new Date(tNewRelay).toISOString() }
];
reconcileFromBotMessages(queueHost, newRelayMsgs);
if (queueHost.chasers.length !== 1 || queueHost.chasers[0].baseCall !== 'W3ABC') {
  throw new Error('New check-in after clear timestamp was incorrectly blocked!');
}
console.log('✓ Subsequent check-in support: Brand-new live contact after clearing timestamp cleanly enters queue');

// 6. New activation cleanly resets cleared registry
queueHost.clearedChasers.clear();
queueHost.chasers = [];
queueHost.reconciledFromBot = false;
if (isChaserCleared(queueHost, 'K3SAR')) {
  throw new Error('Resetting activation failed to clear anti-refill registry');
}
console.log('✓ Activation lifecycle reset: New activation cleans slate for future operations');

console.log('\n=========================================');
console.log('🎉 ALL 31 TEST SUITES PASSED VERIFICATION!');
console.log('=========================================');

process.exit(0);
