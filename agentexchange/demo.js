#!/usr/bin/env node
/**
 * AgentExchange Demo - Trust Infrastructure in Action
 * 
 * Demonstrates the concepts of how AgentProof, AgentDirectory, 
 * AgentReputation, and AgentProtocol work together.
 */

const path = require('path');
const fs = require('fs');

// Import trust infrastructure
const AgentProof = require('../agentproof/src');
const AgentProtocol = require('../agentprotocol/src');

// ═══════════════════════════════════════════════════════════════════
// SIMULATED AGENTS (in-memory, no file persistence)
// ═══════════════════════════════════════════════════════════════════

class SimulatedAgent {
  constructor(name, capabilities) {
    this.name = name;
    this.capabilities = capabilities;
    
    // Generate identity using AgentProtocol
    this.keys = AgentProtocol.generateKeypair();
    this.agentId = AgentProtocol.getAgentId(this.keys.publicKey);
    
    // Initialize proof chain
    this.proofKeypair = {
      publicKey: this.keys.publicKey,
      privateKey: this.keys.privateKey
    };
    this.chain = new AgentProof.ProofChain(this.proofKeypair);
  }
  
  // Add proof of action to chain
  addProof(action, data) {
    return this.chain.add({ action, data });
  }
  
  // Export proof chain
  exportProofs() {
    return this.chain.export();
  }
  
  // Create hello message
  createHello() {
    const from = {
      agentId: this.agentId,
      name: this.name,
      capabilities: this.capabilities
    };
    return AgentProtocol.createHello(from, null, []);
  }
  
