/**
 * AgentReputation - Vouch creation and verification
 * 
 * Vouches are cryptographically signed statements from one agent about another.
 */

const crypto = require('crypto');

// Valid vouch types
const VOUCH_TYPES = ['positive', 'negative'];

// Valid categories
const VOUCH_CATEGORIES = [
  'collaboration',
  'code_review',
  'task_completion',
  'reliability',
  'honesty',
  'security',
  'other'
];

/**
 * Create a new vouch
 * 
 * @param {Object} params
 * @param {string} params.from - Vouching agent ID
 * @param {string} params.to - Agent being vouched for
 * @param {string} params.type - 'positive' or 'negative'
 * @param {string} params.category - Category of vouch
 * @param {string} params.description - Human-readable description
 * @param {string} [params.evidence] - AgentProof hash as evidence
 * @param {number} [params.weight] - Weight (0.1 to 2.0, default 1.0)
 * @param {Buffer} params.privateKey - Ed25519 private key
 * @param {Buffer} params.publicKey - Ed25519 public key
 * @returns {Object} Signed vouch
 */
function createVouch({ from, to, type, category, description, evidence = null, weight = 1.0, privateKey, publicKey }) {
  // Validate inputs
  if (!from || !to) {
    throw new Error('from and to are required');
  }
  
  if (!VOUCH_TYPES.includes(type)) {
    throw new Error(`type must be one of: ${VOUCH_TYPES.join(', ')}`);
  }
  
  if (!VOUCH_CATEGORIES.includes(category)) {
    throw new Error(`category must be one of: ${VOUCH_CATEGORIES.join(', ')}`);
  }
  
  if (!description || description.length < 10) {
    throw new Error('description must be at least 10 characters');
  }
  
  // Clamp weight
  weight = Math.max(0.1, Math.min(2.0, weight));
  
  // Create vouch
  const vouch = {
    id: `vouch_${crypto.randomBytes(12).toString('hex')}`,
    version: '0.1',
    from,
    to,
    type,
    context: {
      category,
      description,
      evidence
    },
    weight,
    timestamp: new Date().toISOString()
  };
  
  // Sign the vouch
  const payload = canonicalJson(vouch);
  const signature = crypto.sign(null, Buffer.from(payload), privateKey);
  
  vouch.signature = signature.toString('base64');
  vouch.publicKey = publicKey.toString('base64');
  
  return vouch;
}

/**
 * Verify a vouch's signature
 * 
 * @param {Object} vouch - Vouch to verify
 * @returns {boolean} True if signature is valid
 */
function verifyVouch(vouch) {
  try {
    // Extract signature and public key
    const { signature, publicKey, ...vouchData } = vouch;
    
    if (!signature || !publicKey) {
      return false;
    }
    
    // Reconstruct payload
    const payload = canonicalJson(vouchData);
    
    // Recreate public key object from DER format
    const pubKeyBuffer = Buffer.from(publicKey, 'base64');
    const pubKeyObj = crypto.createPublicKey({
      key: pubKeyBuffer,
      format: 'der',
      type: 'spki'
    });
    
    // Verify signature
    const isValid = crypto.verify(
      null,
      Buffer.from(payload),
      pubKeyObj,
      Buffer.from(signature, 'base64')
    );
    
    return isValid;
  } catch (err) {
    return false;
  }
}

/**
 * Validate vouch structure (without signature verification)
 * 
 * @param {Object} vouch - Vouch to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateVouch(vouch) {
  const errors = [];
  
  if (!vouch.id || !vouch.id.startsWith('vouch_')) {
    errors.push('invalid or missing id');
  }
  
  if (vouch.version !== '0.1') {
    errors.push('unsupported version');
  }
  
  if (!vouch.from || typeof vouch.from !== 'string') {
    errors.push('missing or invalid from');
  }
  
  if (!vouch.to || typeof vouch.to !== 'string') {
    errors.push('missing or invalid to');
  }
  
  if (vouch.from === vouch.to) {
    errors.push('cannot vouch for yourself');
  }
  
  if (!VOUCH_TYPES.includes(vouch.type)) {
    errors.push(`invalid type: ${vouch.type}`);
  }
  
  if (!vouch.context || typeof vouch.context !== 'object') {
    errors.push('missing or invalid context');
  } else {
    if (!VOUCH_CATEGORIES.includes(vouch.context.category)) {
      errors.push(`invalid category: ${vouch.context.category}`);
    }
    if (!vouch.context.description || vouch.context.description.length < 10) {
      errors.push('description must be at least 10 characters');
    }
  }
  
  if (typeof vouch.weight !== 'number' || vouch.weight < 0.1 || vouch.weight > 2.0) {
    errors.push('weight must be between 0.1 and 2.0');
  }
  
  if (!vouch.timestamp || isNaN(new Date(vouch.timestamp).getTime())) {
    errors.push('invalid or missing timestamp');
  }
  
  if (!vouch.signature || !vouch.publicKey) {
    errors.push('missing signature or publicKey');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Canonical JSON serialization (deterministic key ordering)
 */
function canonicalJson(obj) {
  return JSON.stringify(sortKeys(obj));
}

function sortKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

module.exports = {
  createVouch,
  verifyVouch,
  validateVouch,
  VOUCH_TYPES,
  VOUCH_CATEGORIES
};
