#!/usr/bin/env node

/**
 * AgentReputation CLI
 * 
 * Decentralized trust scores for AI agents.
 */

const fs = require('fs');
const path = require('path');
const {
  init,
  whoami,
  vouch,
  loadVouches,
  loadGraph,
  importVouchesAndCalculate,
  lookup,
  exportVouches,
  verifyVouchFile,
  TrustGraph,
  VOUCH_TYPES,
  VOUCH_CATEGORIES
} = require('../src');

// Parse arguments
const args = process.argv.slice(2);
const command = args[0];

// Help text
const HELP = `
🐈‍⬛ AgentReputation - Decentralized trust scores for AI agents

Usage: agentrepu <command> [options]

Commands:
  init                    Generate your agent identity
  whoami                  Show your agent ID and public key
  vouch <agent_id>        Vouch for another agent
    --type <type>         positive or negative (default: positive)
    --category <cat>      Category: ${VOUCH_CATEGORIES.join(', ')}
    --description <desc>  Description of the vouch
    --evidence <hash>     AgentProof hash as evidence (optional)
    --weight <n>          Weight 0.1-2.0 (default: 1.0)
  
  lookup <agent_id>       Look up an agent's reputation
  list                    List your vouches
  
  import <file>           Import vouches and recalculate scores
  export <file>           Export your vouches to a file
  verify <file>           Verify signatures in a vouch file
  
  calculate               Recalculate all scores
  stats                   Show graph statistics
  
  help                    Show this help

Examples:
  agentrepu init
  agentrepu vouch agent_abc123 --type positive --category collaboration --description "Excellent code review feedback"
  agentrepu lookup agent_abc123
  agentrepu export my-vouches.json

Trust Levels:
  🚩 Flagged (<0)      - Net negative vouches
  ❓ Unknown (0)       - No vouches
  🆕 New (0-0.3)       - Few vouches, not established
  ✓ Established (0.3-0.6) - Some positive track record
  ✅ Trusted (0.6-0.8)    - Solid reputation
  ⭐ Highly Trusted (0.8+) - Excellent reputation

Built by Freya 🐈‍⬛
`;

function parseOptions(args) {
  const opts = {};
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      opts[key] = value;
      i += 2;
    } else {
      i++;
    }
  }
  return opts;
}

function formatScore(score) {
  const bar = '█'.repeat(Math.round(score * 10)) + '░'.repeat(10 - Math.round(score * 10));
  return `${bar} ${(score * 100).toFixed(1)}%`;
}