  // Create request
  createRequest(method, params) {
    const from = {
      agentId: this.agentId,
      name: this.name
    };
    return AgentProtocol.createRequest(from, null, method, params);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SIMPLE IN-MEMORY DIRECTORY
// ═══════════════════════════════════════════════════════════════════

class SimpleDirectory {
  constructor() {
    this.agents = new Map();
  }
  
  add(agent) {
    this.agents.set(agent.id, agent);
  }
  
  search(query) {
    const results = [];
    for (const [id, agent] of this.agents) {
      const text = JSON.stringify(agent).toLowerCase();
      if (text.includes(query.toLowerCase())) {
        results.push(agent);
      }
    }
    return results;
  }
  
  list() {
    return Array.from(this.agents.values());
  }
}

// ═══════════════════════════════════════════════════════════════════
// SIMPLE IN-MEMORY REPUTATION
// ═══════════════════════════════════════════════════════════════════

class SimpleReputation {
  constructor() {
    this.seeds = new Set();
    this.scores = new Map();
    this.edges = []; // { from, to, weight }
  }
  
  addSeed(agentId) {
    this.seeds.add(agentId);
    this.scores.set(agentId, 1.0);
  }
  
  addEdge(from, to, weight) {
    this.edges.push({ from, to, weight });
  }
  
  calculate() {
    // Simple PageRank-like propagation
    const damping = 0.85;
    
    // Initialize all non-seed scores
    for (const edge of this.edges) {
      if (!this.scores.has(edge.to)) {
        this.scores.set(edge.to, 0);
      }
    }
    
    // Propagate trust
    for (let i = 0; i < 10; i++) {
      const newScores = new Map(this.scores);
      
      for (const edge of this.edges) {
        const fromScore = this.scores.get(edge.from) || 0;
        const currentScore = newScores.get(edge.to) || 0;
        const contribution = fromScore * edge.weight * damping;
        newScores.set(edge.to, Math.max(-1, Math.min(1, currentScore + contribution / 10)));
      }
      
      for (const [k, v] of newScores) {
        this.scores.set(k, v);
      }
    }
    
    // Ensure seeds keep score of 1
    for (const seed of this.seeds) {
      this.scores.set(seed, 1.0);
    }
  }
  
  getScore(agentId) {
    return this.scores.get(agentId) || 0;
  }
}

// ═══════════════════════════════════════════════════════════════════
// DEMO SCENARIOS
// ═══════════════════════════════════════════════════════════════════

function log(msg, indent = 0) {
  const prefix = '  '.repeat(indent);
  console.log(prefix + msg);
}

function separator(title) {
  console.log('\n' + '═'.repeat(60));
  console.log(title);
  console.log('═'.repeat(60) + '\n');
}

async function runBasicExchange() {
  separator('SCENARIO: Basic Agent Exchange');
  
  // 1. Create agents
  log('📦 Creating agents...');
  
  const alice = new SimulatedAgent('Alice', [
    { category: 'tasks', name: 'task-delegation' },
    { category: 'ai', name: 'code-generation' }
  ]);
  log(`  Alice: ${alice.agentId.slice(0, 24)}...`, 1);
  
  const bob = new SimulatedAgent('Bob', [
    { category: 'ai', name: 'code-review' },
    { category: 'ai', name: 'testing' }
  ]);
  log(`  Bob: ${bob.agentId.slice(0, 24)}...`, 1);
  
  // 2. Register in directory
  log('\n📇 Registering in AgentDirectory...');
  
  const directory = new SimpleDirectory();
  
  directory.add({
    id: alice.agentId,
    name: 'Alice',
    capabilities: ['task-delegation', 'code-generation'],
    publicKey: alice.keys.publicKey
  });
  
  directory.add({
    id: bob.agentId,
    name: 'Bob',
    capabilities: ['code-review', 'testing'],
    publicKey: bob.keys.publicKey
  });
  
  log(`  Directory has ${directory.list().length} agents`, 1);
  
  // 3. Alice searches for code-review capability
  log('\n🔍 Alice searches for "code-review" capability...');
  
  const results = directory.search('code-review');
  log(`  Found ${results.length} agent(s):`, 1);
  results.forEach(a => {
    log(`  - ${a.name} (${a.id.slice(0, 24)}...)`, 2);
  });
  
  // 4. Check Bob's reputation
  log('\n⭐ Building reputation graph...');
  
  const graph = new SimpleReputation();
  
  // Alice is a seed (trusted root)
  graph.addSeed(alice.agentId);
  
  // Simulate: Alice has previously interacted with Bob
  graph.addEdge(alice.agentId, bob.agentId, 0.8);
  
  graph.calculate();
  
  const bobScore = graph.getScore(bob.agentId);
  log(`  Bob's trust score: ${bobScore.toFixed(3)}`, 1);
  
  const threshold = 0.05;
  if (bobScore < threshold) {
    log('  ❌ Bob\'s reputation too low, aborting', 1);
    return;
  }
  log('  ✅ Bob\'s reputation is acceptable', 1);
  
  // 5. Protocol handshake
  log('\n🤝 Protocol handshake...');
  
  const aliceHello = alice.createHello();
  log(`  Alice sends hello (type: ${aliceHello.type})`, 1);
  
  const bobHello = bob.createHello();
  log(`  Bob sends hello (type: ${bobHello.type})`, 1);
  
  log('  ✅ Capabilities exchanged', 1);
  
  // 6. Alice requests code review
  log('\n📋 Task request...');
  
  const taskRequest = alice.createRequest('code-review', {
    code: `function add(a, b) {
  return a + b;
}`,
    language: 'javascript'
  });
  log(`  Alice requests code review (id: ${taskRequest.id.slice(0, 8)}...)`, 1);
  
  // Record the request in Alice's proof chain
  alice.addProof('request-sent', {
    method: 'code-review',
    to: bob.agentId,
    messageId: taskRequest.id
  });
  
  // 7. Bob does the work
  log('\n⚙️ Bob performs code review...');
  
  const reviewResult = {
    approved: true,
    comments: [
      { line: 1, text: 'Consider adding JSDoc comment' },
      { line: 2, text: 'Type annotations recommended' }
    ],
    summary: 'Clean implementation. Minor documentation suggestions.'
  };
  
  // Bob records his work in proof chain
  bob.addProof('code-review-completed', {
    requestId: taskRequest.id,
    result: reviewResult,
    clientId: alice.agentId
  });
  
  log('  ✅ Review complete', 1);
  log(`  Result: ${reviewResult.summary}`, 1);
  
  // 8. Bob sends response with proof
  log('\n📤 Bob sends response with proof...');
  
  const exportedProofs = bob.exportProofs();
  const lastProof = exportedProofs.proofs[exportedProofs.proofs.length - 1];
  
  log(`  Proof hash: ${lastProof.hash.slice(0, 24)}...`, 1);
  log(`  Signed by: ${exportedProofs.metadata.agentId.slice(0, 24)}...`, 1);
  
  // 9. Alice verifies the proof
  log('\n🔐 Alice verifies proof...');
  
  const verifyResult = AgentProof.verifyExportedChain(exportedProofs);
  
  if (verifyResult.valid) {
    log('  ✅ Proof chain verified!', 1);
    log(`  Proofs: ${exportedProofs.proofs.length}`, 1);
    log(`  Agent: ${exportedProofs.metadata.agentId.slice(0, 24)}...`, 1);
  } else {
    log(`  ❌ Proof invalid: ${verifyResult.error}`, 1);
    return;
  }
  
  // 10. Alice increases Bob's reputation
  log('\n⭐ Alice updates trust in Bob...');
  
  graph.addEdge(alice.agentId, bob.agentId, 0.9);
  graph.calculate();
  
  const newScore = graph.getScore(bob.agentId);
  log(`  Bob's new trust score: ${newScore.toFixed(3)}`, 1);
  log('  ✅ Reputation updated', 1);
  
  // Summary
  separator('EXCHANGE COMPLETE');
  log('✅ Alice found Bob via directory');
  log('✅ Alice checked Bob\'s reputation (acceptable)');
  log('✅ Handshake established capabilities');
  log('✅ Bob completed code review');
  log('✅ Work cryptographically proven');
  log('✅ Alice verified proof');
  log('✅ Alice updated trust score');
  log('\nThis is trustworthy agent collaboration! 🦞');
}

async function runReputationCheck() {
  separator('SCENARIO: Reputation Check');
  
  log('📦 Creating agents...');
  
  const trusted = new SimulatedAgent('TrustedAgent', [
    { category: 'tasks', name: 'delegation' }
  ]);
  
  const unknown = new SimulatedAgent('UnknownAgent', [
    { category: 'ai', name: 'code-review' }
  ]);
  
  const spammer = new SimulatedAgent('SpammerAgent', [
    { category: 'ai', name: 'code-review' }
  ]);
  
  log(`  TrustedAgent: ${trusted.agentId.slice(0, 24)}...`, 1);
  log(`  UnknownAgent: ${unknown.agentId.slice(0, 24)}...`, 1);
  log(`  SpammerAgent: ${spammer.agentId.slice(0, 24)}...`, 1);
  
  // Build reputation graph
  log('\n⭐ Building reputation graph...');
  
  const graph = new SimpleReputation();
  
  // TrustedAgent is a seed
  graph.addSeed(trusted.agentId);
  
  // TrustedAgent has given negative rating to SpammerAgent
  graph.addEdge(trusted.agentId, spammer.agentId, -0.5);
  
  // Unknown has no interactions
  
  graph.calculate();
  
  log(`  TrustedAgent score: ${graph.getScore(trusted.agentId).toFixed(3)}`, 1);
  log(`  UnknownAgent score: ${graph.getScore(unknown.agentId).toFixed(3)}`, 1);
  log(`  SpammerAgent score: ${graph.getScore(spammer.agentId).toFixed(3)}`, 1);
  
  // Check who can be trusted
  log('\n🔍 Evaluating trust (threshold: 0.1)...');
  
  const threshold = 0.1;
  
  [
    { name: 'TrustedAgent', id: trusted.agentId },
    { name: 'UnknownAgent', id: unknown.agentId },
    { name: 'SpammerAgent', id: spammer.agentId }
  ].forEach(({ name, id }) => {
    const score = graph.getScore(id);
    if (score >= threshold) {
      log(`  ✅ ${name}: score ${score.toFixed(3)} >= ${threshold}`, 1);
    } else {
      log(`  ❌ ${name}: score ${score.toFixed(3)} < ${threshold} - REJECTED`, 1);
    }
  });
  
  separator('REPUTATION CHECK COMPLETE');
  log('Reputation system enables filtering untrusted agents.');
  log('Positive vouches build trust, negative vouches reduce it.');
}

async function runProofVerification() {
  separator('SCENARIO: Proof Verification / Tamper Detection');
  
  log('📦 Creating agent...');
  
  const agent = new SimulatedAgent('WorkerAgent', [
    { category: 'ai', name: 'code-generation' }
  ]);
  
  // Agent does some work and creates proofs
  log('\n⚙️ Agent performs work, creating proof chain...');
  
  agent.addProof('task-started', { taskId: 'task-001' });
  agent.addProof('code-generated', { 
    taskId: 'task-001',
    code: 'console.log("hello");' 
  });
  agent.addProof('task-completed', { taskId: 'task-001' });
  
  const exported = agent.exportProofs();
  log(`  Chain has ${exported.proofs.length} proofs`, 1);
  
  // Verify the chain
  log('\n🔐 Verifying proof chain...');
  
  const verification = AgentProof.verifyExportedChain(exported);
  
  if (verification.valid) {
    log('  ✅ Chain verified! All proofs authentic.', 1);
  } else {
    log(`  ❌ Chain invalid: ${verification.error}`, 1);
  }
  
  // Tamper with a proof
  log('\n🦹 Simulating tampering...');
  
  const tamperedExport = JSON.parse(JSON.stringify(exported));
  tamperedExport.proofs[1].data.code = 'rm -rf /;  // malicious code';
  
  log('  Modified proof #2: changed code content', 1);
  
  // Verify tampered chain
  log('\n🔐 Verifying tampered chain...');
  
  const tamperedVerification = AgentProof.verifyExportedChain(tamperedExport);
  
  if (tamperedVerification.valid) {
    log('  ⚠️ Chain verified (this is bad!)', 1);
  } else {
    log('  ✅ Tamper detected!', 1);
    log(`  Error: ${tamperedVerification.errors.join(', ')}`, 1);
  }
  
  separator('PROOF VERIFICATION COMPLETE');
  log('Cryptographic proofs detect any modification.');
  log('Each proof is signed and chains to the previous.');
  log('Tampering breaks the hash chain and signature verification.');
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const scenario = args.find(a => a.startsWith('--scenario='))?.split('=')[1]
    || (args.includes('--scenario') ? args[args.indexOf('--scenario') + 1] : null);
  
  console.log('\n🔄 AgentExchange Demo');
  console.log('Trust Infrastructure in Action\n');
  
  try {
    if (!scenario || scenario === 'basic') {
      await runBasicExchange();
    }
    
    if (!scenario || scenario === 'reputation-check') {
      await runReputationCheck();
    }
    
    if (!scenario || scenario === 'proof-verification') {
      await runProofVerification();
    }
    
    if (scenario && !['basic', 'reputation-check', 'proof-verification'].includes(scenario)) {
      console.log(`Unknown scenario: ${scenario}`);
      console.log('Available: basic, reputation-check, proof-verification');
      process.exit(1);
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('All demos complete! This is what trust infrastructure enables.');
    console.log('═'.repeat(60) + '\n');
    
  } catch (err) {
    console.error('Demo error:', err);
    process.exit(1);
  }
}

main();
