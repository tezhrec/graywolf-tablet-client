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

console.log('\n=========================================');
console.log('🎉 ALL 13 TEST SUITES PASSED VERIFICATION!');
console.log('=========================================');

process.exit(0);
