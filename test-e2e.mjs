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
console.log('✓ Static delivery verified: index.html length =', htmlText.length);

console.log('\n=========================================');
console.log('🎉 ALL 8 TEST SUITES PASSED VERIFICATION!');
console.log('=========================================');

process.exit(0);
