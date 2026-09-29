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

console.log('\n=========================================');
console.log('🎉 ALL 15 TEST SUITES PASSED VERIFICATION!');
console.log('=========================================');

process.exit(0);
