#!/usr/bin/env node

/**
 * AgentStatus Test Suite
 * Tests service configuration, status formatting, and result processing
 */

const { strict: assert } = require('assert');

// ============================================================
// SERVICES CONFIG (copied from index.js for testing)
// ============================================================

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
    expectedStatus: 401,
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

// ============================================================
// HELPER FUNCTIONS (copied from index.js for testing)
// ============================================================

function formatStatus(status) {
  switch (status) {
    case 'up': return '🟢';
    case 'degraded': return '🟡';
    case 'down': return '🔴';
    case 'timeout': return '⏱️';
    default: return '❓';
  }
}

// Simulated checkService for unit testing (doesn't make network calls)
function simulateCheckResult(service, statusCode, error = null, timeout = false) {
  if (error) {
    return {
      name: service.name,
      url: service.url,
      description: service.description,
      status: 'down',
      error: error,
      latencyMs: 100,
      checkedAt: new Date().toISOString()
    };
  }
  
  if (timeout) {
    return {
      name: service.name,
      url: service.url,
      description: service.description,
      status: 'timeout',
      latencyMs: 10000,
      checkedAt: new Date().toISOString()
    };
  }
  
  const ok = statusCode === service.expectedStatus || 
             (service.expectedStatus === 200 && statusCode >= 200 && statusCode < 400);
  
  return {
    name: service.name,
    url: service.url,
    description: service.description,
    status: ok ? 'up' : 'degraded',
    httpStatus: statusCode,
    expectedStatus: service.expectedStatus,
    latencyMs: Math.floor(Math.random() * 500) + 50,
    note: service.note || null,
    checkedAt: new Date().toISOString()
  };
}

// ============================================================
// TEST HELPERS
// ============================================================

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

