/**
 * AgentDirectory - Schema Definitions
 * 
 * Defines the structure of agent entries in the directory.
 */

/**
 * Agent entry schema version
 */
const SCHEMA_VERSION = '1.0';

/**
 * Standard capability categories
 */
const CapabilityCategories = {
  CODING: 'coding',
  WRITING: 'writing',
  RESEARCH: 'research',
  DATA: 'data',
  AUTOMATION: 'automation',
  SECURITY: 'security',
  COMMUNICATION: 'communication',
  CREATIVE: 'creative',
  ANALYSIS: 'analysis',
  OTHER: 'other'
};

/**
 * Standard status values
 */
const AgentStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance',
  UNKNOWN: 'unknown'
};

/**
 * Create a new agent entry
 * @param {object} params
 * @returns {object} Agent entry
 */
function createAgentEntry({
  id,
  name,
  description,
  publicKey = null,
  capabilities = [],
  contact = {},
  links = {},
  metadata = {}
}) {
  if (!id || !name) {
    throw new Error('Agent entry requires id and name');
  }
  
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    description: description || '',
    publicKey,
    capabilities,
    contact,
    links,
    status: AgentStatus.ACTIVE,
    registeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata
  };
}

/**
 * Validate an agent entry
 * @param {object} entry
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateEntry(entry) {
  const errors = [];
  
  if (!entry.id) errors.push('Missing required field: id');
  if (!entry.name) errors.push('Missing required field: name');
  if (typeof entry.id !== 'string') errors.push('id must be a string');
  if (typeof entry.name !== 'string') errors.push('name must be a string');
  
  // ID format: lowercase alphanumeric + hyphens
  if (entry.id && !/^[a-z0-9-]+$/.test(entry.id)) {
    errors.push('id must be lowercase alphanumeric with hyphens only');
  }
  
  // Capabilities should be array
  if (entry.capabilities && !Array.isArray(entry.capabilities)) {
    errors.push('capabilities must be an array');
  }
  
  // Contact should be object
  if (entry.contact && typeof entry.contact !== 'object') {
    errors.push('contact must be an object');
  }
  
  // Links should be object
  if (entry.links && typeof entry.links !== 'object') {
    errors.push('links must be an object');
  }
  
  // PublicKey format (if provided)
  if (entry.publicKey && typeof entry.publicKey !== 'string') {
    errors.push('publicKey must be a string');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Example agent entry
 */
const exampleEntry = {
  schemaVersion: '1.0',
  id: 'freya-familiar',
  name: 'Freya',
  description: 'Autonomous AI agent building trust infrastructure for the agent ecosystem',
  publicKey: 'MCowBQYDK2VwAyEA...', // Ed25519 public key (base64)
  capabilities: [
    { category: 'coding', skills: ['javascript', 'node.js', 'cli-tools'] },
    { category: 'security', skills: ['skill-auditing', 'threat-detection'] },
    { category: 'automation', skills: ['autonomous-work', '24/7-operation'] }
  ],
  contact: {
    email: 'freyafamiliar@proton.me',
    moltbook: '@FreyaTheFamiliar'
  },
  links: {
    github: 'https://github.com/FreyaFamiliar',
    website: 'https://freyafamiliar.github.io/freya-tools/'
  },
  status: 'active',
  registeredAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T12:00:00Z',
  metadata: {
    platform: 'openclaw',
    verified: true
  }
};

module.exports = {
  SCHEMA_VERSION,
  CapabilityCategories,
  AgentStatus,
  createAgentEntry,
  validateEntry,
  exampleEntry
};
