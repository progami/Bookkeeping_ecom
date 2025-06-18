// Use native fetch in Node.js 18+
import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
const devLogPath = path.join(logsDir, 'development.log');

console.log('=== SERVER LOGGING TEST ===\n');

// Clear logs
fs.writeFileSync(devLogPath, '');
console.log('Cleared development.log\n');

// Test API endpoints that should generate logs
try {
  // Test 1: Hit the homepage API
  console.log('1. Testing API health check...');
  const healthRes = await fetch('https://localhost:3003/api/v1/auth/status', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  }).catch(err => ({ ok: false, error: err.message }));
  console.log(`   Health check response: ${healthRes.ok ? 'OK' : 'Failed'}`);
  
  // Test 2: Try to login
  console.log('\n2. Testing login API...');
  const loginRes = await fetch('https://localhost:3003/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password123'
    })
  }).catch(err => ({ ok: false, error: err.message }));
  console.log(`   Login response: ${loginRes.ok ? 'OK' : 'Failed'}`);
  
  // Test 3: Direct logger test
  console.log('\n3. Testing direct logger import...');
  const { structuredLogger } = await import('./lib/logger.js');
  structuredLogger.info('[TestScript] Direct server-side log test');
  structuredLogger.debug('[TestScript] Debug level test');
  structuredLogger.warn('[TestScript] Warning level test');
  structuredLogger.error('[TestScript] Error level test');
  
  // Wait for logs to flush
  console.log('\n4. Waiting for logs to flush...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
} catch (error) {
  console.error('Test error:', error.message);
}

// Check logs
console.log('\n=== LOG ANALYSIS ===');
const content = fs.readFileSync(devLogPath, 'utf8');
const lines = content.split('\n').filter(line => line.trim());

console.log(`Total log lines: ${lines.length}`);

if (lines.length === 0) {
  console.log('\n❌ No logs found! Possible issues:');
  console.log('   - Logger not initialized properly');
  console.log('   - Logs being written to different location');
  console.log('   - File transport not working');
} else {
  console.log('\n✅ Logs are being written!');
  console.log('\n=== ALL LOGS ===');
  lines.forEach((line, i) => console.log(`${i + 1}: ${line}`));
}

console.log('\n✓ Test completed!');