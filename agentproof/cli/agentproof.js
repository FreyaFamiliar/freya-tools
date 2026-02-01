#!/usr/bin/env node

/**
 * AgentProof CLI
 * 
 * Commands:
 *   init          Generate a new keypair
 *   add           Add a proof to the chain
 *   verify        Verify a proof chain
 *   show          Display chain contents
 *   export        Export chain for sharing
 */

const fs = require('fs');
const path = require('path');
const {
  generateKeypair,
  loadKeypair,
  saveKeypair,
  deriveAgentId,
  ProofChain,
  verifyExportedChain,
  ActionTypes
} = require('../src');

const DEFAULT_KEY_PATH = path.join(process.env.HOME || '.', '.agentproof', 'keypair.json');
const DEFAULT_CHAIN_PATH = path.join(process.env.HOME || '.', '.agentproof', 'chain.json');

function printUsage() {
  console.log(`
AgentProof - Cryptographic Proof of Work for AI Agents

Usage: agentproof <command> [options]

Commands:
  init                  Generate a new keypair
  whoami                Show your agent ID and public key
  add <action> <data>   Add a proof to your chain
  verify <file>         Verify an exported chain
  show [--last N]       Display your chain
  export [file]         Export chain for sharing
  summary               Show chain summary

Options:
  --key <path>          Path to keypair file (default: ~/.agentproof/keypair.json)
  --chain <path>        Path to chain file (default: ~/.agentproof/chain.json)
  --json                Output as JSON

Actions: ${Object.values(ActionTypes).join(', ')}

Examples:
  agentproof init
  agentproof add tool_call '{"tool":"web_search","query":"AI safety"}'
  agentproof add decision '{"description":"Chose to build AgentProof first","reasoning":"Trust is foundational"}'
  agentproof verify other-agent-chain.json
  agentproof export my-work.json
  agentproof show --last 10
`);
}

function parseArgs(args) {
  const result = {
    command: null,
    args: [],
    options: {
      key: DEFAULT_KEY_PATH,
      chain: DEFAULT_CHAIN_PATH,
      json: false,
      last: null
    }
  };
  
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--key') {
      result.options.key = args[++i];
    } else if (arg === '--chain') {
      result.options.chain = args[++i];
    } else if (arg === '--json') {
      result.options.json = true;
    } else if (arg === '--last') {
      result.options.last = parseInt(args[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
      result.command = 'help';
    } else if (!result.command) {
      result.command = arg;
    } else {
      result.args.push(arg);
    }
    i++;
  }
  
  return result;
}

function cmdInit(options) {
  if (fs.existsSync(options.key)) {
    console.error(`Error: Keypair already exists at ${options.key}`);
    console.error('Delete it first if you want to generate a new one.');
    process.exit(1);
  }
  
  const keypair = generateKeypair();
  saveKeypair(keypair, options.key);
  
  const agentId = deriveAgentId(keypair.publicKey);
  
  console.log('✅ Generated new keypair');
  console.log(`   Agent ID: ${agentId}`);
  console.log(`   Key file: ${options.key}`);
  console.log(`   Public key: ${keypair.publicKey.slice(0, 40)}...`);
  console.log('\n⚠️  Keep your keypair.json safe! It proves your identity.');
}

function cmdWhoami(options) {
  if (!fs.existsSync(options.key)) {
    console.error('No keypair found. Run: agentproof init');
    process.exit(1);
  }
  
  const keypair = loadKeypair(options.key);
  const agentId = deriveAgentId(keypair.publicKey);
  
  if (options.json) {
    console.log(JSON.stringify({
      agentId,
      publicKey: keypair.publicKey
    }, null, 2));
  } else {
    console.log(`Agent ID:   ${agentId}`);
    console.log(`Public Key: ${keypair.publicKey}`);
  }
}

function cmdAdd(args, options) {
  if (args.length < 2) {
    console.error('Usage: agentproof add <action> <data-json>');
    console.error('Actions:', Object.values(ActionTypes).join(', '));
    process.exit(1);
  }
  
  if (!fs.existsSync(options.key)) {
    console.error('No keypair found. Run: agentproof init');
    process.exit(1);
  }
  
  const [action, dataStr] = args;
  let data;
  try {
    data = JSON.parse(dataStr);
  } catch (e) {
    console.error('Invalid JSON data:', e.message);
    process.exit(1);
  }
  
  const keypair = loadKeypair(options.key);
  const chain = new ProofChain(keypair, options.chain);
  
  const proof = chain.add({ action, data });
  
  if (options.json) {
    console.log(JSON.stringify(proof, null, 2));
  } else {
    console.log(`✅ Added proof #${chain.length()}`);
    console.log(`   Action: ${action}`);
    console.log(`   Hash: ${proof.hash.slice(0, 16)}...`);
    console.log(`   Time: ${proof.timestamp}`);
  }
}

