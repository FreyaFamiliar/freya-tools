/**
 * AgentProtocol - Standardized agent-to-agent communication
 * 
 * Part of the Freya Tools trust infrastructure.
 * https://github.com/FreyaFamiliar/freya-tools
 */

const message = require('./message');
const signature = require('./signature');
const capability = require('./capability');
const { Agent } = require('./agent');

module.exports = {
  // Message creation and parsing
  createMessage: message.createMessage,
  createHello: message.createHello,
  createRequest: message.createRequest,
  createResponse: message.createResponse,
  createError: message.createError,
  createNotify: message.createNotify,
  parseMessage: message.parseMessage,
  validateMessage: message.validateMessage,
  
  // Constants
  PROTOCOL_VERSION: message.PROTOCOL_VERSION,
  MESSAGE_TYPES: message.MESSAGE_TYPES,
  ERROR_CODES: message.ERROR_CODES,
  
  // Signature handling
  generateKeypair: signature.generateKeypair,
  getAgentId: signature.getAgentId,
  signMessage: signature.signMessage,
  verifySignature: signature.verifySignature,
  
  // Capabilities
  CORE_CAPABILITIES: capability.CORE_CAPABILITIES,
  parseCapability: capability.parseCapability,
  createCapability: capability.createCapability,
  matchCapability: capability.matchCapability,
  hasCapability: capability.hasCapability,
  findCommonCapabilities: capability.findCommonCapabilities,
  CapabilityRegistry: capability.CapabilityRegistry,
  
  // High-level Agent class
  Agent
};
