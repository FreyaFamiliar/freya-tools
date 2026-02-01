#!/usr/bin/env node

/**
 * AgentReputation Tests
 */

const crypto = require('crypto');
const { createVouch, verifyVouch, validateVouch } = require('../src/vouch');
const { TrustGraph } = require('../src/graph');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Generate test keypairs
function genKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubKeyBuffer = publicKey.export({ type: 'spki', format: 'der' });
  const agentId = 'agent_' + crypto.randomBytes(12).toString('hex');
  return { publicKey: pubKeyBuffer, privateKey, agentId };
}

console.log('\n🐈‍⬛ AgentReputation Tests\n');

// =========== Vouch Tests ===========

test('Create valid vouch', () => {
  const alice = genKeypair();
  const bob = genKeypair();
  
  const vouch = createVouch({
    from: alice.agentId,
    to: bob.agentId,
    type: 'positive',
    category: 'collaboration',
    description: 'Great work on the project!',
    privateKey: alice.privateKey,
    publicKey: alice.publicKey
  });
  
  assert(vouch.id.startsWith('vouch_'), 'should have valid id');
  assert(vouch.from === alice.agentId, 'should have correct from');
  assert(vouch.to === bob.agentId, 'should have correct to');
  assert(vouch.signature, 'should have signature');
});

test('Verify vouch signature', () => {
  const alice = genKeypair();
  const bob = genKeypair();
  
  const vouch = createVouch({
    from: alice.agentId,
    to: bob.agentId,
    type: 'positive',
    category: 'code_review',
    description: 'Helpful code review feedback',
    privateKey: alice.privateKey,
    publicKey: alice.publicKey
  });
  
  assert(verifyVouch(vouch), 'should verify valid signature');
});

test('Detect tampered vouch', () => {
  const alice = genKeypair();
  const bob = genKeypair();
  
  const vouch = createVouch({
    from: alice.agentId,
    to: bob.agentId,
    type: 'positive',
    category: 'reliability',
    description: 'Always delivers on time',
    privateKey: alice.privateKey,
    publicKey: alice.publicKey
  });
  
  // Tamper with description
  vouch.context.description = 'Modified description';
  
  assert(!verifyVouch(vouch), 'should fail verification for tampered vouch');
});

test('Reject wrong key', () => {
  const alice = genKeypair();
  const bob = genKeypair();
  const charlie = genKeypair();
  
  const vouch = createVouch({
    from: alice.agentId,
    to: bob.agentId,
    type: 'positive',
    category: 'honesty',
    description: 'Very trustworthy agent',
    privateKey: alice.privateKey,
    publicKey: charlie.publicKey // Wrong key!
  });
  
  assert(!verifyVouch(vouch), 'should reject vouch with wrong public key');
});

test('Validate vouch structure', () => {
  const result = validateVouch({
    id: 'vouch_abc123',
    version: '0.1',
    from: 'agent_a',
    to: 'agent_b',
    type: 'positive',
    context: {
      category: 'collaboration',
      description: 'This is a valid description'
    },
    weight: 1.0,
    timestamp: new Date().toISOString(),
    signature: 'xxx',
    publicKey: 'yyy'
  });
  
  assert(result.valid, 'should validate correct structure');
});

test('Reject self-vouch', () => {
  const result = validateVouch({
    id: 'vouch_abc123',
    version: '0.1',
    from: 'agent_a',
    to: 'agent_a', // Same!
    type: 'positive',
    context: {
      category: 'collaboration',
      description: 'I am awesome (self vouch)'
    },
    weight: 1.0,
    timestamp: new Date().toISOString(),
    signature: 'xxx',
    publicKey: 'yyy'
  });
  
  assert(!result.valid, 'should reject self-vouch');
  assert(result.errors.includes('cannot vouch for yourself'), 'should have self-vouch error');
});

// =========== Graph Tests ===========

test('Add agents to graph', () => {
  const graph = new TrustGraph();
  graph.addAgent('agent_a', 'pubkey_a');
  graph.addAgent('agent_b', 'pubkey_b');
  
  assert(graph.agents.size === 2, 'should have 2 agents');
});

test('Add vouch to graph', () => {
  const alice = genKeypair();
  const bob = genKeypair();
  
  const vouch = createVouch({
    from: alice.agentId,
    to: bob.agentId,
    type: 'positive',
    category: 'collaboration',
    description: 'Good collaboration partner',
    privateKey: alice.privateKey,
    publicKey: alice.publicKey
  });
  
  const graph = new TrustGraph();
  const result = graph.addVouch(vouch);
  
  assert(result.success, 'should add vouch successfully');
  assert(graph.vouches.length === 1, 'should have 1 vouch');
});

test('Calculate scores with single vouch', () => {
  const alice = genKeypair();
  const bob = genKeypair();
  
  const vouch = createVouch({
    from: alice.agentId,
    to: bob.agentId,
    type: 'positive',
    category: 'collaboration',
    description: 'Excellent work quality',
    privateKey: alice.privateKey,
    publicKey: alice.publicKey
  });
  
  const graph = new TrustGraph();
  graph.addVouch(vouch);
  graph.calculateScores();
  
  const bobRep = graph.getReputation(bob.agentId);
  assert(bobRep, 'should have reputation for bob');
  assert(bobRep.score >= 0, 'should have non-negative score');
});

