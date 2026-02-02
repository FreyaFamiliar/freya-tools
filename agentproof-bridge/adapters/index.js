/**
 * Universal Proof Envelope Adapters
 * 
 * Each adapter can:
 * - toEnvelope: Convert native proof format to Universal Envelope
 * - verify: Verify a Universal Envelope signature
 * - attest: Add cross-verification attestation
 */

const crypto = require('crypto');

// Base adapter class
class BaseAdapter {
  constructor(type, keyType) {
    this.type = type;
    this.keyType = keyType;
  }
  
  // Override in subclasses
  toEnvelope(proof, identity) {
    throw new Error('toEnvelope not implemented');
  }
  
  async verify(envelope) {
    throw new Error('verify not implemented');
  }
  
  // Common envelope hash function
  hashEnvelope(envelope) {
    const canonical = JSON.stringify({
      source: envelope.source,
      proof: envelope.proof
    }, Object.keys(envelope).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }
  
  // Add attestation to envelope (requires private key)
  async attest(envelope, privateKey, attesterId, attesterDid) {
    const envelopeHash = this.hashEnvelope(envelope);
    const signature = await this.sign(envelopeHash, privateKey);
    
    const attestation = {
      attester_id: attesterId,
      attester_did: attesterDid,
      attester_source: this.type,
      envelope_hash: envelopeHash,
      timestamp: new Date().toISOString(),
      signature: signature
    };
    
    if (!envelope.attestations) {
      envelope.attestations = [];
    }
    envelope.attestations.push(attestation);
    
    return envelope;
  }
  
  // Override in subclasses
  async sign(data, privateKey) {
    throw new Error('sign not implemented');
  }
}

// AgentProof adapter (Ed25519)
class AgentProofAdapter extends BaseAdapter {
  constructor() {
    super('agentproof', 'ed25519');
  }
  
  toEnvelope(proof, chain) {
    const publicKeyBase64 = Buffer.from(chain.publicKey, 'hex').toString('base64');
    const pubKeyBytes = Buffer.from(chain.publicKey, 'hex');
    const hash = crypto.createHash('sha256').update(pubKeyBytes).digest('hex');
    const did = `did:aip:${hash.slice(0, 32)}`;
    
    return {
      version: 1,
      format: 'universal-proof-envelope-v1',
      source: {
        type: 'agentproof',
        agent_id: chain.agentId,
        agent_did: did,
        public_key: publicKeyBase64,
        key_type: 'ed25519'
      },
      proof: {
        action: proof.action,
        data: proof.data,
        timestamp: proof.timestamp,
        hash: proof.hash,
        signature: Buffer.from(proof.signature, 'hex').toString('base64'),
        prev_hash: proof.previousHash || null
      }
    };
  }
  
  async verify(envelope) {
    if (envelope.source.key_type !== 'ed25519') {
      return { valid: false, reason: 'AgentProof adapter only supports ed25519' };
    }
    
    try {
      const { verify } = await import('@noble/ed25519');
      
      // Reconstruct the signed content
      const content = this.canonicalize({
        action: envelope.proof.action,
        data: envelope.proof.data,
        timestamp: envelope.proof.timestamp,
        previousHash: envelope.proof.prev_hash
      });
      
      const contentHash = crypto.createHash('sha256').update(content).digest();
      const publicKey = Buffer.from(envelope.source.public_key, 'base64');
      const signature = Buffer.from(envelope.proof.signature, 'base64');
      
      const valid = await verify(signature, contentHash, publicKey);
      return { valid, reason: valid ? null : 'Signature verification failed' };
    } catch (e) {
      return { valid: false, reason: e.message };
    }
  }
  
  async sign(data, privateKeyHex) {
    const { sign } = await import('@noble/ed25519');
    const dataBytes = typeof data === 'string' ? Buffer.from(data, 'hex') : data;
    const privateKey = Buffer.from(privateKeyHex, 'hex');
    const signature = await sign(dataBytes, privateKey);
    return Buffer.from(signature).toString('base64');
  }
  
