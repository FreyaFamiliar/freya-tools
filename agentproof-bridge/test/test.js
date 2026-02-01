/**
 * Tests for AgentProof-AIP Bridge
 */

const assert = require('assert');
const bridge = require('../index');

console.log('Running AgentProof-AIP Bridge tests...\n');

// Test data - simulated AgentProof chain
const mockChain = {
  agentId: 'agent-a00f194b5590b2d7',
  publicKey: 'a00f194b5590b2d7e3f8c9d1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1',
  proofs: [
    {
      action: 'test',
      data: { foo: 'bar' },
      timestamp: '2026-02-01T12:00:00.000Z',
      previousHash: null,
      hash: '1234567890abcdef',
      signature: 'deadbeef' + '0'.repeat(120)
    }
  ]
};

// Test 1: Hex to Base64 conversion
console.log('Test 1: Hex to Base64 conversion');
const hex = 'deadbeef';
const base64 = bridge.hexToBase64(hex);
assert.strictEqual(base64, '3q2+7w==');
console.log('  ✅ Passed\n');

// Test 2: Base64 to Hex conversion
console.log('Test 2: Base64 to Hex conversion');
const backToHex = bridge.base64ToHex(base64);
assert.strictEqual(backToHex, hex);
console.log('  ✅ Passed\n');

// Test 3: AgentProof key to AIP DID
console.log('Test 3: AgentProof key to AIP DID');
const did = bridge.agentProofKeyToAIPDid(mockChain.publicKey);
assert(did.startsWith('did:aip:'));
assert.strictEqual(did.length, 8 + 32); // "did:aip:" + 32 hex chars
console.log(`  DID: ${did}`);
console.log('  ✅ Passed\n');

// Test 4: Create DID Document
console.log('Test 4: Create DID Document');
const didDoc = bridge.createDIDDocument(mockChain);
assert.strictEqual(didDoc['@context'][0], 'https://www.w3.org/ns/did/v1');
assert.strictEqual(didDoc.id, did);
assert(didDoc.verificationMethod[0].publicKeyBase64);
assert.strictEqual(didDoc.alsoKnownAs[0], `agentproof:${mockChain.agentId}`);
console.log('  ✅ Passed\n');

// Test 5: Create Challenge
console.log('Test 5: Create Challenge');
const challenge = bridge.createChallenge();
assert.strictEqual(challenge.type, 'agent-trust-challenge-v1');
assert.strictEqual(challenge.nonce.length, 64); // 32 bytes = 64 hex chars
assert(challenge.timestamp);
assert.strictEqual(challenge.expires_seconds, 300);
console.log('  ✅ Passed\n');

// Test 6: Convert chain to AIP format
console.log('Test 6: Convert chain to AIP format');
const aipChain = bridge.convertChainToAIPFormat(mockChain);
assert.strictEqual(aipChain.version, 1);
assert.strictEqual(aipChain.agent_did, did);
assert(aipChain.public_key); // base64
assert.strictEqual(aipChain.proofs.length, mockChain.proofs.length);
assert.strictEqual(aipChain.proofs[0].action, 'test');
console.log('  ✅ Passed\n');

// Test 7: Agent ID derivation
console.log('Test 7: Agent ID derivation');
const agentId = bridge.publicKeyToAgentId(mockChain.publicKey);
assert(agentId.startsWith('agent-'));
assert.strictEqual(agentId.length, 6 + 16); // "agent-" + 16 hex chars
console.log(`  Agent ID: ${agentId}`);
console.log('  ✅ Passed\n');

console.log('='.repeat(40));
console.log('All 7 tests passed! ✅');
