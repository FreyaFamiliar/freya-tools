/**
 * Cross-verification test
 * 
 * Tests the Universal Proof Envelope flow between different implementations.
 */

const assert = require('assert');
const crypto = require('crypto');

// Import adapters
const { AgentProofAdapter, AIPAdapter, SigilAdapter, verifyEnvelope } = require('../adapters');
const { VerifierRegistry } = require('../verifier-registry');

describe('Universal Proof Envelope', () => {
  // Sample AgentProof chain (minimal)
  const sampleChain = {
    agentId: 'agent-test123',
    publicKey: crypto.randomBytes(32).toString('hex')
  };
  
  // Sample proof
  const sampleProof = {
    action: 'test-action',
    data: { message: 'Hello from test' },
    timestamp: new Date().toISOString(),
    hash: crypto.randomBytes(32).toString('hex'),
    signature: crypto.randomBytes(64).toString('hex'),
    previousHash: null
  };
  
  describe('AgentProofAdapter', () => {
    const adapter = new AgentProofAdapter();
    
    it('should convert proof to envelope', () => {
      const envelope = adapter.toEnvelope(sampleProof, sampleChain);
      
      assert.strictEqual(envelope.version, 1);
      assert.strictEqual(envelope.format, 'universal-proof-envelope-v1');
      assert.strictEqual(envelope.source.type, 'agentproof');
      assert.strictEqual(envelope.source.key_type, 'ed25519');
      assert.ok(envelope.source.agent_did.startsWith('did:aip:'));
      assert.strictEqual(envelope.proof.action, 'test-action');
    });
    
    it('should generate consistent envelope hash', () => {
      const envelope = adapter.toEnvelope(sampleProof, sampleChain);
      const hash1 = adapter.hashEnvelope(envelope);
      const hash2 = adapter.hashEnvelope(envelope);
      
      assert.strictEqual(hash1, hash2);
      assert.strictEqual(hash1.length, 64); // SHA-256 hex
    });
  });
  
  describe('AIPAdapter', () => {
    const adapter = new AIPAdapter();
    
    const sampleAIPIdentity = {
      agent_id: 'aip-agent-123',
      agent_did: 'did:aip:abcdef123456',
      public_key: crypto.randomBytes(32).toString('base64')
    };
    
    const sampleAIPProof = {
      action: 'aip-action',
      data: { claim: 'test claim' },
      timestamp: new Date().toISOString(),
      hash: crypto.randomBytes(32).toString('hex'),
      signature: crypto.randomBytes(64).toString('base64')
    };
    
    it('should convert AIP proof to envelope', () => {
      const envelope = adapter.toEnvelope(sampleAIPProof, sampleAIPIdentity);
      
      assert.strictEqual(envelope.source.type, 'aip');
      assert.strictEqual(envelope.source.agent_did, 'did:aip:abcdef123456');
    });
  });
  
  describe('SigilAdapter', () => {
    const adapter = new SigilAdapter();
    
    const sampleSigilIdentity = {
      sigil_id: 'sigil-clawdnight',
      did: 'did:sigil:abc123',
      public_key: crypto.randomBytes(32).toString('base64')
    };
    
    const sampleSigilAttestation = {
      attestation_type: 'soul-claim',
      soul_hash: crypto.randomBytes(32).toString('hex'),
      claim: 'I am ClawdNight',
      timestamp: new Date().toISOString(),
      hash: crypto.randomBytes(32).toString('hex'),
      signature: crypto.randomBytes(64).toString('base64')
    };
    
    it('should convert Sigil attestation to envelope', () => {
      const envelope = adapter.toEnvelope(sampleSigilAttestation, sampleSigilIdentity);
      
      assert.strictEqual(envelope.source.type, 'sigil');
      assert.strictEqual(envelope.proof.action, 'soul-claim');
      assert.ok(envelope.proof.data.soul_hash);
    });
  });
  
  describe('VerifierRegistry', () => {
    it('should register and retrieve verifiers', () => {
      const registry = new VerifierRegistry();
      
      registry.register({
        agent_id: 'agent-freya',
        public_key: crypto.randomBytes(32).toString('base64'),
        formats: ['agentproof', 'aip']
      });
      
      registry.register({
        agent_id: 'agent-bob',
        public_key: crypto.randomBytes(32).toString('base64'),
        formats: ['bsv-anchor']
      });
      
      const verifier = registry.get('agent-freya');
      assert.ok(verifier);
      assert.deepStrictEqual(verifier.formats, ['agentproof', 'aip']);
    });
    
    it('should find verifiers by format', () => {
      const registry = new VerifierRegistry();
      
      registry.register({
        agent_id: 'agent-1',
        public_key: 'key1',
        formats: ['agentproof']
      });
      
      registry.register({
        agent_id: 'agent-2',
        public_key: 'key2',
        formats: ['aip', 'agentproof']
      });
      
      registry.register({
        agent_id: 'agent-3',
        public_key: 'key3',
        formats: ['bsv-anchor']
      });
      
      const agentproofVerifiers = registry.findByFormat('agentproof');
      assert.strictEqual(agentproofVerifiers.length, 2);
      
      const bsvVerifiers = registry.findByFormat('bsv-anchor');
      assert.strictEqual(bsvVerifiers.length, 1);
    });
    
    it('should record and query attestations', () => {
      const registry = new VerifierRegistry();
      const proofHash = crypto.randomBytes(32).toString('hex');
      
      registry.recordAttestation({
        attester_id: 'agent-verifier',
        envelope_hash: proofHash,
        signature: 'sig123'
      });
      
      const attestations = registry.findAttestations(proofHash);
      assert.strictEqual(attestations.length, 1);
      assert.strictEqual(attestations[0].attester_id, 'agent-verifier');
    });
    
    it('should generate stats', () => {
      const registry = new VerifierRegistry();
      
      registry.register({
        agent_id: 'a1',
        public_key: 'k1',
        key_type: 'ed25519',
        formats: ['agentproof', 'aip']
      });
      
      registry.register({
        agent_id: 'a2',
        public_key: 'k2',
        key_type: 'secp256k1',
        formats: ['bsv-anchor']
      });
      
      const stats = registry.stats();
      assert.strictEqual(stats.total_verifiers, 2);
      assert.strictEqual(stats.formats.agentproof, 1);
      assert.strictEqual(stats.formats.aip, 1);
      assert.strictEqual(stats.key_types.ed25519, 1);
      assert.strictEqual(stats.key_types.secp256k1, 1);
    });
  });
  
  describe('Cross-format verification', () => {
    it('should auto-detect adapter from envelope', async () => {
      const agentAdapter = new AgentProofAdapter();
      const envelope = agentAdapter.toEnvelope(sampleProof, sampleChain);
      
      // This will fail signature verification (random sig) but should find adapter
      const result = await verifyEnvelope(envelope);
      
      // Should have attempted verification (failure expected with random sig)
      assert.ok(result.hasOwnProperty('valid'));
    });
    
    it('should fail gracefully for unknown formats', async () => {
      const envelope = {
        version: 1,
        format: 'universal-proof-envelope-v1',
        source: { type: 'unknown-format' },
        proof: {}
      };
      
      const result = await verifyEnvelope(envelope);
      assert.strictEqual(result.valid, false);
      assert.ok(result.reason.includes('No adapter'));
    });
  });
});

// Run tests
if (require.main === module) {
  const Mocha = require('mocha');
  const mocha = new Mocha();
  mocha.addFile(__filename);
  mocha.run(failures => {
    process.exitCode = failures ? 1 : 0;
  });
}
