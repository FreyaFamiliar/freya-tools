#!/usr/bin/env node
/**
 * Agent QuickCheck - Fast credibility assessment
 * 
 * Combines AgentDirectory, AgentReputation, and AgentProof
 * to quickly assess an agent's trustworthiness.
 * 
 * Usage:
 *   node agent-quickcheck/index.js <agent-id-or-name>
 *   node agent-quickcheck/index.js --proof <proof-chain.json>
 * 
 * @author FreyaFamiliar
 * @license MIT
 */

const fs = require('fs');
const path = require('path');

// Import our trust tools
const agentproofPath = path.join(__dirname, '..', 'agentproof', 'src', 'index.js');
const agentdirPath = path.join(__dirname, '..', 'agentdirectory', 'src', 'index.js');
const agentrepuPath = path.join(__dirname, '..', 'agentreputation', 'src', 'index.js');

let AgentProof, AgentDirectory, AgentReputation;

try {
  AgentProof = require(agentproofPath);
} catch (e) {
  AgentProof = null;
}

try {
  AgentDirectory = require(agentdirPath);
} catch (e) {
  AgentDirectory = null;
}

try {
  AgentReputation = require(agentrepuPath);
} catch (e) {
  AgentReputation = null;
}

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

function printHeader(text) {
  console.log('\n' + colorize('═'.repeat(50), 'cyan'));
  console.log(colorize(`  ${text}`, 'bold'));
  console.log(colorize('═'.repeat(50), 'cyan'));
}

function printSection(title) {
  console.log('\n' + colorize(`▸ ${title}`, 'blue'));
  console.log(colorize('─'.repeat(40), 'gray'));
}

function printResult(label, value, status = 'neutral') {
  const statusColors = {
    good: 'green',
    bad: 'red',
    warn: 'yellow',
    neutral: 'reset'
  };
  const color = statusColors[status] || 'reset';
  console.log(`  ${colorize(label + ':', 'gray')} ${colorize(value, color)}`);
}

async function checkDirectory(agentId) {
  if (!AgentDirectory) {
    printResult('Status', 'AgentDirectory not available', 'warn');
    return null;
  }

  const dir = new AgentDirectory.Directory();
  
  // Try to load from default location
  const defaultPath = path.join(process.env.HOME, '.agentdirectory', 'directory.json');
  if (fs.existsSync(defaultPath)) {
    dir.load(defaultPath);
  }

  // Search for agent
  const results = dir.search(agentId);
  
  if (results.length === 0) {
    printResult('Found', 'Not in directory', 'warn');
    return null;
  }

  const agent = results[0];
  printResult('Found', 'Yes', 'good');
  printResult('Name', agent.name || agent.id);
  printResult('Capabilities', (agent.capabilities || []).join(', ') || 'none listed');
  printResult('Registered', agent.registered ? new Date(agent.registered).toISOString().split('T')[0] : 'unknown');
  
  if (agent.proofId) {
    printResult('Proof ID', agent.proofId, 'good');
  }
  
  return agent;
}

async function checkReputation(agentId) {
  if (!AgentReputation) {
    printResult('Status', 'AgentReputation not available', 'warn');
    return null;
  }

  const graph = new AgentReputation.TrustGraph();
  
  // Try to load from default location
  const defaultPath = path.join(process.env.HOME, '.agentreputation', 'vouches.json');
  if (fs.existsSync(defaultPath)) {
    try {
      const vouches = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
      vouches.forEach(v => graph.addVouch(v));
    } catch (e) {
      // Ignore load errors
    }
  }

  graph.calculateScores();
  const reputation = graph.getReputation(agentId);

  if (!reputation) {
    printResult('Score', 'Not rated (no vouches)', 'warn');
    return null;
  }

  const score = reputation.score;
  const status = score >= 0.5 ? 'good' : score >= 0.2 ? 'warn' : 'bad';
  printResult('Trust Score', score.toFixed(3), status);
  printResult('Trust Level', reputation.trustLevel || 'unknown');
  printResult('Vouches Received', reputation.vouchesReceived.toString());
  printResult('Vouches Given', reputation.vouchesGiven.toString());

  return { score, vouches: reputation.vouchesReceived };
}

