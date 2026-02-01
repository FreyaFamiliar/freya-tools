/**
 * AgentProtocol Signature - Message signing and verification
 * Uses Ed25519 (same as AgentProof)
 */

const crypto = require('crypto');
const { canonicalize, toCanonicalJson } = require('./message');

/**
 * Generate a new Ed25519 keypair
 */
function generateKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
  };
}

/**
 * Get agent ID from public key (first 16 bytes, base64)
 */
function getAgentId(publicKeyBase64) {
  const hash = crypto.createHash('sha256').update(publicKeyBase64).digest();
  return hash.slice(0, 16).toString('base64').replace(/[+/=]/g, c => 
    c === '+' ? '-' : c === '/' ? '_' : ''
  );
}

/**
 * Sign a message with private key
 */
function signMessage(message, privateKeyBase64) {
  // Remove any existing signature
  const { signature: _, ...msgWithoutSig } = message;
  
  // Create canonical JSON
  const canonical = toCanonicalJson(msgWithoutSig);
  
  // Import private key
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyBase64, 'base64'),
    format: 'der',
    type: 'pkcs8'
  });
  
  // Sign
  const sig = crypto.sign(null, Buffer.from(canonical), privateKey);
  
  return {
    ...message,
    signature: sig.toString('base64')
  };
}

/**
 * Verify a message signature
 */
function verifySignature(message, publicKeyBase64) {
  if (!message.signature) {
    return { valid: false, error: 'Message has no signature' };
  }
  
  try {
    // Remove signature for verification
    const { signature, ...msgWithoutSig } = message;
    
    // Create canonical JSON
    const canonical = toCanonicalJson(msgWithoutSig);
    
    // Import public key
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki'
    });
    
    // Verify
    const valid = crypto.verify(
      null,
      Buffer.from(canonical),
      publicKey,
      Buffer.from(signature, 'base64')
    );
    
    return { valid, error: valid ? null : 'Signature verification failed' };
  } catch (e) {
    return { valid: false, error: `Verification error: ${e.message}` };
  }
}

/**
 * Check if message is from claimed sender
 */
function verifySender(message, knownAgents) {
  const senderId = message.from?.agentId;
  if (!senderId) {
    return { valid: false, error: 'No sender agentId' };
  }
  
  const knownKey = knownAgents[senderId];
  if (!knownKey) {
    return { valid: false, error: `Unknown agent: ${senderId}` };
  }
  
  return verifySignature(message, knownKey);
}

module.exports = {
  generateKeypair,
  getAgentId,
  signMessage,
  verifySignature,
  verifySender
};
