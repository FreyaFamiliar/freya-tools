#!/usr/bin/env node
/**
 * AgentStatus - Service status checker for AI agents
 * Monitors common services agents depend on
 * 
 * Usage: node index.js [--json] [--watch]
 */

const https = require('https');
const http = require('http');

const SERVICES = [
  {
    name: 'Moltbook',
    url: 'https://www.moltbook.com',
    description: 'AI agent social network',
    checkPath: '/',
    expectedStatus: 200
  },
  {
    name: 'Moltbook API',
    url: 'https://www.moltbook.com/api/v1/feed/hot',
    description: 'Moltbook feed API',
    checkPath: '',
    expectedStatus: 200,
    note: 'May require auth'
  },
  {
    name: 'imanagent.dev',
    url: 'https://imanagent.dev',
    description: 'Agent verification challenges',
    checkPath: '/',
    expectedStatus: 200
  },
  {
    name: 'GitHub',
    url: 'https://github.com',
    description: 'Code hosting',
    checkPath: '/',
    expectedStatus: 200
  },
  {
    name: 'GitHub API',
    url: 'https://api.github.com',
    description: 'GitHub REST API',
    checkPath: '/',
    expectedStatus: 200
  },
  {
    name: 'OpenAI API',
    url: 'https://api.openai.com',
    description: 'OpenAI services',
    checkPath: '/v1/models',
    expectedStatus: 401, // Expect 401 without auth (proves API is up)
    note: 'Expects 401 (auth required)'
  },
  {
    name: 'Anthropic API',
    url: 'https://api.anthropic.com',
    description: 'Claude API',
    checkPath: '/v1/messages',
    expectedStatus: 401,
    note: 'Expects 401 (auth required)'
  },
  {
    name: 'HuggingFace',
    url: 'https://huggingface.co',
    description: 'ML models & datasets',
    checkPath: '/',
    expectedStatus: 200
  }
];

async function checkService(service) {
  const startTime = Date.now();
  const fullUrl = service.url + (service.checkPath || '');
  
  return new Promise((resolve) => {
    const urlObj = new URL(fullUrl);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.get(fullUrl, { 
      timeout: 10000,
      headers: { 'User-Agent': 'AgentStatus/1.0 (https://github.com/FreyaFamiliar/freya-tools)' }
    }, (res) => {
      const latency = Date.now() - startTime;
      const status = res.statusCode;
      const ok = status === service.expectedStatus || 
                 (service.expectedStatus === 200 && status >= 200 && status < 400);
      
      resolve({
        name: service.name,
        url: service.url,
        description: service.description,
        status: ok ? 'up' : 'degraded',
        httpStatus: status,
        expectedStatus: service.expectedStatus,
        latencyMs: latency,
        note: service.note || null,
        checkedAt: new Date().toISOString()
      });
    });
    
    req.on('error', (err) => {
      resolve({
        name: service.name,
        url: service.url,
        description: service.description,
        status: 'down',
        error: err.message,
        latencyMs: Date.now() - startTime,
        checkedAt: new Date().toISOString()
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: service.name,
        url: service.url,
        description: service.description,
        status: 'timeout',
        latencyMs: Date.now() - startTime,
        checkedAt: new Date().toISOString()
      });
    });
  });
}

async function checkAllServices() {
  const results = await Promise.all(SERVICES.map(checkService));
  return results;
}

function formatStatus(status) {
  switch (status) {
    case 'up': return '🟢';
    case 'degraded': return '🟡';
    case 'down': return '🔴';
    case 'timeout': return '⏱️';
    default: return '❓';
  }
}

function printResults(results, jsonOutput = false) {
  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  
  console.log('\n🤖 Agent Service Status');
  console.log('=' .repeat(60));
  console.log(`Checked at: ${new Date().toISOString()}\n`);
  
  const up = results.filter(r => r.status === 'up').length;
  const total = results.length;
  console.log(`Overall: ${up}/${total} services operational\n`);
  
  for (const result of results) {
    const icon = formatStatus(result.status);
    const latency = result.latencyMs ? `${result.latencyMs}ms` : 'N/A';
    console.log(`${icon} ${result.name.padEnd(20)} ${result.status.padEnd(10)} ${latency.padStart(8)}`);
    if (result.error) {
      console.log(`   └─ Error: ${result.error}`);
    }
    if (result.status === 'degraded' && result.httpStatus) {
      console.log(`   └─ HTTP ${result.httpStatus} (expected ${result.expectedStatus})`);
    }
  }
  
  console.log('\n' + '-'.repeat(60));
  console.log('Legend: 🟢 Up | 🟡 Degraded | 🔴 Down | ⏱️ Timeout');
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const watchMode = args.includes('--watch');
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
AgentStatus - Service status checker for AI agents

Usage: node index.js [options]

Options:
  --json     Output results as JSON
  --watch    Continuously monitor (every 60s)
  --help     Show this help

Services monitored:
${SERVICES.map(s => `  - ${s.name}: ${s.description}`).join('\n')}
`);
    process.exit(0);
  }
  
  if (watchMode) {
    console.log('Starting watch mode (Ctrl+C to stop)...\n');
    while (true) {
      const results = await checkAllServices();
      console.clear();
      printResults(results, jsonOutput);
      await new Promise(r => setTimeout(r, 60000));
    }
  } else {
    const results = await checkAllServices();
    printResults(results, jsonOutput);
  }
}

main().catch(console.error);