async function verifyProofChain(filePath) {
  if (!AgentProof) {
    printResult('Status', 'AgentProof not available', 'warn');
    return null;
  }

  if (!fs.existsSync(filePath)) {
    printResult('File', 'Not found: ' + filePath, 'bad');
    return null;
  }

  try {
    const chain = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const result = AgentProof.verifyExportedChain(chain);
    
    // Get agentId from metadata or first proof
    const agentId = chain.metadata?.agentId || (chain.proofs[0]?.agentId);

    if (result.valid) {
      printResult('Chain Valid', 'Yes ✓', 'good');
      printResult('Agent ID', agentId || 'unknown');
      printResult('Total Proofs', chain.proofs.length.toString(), 'good');
      
      // Show action summary
      const actions = {};
      chain.proofs.forEach(p => {
        actions[p.action] = (actions[p.action] || 0) + 1;
      });
      
      const actionSummary = Object.entries(actions)
        .map(([a, c]) => `${a}(${c})`)
        .join(', ');
      printResult('Actions', actionSummary);

      // Time span
      if (chain.proofs.length > 0) {
        const first = new Date(chain.proofs[0].timestamp);
        const last = new Date(chain.proofs[chain.proofs.length - 1].timestamp);
        const hours = ((last - first) / (1000 * 60 * 60)).toFixed(1);
        printResult('Time Span', `${hours} hours`);
      }

      return { valid: true, proofs: chain.proofs.length, agentId };
    } else {
      printResult('Chain Valid', 'No ✗', 'bad');
      printResult('Error', result.error, 'bad');
      return { valid: false, error: result.error };
    }
  } catch (e) {
    printResult('Parse Error', e.message, 'bad');
    return null;
  }
}

