/**
 * AgentProof - Proof Creation
 * 
 * Creates cryptographically signed proofs of agent actions.
 * Each proof contains: action type, data, timestamp, and signature.
 */

const crypto = require('crypto');
const { privateKeyFromBase64, deriveAgentId } = require('./keys');

/**
 * Proof structure version
 */
const PROOF_VERSION = '1.0';

/**
 * Create a proof object (unsigned)
 * @param {object} params
 * @param {string} params.action - Action type (e.g., 'tool_call', 'message', 'file_write')
 * @param {object} params.data - Action-specific data
 * @param {string} params.agentId - Agent identifier
 * @param {string} [params.previousHash] - Hash of previous proof in chain
 * @param {object} [params.metadata] - Additional metadata
 * @returns {object} Unsigned proof object
 */
function createProofData({ action, data, agentId, previousHash = null, metadata = {} }) {
  return {
    version: PROOF_VERSION,
    action,
    data,
    agentId,
    previousHash,
    timestamp: new Date().toISOString(),
    metadata
  };
}

/**
 * Recursively sort object keys for canonical JSON
 * @param {any} obj
 * @returns {any}
 */
function sortKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

/**
 * Compute the canonical hash of proof data
 * @param {object} proofData - Proof data object (without signature)
 * @returns {string} SHA-256 hash (hex)
 */
function hashProofData(proofData) {
  // Canonical JSON serialization (recursively sorted keys)
  const sorted = sortKeys(proofData);
  const canonical = JSON.stringify(sorted);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Sign proof data with private key
 * @param {object} proofData - Proof data to sign
 * @param {string} privateKey - Base64-encoded Ed25519 private key
 * @returns {string} Base64-encoded signature
 */
function signProofData(proofData, privateKey) {
  const sorted = sortKeys(proofData);
  const canonical = JSON.stringify(sorted);
  const keyObject = privateKeyFromBase64(privateKey);
  const signature = crypto.sign(null, Buffer.from(canonical), keyObject);
  return signature.toString('base64');
}

/**
 * Create a complete signed proof
 * @param {object} params - Same as createProofData
 * @param {string} privateKey - Base64-encoded Ed25519 private key
 * @returns {object} Complete proof with hash and signature
 */
function createProof(params, privateKey) {
  const proofData = createProofData(params);
  const hash = hashProofData(proofData);
  const signature = signProofData(proofData, privateKey);
  
  return {
    ...proofData,
    hash,
    signature
  };
}

/**
 * Standard action types
 */
const ActionTypes = {
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  FILE_READ: 'file_read',
  FILE_WRITE: 'file_write',
  FILE_DELETE: 'file_delete',
  EXEC: 'exec',
  WEB_REQUEST: 'web_request',
  DECISION: 'decision',
  ERROR: 'error',
  CUSTOM: 'custom'
};

/**
 * Helper: Create proof for a tool call
 */
function createToolCallProof({ tool, params, result, duration_ms }, keypair, previousHash) {
  return createProof({
    action: ActionTypes.TOOL_CALL,
    data: { tool, params, result, duration_ms },
    agentId: deriveAgentId(keypair.publicKey),
    previousHash
  }, keypair.privateKey);
}

/**
 * Helper: Create proof for a file operation
 */
function createFileProof({ operation, path, hash, size }, keypair, previousHash) {
  return createProof({
    action: operation === 'write' ? ActionTypes.FILE_WRITE : 
            operation === 'read' ? ActionTypes.FILE_READ : ActionTypes.FILE_DELETE,
    data: { path, hash, size },
    agentId: deriveAgentId(keypair.publicKey),
    previousHash
  }, keypair.privateKey);
}

/**
 * Helper: Create proof for a decision/reasoning step
 */
function createDecisionProof({ description, inputs, outputs, reasoning }, keypair, previousHash) {
  return createProof({
    action: ActionTypes.DECISION,
    data: { description, inputs, outputs, reasoning },
    agentId: deriveAgentId(keypair.publicKey),
    previousHash
  }, keypair.privateKey);
}

module.exports = {
  PROOF_VERSION,
  sortKeys,
  createProofData,
  hashProofData,
  signProofData,
  createProof,
  ActionTypes,
  createToolCallProof,
  createFileProof,
  createDecisionProof
};
