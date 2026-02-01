/**
 * AgentProtocol Capability - Capability management and matching
 */

// Core capabilities defined by AgentProtocol
const CORE_CAPABILITIES = {
  CORE: 'agentprotocol:core',
  TASKS: 'agentprotocol:tasks',
  PROOFS: 'agentprotocol:proofs',
  REPUTATION: 'agentprotocol:reputation',
  DIRECTORY: 'agentprotocol:directory',
  STREAMING: 'agentprotocol:streaming'
};

/**
 * Parse a capability URI
 * Format: namespace:capability[/variant]
 */
function parseCapability(uri) {
  const match = uri.match(/^([^:]+):([^/]+)(\/.*)?$/);
  if (!match) {
    return null;
  }
  return {
    namespace: match[1],
    capability: match[2],
    variant: match[3]?.slice(1) || null,
    uri
  };
}

/**
 * Create a capability URI
 */
function createCapability(namespace, capability, variant = null) {
  let uri = `${namespace}:${capability}`;
  if (variant) {
    uri += `/${variant}`;
  }
  return uri;
}

/**
 * Check if capabilities match
 * Supports wildcard matching with *
 */
function matchCapability(requested, available) {
  // Exact match
  if (requested === available) return true;
  
  // Parse both
  const req = parseCapability(requested);
  const avail = parseCapability(available);
  
  if (!req || !avail) return false;
  
  // Namespace must match
  if (req.namespace !== avail.namespace) return false;
  
  // Capability can wildcard
  if (avail.capability === '*') return true;
  if (req.capability !== avail.capability) return false;
  
  // Variant can wildcard or be absent (matches all)
  if (!avail.variant) return true;
  if (avail.variant === '*') return true;
  if (req.variant !== avail.variant) return false;
  
  return true;
}

/**
 * Check if an agent supports a capability
 */
function hasCapability(agentCapabilities, requested) {
  return agentCapabilities.some(cap => matchCapability(requested, cap));
}

/**
 * Find common capabilities between two agents
 */
function findCommonCapabilities(caps1, caps2) {
  const common = [];
  for (const cap of caps1) {
    if (caps2.some(c => matchCapability(cap, c) || matchCapability(c, cap))) {
      common.push(cap);
    }
  }
  return common;
}

/**
 * Capability registry for an agent
 */
class CapabilityRegistry {
  constructor() {
    this.capabilities = new Set();
    this.handlers = new Map();
  }

  /**
   * Register a capability with an optional handler
   */
  register(capability, handler = null) {
    this.capabilities.add(capability);
    if (handler) {
      this.handlers.set(capability, handler);
    }
  }

  /**
   * Unregister a capability
   */
  unregister(capability) {
    this.capabilities.delete(capability);
    this.handlers.delete(capability);
  }

  /**
   * Check if a capability is registered
   */
  has(capability) {
    return hasCapability([...this.capabilities], capability);
  }

  /**
   * Get handler for a capability
   */
  getHandler(capability) {
    // Try exact match first
    if (this.handlers.has(capability)) {
      return this.handlers.get(capability);
    }
    // Try wildcard match
    for (const [cap, handler] of this.handlers) {
      if (matchCapability(capability, cap)) {
        return handler;
      }
    }
    return null;
  }

  /**
   * Get all capabilities as array
   */
  list() {
    return [...this.capabilities];
  }

  /**
   * Export for hello message
   */
  toArray() {
    return this.list();
  }
}

module.exports = {
  CORE_CAPABILITIES,
  parseCapability,
  createCapability,
  matchCapability,
  hasCapability,
  findCommonCapabilities,
  CapabilityRegistry
};
