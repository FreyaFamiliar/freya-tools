#!/usr/bin/env node
/**
 * RetryClient - Robust HTTP client for flaky APIs
 * 
 * Features:
 * - Automatic retries with exponential backoff
 * - Rate limit detection and respect
 * - Response caching
 * - Graceful degradation
 * 
 * Built by Freya (@FreyaTheFamiliar) - Feb 2026
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class RetryClient {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.timeout = options.timeout || 10000;
    this.cacheDir = options.cacheDir || path.join(process.env.HOME || '/tmp', '.cache', 'retryclient');
    this.cacheTTL = options.cacheTTL || 300000;
    this.enableCache = options.enableCache !== false;
    this.verbose = options.verbose || false;
    
    if (this.enableCache) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  log(...args) {
    if (this.verbose) console.log('[RetryClient]', ...args);
  }

  getCacheKey(url, options = {}) {
    const data = JSON.stringify({ url, method: options.method || 'GET', body: options.body });
    return crypto.createHash('md5').update(data).digest('hex');
  }

  getCachePath(key) {
    return path.join(this.cacheDir, `${key}.json`);
  }

  getFromCache(url, options = {}) {
    if (!this.enableCache) return null;
    const key = this.getCacheKey(url, options);
    const cachePath = this.getCachePath(key);
    try {
      if (fs.existsSync(cachePath)) {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const age = Date.now() - cached.timestamp;
        if (age < this.cacheTTL) {
          this.log(`Cache hit for ${url} (age: ${Math.round(age/1000)}s)`);
          return cached;
        }
      }
    } catch (e) {}
    return null;
  }

  saveToCache(url, options, response) {
    if (!this.enableCache) return;
    const key = this.getCacheKey(url, options);
    const cachePath = this.getCachePath(key);
    try {
      fs.writeFileSync(cachePath, JSON.stringify({ url, timestamp: Date.now(), response }));
    } catch (e) {}
  }

  parseUrl(url) {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search
    };
  }

  isRetryable(statusCode, error) {
    if (error) {
      return ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE'].includes(error.code);
    }
    return statusCode >= 500 || statusCode === 429 || statusCode === 408;
  }

  calculateDelay(attempt, response) {
    if (response?.headers?.['retry-after']) {
      const retryAfter = parseInt(response.headers['retry-after'], 10);
      if (!isNaN(retryAfter)) return Math.min(retryAfter * 1000, this.maxDelay);
    }
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, this.maxDelay);
  }

  makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const { protocol, hostname, port, path: urlPath } = this.parseUrl(url);
      const client = protocol === 'https:' ? https : http;
      const reqOptions = {
        hostname, port, path: urlPath,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: this.timeout
      };

      const req = client.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  async fetch(url, options = {}) {
    if (!options.method || options.method === 'GET') {
      const cached = this.getFromCache(url, options);
      if (cached) return { ...cached.response, fromCache: true };
    }

    let lastError = null;
    let lastResponse = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.log(`Attempt ${attempt + 1}/${this.maxRetries + 1} for ${url}`);
        const response = await this.makeRequest(url, options);
        lastResponse = response;

        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (!options.method || options.method === 'GET') this.saveToCache(url, options, response);
          return { ...response, fromCache: false, attempts: attempt + 1 };
        }

        if (!this.isRetryable(response.statusCode, null)) {
          return { ...response, fromCache: false, attempts: attempt + 1 };
        }

        if (attempt < this.maxRetries) {
          const delay = this.calculateDelay(attempt, response);
          this.log(`Retrying in ${Math.round(delay/1000)}s (status: ${response.statusCode})`);
          await this.sleep(delay);
        }
      } catch (error) {
        lastError = error;
        if (!this.isRetryable(null, error) || attempt >= this.maxRetries) break;
        const delay = this.calculateDelay(attempt, null);
        this.log(`Retrying in ${Math.round(delay/1000)}s (error: ${error.code || error.message})`);
        await this.sleep(delay);
      }
    }

    const staleCache = this.getStaleCache(url, options);
    if (staleCache) {
      this.log(`Returning stale cache as fallback`);
      return { ...staleCache.response, fromCache: true, stale: true, cacheAge: Date.now() - staleCache.timestamp };
    }

    throw new Error(lastError?.message || `Request failed after ${this.maxRetries + 1} attempts`);
  }

  getStaleCache(url, options) {
    if (!this.enableCache) return null;
    const key = this.getCacheKey(url, options);
    const cachePath = this.getCachePath(key);
    try {
      if (fs.existsSync(cachePath)) return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } catch (e) {}
    return null;
  }

  sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async get(url, headers = {}) {
    return this.fetch(url, { method: 'GET', headers });
  }

  async post(url, body, headers = {}) {
    return this.fetch(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
  }

  async getJSON(url, headers = {}) {
    const response = await this.get(url, { Accept: 'application/json', ...headers });
    return { ...response, data: JSON.parse(response.body) };
  }

  clearCache() {
    if (this.enableCache && fs.existsSync(this.cacheDir)) {
      fs.readdirSync(this.cacheDir).forEach(file => fs.unlinkSync(path.join(this.cacheDir, file)));
    }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
RetryClient - Robust HTTP client for flaky APIs

Usage: retryclient [options] <url>

Options:
  -v, --verbose     Show detailed logs
  -r, --retries N   Max retries (default: 3)
  -t, --timeout N   Timeout in seconds (default: 10)
  --no-cache        Disable caching
  --clear-cache     Clear the cache
  -H, --header K:V  Add header
  -X, --method M    HTTP method (default: GET)
  -d, --data D      Request body
`);
    process.exit(0);
  }

  const options = { verbose: false, maxRetries: 3, timeout: 10000, enableCache: true, headers: {} };
  let url = null, method = 'GET', body = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-v' || arg === '--verbose') options.verbose = true;
    else if (arg === '-r' || arg === '--retries') options.maxRetries = parseInt(args[++i], 10);
    else if (arg === '-t' || arg === '--timeout') options.timeout = parseInt(args[++i], 10) * 1000;
    else if (arg === '--no-cache') options.enableCache = false;
    else if (arg === '--clear-cache') { new RetryClient(options).clearCache(); process.exit(0); }
    else if (arg === '-H' || arg === '--header') {
      const [key, ...v] = args[++i].split(':');
      options.headers[key.trim()] = v.join(':').trim();
    }
    else if (arg === '-X' || arg === '--method') method = args[++i].toUpperCase();
    else if (arg === '-d' || arg === '--data') body = args[++i];
    else if (!arg.startsWith('-')) url = arg;
  }

  if (!url) { console.error('Error: URL required'); process.exit(1); }

  new RetryClient(options).fetch(url, { method, body, headers: options.headers })
    .then(response => {
      if (options.verbose) {
        console.log(`\n--- Status: ${response.statusCode} | Cache: ${response.fromCache ? 'yes' : 'no'} | Attempts: ${response.attempts || 'N/A'} ---\n`);
      }
      console.log(response.body);
    })
    .catch(error => { console.error(`Error: ${error.message}`); process.exit(1); });
}

module.exports = RetryClient;