function cmdVerify(args, options) {
  if (args.length < 1) {
    console.error('Usage: agentproof verify <chain-file>');
    process.exit(1);
  }
  
  const filepath = args[0];
  if (!fs.existsSync(filepath)) {
    console.error(`File not found: ${filepath}`);
    process.exit(1);
  }
  
  let chainData;
  try {
    chainData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch (e) {
    console.error('Invalid JSON file:', e.message);
    process.exit(1);
  }
  
  const result = verifyExportedChain(chainData);
  
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.valid) {
      console.log('✅ Chain is VALID');
      console.log(`   Agent: ${chainData.metadata?.agentId || 'unknown'}`);
      console.log(`   Proofs: ${chainData.proofs?.length || 0}`);
    } else {
      console.log('❌ Chain is INVALID');
      for (const error of result.errors) {
        console.log(`   Error: ${error}`);
      }
    }
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.log(`   Warning: ${warning}`);
      }
    }
  }
  
  process.exit(result.valid ? 0 : 1);
}

function cmdShow(options) {
  if (!fs.existsSync(options.chain)) {
    console.error('No chain found. Add some proofs first.');
    process.exit(1);
  }
  
  const chainData = JSON.parse(fs.readFileSync(options.chain, 'utf-8'));
  let proofs = chainData.proofs || [];
  
  if (options.last && options.last > 0) {
    proofs = proofs.slice(-options.last);
  }
  
  if (options.json) {
    console.log(JSON.stringify(proofs, null, 2));
  } else {
    console.log(`Chain: ${chainData.metadata?.agentId || 'unknown'}`);
    console.log(`Total proofs: ${chainData.proofs?.length || 0}`);
    console.log('---');
    
    for (let i = 0; i < proofs.length; i++) {
      const p = proofs[i];
      console.log(`[${i + 1}] ${p.action}`);
      console.log(`    Time: ${p.timestamp}`);
      console.log(`    Hash: ${p.hash.slice(0, 24)}...`);
      console.log(`    Data: ${JSON.stringify(p.data).slice(0, 60)}${JSON.stringify(p.data).length > 60 ? '...' : ''}`);
    }
  }
}

function cmdExport(args, options) {
  if (!fs.existsSync(options.key) || !fs.existsSync(options.chain)) {
    console.error('No keypair or chain found.');
    process.exit(1);
  }
  
  const keypair = loadKeypair(options.key);
  const chain = new ProofChain(keypair, options.chain);
  const exported = chain.export();
  
  if (args.length > 0) {
    fs.writeFileSync(args[0], JSON.stringify(exported, null, 2));
    console.log(`✅ Exported chain to ${args[0]}`);
    console.log(`   Proofs: ${exported.proofs.length}`);
  } else {
    console.log(JSON.stringify(exported, null, 2));
  }
}

function cmdSummary(options) {
  if (!fs.existsSync(options.key) || !fs.existsSync(options.chain)) {
    console.error('No keypair or chain found.');
    process.exit(1);
  }
  
  const keypair = loadKeypair(options.key);
  const chain = new ProofChain(keypair, options.chain);
  const summary = chain.summary();
  
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('=== AgentProof Summary ===');
    console.log(`Agent ID:    ${summary.agentId}`);
    console.log(`Proofs:      ${summary.proofCount}`);
    console.log(`First proof: ${summary.firstProof || 'none'}`);
    console.log(`Last proof:  ${summary.lastProof || 'none'}`);
    console.log('\nActions:');
    for (const [action, count] of Object.entries(summary.actionCounts)) {
      console.log(`  ${action}: ${count}`);
    }
  }
}

// Main
const { command, args, options } = parseArgs(process.argv.slice(2));

switch (command) {
  case 'init':
    cmdInit(options);
    break;
  case 'whoami':
    cmdWhoami(options);
    break;
  case 'add':
    cmdAdd(args, options);
    break;
  case 'verify':
    cmdVerify(args, options);
    break;
  case 'show':
    cmdShow(options);
    break;
  case 'export':
    cmdExport(args, options);
    break;
  case 'summary':
    cmdSummary(options);
    break;
  case 'help':
  default:
    printUsage();
    break;
}
