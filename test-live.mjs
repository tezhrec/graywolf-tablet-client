// Comprehensive Live Server Verification Test for 10.0.0.122:8080
process.argv = ['node', 'server.mjs', '10.0.0.122:8080', '--port', '3952'];

const { default: server } = await import('./server.mjs');
await new Promise(r => setTimeout(r, 600));

const baseUrl = 'http://127.0.0.1:3952';

console.log('=== Step 1: Verify Positional Server Parsing & Client Info ===');
const infoRes = await fetch(`${baseUrl}/client/info`);
const info = await infoRes.json();
console.log('✓ /client/info:', info);
if (info.graywolf_url !== 'http://10.0.0.122:8080') {
  throw new Error(`Expected http://10.0.0.122:8080, got ${info.graywolf_url}`);
}

console.log('\n=== Step 2: Verify Live Graywolf Connectivity via /api/version ===');
const verRes = await fetch(`${baseUrl}/api/version`);
console.log('Status code:', verRes.status);
const verData = await verRes.json();
console.log('✓ /api/version response:', verData);
if (verRes.status !== 200 || !verData.version) {
  throw new Error('Failed to fetch version from 10.0.0.122:8080');
}

console.log('\n=== Step 3: Verify Authentication Requirement via /api/status ===');
const statusRes = await fetch(`${baseUrl}/api/status`);
console.log('Status code:', statusRes.status);
const statusData = await statusRes.json();
console.log('✓ /api/status response:', statusData);
if (statusRes.status !== 401) {
  throw new Error('Expected 401 Unauthorized from live Graywolf');
}

console.log('\n=== Step 4: Verify Proxying Login Endpoint via /api/auth/login ===');
const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'op-test', password: 'wrongpassword' })
});
console.log('Status code:', loginRes.status);
const loginData = await loginRes.json();
console.log('✓ /api/auth/login response:', loginData);
if (loginRes.status !== 401 || !loginData.error) {
  throw new Error('Expected invalid credentials response');
}

console.log('\n=== Step 5: Verify Dynamic Target Switching via /client/target ===');
const switchRes = await fetch(`${baseUrl}/client/target`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ target: '10.0.0.122:8080' })
});
const switchData = await switchRes.json();
console.log('✓ /client/target response:', switchData);

console.log('\n=== Step 6: Verify Static Asset Delivery ===');
const indexRes = await fetch(`${baseUrl}/index.html`);
const indexHtml = await indexRes.text();
if (!indexHtml.includes('modal-login') || !indexHtml.includes('btn-login-prompt')) {
  throw new Error('index.html missing login dialog elements');
}
console.log('✓ index.html successfully verified with dedicated login prompt');

console.log('\n======================================================');
console.log('🎉 LIVE GRAYWOLF CONNECTIVITY (10.0.0.122:8080) VERIFIED!');
console.log('======================================================');

process.exit(0);
