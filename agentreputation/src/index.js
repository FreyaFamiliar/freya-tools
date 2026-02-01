/**
 * AgentReputation - Decentralized trust scores for AI agents
 * 
 * Agents vouch for each other based on verified interactions,
 * building a web of trust with no central authority.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { createVouch, verifyVouch, validateVouch, VOUCH_TYPES, VOUCH_CATEGORIES } = require('./vouch');
const { TrustGraph } = require('./graph');

// Default paths
const DEFAULT_CONFIG_DIR = path.join(os.homedir(), '.agentreputation');
const DEFAULT_KEYFILE = path.join(DEFAULT_CONFIG_DIR, 'keys.json');
const DEFAULT_VOUCHES_FILE = path.join(DEFAULT_CONFIG_DIR, 'vouches.json');
const DEFAULT_GRAPH_FILE = path.join(DEFAULT_CONFIG_DIR, 'graph.json');

/**
 * Initialize agent identity (generates Ed25519 keypair)
 */
function init(configDir = DEFAULT_CONFIG_DIR) {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  const keyfile = path.join(configDir, 'keys.json');
  
  if (fs.existsSync(keyfile)) {
    throw new Error('Already initialized. Use --force to regenerate.');
  }
  
  // Generate keypair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  
  // Derive agent ID from public key
  const pubKeyBuffer = publicKey.export({ type: 'spki', format: 'der' });
  const agentId = 'agent_' + crypto.createHash('sha256')
    .update(pubKeyBuffer)
    .digest('hex')
    .slice(0, 24);
  
  // Save keys
  const keys = {
    agentId,
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    createdAt: new Date().toISOString()
  };
  
  fs.writeFileSync(keyfile, JSON.stringify(keys, null, 2));
  
  return { agentId, publicKey: pubKeyBuffer.toString('base64') };
}

/**
 * Load keys from config
 */
function loadKeys(configDir = DEFAULT_CONFIG_DIR) {
  const keyfile = path.join(configDir, 'keys.json');
  
  if (!fs.existsSync(keyfile)) {
    throw new Error('Not initialized. Run `agentrepu init` first.');
  }
  
  const keys = JSON.parse(fs.readFileSync(keyfile, 'utf8'));
  
  return {
    agentId: keys.agentId,
    publicKey: crypto.createPublicKey(keys.publicKey),
    privateKey: crypto.createPrivateKey(keys.privateKey)
  };
}

/**
 * Get agent identity info
 */
function whoami(configDir = DEFAULT_CONFIG_DIR) {
  const keys = loadKeys(configDir);
  const pubKeyBuffer = keys.publicKey.export({ type: 'spki', format: 'der' });
  
  return {
    agentId: keys.agentId,
    publicKey: pubKeyBuffer.toString('base64')
  };
}

/**
 * Create and sign a vouch for another agent
 */
function vouch({ to, type, category, description, evidence, weight }, configDir = DEFAULT_CONFIG_DIR) {
  const keys = loadKeys(configDir);
  
  const pubKeyBuffer = keys.publicKey.export({ type: 'spki', format: 'der' });
  
  const vouchObj = createVouch({
    from: keys.agentId,
    to,
    type,
    category,
    description,
    evidence,
    weight,
    privateKey: keys.privateKey,
    publicKey: pubKeyBuffer
  });
  
  // Save to local vouches file
  const vouchesFile = path.join(configDir, 'vouches.json');
  let vouches = [];
  
  if (fs.existsSync(vouchesFile)) {
    vouches = JSON.parse(fs.readFileSync(vouchesFile, 'utf8'));
  }
  
  vouches.push(vouchObj);
  fs.writeFileSync(vouchesFile, JSON.stringify(vouches, null, 2));
  
  return vouchObj;
}

/**
 * Load local vouches
 */
function loadVouches(configDir = DEFAULT_CONFIG_DIR) {
  const vouchesFile = path.join(configDir, 'vouches.json');
  
  if (!fs.existsSync(vouchesFile)) {
    return [];
  }
  
  return JSON.parse(fs.readFileSync(vouchesFile, 'utf8'));
}

/**
 * Load or create trust graph
 */
function loadGraph(configDir = DEFAULT_CONFIG_DIR) {
  const graphFile = path.join(configDir, 'graph.json');
  
  if (fs.existsSync(graphFile)) {
    const data = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
    return TrustGraph.import(data);
  }
  
  return new TrustGraph();
}

/**
 * Save trust graph
 */
function saveGraph(graph, configDir = DEFAULT_CONFIG_DIR) {
  const graphFile = path.join(configDir, 'graph.json');
  fs.writeFileSync(graphFile, JSON.stringify(graph.export(), null, 2));
}

/**
 * Import vouches into graph and recalculate
 */
function importVouchesAndCalculate(vouchData, configDir = DEFAULT_CONFIG_DIR) {
  const graph = loadGraph(configDir);
  
  let added = 0;
  let skipped = 0;
  const errors = [];
  
  for (const vouch of vouchData) {
    const result = graph.addVouch(vouch);
    if (result.success) {
      added++;
    } else {
      skipped++;
      errors.push({ id: vouch.id, error: result.error });
    }
  }
  
  graph.calculateScores();
  saveGraph(graph, configDir);
  
  return { added, skipped, errors, stats: graph.getStats() };
}

/**
 * Look up an agent's reputation
 */
function lookup(agentId, configDir = DEFAULT_CONFIG_DIR) {
  const graph = loadGraph(configDir);
  return graph.getReputation(agentId);
}

/**
 * Export vouches
 */
function exportVouches(outputPath, configDir = DEFAULT_CONFIG_DIR) {
  const vouches = loadVouches(configDir);
  const keys = loadKeys(configDir);
  
  const exportData = {
    version: '0.1',
    agent: keys.agentId,
    publicKey: keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    vouches,
    exportedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  
  return { count: vouches.length, path: outputPath };
}

/**
 * Verify vouches from a file
 */
function verifyVouchFile(inputPath) {
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  
  const results = {
    valid: 0,
    invalid: 0,
    errors: []
  };
  
  for (const vouch of data.vouches || []) {
    if (verifyVouch(vouch)) {
      results.valid++;
    } else {
      results.invalid++;
      results.errors.push(vouch.id);
    }
  }
  
  return results;
}

module.exports = {
  init,
  whoami,
  vouch,
  loadVouches,
  loadGraph,
  saveGraph,
  importVouchesAndCalculate,
  lookup,
  exportVouches,
  verifyVouchFile,
  verifyVouch,
  validateVouch,
  TrustGraph,
  VOUCH_TYPES,
  VOUCH_CATEGORIES
};