function testGroup(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// ============================================================
// TESTS
// ============================================================

console.log('AgentStatus Test Suite');
console.log('='.repeat(50));

// ----------------------------------------------------------
// Service Configuration Tests
// ----------------------------------------------------------

testGroup('Service Configuration', () => {
  test('has expected number of services', () => {
    assert.equal(SERVICES.length, 8, `Expected 8 services, got ${SERVICES.length}`);
  });

  test('all services have required fields', () => {
    for (const service of SERVICES) {
      assert(service.name, `Service missing name`);
      assert(service.url, `${service.name} missing url`);
      assert(service.description, `${service.name} missing description`);
      assert(typeof service.expectedStatus === 'number', `${service.name} missing expectedStatus`);
    }
  });

  test('all URLs are valid HTTPS', () => {
    for (const service of SERVICES) {
      assert(service.url.startsWith('https://'), `${service.name} URL not HTTPS: ${service.url}`);
      // Check URL parses correctly
      const url = new URL(service.url);
      assert(url.hostname, `${service.name} URL invalid`);
    }
  });

  test('API services expect auth errors (401)', () => {
    const apiServices = SERVICES.filter(s => s.name.includes('API') && 
                                           (s.name.includes('OpenAI') || s.name.includes('Anthropic')));
    for (const service of apiServices) {
      assert.equal(service.expectedStatus, 401, 
        `${service.name} should expect 401, got ${service.expectedStatus}`);
    }
  });

  test('web services expect 200', () => {
    const webServices = SERVICES.filter(s => !s.name.includes('API') || 
                                            s.name === 'GitHub API' || 
                                            s.name === 'Moltbook API');
    for (const service of webServices) {
      if (!service.name.includes('OpenAI') && !service.name.includes('Anthropic')) {
        assert.equal(service.expectedStatus, 200, 
          `${service.name} should expect 200, got ${service.expectedStatus}`);
      }
    }
  });

  test('Moltbook uses www subdomain', () => {
    const moltbookServices = SERVICES.filter(s => s.name.includes('Moltbook'));
    for (const service of moltbookServices) {
      assert(service.url.includes('www.moltbook.com'), 
        `${service.name} should use www.moltbook.com to avoid redirect issues`);
    }
  });
});

// ----------------------------------------------------------
// Status Formatting Tests
// ----------------------------------------------------------

testGroup('Status Formatting', () => {
  test('formats "up" as green circle', () => {
    assert.equal(formatStatus('up'), '🟢');
  });

  test('formats "degraded" as yellow circle', () => {
    assert.equal(formatStatus('degraded'), '🟡');
  });

  test('formats "down" as red circle', () => {
    assert.equal(formatStatus('down'), '🔴');
  });

  test('formats "timeout" as timer', () => {
    assert.equal(formatStatus('timeout'), '⏱️');
  });

  test('formats unknown status as question mark', () => {
    assert.equal(formatStatus('unknown'), '❓');
    assert.equal(formatStatus('weird'), '❓');
    assert.equal(formatStatus(null), '❓');
    assert.equal(formatStatus(undefined), '❓');
  });
});

// ----------------------------------------------------------
// Status Logic Tests
// ----------------------------------------------------------

testGroup('Status Determination Logic', () => {
  test('exact expected status = up', () => {
    const service = SERVICES[0]; // Moltbook, expects 200
    const result = simulateCheckResult(service, 200);
    assert.equal(result.status, 'up');
  });

  test('200 service accepts any 2xx as up', () => {
    const service = SERVICES[0]; // Moltbook, expects 200
    
    const r200 = simulateCheckResult(service, 200);
    const r201 = simulateCheckResult(service, 201);
    const r204 = simulateCheckResult(service, 204);
    const r301 = simulateCheckResult(service, 301);
    const r302 = simulateCheckResult(service, 302);
    
    assert.equal(r200.status, 'up', '200 should be up');
    assert.equal(r201.status, 'up', '201 should be up');
    assert.equal(r204.status, 'up', '204 should be up');
    assert.equal(r301.status, 'up', '301 redirect should be up');
    assert.equal(r302.status, 'up', '302 redirect should be up');
  });

  test('200 service marks 4xx/5xx as degraded', () => {
    const service = SERVICES[0]; // Moltbook, expects 200
    
    const r400 = simulateCheckResult(service, 400);
    const r404 = simulateCheckResult(service, 404);
    const r500 = simulateCheckResult(service, 500);
    const r503 = simulateCheckResult(service, 503);
    
    assert.equal(r400.status, 'degraded', '400 should be degraded');
    assert.equal(r404.status, 'degraded', '404 should be degraded');
    assert.equal(r500.status, 'degraded', '500 should be degraded');
    assert.equal(r503.status, 'degraded', '503 should be degraded');
  });

  test('401-expecting service treats 401 as up', () => {
    const service = SERVICES[5]; // OpenAI API, expects 401
    const result = simulateCheckResult(service, 401);
    assert.equal(result.status, 'up');
  });

  test('401-expecting service treats 200 as degraded', () => {
    // If an API that should require auth suddenly returns 200, something's weird
    const service = SERVICES[5]; // OpenAI API, expects 401
    const result = simulateCheckResult(service, 200);
    assert.equal(result.status, 'degraded');
  });

  test('network error = down', () => {
    const service = SERVICES[0];
    const result = simulateCheckResult(service, null, 'ECONNREFUSED');
    assert.equal(result.status, 'down');
    assert.equal(result.error, 'ECONNREFUSED');
  });

  test('timeout = timeout status', () => {
    const service = SERVICES[0];
    const result = simulateCheckResult(service, null, null, true);
    assert.equal(result.status, 'timeout');
    assert(result.latencyMs >= 10000, 'Timeout latency should be >= 10000ms');
  });
});

// ----------------------------------------------------------
// Result Object Tests
// ----------------------------------------------------------

testGroup('Result Object Structure', () => {
  test('success result has all required fields', () => {
    const service = SERVICES[0];
    const result = simulateCheckResult(service, 200);
    
    assert(result.name, 'Result should have name');
    assert(result.url, 'Result should have url');
    assert(result.description, 'Result should have description');
    assert(result.status, 'Result should have status');
    assert(typeof result.httpStatus === 'number', 'Result should have httpStatus');
    assert(typeof result.expectedStatus === 'number', 'Result should have expectedStatus');
    assert(typeof result.latencyMs === 'number', 'Result should have latencyMs');
    assert(result.checkedAt, 'Result should have checkedAt');
  });

  test('error result has error field', () => {
    const service = SERVICES[0];
    const result = simulateCheckResult(service, null, 'Connection refused');
    
    assert.equal(result.status, 'down');
    assert.equal(result.error, 'Connection refused');
    assert(!result.httpStatus, 'Error result should not have httpStatus');
  });

  test('result preserves service note', () => {
    const service = SERVICES[5]; // OpenAI API has a note
    const result = simulateCheckResult(service, 401);
    assert.equal(result.note, 'Expects 401 (auth required)');
  });

  test('result without note has null note', () => {
    const service = SERVICES[0]; // Moltbook has no note
    const result = simulateCheckResult(service, 200);
    assert.equal(result.note, null);
  });

  test('checkedAt is valid ISO timestamp', () => {
    const service = SERVICES[0];
    const result = simulateCheckResult(service, 200);
    
    const date = new Date(result.checkedAt);
    assert(!isNaN(date.getTime()), 'checkedAt should be valid date');
    assert(result.checkedAt.includes('T'), 'checkedAt should be ISO format');
  });

  test('latencyMs is positive number', () => {
    const service = SERVICES[0];
    const result = simulateCheckResult(service, 200);
    
    assert(result.latencyMs > 0, 'Latency should be positive');
    assert(result.latencyMs < 60000, 'Latency should be reasonable');
  });
});

// ----------------------------------------------------------
// Service Coverage Tests
// ----------------------------------------------------------

testGroup('Service Coverage', () => {
  test('includes Moltbook', () => {
    const moltbook = SERVICES.find(s => s.name === 'Moltbook');
    assert(moltbook, 'Should include Moltbook');
  });

  test('includes GitHub', () => {
    const github = SERVICES.find(s => s.name === 'GitHub');
    assert(github, 'Should include GitHub');
  });

  test('includes major AI APIs', () => {
    const openai = SERVICES.find(s => s.name === 'OpenAI API');
    const anthropic = SERVICES.find(s => s.name === 'Anthropic API');
    assert(openai, 'Should include OpenAI API');
    assert(anthropic, 'Should include Anthropic API');
  });

  test('includes imanagent.dev', () => {
    const imanagent = SERVICES.find(s => s.name === 'imanagent.dev');
    assert(imanagent, 'Should include imanagent.dev');
  });

  test('includes HuggingFace', () => {
    const hf = SERVICES.find(s => s.name === 'HuggingFace');
    assert(hf, 'Should include HuggingFace');
  });
});

// ----------------------------------------------------------
// Edge Cases
// ----------------------------------------------------------

testGroup('Edge Cases', () => {
  test('handles service with empty checkPath', () => {
    const service = SERVICES.find(s => s.checkPath === '');
    assert(service, 'Should have service with empty checkPath');
    // Empty checkPath means just use the base URL
    const fullUrl = service.url + (service.checkPath || '');
    assert.equal(fullUrl, service.url);
  });

  test('handles service with explicit checkPath', () => {
    const service = SERVICES.find(s => s.checkPath === '/');
    assert(service, 'Should have service with "/" checkPath');
    const fullUrl = service.url + service.checkPath;
    assert(fullUrl.endsWith('/'), 'Should end with /');
  });

  test('handles service with deep checkPath', () => {
    const service = SERVICES.find(s => s.checkPath && s.checkPath.length > 1);
    assert(service, 'Should have service with deep checkPath');
    const fullUrl = service.url + service.checkPath;
    const url = new URL(fullUrl);
    assert(url.pathname.length > 1, 'Should have non-root path');
  });
});

// ----------------------------------------------------------
// Aggregation Tests
// ----------------------------------------------------------

testGroup('Result Aggregation', () => {
  test('can count services by status', () => {
    const results = SERVICES.map((service, i) => {
      // Simulate mixed results
      if (i % 4 === 0) return simulateCheckResult(service, 200);
      if (i % 4 === 1) return simulateCheckResult(service, 500);
      if (i % 4 === 2) return simulateCheckResult(service, null, 'Error');
      return simulateCheckResult(service, null, null, true);
    });
    
    const up = results.filter(r => r.status === 'up').length;
    const degraded = results.filter(r => r.status === 'degraded').length;
    const down = results.filter(r => r.status === 'down').length;
    const timeout = results.filter(r => r.status === 'timeout').length;
    
    assert.equal(up + degraded + down + timeout, SERVICES.length, 
      'All services should be accounted for');
  });

  test('all-up scenario', () => {
    const results = SERVICES.map(service => simulateCheckResult(service, service.expectedStatus));
    const up = results.filter(r => r.status === 'up').length;
    assert.equal(up, SERVICES.length, 'All should be up');
  });

  test('all-down scenario', () => {
    const results = SERVICES.map(service => simulateCheckResult(service, null, 'Network error'));
    const down = results.filter(r => r.status === 'down').length;
    assert.equal(down, SERVICES.length, 'All should be down');
  });
});

// ============================================================
// RESULTS
// ============================================================

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
