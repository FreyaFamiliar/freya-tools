#!/usr/bin/env node
/**
 * Test suite for RetryClient
 * 
 * Tests utility methods and core logic.
 * Network-dependent tests use real endpoints or mocks.
 * 
 * Built by Freya (@FreyaTheFamiliar) - Feb 2026
 */

const RetryClient = require('./index.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`\x1b[32m✅ ${name}\x1b[0m`);
    passed++;
  } catch (error) {
    console.log(`\x1b[31m❌ ${name}\x1b[0m`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertInRange(value, min, max, message) {
  if (value < min || value > max) {
    throw new Error(message || `Expected ${value} to be between ${min} and ${max}`);
  }
}

// =====================
// Constructor Tests
// =====================

test('constructor uses default options', () => {
  const client = new RetryClient();
  assertEqual(client.maxRetries, 3);
  assertEqual(client.baseDelay, 1000);
  assertEqual(client.maxDelay, 30000);
  assertEqual(client.timeout, 10000);
  assertEqual(client.cacheTTL, 300000);
  assert(client.enableCache === true);
});

test('constructor accepts custom options', () => {
  const client = new RetryClient({
    maxRetries: 5,
    baseDelay: 500,
    maxDelay: 60000,
    timeout: 20000,
    cacheTTL: 600000,
    enableCache: false,
    verbose: true
  });
  assertEqual(client.maxRetries, 5);
  assertEqual(client.baseDelay, 500);
  assertEqual(client.maxDelay, 60000);
  assertEqual(client.timeout, 20000);
  assertEqual(client.cacheTTL, 600000);
  assertEqual(client.enableCache, false);
  assertEqual(client.verbose, true);
});

// =====================
// URL Parsing Tests
// =====================

test('parseUrl handles HTTPS URLs', () => {
  const client = new RetryClient({ enableCache: false });
  const parsed = client.parseUrl('https://api.example.com/v1/data?foo=bar');
  assertEqual(parsed.protocol, 'https:');
  assertEqual(parsed.hostname, 'api.example.com');
  assertEqual(parsed.port, 443);
  assertEqual(parsed.path, '/v1/data?foo=bar');
});

test('parseUrl handles HTTP URLs', () => {
  const client = new RetryClient({ enableCache: false });
  const parsed = client.parseUrl('http://localhost:3000/test');
  assertEqual(parsed.protocol, 'http:');
  assertEqual(parsed.hostname, 'localhost');
  assertEqual(String(parsed.port), '3000'); // URL.port is a string
  assertEqual(parsed.path, '/test');
});

test('parseUrl handles URLs with default ports', () => {
  const client = new RetryClient({ enableCache: false });
  const https = client.parseUrl('https://example.com/');
  assertEqual(https.port, 443);
  
  const http = client.parseUrl('http://example.com/');
  assertEqual(http.port, 80);
});

// =====================
// Cache Key Tests
// =====================

test('getCacheKey is deterministic', () => {
  const client = new RetryClient({ enableCache: false });
  const key1 = client.getCacheKey('https://api.example.com/data', { method: 'GET' });
  const key2 = client.getCacheKey('https://api.example.com/data', { method: 'GET' });
  assertEqual(key1, key2);
});

test('getCacheKey differs for different URLs', () => {
  const client = new RetryClient({ enableCache: false });
  const key1 = client.getCacheKey('https://api.example.com/data1');
  const key2 = client.getCacheKey('https://api.example.com/data2');
  assert(key1 !== key2, 'Keys should differ for different URLs');
});

test('getCacheKey differs for different methods', () => {
  const client = new RetryClient({ enableCache: false });
  const key1 = client.getCacheKey('https://api.example.com/data', { method: 'GET' });
  const key2 = client.getCacheKey('https://api.example.com/data', { method: 'POST' });
  assert(key1 !== key2, 'Keys should differ for different methods');
});

test('getCacheKey differs for different bodies', () => {
  const client = new RetryClient({ enableCache: false });
  const key1 = client.getCacheKey('https://api.example.com/data', { body: '{"a":1}' });
  const key2 = client.getCacheKey('https://api.example.com/data', { body: '{"a":2}' });
  assert(key1 !== key2, 'Keys should differ for different bodies');
});

// =====================
// Retryable Detection Tests
// =====================

test('isRetryable returns true for 500 errors', () => {
  const client = new RetryClient({ enableCache: false });
  assert(client.isRetryable(500, null) === true);
  assert(client.isRetryable(502, null) === true);
  assert(client.isRetryable(503, null) === true);
  assert(client.isRetryable(504, null) === true);
});

test('isRetryable returns true for 429 rate limit', () => {
  const client = new RetryClient({ enableCache: false });
  assert(client.isRetryable(429, null) === true);
});

test('isRetryable returns true for 408 timeout', () => {
  const client = new RetryClient({ enableCache: false });
  assert(client.isRetryable(408, null) === true);
});

test('isRetryable returns false for 4xx client errors', () => {
  const client = new RetryClient({ enableCache: false });
  assert(client.isRetryable(400, null) === false);
  assert(client.isRetryable(401, null) === false);
  assert(client.isRetryable(403, null) === false);
  assert(client.isRetryable(404, null) === false);
});

test('isRetryable returns false for 2xx success', () => {
  const client = new RetryClient({ enableCache: false });
  assert(client.isRetryable(200, null) === false);
  assert(client.isRetryable(201, null) === false);
  assert(client.isRetryable(204, null) === false);
});

test('isRetryable returns true for network errors', () => {
  const client = new RetryClient({ enableCache: false });
  assert(client.isRetryable(null, { code: 'ECONNRESET' }) === true);
  assert(client.isRetryable(null, { code: 'ENOTFOUND' }) === true);
  assert(client.isRetryable(null, { code: 'ECONNREFUSED' }) === true);
  assert(client.isRetryable(null, { code: 'ETIMEDOUT' }) === true);
  assert(client.isRetryable(null, { code: 'EPIPE' }) === true);
});

test('isRetryable returns false for other errors', () => {
  const client = new RetryClient({ enableCache: false });
  assert(client.isRetryable(null, { code: 'ERR_INVALID_URL' }) === false);
  assert(client.isRetryable(null, { code: 'UNKNOWN' }) === false);
});

// =====================
// Delay Calculation Tests
// =====================

test('calculateDelay uses exponential backoff', () => {
  const client = new RetryClient({ baseDelay: 1000, maxDelay: 30000, enableCache: false });
  
  // First attempt: ~1000ms base
  const delay0 = client.calculateDelay(0, null);
  assertInRange(delay0, 1000, 1300, `Attempt 0 delay should be 1000-1300ms, got ${delay0}`);
  
  // Second attempt: ~2000ms base
  const delay1 = client.calculateDelay(1, null);
  assertInRange(delay1, 2000, 2600, `Attempt 1 delay should be 2000-2600ms, got ${delay1}`);
  
  // Third attempt: ~4000ms base
  const delay2 = client.calculateDelay(2, null);
  assertInRange(delay2, 4000, 5200, `Attempt 2 delay should be 4000-5200ms, got ${delay2}`);
});

test('calculateDelay respects maxDelay', () => {
  const client = new RetryClient({ baseDelay: 1000, maxDelay: 5000, enableCache: false });
  
  // With high attempt number, should hit maxDelay
  const delay = client.calculateDelay(10, null);
  assertInRange(delay, 0, 5000, `Delay should not exceed maxDelay of 5000ms, got ${delay}`);
});

test('calculateDelay respects Retry-After header', () => {
  const client = new RetryClient({ baseDelay: 1000, maxDelay: 30000, enableCache: false });
  
  const response = { headers: { 'retry-after': '5' } };
  const delay = client.calculateDelay(0, response);
  assertEqual(delay, 5000, 'Should use Retry-After header value');
});

test('calculateDelay caps Retry-After at maxDelay', () => {
  const client = new RetryClient({ baseDelay: 1000, maxDelay: 10000, enableCache: false });
  
  const response = { headers: { 'retry-after': '60' } };
  const delay = client.calculateDelay(0, response);
  assertEqual(delay, 10000, 'Should cap at maxDelay');
});

// =====================
// Cache Tests
// =====================

test('cache saves and retrieves responses', () => {
  const cacheDir = path.join(os.tmpdir(), 'retryclient-test-' + Date.now());
  const client = new RetryClient({ cacheDir, enableCache: true, cacheTTL: 60000 });
  
  const testUrl = 'https://test.example.com/data';
  const testResponse = { statusCode: 200, body: '{"test": true}' };
  
  // Save to cache
  client.saveToCache(testUrl, {}, testResponse);
  
  // Retrieve from cache
  const cached = client.getFromCache(testUrl, {});
  assert(cached !== null, 'Should return cached value');
  assertEqual(cached.response.statusCode, 200);
  assertEqual(cached.response.body, '{"test": true}');
  
  // Cleanup
  client.clearCache();
  fs.rmdirSync(cacheDir, { recursive: true });
});

test('cache returns null when disabled', () => {
  const client = new RetryClient({ enableCache: false });
  
  const cached = client.getFromCache('https://example.com/test', {});
  assert(cached === null, 'Should return null when cache disabled');
});

test('cache returns null for expired entries', async () => {
  const cacheDir = path.join(os.tmpdir(), 'retryclient-test-ttl-' + Date.now());
  const client = new RetryClient({ cacheDir, enableCache: true, cacheTTL: 10 }); // 10ms TTL
  
  const testUrl = 'https://test.example.com/expire';
  const testResponse = { statusCode: 200, body: 'test' };
  
  // Save to cache
  client.saveToCache(testUrl, {}, testResponse);
  
  // Wait for expiry
  await new Promise(r => setTimeout(r, 20));
  
  // Should be expired
  const cached = client.getFromCache(testUrl, {});
  assert(cached === null, 'Should return null for expired cache');
  
  // Cleanup
  client.clearCache();
  fs.rmdirSync(cacheDir, { recursive: true });
});

test('clearCache removes all cached files', () => {
  const cacheDir = path.join(os.tmpdir(), 'retryclient-test-clear-' + Date.now());
  const client = new RetryClient({ cacheDir, enableCache: true });
  
  // Save some entries
  client.saveToCache('https://example.com/1', {}, { body: '1' });
  client.saveToCache('https://example.com/2', {}, { body: '2' });
  
  // Verify files exist
  const filesBefore = fs.readdirSync(cacheDir);
  assertEqual(filesBefore.length, 2);
  
  // Clear cache
  client.clearCache();
  
  // Verify files removed
  const filesAfter = fs.readdirSync(cacheDir);
  assertEqual(filesAfter.length, 0);
  
  // Cleanup
  fs.rmdirSync(cacheDir, { recursive: true });
});

// =====================
// Sleep Test
// =====================

test('sleep waits for specified duration', async () => {
  const client = new RetryClient({ enableCache: false });
  const start = Date.now();
  await client.sleep(50);
  const elapsed = Date.now() - start;
  assertInRange(elapsed, 45, 100, `Sleep should take ~50ms, took ${elapsed}ms`);
});

// =====================
// Summary
// =====================

console.log('\n' + '─'.repeat(40));
console.log(`Tests: ${passed} passed, ${failed} failed`);

process.exit(failed > 0 ? 1 : 0);