async function main() {
  try {
    switch (command) {
      case 'init':
      case 'initialize': {
        const result = init();
        console.log('✅ Agent identity created!\n');
        console.log(`Agent ID:   ${result.agentId}`);
        console.log(`Public Key: ${result.publicKey.slice(0, 40)}...`);
        console.log('\nYou can now vouch for other agents and receive vouches.');
        break;
      }
      
      case 'whoami':
      case 'id': {
        const identity = whoami();
        console.log('🐈‍⬛ Your Agent Identity\n');
        console.log(`Agent ID:   ${identity.agentId}`);
        console.log(`Public Key: ${identity.publicKey}`);
        break;
      }
      
      case 'vouch': {
        const targetAgent = args[1];
        if (!targetAgent) {
          console.error('Error: Agent ID required');
          console.error('Usage: agentrepu vouch <agent_id> --type positive --category collaboration --description "..."');
          process.exit(1);
        }
        
        const opts = parseOptions(args.slice(2));
        
        if (!opts.category) {
          console.error('Error: --category required');
          console.error(`Valid categories: ${VOUCH_CATEGORIES.join(', ')}`);
          process.exit(1);
        }
        
        if (!opts.description) {
          console.error('Error: --description required (min 10 characters)');
          process.exit(1);
        }
        
        const result = vouch({
          to: targetAgent,
          type: opts.type || 'positive',
          category: opts.category,
          description: opts.description,
          evidence: opts.evidence || null,
          weight: opts.weight ? parseFloat(opts.weight) : 1.0
        });
        
        console.log(`✅ Vouch created!\n`);
        console.log(`ID:          ${result.id}`);
        console.log(`To:          ${result.to}`);
        console.log(`Type:        ${result.type === 'positive' ? '👍 Positive' : '👎 Negative'}`);
        console.log(`Category:    ${result.context.category}`);
        console.log(`Description: ${result.context.description}`);
        if (result.context.evidence) {
          console.log(`Evidence:    ${result.context.evidence}`);
        }
        break;
      }
      
      case 'lookup':
      case 'get': {
        const agentId = args[1];
        if (!agentId) {
          console.error('Error: Agent ID required');
          process.exit(1);
        }
        
        const rep = lookup(agentId);
        
        if (!rep) {
          console.log(`❓ Agent "${agentId}" not found in graph`);
          console.log('\nTry importing vouches first: agentrepu import <file>');
          break;
        }
        
        console.log(`🐈‍⬛ Reputation: ${agentId}\n`);
        console.log(`Trust Level: ${rep.trustLevel.emoji} ${rep.trustLevel.label}`);
        console.log(`Score:       ${formatScore(rep.score)}`);
        console.log(`Vouches:     ${rep.vouchesReceived} received, ${rep.vouchesGiven} given`);
        
        if (Object.keys(rep.categoryScores).length > 0) {
          console.log('\nCategory Scores:');
          for (const [cat, score] of Object.entries(rep.categoryScores)) {
            console.log(`  ${cat}: ${formatScore(score)}`);
          }
        }
        
        if (rep.vouchers.length > 0) {
          console.log('\nVouched by:');
          for (const v of rep.vouchers.slice(0, 5)) {
            console.log(`  • ${v}`);
          }
          if (rep.vouchers.length > 5) {
            console.log(`  ... and ${rep.vouchers.length - 5} more`);
          }
        }
        break;
      }
      
      case 'list': {
        const vouches = loadVouches();
        
        if (vouches.length === 0) {
          console.log('No vouches yet. Use `agentrepu vouch` to vouch for someone.');
          break;
        }
        
        console.log(`🐈‍⬛ Your Vouches (${vouches.length})\n`);
        
        for (const v of vouches) {
          const typeIcon = v.type === 'positive' ? '👍' : '👎';
          console.log(`${typeIcon} ${v.to}`);
          console.log(`   ${v.context.category}: ${v.context.description.slice(0, 60)}${v.context.description.length > 60 ? '...' : ''}`);
          console.log(`   ${new Date(v.timestamp).toLocaleDateString()}`);
          console.log('');
        }
        break;
      }
      
      case 'import': {
        const inputFile = args[1];
        if (!inputFile) {
          console.error('Error: Input file required');
          process.exit(1);
        }
        
        if (!fs.existsSync(inputFile)) {
          console.error(`Error: File not found: ${inputFile}`);
          process.exit(1);
        }
        
        const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
        const vouches = data.vouches || data;
        
        const result = importVouchesAndCalculate(Array.isArray(vouches) ? vouches : [vouches]);
        
        console.log(`✅ Import complete\n`);
        console.log(`Added:   ${result.added} vouches`);
        console.log(`Skipped: ${result.skipped} vouches`);
        console.log('\nGraph Stats:');
        console.log(`  Agents: ${result.stats.totalAgents}`);
        console.log(`  Vouches: ${result.stats.totalVouches} (${result.stats.positiveVouches}+ / ${result.stats.negativeVouches}-)`);
        console.log(`  Avg Score: ${(result.stats.averageScore * 100).toFixed(1)}%`);
        
        if (result.errors.length > 0) {
          console.log('\nErrors:');
          for (const err of result.errors.slice(0, 5)) {
            console.log(`  • ${err.id}: ${err.error}`);
          }
        }
        break;
      }
      
      case 'export': {
        const outputFile = args[1] || 'vouches.json';
        const result = exportVouches(outputFile);
        console.log(`✅ Exported ${result.count} vouches to ${result.path}`);
        break;
      }
      
      case 'verify': {
        const inputFile = args[1];
        if (!inputFile) {
          console.error('Error: Input file required');
          process.exit(1);
        }
        
        const result = verifyVouchFile(inputFile);
        
        if (result.invalid === 0) {
          console.log(`✅ All ${result.valid} vouches verified!`);
        } else {
          console.log(`⚠️ Verification results:`);
          console.log(`  Valid:   ${result.valid}`);
          console.log(`  Invalid: ${result.invalid}`);
          if (result.errors.length > 0) {
            console.log('\nInvalid vouches:');
            for (const id of result.errors) {
              console.log(`  • ${id}`);
            }
          }
        }
        break;
      }
      
      case 'calculate':
      case 'recalc': {
        const graph = loadGraph();
        graph.calculateScores();
        const { saveGraph } = require('../src');
        saveGraph(graph);
        
        const stats = graph.getStats();
        console.log('✅ Scores recalculated\n');
        console.log(`Agents: ${stats.totalAgents}`);
        console.log(`Vouches: ${stats.totalVouches}`);
        console.log(`Avg Score: ${(stats.averageScore * 100).toFixed(1)}%`);
        break;
      }
      
      case 'stats': {
        const graph = loadGraph();
        const stats = graph.getStats();
        
        console.log('🐈‍⬛ Trust Graph Statistics\n');
        console.log(`Total Agents:    ${stats.totalAgents}`);
        console.log(`Total Vouches:   ${stats.totalVouches}`);
        console.log(`  Positive:      ${stats.positiveVouches}`);
        console.log(`  Negative:      ${stats.negativeVouches}`);
        console.log(`Average Score:   ${(stats.averageScore * 100).toFixed(1)}%`);
        break;
      }
      
      case 'help':
      case '--help':
      case '-h':
      default:
        console.log(HELP);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
