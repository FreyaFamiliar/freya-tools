/**
 * AgentProof Tests
 */

const {
  generateKeypair,
  deriveAgentId,
  createProof,
  ProofChain,
  verifyProof,
  verifyChain,
  verifyExportedChain,
  ActionTypes
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Tests

test('generateKeypair creates valid keys', () => {
  const keypair = generateKeypair();
  assert(keypair.publicKey, 'Should have publicKey');
  assert(keypair.privateKey, 'Should have privateKey');
  assert(keypair.publicKey.length > 40, 'publicKey should be reasonable length');
});

test('deriveAgentId is deterministic', () => {
  const keypair = generateKeypair();
  const id1 = deriveAgentId(keypair.publicKey);
  const id2 = deriveAgentId(keypair.publicKey);
  assert(id1 === id2, 'Same key should give same ID');
  assert(id1.startsWith('agent-'), 'ID should start with agent-');
  assert(id1.length === 22, 'ID should be agent- + 16 chars');
});

test('createProof creates signed proof', () => {
  const keypair = generateKeypair();
  const proof = createProof({
    action: 'test',
    data: { foo: 'bar' },
    agentId: deriveAgentId(keypair.publicKey)
  }, keypair.privateKey);
  
  assert(proof.version === '1.0', 'Should have version');
  assert(proof.action === 'test', 'Should have action');
  assert(proof.hash, 'Should have hash');
  assert(proof.signature, 'Should have signature');
  assert(proof.timestamp, 'Should have timestamp');
});

test('verifyProof validates authentic proof', () => {
  const keypair = generateKeypair();
  const proof = createProof({
    action: 'test',
    data: { foo: 'bar' },
    agentId: deriveAgentId(keypair.publicKey)
  }, keypair.privateKey);
  
  const result = verifyProof(proof, keypair.publicKey);
  assert(result.valid, 'Should be valid: ' + result.errors.join(', '));
});

test('verifyProof rejects tampered proof', () => {
  const keypair = generateKeypair();
  const proof = createProof({
    action: 'test',
    data: { foo: 'bar' },
    agentId: deriveAgentId(keypair.publicKey)
  }, keypair.privateKey);
  
  // Tamper with data
  proof.data.foo = 'tampered';
  
  const result = verifyProof(proof, keypair.publicKey);
  assert(!result.valid, 'Should be invalid');
  assert(result.errors.length > 0, 'Should have errors');
});

test('verifyProof rejects wrong key', () => {
  const keypair1 = generateKeypair();
  const keypair2 = generateKeypair();
  
  const proof = createProof({
    action: 'test',
    data: { foo: 'bar' },
    agentId: deriveAgentId(keypair1.publicKey)
  }, keypair1.privateKey);
  
  const result = verifyProof(proof, keypair2.publicKey);
  assert(!result.valid, 'Should be invalid with wrong key');
});

test('ProofChain creates linked proofs', () => {
  const keypair = generateKeypair();
  const chain = new ProofChain(keypair);
  
  const p1 = chain.add({ action: 'first', data: { n: 1 } });
  const p2 = chain.add({ action: 'second', data: { n: 2 } });
  const p3 = chain.add({ action: 'third', data: { n: 3 } });
  
  assert(p1.previousHash === null, 'First proof should have null previousHash');
  assert(p2.previousHash === p1.hash, 'Second should link to first');
  assert(p3.previousHash === p2.hash, 'Third should link to second');
  assert(chain.length() === 3, 'Should have 3 proofs');
});

test('verifyChain validates linked proofs', () => {
  const keypair = generateKeypair();
  const chain = new ProofChain(keypair);
  
  chain.add({ action: 'first', data: { n: 1 } });
  chain.add({ action: 'second', data: { n: 2 } });
  chain.add({ action: 'third', data: { n: 3 } });
  
  const result = verifyChain(chain.getAll(), keypair.publicKey);
  assert(result.valid, 'Chain should be valid: ' + result.errors.join(', '));
});

test('verifyChain detects broken chain', () => {
  const keypair = generateKeypair();
  const chain = new ProofChain(keypair);
  
  chain.add({ action: 'first', data: { n: 1 } });
  chain.add({ action: 'second', data: { n: 2 } });
  chain.add({ action: 'third', data: { n: 3 } });
  
  const proofs = chain.getAll();
  // Break the chain by modifying previousHash
  proofs[2].previousHash = 'broken';
  
  const result = verifyChain(proofs, keypair.publicKey);
  assert(!result.valid, 'Should detect broken chain');
});

test('export and verifyExportedChain roundtrip', () => {
  const keypair = generateKeypair();
  const chain = new ProofChain(keypair);
  
  chain.add({ action: ActionTypes.TOOL_CALL, data: { tool: 'test', result: 'ok' } });
  chain.add({ action: ActionTypes.DECISION, data: { description: 'test' } });
  
  const exported = chain.export();
  assert(exported.metadata, 'Should have metadata');
  assert(exported.metadata.publicKey, 'Should have publicKey in metadata');
  assert(exported.proofs.length === 2, 'Should have 2 proofs');
  
  const result = verifyExportedChain(exported);
  assert(result.valid, 'Exported chain should verify: ' + result.errors.join(', '));
});

test('ActionTypes contains expected types', () => {
  assert(ActionTypes.TOOL_CALL === 'tool_call', 'Should have tool_call');
  assert(ActionTypes.DECISION === 'decision', 'Should have decision');
  assert(ActionTypes.FILE_WRITE === 'file_write', 'Should have file_write');
});

// Summary
console.log('\n---');
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
