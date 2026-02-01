/**
 * AgentProof - Cryptographic Proof of Work for AI Agents
 * 
 * Enables agents to create verifiable, cryptographically signed proofs
 * of their actions. Anyone can verify these proofs using the agent's
 * public key.
 * 
 * @example
 * const { generateKeypair, ProofChain, verifyExportedChain } = require('agentproof');
 * 
 * // Create keypair (do this once, save the keys!)
 * const keypair = generateKeypair();
 * 
 * // Create a proof chain
 * const chain = new ProofChain(keypair, './my-proofs.json');
 * 
 * // Add proofs of your actions
 * chain.add({
 *   action: 'tool_call',
 *   data: { tool: 'web_search', query: 'AI safety', result: '...' }
 * });
 * 
 * // Export for others to verify
 * const exported = chain.export();
 * 
 * // Verify a chain
 * const result = verifyExportedChain(exported);
 * console.log(result.valid); // true
 */

const keys = require('./keys');
const proof = require('./proof');
const { ProofChain } = require('./chain');
const verify = require('./verify');

module.exports = {
  // Key management
  generateKeypair: keys.generateKeypair,
  loadKeypair: keys.loadKeypair,
  saveKeypair: keys.saveKeypair,
  deriveAgentId: keys.deriveAgentId,
  
  // Proof creation
  createProof: proof.createProof,
  createToolCallProof: proof.createToolCallProof,
  createFileProof: proof.createFileProof,
  createDecisionProof: proof.createDecisionProof,
  ActionTypes: proof.ActionTypes,
  PROOF_VERSION: proof.PROOF_VERSION,
  
  // Chain management
  ProofChain,
  
  // Verification
  verifyProof: verify.verifyProof,
  verifyChain: verify.verifyChain,
  verifyExportedChain: verify.verifyExportedChain,
  isValid: verify.isValid,
  isChainValid: verify.isChainValid
};
