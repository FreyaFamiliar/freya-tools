/**
 * AgentProof-AIP Bridge
 * 
 * Provides compatibility layer between AgentProof and AIP (Agent Identity Protocol).
 * Allows AgentProof users to generate AIP-compatible DID documents and vice versa.
 */

const crypto = require('crypto');

/**
 * Convert AgentProof hex-encoded public key to AIP base64 format
 */
function hexToBase64(hex) {
  return Buffer.from(hex, 'hex').toString('base64');
}

/**
 * Convert AIP base64-encoded public key to AgentProof hex format
 */
function base64ToHex(base64) {
  return Buffer.from(base64, 'base64').toString('hex');
}

/**
 * Derive AIP-style DID from AgentProof public key
 * AIP format: did:aip:<sha256(pubkey)[:32]>
 */
function agentProofKeyToAIPDid(publicKeyHex) {
  const pubKeyBytes = Buffer.from(publicKeyHex, 'hex');
  const hash = crypto.createHash('sha256').update(pubKeyBytes).digest('hex');
  return `did:aip:${hash.slice(0, 32)}`;
}

/**
 * Derive AgentProof-style agent ID from public key
 * AgentProof format: agent-<sha256(pubkey)[:16]>
 */
function publicKeyToAgentId(publicKeyHex) {
  const pubKeyBytes = Buffer.from(publicKeyHex, 'hex');
  const hash = crypto.createHash('sha256').update(pubKeyBytes).digest('hex');
  return `agent-${hash.slice(0, 16)}`;
}

/**
 * Generate W3C DID Document from AgentProof identity
 */
function createDIDDocument(agentProofChain) {
  const { agentId, publicKey } = agentProofChain;
  const did = agentProofKeyToAIPDid(publicKey);
  const publicKeyBase64 = hexToBase64(publicKey);
  
  return {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1"
    ],
    "id": did,
    "controller": did,
    "alsoKnownAs": [`agentproof:${agentId}`],
    "verificationMethod": [{
      "id": `${did}#key-1`,
      "type": "Ed25519VerificationKey2020",
      "controller": did,
      "publicKeyBase64": publicKeyBase64
    }],
    "authentication": [`${did}#key-1`],
    "assertionMethod": [`${did}#key-1`],
    "service": [{
      "id": `${did}#agentproof`,
      "type": "AgentProofChain",
      "serviceEndpoint": {
        "agentId": agentId,
        "proofCount": agentProofChain.proofs?.length || 0
      }
    }]
  };
}

/**
 * Create challenge for identity verification (AIP-compatible)
 */
function createChallenge() {
  const nonce = crypto.randomBytes(32).toString('hex');
  const timestamp = new Date().toISOString();
  return {
    type: "agent-trust-challenge-v1",
    nonce,
    timestamp,
    expires_seconds: 300
  };
}

/**
 * Sign a challenge response (returns base64 signature for AIP compatibility)
 */
async function signChallenge(challenge, privateKeyHex) {
  // Dynamic import for ES module
  const { sign } = await import('@noble/ed25519');
  
  const challengeBytes = Buffer.from(JSON.stringify(challenge, Object.keys(challenge).sort()));
  const privateKey = Buffer.from(privateKeyHex, 'hex');
  const signature = await sign(challengeBytes, privateKey);
  
  return {
    type: "agent-trust-response-v1",
    challenge_hash: crypto.createHash('sha256').update(challengeBytes).digest('hex'),
    signature: Buffer.from(signature).toString('base64'),
    timestamp: new Date().toISOString()
  };
}

/**
 * Verify a challenge response
 */
async function verifyChallenge(challenge, response, publicKeyBase64) {
  const { verify } = await import('@noble/ed25519');
  
  const challengeBytes = Buffer.from(JSON.stringify(challenge, Object.keys(challenge).sort()));
  const expectedHash = crypto.createHash('sha256').update(challengeBytes).digest('hex');
  
  if (response.challenge_hash !== expectedHash) {
    return { valid: false, reason: 'Challenge hash mismatch' };
  }
  
  const publicKey = Buffer.from(publicKeyBase64, 'base64');
  const signature = Buffer.from(response.signature, 'base64');
  
  try {
    const valid = await verify(signature, challengeBytes, publicKey);
    return { valid, reason: valid ? null : 'Invalid signature' };
  } catch (e) {
    return { valid: false, reason: e.message };
  }
}

/**
 * Convert AgentProof chain to AIP-compatible format
 */
function convertChainToAIPFormat(agentProofChain) {
  const did = agentProofKeyToAIPDid(agentProofChain.publicKey);
  
  return {
    version: 1,
    agent_did: did,
    public_key: hexToBase64(agentProofChain.publicKey),
    proofs: agentProofChain.proofs.map(proof => ({
      version: 1,
      agent_did: did,
      action: proof.action,
      data: proof.data,
      timestamp: proof.timestamp,
      prev_hash: proof.previousHash || null,
      hash: proof.hash,
      signature: hexToBase64(proof.signature)
    }))
  };
}

// Import new cross-verification modules
const adapters = require('./adapters');
const { VerifierRegistry } = require('./verifier-registry');

module.exports = {
  // Original AIP bridge functions
  hexToBase64,
  base64ToHex,
  agentProofKeyToAIPDid,
  publicKeyToAgentId,
  createDIDDocument,
  createChallenge,
  signChallenge,
  verifyChallenge,
  convertChainToAIPFormat,
  
  // Universal Proof Envelope adapters
  adapters,
  getAdapter: adapters.getAdapter,
  listAdapters: adapters.listAdapters,
  verifyEnvelope: adapters.verifyEnvelope,
  
  // Verifier Registry
  VerifierRegistry
};
