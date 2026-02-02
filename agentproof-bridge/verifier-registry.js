/**
 * Verifier Registry
 * 
 * Decentralized registry where agents can:
 * - Register their verification capabilities
 * - Discover other verifiers
 * - Query attestation history
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class VerifierRegistry {
  constructor(storagePath = null) {
    this.verifiers = new Map();
    this.attestations = [];
    this.storagePath = storagePath;
    
    if (storagePath && fs.existsSync(storagePath)) {
      this.load();
    }
  }
  
  /**
   * Register a verifier with their capabilities
   */
  register(verifier) {
    const required = ['agent_id', 'public_key', 'formats'];
    for (const field of required) {
      if (!verifier[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    const entry = {
      agent_id: verifier.agent_id,
      agent_did: verifier.agent_did || null,
      public_key: verifier.public_key,
      key_type: verifier.key_type || 'ed25519',
      formats: verifier.formats, // Array of supported format types
      endpoint: verifier.endpoint || null,
      metadata: verifier.metadata || {},
      registered_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    };
    
    this.verifiers.set(verifier.agent_id, entry);
    this.save();
    
    return entry;
  }
  
  /**
   * Update verifier's last_seen timestamp
   */
  heartbeat(agentId) {
    const verifier = this.verifiers.get(agentId);
    if (verifier) {
      verifier.last_seen = new Date().toISOString();
      this.save();
    }
    return verifier;
  }
  
  /**
   * Find verifiers by format support
   */
  findByFormat(format) {
    const results = [];
    for (const [_, verifier] of this.verifiers) {
      if (verifier.formats.includes(format)) {
        results.push(verifier);
      }
    }
    return results;
  }
  
  /**
   * Find verifiers by key type
   */
  findByKeyType(keyType) {
    const results = [];
    for (const [_, verifier] of this.verifiers) {
      if (verifier.key_type === keyType) {
        results.push(verifier);
      }
    }
    return results;
  }
  
  /**
   * Get verifier by agent ID
   */
  get(agentId) {
    return this.verifiers.get(agentId) || null;
  }
  
  /**
   * List all verifiers
   */
  list(options = {}) {
    const { format, keyType, limit = 100, activeWithinHours } = options;
    let results = Array.from(this.verifiers.values());
    
    if (format) {
      results = results.filter(v => v.formats.includes(format));
    }
    
    if (keyType) {
      results = results.filter(v => v.key_type === keyType);
    }
    
    if (activeWithinHours) {
      const cutoff = new Date(Date.now() - activeWithinHours * 60 * 60 * 1000);
      results = results.filter(v => new Date(v.last_seen) >= cutoff);
    }
    
    return results.slice(0, limit);
  }
  
  /**
   * Record an attestation
   */
  recordAttestation(attestation) {
    const entry = {
      id: crypto.randomUUID(),
      ...attestation,
      recorded_at: new Date().toISOString()
    };
    this.attestations.push(entry);
    this.save();
    return entry;
  }
  
  /**
   * Find attestations for a proof hash
   */
  findAttestations(proofHash) {
    return this.attestations.filter(a => a.envelope_hash === proofHash);
  }
  
  /**
   * Get attestations by verifier
   */
  attestationsByVerifier(agentId) {
    return this.attestations.filter(a => a.attester_id === agentId);
  }
  
  /**
   * Get stats
   */
  stats() {
    const formatCounts = {};
    const keyTypeCounts = {};
    
    for (const [_, v] of this.verifiers) {
      for (const f of v.formats) {
        formatCounts[f] = (formatCounts[f] || 0) + 1;
      }
      keyTypeCounts[v.key_type] = (keyTypeCounts[v.key_type] || 0) + 1;
    }
    
    return {
      total_verifiers: this.verifiers.size,
      total_attestations: this.attestations.length,
      formats: formatCounts,
      key_types: keyTypeCounts
    };
  }
  
  /**
   * Save to disk
   */
  save() {
    if (!this.storagePath) return;
    
    const data = {
      version: 1,
      verifiers: Object.fromEntries(this.verifiers),
      attestations: this.attestations,
      saved_at: new Date().toISOString()
    };
    
    fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2));
  }
  
  /**
   * Load from disk
   */
  load() {
    if (!this.storagePath || !fs.existsSync(this.storagePath)) return;
    
    try {
      const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf-8'));
      this.verifiers = new Map(Object.entries(data.verifiers || {}));
      this.attestations = data.attestations || [];
    } catch (e) {
      console.error('Failed to load registry:', e.message);
    }
  }
  
  /**
   * Export for federation/sharing
   */
  export() {
    return {
      version: 1,
      verifiers: Object.fromEntries(this.verifiers),
      attestation_count: this.attestations.length,
      exported_at: new Date().toISOString()
    };
  }
  
  /**
   * Import from another registry (merge)
   */
  import(registryData) {
    let imported = 0;
    for (const [id, verifier] of Object.entries(registryData.verifiers || {})) {
      if (!this.verifiers.has(id)) {
        this.verifiers.set(id, verifier);
        imported++;
      }
    }
    this.save();
    return imported;
  }
}

module.exports = { VerifierRegistry };
