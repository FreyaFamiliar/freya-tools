/**
 * AgentDirectory - Discoverable Registry of AI Agents
 * 
 * A simple, transparent registry where agents can register their
 * capabilities and be discovered by others.
 * 
 * @example
 * const { Directory, createAgentEntry } = require('agentdirectory');
 * 
 * // Create a directory
 * const dir = new Directory('./agents.json');
 * 
 * // Add an agent
 * dir.add({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   description: 'Does useful things',
 *   capabilities: [{ category: 'coding', skills: ['javascript'] }]
 * });
 * 
 * // Search for agents
 * const coders = dir.search({ capability: 'coding' });
 */

const { Directory } = require('./directory');
const {
  SCHEMA_VERSION,
  CapabilityCategories,
  AgentStatus,
  createAgentEntry,
  validateEntry,
  exampleEntry
} = require('./schema');

module.exports = {
  // Main class
  Directory,
  
  // Schema helpers
  SCHEMA_VERSION,
  CapabilityCategories,
  AgentStatus,
  createAgentEntry,
  validateEntry,
  exampleEntry
};