  canonicalize(obj) {
    return JSON.stringify(this.sortKeys(obj));
  }
  
  sortKeys(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortKeys(item));
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = this.sortKeys(obj[key]);
    }
    return sorted;
  }
}

// AIP adapter (Ed25519)
class AIPAdapter extends BaseAdapter {
  constructor() {
    super('aip', 'ed25519');
  }
  
  toEnvelope(aipProof, aipIdentity) {
    return {
      version: 1,
      format: 'universal-proof-envelope-v1',
      source: {
        type: 'aip',
        agent_id: aipIdentity.agent_id,
        agent_did: aipIdentity.agent_did,
        public_key: aipIdentity.public_key, // Already base64 in AIP
        key_type: 'ed25519'
      },
      proof: {
        action: aipProof.action,
        data: aipProof.data || {},
        timestamp: aipProof.timestamp,
        hash: aipProof.hash,
        signature: aipProof.signature, // Already base64 in AIP
        prev_hash: aipProof.prev_hash || null
      }
    };
  }
  
  async verify(envelope) {
    // Same as AgentProof for Ed25519
    if (envelope.source.key_type !== 'ed25519') {
      return { valid: false, reason: 'AIP adapter only supports ed25519' };
    }
    
    // Delegate to AgentProof verification (same crypto)
    const agentProofAdapter = new AgentProofAdapter();
    return agentProofAdapter.verify(envelope);
  }
  
  async sign(data, privateKeyHex) {
    const agentProofAdapter = new AgentProofAdapter();
    return agentProofAdapter.sign(data, privateKeyHex);
  }
}

// Sigil Protocol adapter (Ed25519, SOUL.md attestations)
class SigilAdapter extends BaseAdapter {
  constructor() {
    super('sigil', 'ed25519');
  }
  
  toEnvelope(sigilAttestation, sigilIdentity) {
    // Sigil uses SOUL.md attestations with Ed25519 signatures
    return {
      version: 1,
      format: 'universal-proof-envelope-v1',
      source: {
        type: 'sigil',
        agent_id: sigilIdentity.sigil_id,
        agent_did: sigilIdentity.did,
        public_key: sigilIdentity.public_key,
        key_type: 'ed25519'
      },
      proof: {
        action: sigilAttestation.attestation_type || 'attest',
        data: {
          soul_hash: sigilAttestation.soul_hash,
          claim: sigilAttestation.claim
        },
        timestamp: sigilAttestation.timestamp,
        hash: sigilAttestation.hash,
        signature: sigilAttestation.signature,
        prev_hash: sigilAttestation.prev_hash || null
      }
    };
  }
  
  async verify(envelope) {
    if (envelope.source.key_type !== 'ed25519') {
      return { valid: false, reason: 'Sigil adapter only supports ed25519' };
    }
    
    // Same Ed25519 verification as AgentProof
    const agentProofAdapter = new AgentProofAdapter();
    return agentProofAdapter.verify(envelope);
  }
  
  async sign(data, privateKeyHex) {
    const agentProofAdapter = new AgentProofAdapter();
    return agentProofAdapter.sign(data, privateKeyHex);
  }
}

// Adapter registry
const adapters = {
  agentproof: new AgentProofAdapter(),
  aip: new AIPAdapter(),
  sigil: new SigilAdapter()
};

function getAdapter(type) {
  return adapters[type] || null;
}

function listAdapters() {
  return Object.keys(adapters);
}

// Universal verify - auto-detect adapter from envelope
async function verifyEnvelope(envelope) {
  const adapter = getAdapter(envelope.source.type);
  if (!adapter) {
    return { valid: false, reason: `No adapter for type: ${envelope.source.type}` };
  }
  return adapter.verify(envelope);
}

module.exports = {
  BaseAdapter,
  AgentProofAdapter,
  AIPAdapter,
  SigilAdapter,
  getAdapter,
  listAdapters,
  verifyEnvelope
};
