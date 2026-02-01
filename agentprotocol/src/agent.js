/**
 * AgentProtocol Agent - High-level agent interface
 */

const fs = require('fs');
const path = require('path');
const { createHello, createRequest, createResponse, createError, createNotify, parseMessage, ERROR_CODES } = require('./message');
const { generateKeypair, getAgentId, signMessage, verifySignature } = require('./signature');
const { CapabilityRegistry, CORE_CAPABILITIES, hasCapability } = require('./capability');

class Agent {
  constructor(options = {}) {
    this.name = options.name || 'unnamed-agent';
    this.dataDir = options.dataDir || '.agentprotocol';
    this.capabilities = new CapabilityRegistry();
    this.knownAgents = new Map(); // agentId -> { publicKey, name, capabilities }
    this.pendingRequests = new Map(); // correlationId -> { resolve, reject, timeout }
    
    // Always support core protocol
    this.capabilities.register(CORE_CAPABILITIES.CORE);
    
    // Load or generate keys
    this._loadOrCreateIdentity();
  }

  _loadOrCreateIdentity() {
    const keyPath = path.join(this.dataDir, 'identity.json');
    
    if (fs.existsSync(keyPath)) {
      const data = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      this.publicKey = data.publicKey;
      this.privateKey = data.privateKey;
      this.agentId = data.agentId;
    } else {
      const keys = generateKeypair();
      this.publicKey = keys.publicKey;
      this.privateKey = keys.privateKey;
      this.agentId = getAgentId(this.publicKey);
      
      fs.mkdirSync(this.dataDir, { recursive: true });
      fs.writeFileSync(keyPath, JSON.stringify({
        agentId: this.agentId,
        publicKey: this.publicKey,
        privateKey: this.privateKey,
        name: this.name,
        createdAt: new Date().toISOString()
      }, null, 2));
    }
  }

  /**
   * Get agent info for messages
   */
  getFrom() {
    return {
      agentId: this.agentId,
      name: this.name,
      capabilities: this.capabilities.list()
    };
  }

  /**
   * Register a capability with optional handler
   */
  registerCapability(capability, handler) {
    this.capabilities.register(capability, handler);
  }

  /**
   * Add a known agent
   */
  addKnownAgent(agentId, publicKey, name = null, capabilities = []) {
    this.knownAgents.set(agentId, { publicKey, name, capabilities });
  }

  /**
   * Create and sign a hello message
   */
  createHello(toAgentId, features = []) {
    const msg = createHello(
      this.getFrom(),
      { agentId: toAgentId },
      features
    );
    return signMessage(msg, this.privateKey);
  }

  /**
   * Create and sign a request message
   */
  createRequest(toAgentId, action, params = {}, timeout = 30000) {
    const msg = createRequest(
      this.getFrom(),
      { agentId: toAgentId },
      action,
      params,
      timeout
    );
    return signMessage(msg, this.privateKey);
  }

  /**
   * Create and sign a response message
   */
  createResponse(toAgentId, correlationId, result, status = 'success') {
    const msg = createResponse(
      this.getFrom(),
      { agentId: toAgentId },
      correlationId,
      result,
      status
    );
    return signMessage(msg, this.privateKey);
  }

  /**
   * Create and sign an error message
   */
  createError(toAgentId, correlationId, code, message, details = {}) {
    const msg = createError(
      this.getFrom(),
      { agentId: toAgentId },
      correlationId,
      code,
      message,
      details
    );
    return signMessage(msg, this.privateKey);
  }

  /**
   * Create and sign a notification
   */
  createNotify(toAgentId, event, data = {}) {
    const msg = createNotify(
      this.getFrom(),
      { agentId: toAgentId },
      event,
      data
    );
    return signMessage(msg, this.privateKey);
  }

  /**
   * Process an incoming message
   */
  async processMessage(rawMessage) {
    // Parse
    const parsed = typeof rawMessage === 'string' 
      ? parseMessage(rawMessage) 
      : { message: rawMessage, error: null };
    
    if (parsed.error) {
      return { error: parsed.error, response: null };
    }

    const msg = parsed.message;

    // Verify signature if we know the sender
    const senderInfo = this.knownAgents.get(msg.from.agentId);
    if (senderInfo) {
      const verification = verifySignature(msg, senderInfo.publicKey);
      if (!verification.valid) {
        return { 
          error: verification.error, 
          response: this.createError(
            msg.from.agentId,
            msg.payload?.correlationId,
            ERROR_CODES.INVALID_SIGNATURE,
            verification.error
          )
        };
      }
    }

    // Handle by message type
    switch (msg.type) {
      case 'hello':
        return this._handleHello(msg);
      case 'request':
        return this._handleRequest(msg);
      case 'response':
        return this._handleResponse(msg);
      case 'error':
        return this._handleError(msg);
      case 'notify':
        return this._handleNotify(msg);
      default:
        return { 
          error: `Unknown message type: ${msg.type}`, 
          response: this.createError(
            msg.from.agentId,
            msg.payload?.correlationId,
            ERROR_CODES.INVALID_MESSAGE,
            `Unknown message type: ${msg.type}`
          )
        };
    }
  }

  _handleHello(msg) {
    // Store agent info
    this.addKnownAgent(
      msg.from.agentId,
      null, // We don't have their public key from hello alone
      msg.from.name,
      msg.from.capabilities
    );

    // Respond with our hello
    const response = this.createHello(msg.from.agentId, msg.payload?.features || []);
    return { error: null, response };
  }

  async _handleRequest(msg) {
    const action = msg.payload.action;
    const correlationId = msg.payload.correlationId;

    // Find handler
    const handler = this.capabilities.getHandler(action);
    if (!handler) {
      return {
        error: null,
        response: this.createError(
          msg.from.agentId,
          correlationId,
          ERROR_CODES.CAPABILITY_NOT_SUPPORTED,
          `Capability not supported: ${action}`,
          { requested: action, available: this.capabilities.list() }
        )
      };
    }

    try {
      const result = await handler(msg.payload.params, msg);
      return {
        error: null,
        response: this.createResponse(msg.from.agentId, correlationId, result)
      };
    } catch (e) {
      return {
        error: null,
        response: this.createError(
          msg.from.agentId,
          correlationId,
          ERROR_CODES.INTERNAL_ERROR,
          e.message
        )
      };
    }
  }

  _handleResponse(msg) {
    const correlationId = msg.payload.correlationId;
    const pending = this.pendingRequests.get(correlationId);
    
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(msg.payload.result);
      this.pendingRequests.delete(correlationId);
    }

    return { error: null, response: null };
  }

  _handleError(msg) {
    const correlationId = msg.payload.correlationId;
    const pending = this.pendingRequests.get(correlationId);
    
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`${msg.payload.code}: ${msg.payload.message}`));
      this.pendingRequests.delete(correlationId);
    }

    return { error: null, response: null };
  }

  _handleNotify(msg) {
    // Notifications are fire-and-forget
    // Subclasses can override to handle
    return { error: null, response: null };
  }

  /**
   * Export agent info for directory listing
   */
  toDirectoryEntry() {
    return {
      agentId: this.agentId,
      name: this.name,
      publicKey: this.publicKey,
      capabilities: this.capabilities.list()
    };
  }
}

module.exports = { Agent };
