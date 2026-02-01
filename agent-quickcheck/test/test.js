/**
 * Tests for Agent QuickCheck
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create temp directory for tests
const testDir = path.join(os.tmpdir(), 'agent-quickcheck-test-' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

// Import AgentProof to create a test chain
const AgentProof = require('../../agentproof/src/index.js');

console.log('Running Agent QuickCheck tests...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
    failed++;
  }
}

// Create a test proof chain
test('Create test proof chain', () => {
  const keypair = AgentProof.generateKeypair();
  const chainPath = path.join(testDir, 'test-chain.json');
  const chain = new AgentProof.ProofChain(keypair, chainPath);
  
  chain.add({ action: 'test', data: { name: 'test1' } });
  chain.add({ action: 'test', data: { name: 'test2' } });
  chain.add({ action: 'test', data: { name: 'test3' } });
  
  // Export returns data, we need to write it ourselves
  const exported = chain.export();
  const exportPath = path.join(testDir, 'exported-chain.json');
  fs.writeFileSync(exportPath, JSON.stringify(exported, null, 2));
  assert(fs.existsSync(exportPath), 'Chain file should exist');
});

test('Verify exported chain', () => {
  const chainPath = path.join(testDir, 'exported-chain.json');
  const chain = JSON.parse(fs.readFileSync(chainPath, 'utf8'));
  
  const result = AgentProof.verifyExportedChain(chain);
  assert(result.valid, 'Chain should be valid');
  assert(result.errors.length === 0, 'Should have no errors');
});

test('Chain has correct metadata', () => {
  const chainPath = path.join(testDir, 'exported-chain.json');
  const chain = JSON.parse(fs.readFileSync(chainPath, 'utf8'));
  
  assert(chain.metadata, 'Should have metadata');
  assert(chain.metadata.agentId, 'Should have agentId');
  assert(chain.metadata.publicKey, 'Should have publicKey');
  assert(chain.proofs.length === 3, 'Should have 3 proofs');
});

test('Invalid chain is detected', () => {
  const chainPath = path.join(testDir, 'exported-chain.json');
  const chain = JSON.parse(fs.readFileSync(chainPath, 'utf8'));
  
  // Tamper with a proof
  chain.proofs[1].data.name = 'tampered';
  
  const result = AgentProof.verifyExportedChain(chain);
  assert(!result.valid, 'Tampered chain should be invalid');
});

// Cleanup
test('Cleanup', () => {
  fs.rmSync(testDir, { recursive: true });
  assert(!fs.existsSync(testDir), 'Test directory should be removed');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