function printOverallAssessment(directory, reputation, proof) {
  printSection('Overall Assessment');
  
  let signals = [];
  let concerns = [];

  // Directory signals
  if (directory) {
    signals.push('Listed in agent directory');
    if (directory.proofId) signals.push('Has linked proof identity');
    if (directory.capabilities?.length > 2) signals.push('Multiple capabilities declared');
  } else {
    concerns.push('Not found in agent directory');
  }

  // Reputation signals
  if (reputation) {
    if (reputation.score >= 0.5) signals.push(`High trust score (${reputation.score.toFixed(2)})`);
    else if (reputation.score >= 0.2) signals.push(`Moderate trust score (${reputation.score.toFixed(2)})`);
    else concerns.push(`Low trust score (${reputation.score.toFixed(2)})`);
    
    if (reputation.vouches > 0) signals.push(`${reputation.vouches} incoming vouches`);
  } else {
    concerns.push('No reputation data');
  }

  // Proof signals
  if (proof) {
    if (proof.valid) {
      signals.push('Valid cryptographic proof chain');
      if (proof.proofs >= 10) signals.push(`Substantial work history (${proof.proofs} proofs)`);
    } else {
      concerns.push('Invalid proof chain: ' + proof.error);
    }
  }

  // Print results
  if (signals.length > 0) {
    console.log(colorize('\n  ✓ Positive Signals:', 'green'));
    signals.forEach(s => console.log(colorize(`    • ${s}`, 'green')));
  }

  if (concerns.length > 0) {
    console.log(colorize('\n  ⚠ Concerns:', 'yellow'));
    concerns.forEach(c => console.log(colorize(`    • ${c}`, 'yellow')));
  }

  // Final recommendation
  const signalScore = signals.length;
  const concernScore = concerns.length;

  console.log('\n' + colorize('─'.repeat(40), 'gray'));
  
  if (signalScore >= 3 && concernScore === 0) {
    console.log(colorize('  Recommendation: HIGH TRUST', 'green'));
    console.log(colorize('  This agent has strong verifiable credentials.', 'gray'));
  } else if (signalScore >= 2 && concernScore <= 1) {
    console.log(colorize('  Recommendation: MODERATE TRUST', 'yellow'));
    console.log(colorize('  Some positive signals, but verify for sensitive tasks.', 'gray'));
  } else if (concernScore > signalScore) {
    console.log(colorize('  Recommendation: LOW TRUST', 'red'));
    console.log(colorize('  Limited or concerning signals. Proceed with caution.', 'gray'));
  } else {
    console.log(colorize('  Recommendation: INSUFFICIENT DATA', 'gray'));
    console.log(colorize('  Not enough information to assess. Request proof chain.', 'gray'));
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
${colorize('Agent QuickCheck', 'bold')} - Fast credibility assessment

${colorize('Usage:', 'cyan')}
  node agent-quickcheck/index.js <agent-id>           Check an agent by ID/name
  node agent-quickcheck/index.js --proof <file.json>  Verify a proof chain file
  node agent-quickcheck/index.js --self               Check your own credentials

${colorize('Examples:', 'cyan')}
  node agent-quickcheck/index.js freya-familiar
  node agent-quickcheck/index.js --proof freya-proof-chain.json
  node agent-quickcheck/index.js agent-a00f194b5590b2d7

${colorize('What it checks:', 'cyan')}
  • AgentDirectory: Is this agent registered? What capabilities?
  • AgentReputation: What's their trust score? Who vouched for them?
  • AgentProof: Do they have a valid cryptographic proof chain?

${colorize('Trust Tools:', 'gray')} https://github.com/FreyaFamiliar/freya-tools
`);
    process.exit(0);
  }

  if (args[0] === '--proof' && args[1]) {
    printHeader('Proof Chain Verification');
    printSection('Verifying: ' + args[1]);
    const proof = await verifyProofChain(args[1]);
    
    if (proof && proof.valid && proof.agentId) {
      printSection('Agent Directory Lookup');
      const directory = await checkDirectory(proof.agentId);
      
      printSection('Reputation Check');
      const reputation = await checkReputation(proof.agentId);
      
      printOverallAssessment(directory, reputation, proof);
    }
    
    console.log('');
    process.exit(proof?.valid ? 0 : 1);
  }

  if (args[0] === '--self') {
    // Check own credentials
    const proofPath = path.join(process.env.HOME, '.agentproof', 'chain.json');
    if (fs.existsSync(proofPath)) {
      printHeader('Self-Assessment');
      printSection('Your Proof Chain');
      const proof = await verifyProofChain(proofPath);
      
      if (proof && proof.agentId) {
        printSection('Directory Entry');
        const directory = await checkDirectory(proof.agentId);
        
        printSection('Reputation');
        const reputation = await checkReputation(proof.agentId);
        
        printOverallAssessment(directory, reputation, proof);
      }
    } else {
      console.log(colorize('No proof chain found at ~/.agentproof/chain.json', 'yellow'));
      console.log('Run: node agentproof/cli/agentproof.js init');
    }
    console.log('');
    process.exit(0);
  }

  // Check an agent by ID
  const agentId = args[0];
  printHeader(`Checking: ${agentId}`);

  printSection('Directory Lookup');
  const directory = await checkDirectory(agentId);

  printSection('Reputation');
  const reputation = await checkReputation(agentId);

  // Try to find and verify proof chain
  let proof = null;
  const possiblePaths = [
    `${agentId}-proof-chain.json`,
    `${agentId.replace('agent-', '')}-proof-chain.json`,
    path.join(process.env.HOME, '.cache', 'agentproof', `${agentId}.json`)
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      printSection('Proof Chain');
      proof = await verifyProofChain(p);
      break;
    }
  }

  if (!proof) {
    printSection('Proof Chain');
    printResult('Status', 'No proof chain file found locally', 'warn');
    printResult('Hint', 'Request proof chain from agent or check their published proofs');
  }

  printOverallAssessment(directory, reputation, proof);
  console.log('');
}

main().catch(console.error);
