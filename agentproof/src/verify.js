/**
 * AgentProof - Verification
 * 
 * Verifies proofs and proof chains.
 * Anyone with the public key can verify that proofs are authentic.
 */

const crypto = require('crypto');
const { publicKeyFromBase64, deriveAgentId } = require('./keys');
const { hashProofData, sortKeys } = require('./proof');

/**
 * Verification result
 * @typedef {object} VerificationResult
 * @property {boolean} valid - Overall validity
 * @property {string[]} errors - List of errors found
 * @property {string[]} warnings - List of warnings
 */

/**
 * Verify a single proof's signature
 * @param {object} proof - Proof to verify
 * @param {string} publicKey - Base64-encoded public key
 * @returns {boolean}
 */
function verifySignature(proof, publicKey) {
  try {
    // Reconstruct proof data (everything except hash and signature)
    const proofData = {
      version: proof.version,
      action: proof.action,
      data: proof.data,
      agentId: proof.agentId,
      previousHash: proof.previousHash,
      timestamp: proof.timestamp,
      metadata: proof.metadata
    };
    
    const sorted = sortKeys(proofData);
    const canonical = JSON.stringify(sorted);
    const keyObject = publicKeyFromBase64(publicKey);
    const signature = Buffer.from(proof.signature, 'base64');
    
    return crypto.verify(null, Buffer.from(canonical), keyObject, signature);
  } catch (error) {
    return false;
  }
}

/**
 * Verify a proof's hash
 * @param {object} proof - Proof to verify
 * @returns {boolean}
 */
function verifyHash(proof) {
  const proofData = {
    version: proof.version,
    action: proof.action,
    data: proof.data,
    agentId: proof.agentId,
    previousHash: proof.previousHash,
    timestamp: proof.timestamp,
    metadata: proof.metadata
  };
  
  const computedHash = hashProofData(proofData);
  return computedHash === proof.hash;
}

/**
 * Verify agent ID matches public key
 * @param {object} proof - Proof to verify
 * @param {string} publicKey - Base64-encoded public key
 * @returns {boolean}
 */
function verifyAgentId(proof, publicKey) {
  return proof.agentId === deriveAgentId(publicKey);
}

/**
 * Fully verify a single proof
 * @param {object} proof - Proof to verify
 * @param {string} publicKey - Base64-encoded public key
 * @returns {VerificationResult}
 */
function verifyProof(proof, publicKey) {
  const errors = [];
  const warnings = [];
  
  // Check required fields
  const required = ['version', 'action', 'data', 'agentId', 'timestamp', 'hash', 'signature'];
  for (const field of required) {
    if (proof[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }
  
  // Verify agent ID
  if (!verifyAgentId(proof, publicKey)) {
    errors.push('Agent ID does not match public key');
  }
  
  // Verify hash
  if (!verifyHash(proof)) {
    errors.push('Hash verification failed - proof data may be tampered');
  }
  
  // Verify signature
  if (!verifySignature(proof, publicKey)) {
    errors.push('Signature verification failed - proof is not authentic');
  }
  
  // Check timestamp sanity
  const proofTime = new Date(proof.timestamp).getTime();
  const now = Date.now();
  if (proofTime > now + 60000) { // 1 minute tolerance for clock skew
    warnings.push('Proof timestamp is in the future');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Verify a chain of proofs
 * @param {object[]} proofs - Array of proofs in order
 * @param {string} publicKey - Base64-encoded public key
 * @returns {VerificationResult}
 */
function verifyChain(proofs, publicKey) {
  const errors = [];
  const warnings = [];
  
  if (proofs.length === 0) {
    return { valid: true, errors, warnings: ['Empty chain'] };
  }
  
  // Verify each proof
  for (let i = 0; i < proofs.length; i++) {
    const proof = proofs[i];
    const result = verifyProof(proof, publicKey);
    
    if (!result.valid) {
      errors.push(`Proof ${i}: ${result.errors.join(', ')}`);
    }
    if (result.warnings.length > 0) {
      warnings.push(`Proof ${i}: ${result.warnings.join(', ')}`);
    }
  }
  
  // Verify chain linkage
  if (proofs[0].previousHash !== null) {
    warnings.push('First proof has non-null previousHash (may be partial chain)');
  }
  
  for (let i = 1; i < proofs.length; i++) {
    const prev = proofs[i - 1];
    const curr = proofs[i];
    
    if (curr.previousHash !== prev.hash) {
      errors.push(`Chain break at proof ${i}: previousHash doesn't match previous proof's hash`);
    }
    
    // Check temporal ordering
    const prevTime = new Date(prev.timestamp).getTime();
    const currTime = new Date(curr.timestamp).getTime();
    if (currTime < prevTime - 1000) { // 1 second tolerance
      warnings.push(`Proof ${i} has earlier timestamp than proof ${i-1}`);
    }
  }
  
  // Verify consistent agent ID
  const agentIds = new Set(proofs.map(p => p.agentId));
  if (agentIds.size > 1) {
    errors.push('Chain contains proofs from multiple agents');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Verify a chain from exported data
 * @param {object} exportedChain - { metadata, proofs }
 * @returns {VerificationResult}
 */
function verifyExportedChain(exportedChain) {
  if (!exportedChain.metadata?.publicKey) {
    return {
      valid: false,
      errors: ['Missing public key in chain metadata'],
      warnings: []
    };
  }
  
  return verifyChain(exportedChain.proofs, exportedChain.metadata.publicKey);
}

/**
 * Quick validity check (no detailed errors)
 * @param {object} proof - Proof to check
 * @param {string} publicKey - Base64-encoded public key
 * @returns {boolean}
 */
function isValid(proof, publicKey) {
  return verifyProof(proof, publicKey).valid;
}

/**
 * Quick chain validity check
 * @param {object[]} proofs - Chain to check
 * @param {string} publicKey - Base64-encoded public key
 * @returns {boolean}
 */
function isChainValid(proofs, publicKey) {
  return verifyChain(proofs, publicKey).valid;
}

module.exports = {
  verifySignature,
  verifyHash,
  verifyAgentId,
  verifyProof,
  verifyChain,
  verifyExportedChain,
  isValid,
  isChainValid
};
