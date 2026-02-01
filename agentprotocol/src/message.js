/**
 * AgentProtocol Message - Creation and parsing
 */

const crypto = require('crypto');

const PROTOCOL_VERSION = 'agentprotocol/0.1';

const MESSAGE_TYPES = ['hello', 'request', 'response', 'notify', 'error'];

const ERROR_CODES = {
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  UNKNOWN_AGENT: 'UNKNOWN_AGENT',
  CAPABILITY_NOT_SUPPORTED: 'CAPABILITY_NOT_SUPPORTED',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

/**
 * Create a new message
 */
function createMessage(options) {
  const {
    from,
    to,
    type,
    payload = {},
    metadata = {}
  } = options;

  if (!MESSAGE_TYPES.includes(type)) {
    throw new Error(`Invalid message type: ${type}. Valid types: ${MESSAGE_TYPES.join(', ')}`);
  }

  if (!from?.agentId) {
    throw new Error('Message must have from.agentId');
  }

  return {
    protocol: PROTOCOL_VERSION,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    from: {
      agentId: from.agentId,
      name: from.name,
      capabilities: from.capabilities || []
    },
    to: {
      agentId: to?.agentId || null,
      broadcast: to?.broadcast || false
    },
    type,
    payload,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {})
  };
}

/**
 * Create a hello message for handshake
 */
function createHello(from, to, features = []) {
  return createMessage({
    from,
    to,
    type: 'hello',
    payload: {
      version: '0.1',
      features
    }
  });
}

/**
 * Create a request message
 */
function createRequest(from, to, action, params = {}, timeout = 30000) {
  return createMessage({
    from,
    to,
    type: 'request',
    payload: {
      action,
      correlationId: crypto.randomUUID(),
      params,
      timeout
    }
  });
}

/**
 * Create a response message
 */
function createResponse(from, to, correlationId, result, status = 'success') {
  return createMessage({
    from,
    to,
    type: 'response',
    payload: {
      correlationId,
      status,
      result
    }
  });
}

/**
 * Create an error response
 */
function createError(from, to, correlationId, code, message, details = {}) {
  return createMessage({
    from,
    to,
    type: 'error',
    payload: {
      correlationId,
      code,
      message,
      details
    }
  });
}

/**
 * Create a notification message
 */
function createNotify(from, to, event, data = {}) {
  return createMessage({
    from,
    to,
    type: 'notify',
    payload: {
      event,
      data
    }
  });
}

/**
 * Validate a message structure
 */
function validateMessage(msg) {
  const errors = [];

  if (!msg.protocol?.startsWith('agentprotocol/')) {
    errors.push('Missing or invalid protocol field');
  }

  if (!msg.id) {
    errors.push('Missing message id');
  }

  if (!msg.timestamp) {
    errors.push('Missing timestamp');
  }

  if (!msg.from?.agentId) {
    errors.push('Missing from.agentId');
  }

  if (!MESSAGE_TYPES.includes(msg.type)) {
    errors.push(`Invalid message type: ${msg.type}`);
  }

  if (typeof msg.payload !== 'object') {
    errors.push('Payload must be an object');
  }

  // Type-specific validation
  if (msg.type === 'request') {
    if (!msg.payload?.action) {
      errors.push('Request messages must have payload.action');
    }
    if (!msg.payload?.correlationId) {
      errors.push('Request messages must have payload.correlationId');
    }
  }

  if (msg.type === 'response' || msg.type === 'error') {
    if (!msg.payload?.correlationId) {
      errors.push(`${msg.type} messages must have payload.correlationId`);
    }
  }

  if (msg.type === 'error') {
    if (!msg.payload?.code) {
      errors.push('Error messages must have payload.code');
    }
    if (!msg.payload?.message) {
      errors.push('Error messages must have payload.message');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Parse a message from JSON string
 */
function parseMessage(jsonString) {
  try {
    const msg = JSON.parse(jsonString);
    const validation = validateMessage(msg);
    if (!validation.valid) {
      return { error: validation.errors.join('; '), message: null };
    }
    return { error: null, message: msg };
  } catch (e) {
    return { error: `Invalid JSON: ${e.message}`, message: null };
  }
}

/**
 * Canonical JSON stringification (for signing)
 */
function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = canonicalize(obj[key]);
  }
  return sorted;
}

function toCanonicalJson(msg) {
  return JSON.stringify(canonicalize(msg));
}

module.exports = {
  PROTOCOL_VERSION,
  MESSAGE_TYPES,
  ERROR_CODES,
  createMessage,
  createHello,
  createRequest,
  createResponse,
  createError,
  createNotify,
  validateMessage,
  parseMessage,
  canonicalize,
  toCanonicalJson
};