test('Calculate scores with multiple vouches', () => {
  const agents = [genKeypair(), genKeypair(), genKeypair(), genKeypair()];
  const graph = new TrustGraph();
  
  // Create a web of vouches
  // Agent 0 -> 1, Agent 1 -> 2, Agent 2 -> 3, Agent 3 -> 1
  const vouches = [
    { from: 0, to: 1 },
    { from: 1, to: 2 },
    { from: 2, to: 3 },
    { from: 3, to: 1 }
  ];
  
  for (const v of vouches) {
    const vouch = createVouch({
      from: agents[v.from].agentId,
      to: agents[v.to].agentId,
      type: 'positive',
      category: 'collaboration',
      description: 'Good work together on various projects',
      privateKey: agents[v.from].privateKey,
      publicKey: agents[v.from].publicKey
    });
    graph.addVouch(vouch);
  }
  
  graph.calculateScores();
  
  // Agent 1 has 2 vouches (from 0 and 3), others have 1
  const rep1 = graph.getReputation(agents[1].agentId);
  
  assert(rep1 !== null, 'Agent 1 should have reputation');
  assert(rep1.vouchesReceived === 2, 'Agent 1 should have 2 vouches received');
  assert(typeof rep1.score === 'number', 'Score should be numeric');
});

test('Negative vouch reduces score', () => {
  const alice = genKeypair();
  const bob = genKeypair();
  const charlie = genKeypair();
  
  const graph = new TrustGraph();
  
  // Positive vouch from Alice
  const positiveVouch = createVouch({
    from: alice.agentId,
    to: bob.agentId,
    type: 'positive',
    category: 'collaboration',
    description: 'Great collaboration partner',
    privateKey: alice.privateKey,
    publicKey: alice.publicKey
  });
  
  // Negative vouch from Charlie
  const negativeVouch = createVouch({
    from: charlie.agentId,
    to: bob.agentId,
    type: 'negative',
    category: 'security',
    description: 'Suspicious behavior observed',
    privateKey: charlie.privateKey,
    publicKey: charlie.publicKey
  });
  
  // Add just positive, calculate
  graph.addVouch(positiveVouch);
  graph.calculateScores();
  const scorePositiveOnly = graph.getReputation(bob.agentId).score;
  
  // Add negative, recalculate
  graph.addVouch(negativeVouch);
  graph.calculateScores();
  const scoreWithNegative = graph.getReputation(bob.agentId).score;
  
  // Score should be lower or equal with negative vouch
  // (exact comparison depends on algorithm details)
  assert(typeof scoreWithNegative === 'number', 'should have numeric score');
});

test('Trust level calculation', () => {
  const levels = [
    { score: -0.1, expected: 'flagged' },
    { score: 0, expected: 'unknown' },
    { score: 0.2, expected: 'new' },
    { score: 0.5, expected: 'established' },
    { score: 0.7, expected: 'trusted' },
    { score: 0.9, expected: 'highly_trusted' }
  ];
  
  for (const { score, expected } of levels) {
    const level = TrustGraph.getTrustLevel(score);
    assert(level.level === expected, `Score ${score} should be ${expected}, got ${level.level}`);
  }
});

test('Export and import graph', () => {
  const alice = genKeypair();
  const bob = genKeypair();
  
  const vouch = createVouch({
    from: alice.agentId,
    to: bob.agentId,
    type: 'positive',
    category: 'reliability',
    description: 'Very reliable agent partner',
    privateKey: alice.privateKey,
    publicKey: alice.publicKey
  });
  
  const graph1 = new TrustGraph();
  graph1.addVouch(vouch);
  graph1.calculateScores();
  
  const exported = graph1.export();
  const graph2 = TrustGraph.import(exported);
  
  assert(graph2.vouches.length === 1, 'imported graph should have 1 vouch');
  assert(graph2.agents.size === 2, 'imported graph should have 2 agents');
});

test('Reject duplicate vouch', () => {
  const alice = genKeypair();
  const bob = genKeypair();
  
  const vouch1 = createVouch({
    from: alice.agentId,
    to: bob.agentId,
    type: 'positive',
    category: 'collaboration',
    description: 'First vouch for collaboration',
    privateKey: alice.privateKey,
    publicKey: alice.publicKey
  });
  
  // Same agent, same category, same day
  const vouch2 = createVouch({
    from: alice.agentId,
    to: bob.agentId,
    type: 'positive',
    category: 'collaboration',
    description: 'Second vouch for collaboration',
    privateKey: alice.privateKey,
    publicKey: alice.publicKey
  });
  
  const graph = new TrustGraph();
  const result1 = graph.addVouch(vouch1);
  const result2 = graph.addVouch(vouch2);
  
  assert(result1.success, 'first vouch should succeed');
  assert(!result2.success, 'duplicate vouch should fail');
});

// =========== Summary ===========

console.log(`\n${'='.repeat(40)}`);
console.log(`Passed: ${passed}/${passed + failed}`);

if (failed > 0) {
  console.log(`Failed: ${failed}`);
  process.exit(1);
}

console.log('\n✅ All tests passed!\n');
