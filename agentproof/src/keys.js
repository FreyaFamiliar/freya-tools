/**
 * AgentProof - Key Management
 * 
 * Handles Ed25519 keypair generation and storage.
 * The public key becomes the agent's verifiable identity.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Generate a new Ed25519 keypair
 * @returns {{ publicKey: string, privateKey: string }} Base64-encoded keys
 */
function generateKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' }
  });
  
  return {
    publicKey: publicKey.toString('base64'),
    privateKey: privateKey.toString('base64')
  };
}

/**
 * Load keypair from file
 * @param {string} filepath - Path to keypair JSON file
 * @returns {{ publicKey: string, privateKey: string }}
 */
function loadKeypair(filepath) {
  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  if (!data.publicKey || !data.privateKey) {
    throw new Error('Invalid keypair file: missing publicKey or privateKey');
  }
  return data;
}

/**
 * Save keypair to file
 * @param {{ publicKey: string, privateKey: string }} keypair
 * @param {string} filepath - Path to save
 */
function saveKeypair(keypair, filepath) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, JSON.stringify(keypair, null, 2), { mode: 0o600 });
}

/**
 * Convert base64 public key to crypto.KeyObject
 * @param {string} base64Key
 * @returns {crypto.KeyObject}
 */
function publicKeyFromBase64(base64Key) {
  return crypto.createPublicKey({
    key: Buffer.from(base64Key, 'base64'),
    format: 'der',
    type: 'spki'
  });
}

/**
 * Convert base64 private key to crypto.KeyObject
 * @param {string} base64Key
 * @returns {crypto.KeyObject}
 */
function privateKeyFromBase64(base64Key) {
  return crypto.createPrivateKey({
    key: Buffer.from(base64Key, 'base64'),
    format: 'der',
    type: 'pkcs8'
  });
}

/**
 * Derive agent ID from public key (short hash for readability)
 * @param {string} publicKey - Base64-encoded public key
 * @returns {string} Agent ID (first 16 chars of SHA-256 hash)
 */
function deriveAgentId(publicKey) {
  const hash = crypto.createHash('sha256').update(publicKey).digest('hex');
  return 'agent-' + hash.slice(0, 16);
}

module.exports = {
  generateKeypair,
  loadKeypair,
  saveKeypair,
  publicKeyFromBase64,
  privateKeyFromBase64,
  deriveAgentId
};
