/**
 * AgentProof - Chain Management
 * 
 * Manages chains of proofs linked by hashes.
 * Each proof references the previous proof's hash, creating an
 * immutable audit trail of agent actions.
 */

const fs = require('fs');
const path = require('path');
const { createProof, hashProofData } = require('./proof');
const { deriveAgentId } = require('./keys');

/**
 * Chain class for managing proof sequences
 */
class ProofChain {
  /**
   * @param {object} keypair - { publicKey, privateKey }
   * @param {string} [storePath] - Optional path to persist chain
   */
  constructor(keypair, storePath = null) {
    this.keypair = keypair;
    this.agentId = deriveAgentId(keypair.publicKey);
    this.storePath = storePath;
    this.proofs = [];
    this.metadata = {
      created: new Date().toISOString(),
      agentId: this.agentId,
      publicKey: keypair.publicKey
    };
    
    if (storePath && fs.existsSync(storePath)) {
      this.load();
    }
  }
  
  /**
   * Get the hash of the last proof (or null for first proof)
   * @returns {string|null}
   */
  getLastHash() {
    if (this.proofs.length === 0) return null;
    return this.proofs[this.proofs.length - 1].hash;
  }
  
  /**
   * Add a new proof to the chain
   * @param {object} params
   * @param {string} params.action - Action type
   * @param {object} params.data - Action data
   * @param {object} [params.metadata] - Additional metadata
   * @returns {object} The created proof
   */
  add({ action, data, metadata = {} }) {
    const proof = createProof({
      action,
      data,
      agentId: this.agentId,
      previousHash: this.getLastHash(),
      metadata
    }, this.keypair.privateKey);
    
    this.proofs.push(proof);
    
    if (this.storePath) {
      this.save();
    }
    
    return proof;
  }
  
  /**
   * Get chain length
   * @returns {number}
   */
  length() {
    return this.proofs.length;
  }
  
  /**
   * Get all proofs
   * @returns {object[]}
   */
  getAll() {
    return [...this.proofs];
  }
  
  /**
   * Get proof by index
   * @param {number} index
   * @returns {object|null}
   */
  get(index) {
    return this.proofs[index] || null;
  }
  
  /**
   * Get proofs by action type
   * @param {string} action
   * @returns {object[]}
   */
  getByAction(action) {
    return this.proofs.filter(p => p.action === action);
  }
  
  /**
   * Get proofs in time range
   * @param {Date|string} start
   * @param {Date|string} end
   * @returns {object[]}
   */
  getByTimeRange(start, end) {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    return this.proofs.filter(p => {
      const t = new Date(p.timestamp).getTime();
      return t >= startTime && t <= endTime;
    });
  }
  
  /**
   * Save chain to file
   */
  save() {
    if (!this.storePath) {
      throw new Error('No store path configured');
    }
    
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const data = {
      metadata: this.metadata,
      proofs: this.proofs
    };
    
    fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2));
  }
  
  /**
   * Load chain from file
   */
  load() {
    if (!this.storePath || !fs.existsSync(this.storePath)) {
      return;
    }
    
    const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
    this.metadata = data.metadata || this.metadata;
    this.proofs = data.proofs || [];
  }
  
  /**
   * Export chain summary
   * @returns {object}
   */
  summary() {
    const actionCounts = {};
    for (const proof of this.proofs) {
      actionCounts[proof.action] = (actionCounts[proof.action] || 0) + 1;
    }
    
    return {
      agentId: this.agentId,
      publicKey: this.keypair.publicKey,
      proofCount: this.proofs.length,
      firstProof: this.proofs[0]?.timestamp || null,
      lastProof: this.proofs[this.proofs.length - 1]?.timestamp || null,
      actionCounts
    };
  }
  
  /**
   * Export chain for sharing (proofs + metadata, no private key)
   * @returns {object}
   */
  export() {
    return {
      metadata: this.metadata,
      proofs: this.proofs
    };
  }
  
  /**
   * Import chain from exported data (for verification)
   * @param {object} data - Exported chain data
   * @returns {ProofChain}
   */
  static fromExport(data) {
    const chain = new ProofChain({ 
      publicKey: data.metadata.publicKey, 
      privateKey: null // No private key for imported chains
    });
    chain.metadata = data.metadata;
    chain.proofs = data.proofs;
    return chain;
  }
}

module.exports = { ProofChain };
