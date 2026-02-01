/**
 * AgentProtocol Tests
 */

const assert = require('assert');
const {
  createMessage,
  createHello,
  createRequest,
  createResponse,
  createError,
  createNotify,
  parseMessage,
  validateMessage,
  generateKeypair,
  getAgentId,
  signMessage,
  verifySignature,
  parseCapability,
  createCapability,
  matchCapability,
  hasCapability,
  CapabilityRegistry,
  Agent,
  CORE_CAPABILITIES,
  ERROR_CODES
} = require('../src');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}`);
    console.log(`   ${e.message}`);
    failed++;
  }
}

// Message Tests
test('createMessage - basic', () => {
  const msg = createMessage({
    from: { agentId: 'test-agent' },
    to: { agentId: 'target-agent' },
    type: 'notify',
    payload: { event: 'test' }
  });
  assert(msg.protocol === 'agentprotocol/0.1');
  assert(msg.id);
  assert(msg.timestamp);
  assert(msg.from.agentId === 'test-agent');
  assert(msg.to.agentId === 'target-agent');
  assert(msg.type === 'notify');
});

test('createMessage - invalid type throws', () => {
  let threw = false;
  try {
    createMessage({
      from: { agentId: 'test' },
      type: 'invalid-type',
      payload: {}
    });
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Should throw on invalid type');
});

test('createHello - structure', () => {
  const msg = createHello(
    { agentId: 'me', capabilities: ['test:cap'] },
    { agentId: 'you' },
    ['signed-messages']
  );
  assert(msg.type === 'hello');
  assert(msg.payload.version === '0.1');
  assert(msg.payload.features.includes('signed-messages'));
});

test('createRequest - structure', () => {
  const msg = createRequest(
    { agentId: 'me' },
    { agentId: 'you' },
    'code-review',
    { code: 'test' },
    5000
  );
  assert(msg.type === 'request');
  assert(msg.payload.action === 'code-review');
  assert(msg.payload.correlationId);
  assert(msg.payload.params.code === 'test');
  assert(msg.payload.timeout === 5000);
});

test('createResponse - structure', () => {
  const msg = createResponse(
    { agentId: 'me' },
    { agentId: 'you' },
    'corr-123',
    { rating: 'good' }
  );
  assert(msg.type === 'response');
  assert(msg.payload.correlationId === 'corr-123');
  assert(msg.payload.status === 'success');
  assert(msg.payload.result.rating === 'good');
});

test('createError - structure', () => {
  const msg = createError(
    { agentId: 'me' },
    { agentId: 'you' },
    'corr-123',
    ERROR_CODES.CAPABILITY_NOT_SUPPORTED,
    'Not supported'
  );
  assert(msg.type === 'error');
  assert(msg.payload.code === 'CAPABILITY_NOT_SUPPORTED');
  assert(msg.payload.message === 'Not supported');
});

test('validateMessage - valid', () => {
  const msg = createNotify({ agentId: 'me' }, { agentId: 'you' }, 'test', {});
  const result = validateMessage(msg);
  assert(result.valid);
  assert(result.errors.length === 0);
});

test('validateMessage - missing fields', () => {
  const result = validateMessage({ type: 'notify' });
  assert(!result.valid);
  assert(result.errors.length > 0);
});

test('parseMessage - valid JSON', () => {
  const msg = createNotify({ agentId: 'me' }, { agentId: 'you' }, 'test', {});
  const json = JSON.stringify(msg);
  const result = parseMessage(json);
  assert(!result.error);
  assert(result.message.type === 'notify');
});

test('parseMessage - invalid JSON', () => {
  const result = parseMessage('not json');
  assert(result.error);
  assert(!result.message);
});

// Signature Tests
test('generateKeypair - creates valid keys', () => {
  const keys = generateKeypair();
  assert(keys.publicKey);
  assert(keys.privateKey);
  assert(keys.publicKey.length > 40);
});

test('getAgentId - deterministic', () => {
  const keys = generateKeypair();
  const id1 = getAgentId(keys.publicKey);
  const id2 = getAgentId(keys.publicKey);
  assert(id1 === id2);
});

test('signMessage - adds signature', () => {
  const keys = generateKeypair();
  const msg = createNotify({ agentId: 'me' }, { agentId: 'you' }, 'test', {});
  const signed = signMessage(msg, keys.privateKey);
  assert(signed.signature);
  assert(signed.signature.length > 40);
});

test('verifySignature - valid signature', () => {
  const keys = generateKeypair();
  const msg = createNotify({ agentId: 'me' }, { agentId: 'you' }, 'test', {});
  const signed = signMessage(msg, keys.privateKey);
  const result = verifySignature(signed, keys.publicKey);
  assert(result.valid);
});

test('verifySignature - tampered message', () => {
  const keys = generateKeypair();
  const msg = createNotify({ agentId: 'me' }, { agentId: 'you' }, 'test', {});
  const signed = signMessage(msg, keys.privateKey);
  signed.payload.event = 'tampered';
  const result = verifySignature(signed, keys.publicKey);
  assert(!result.valid);
});

test('verifySignature - wrong key', () => {
  const keys1 = generateKeypair();
  const keys2 = generateKeypair();
  const msg = createNotify({ agentId: 'me' }, { agentId: 'you' }, 'test', {});
  const signed = signMessage(msg, keys1.privateKey);
  const result = verifySignature(signed, keys2.publicKey);
  assert(!result.valid);
});

// Capability Tests
test('parseCapability - valid', () => {
  const cap = parseCapability('myagent:code-review');
  assert(cap.namespace === 'myagent');
  assert(cap.capability === 'code-review');
  assert(cap.variant === null);
});

test('parseCapability - with variant', () => {
  const cap = parseCapability('myagent:translation/en-de');
  assert(cap.namespace === 'myagent');
  assert(cap.capability === 'translation');
  assert(cap.variant === 'en-de');
});

test('createCapability - basic', () => {
  const cap = createCapability('test', 'capability');
  assert(cap === 'test:capability');
});

test('createCapability - with variant', () => {
  const cap = createCapability('test', 'capability', 'v1');
  assert(cap === 'test:capability/v1');
});

test('matchCapability - exact match', () => {
  assert(matchCapability('test:cap', 'test:cap'));
});

test('matchCapability - wildcard', () => {
  assert(matchCapability('test:anything', 'test:*'));
});

test('hasCapability - finds match', () => {
  const caps = ['test:a', 'test:b', 'other:c'];
  assert(hasCapability(caps, 'test:b'));
  assert(!hasCapability(caps, 'test:d'));
});

test('CapabilityRegistry - register and check', () => {
  const reg = new CapabilityRegistry();
  reg.register('test:cap');
  assert(reg.has('test:cap'));
  assert(!reg.has('test:other'));
});

test('CapabilityRegistry - handler', () => {
  const reg = new CapabilityRegistry();
  reg.register('test:cap', () => 'handled');
  const handler = reg.getHandler('test:cap');
  assert(handler);
  assert(handler() === 'handled');
});

// Agent Tests
test('Agent - creates identity', () => {
  const agent = new Agent({ dataDir: '/tmp/agentproto-test-' + Date.now() });
  assert(agent.agentId);
  assert(agent.publicKey);
  assert(agent.capabilities.has(CORE_CAPABILITIES.CORE));
});

test('Agent - createHello', () => {
  const agent = new Agent({ dataDir: '/tmp/agentproto-test-' + Date.now() });
  const msg = agent.createHello('target-123');
  assert(msg.type === 'hello');
  assert(msg.signature);
});

test('Agent - createRequest', () => {
  const agent = new Agent({ dataDir: '/tmp/agentproto-test-' + Date.now() });
  const msg = agent.createRequest('target-123', 'test-action', { foo: 'bar' });
  assert(msg.type === 'request');
  assert(msg.payload.action === 'test-action');
  assert(msg.signature);
});

// Summary
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
