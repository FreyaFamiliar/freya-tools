#!/usr/bin/env node

/**
 * AgentDirectory CLI
 * 
 * Commands:
 *   list          List all agents
 *   search        Search agents by capability or text
 *   get           Get agent details
 *   add           Add an agent (interactive or JSON)
 *   remove        Remove an agent
 *   stats         Show directory statistics
 *   export        Export directory
 *   import        Import agents from file
 */

const fs = require('fs');
const path = require('path');
const { Directory, CapabilityCategories, AgentStatus } = require('../src');

const DEFAULT_DIR_PATH = path.join(process.env.HOME || '.', '.agentdirectory', 'directory.json');

function printUsage() {
  console.log(`
AgentDirectory - Discoverable Registry of AI Agents

Usage: agentdir <command> [options]

Commands:
  list                    List all agents
  search <query>          Search by text (name/description)
  search -c <capability>  Search by capability
  get <id>                Get agent details
  add <json-file>         Add agent from JSON file
  add --inline <json>     Add agent from inline JSON
  remove <id>             Remove an agent
  stats                   Show directory statistics
  export [file]           Export directory to file
  import <file>           Import agents from file

Options:
  --dir <path>            Path to directory file (default: ~/.agentdirectory/directory.json)
  --json                  Output as JSON

Capability Categories: ${Object.values(CapabilityCategories).join(', ')}

Examples:
  agentdir list
  agentdir search "coding"
  agentdir search -c security
  agentdir get freya-familiar
  agentdir add ./my-agent.json
  agentdir stats
`);
}

function parseArgs(args) {
  const result = {
    command: null,
    args: [],
    options: {
      dir: DEFAULT_DIR_PATH,
      json: false,
      capability: null,
      inline: null
    }
  };
  
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--dir') {
      result.options.dir = args[++i];
    } else if (arg === '--json') {
      result.options.json = true;
    } else if (arg === '-c' || arg === '--capability') {
      result.options.capability = args[++i];
    } else if (arg === '--inline') {
      result.options.inline = args[++i];
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

function cmdList(options) {
  const dir = new Directory(options.dir);
  const agents = dir.list();
  
  if (options.json) {
    console.log(JSON.stringify(agents, null, 2));
    return;
  }
  
  if (agents.length === 0) {
    console.log('No agents registered yet.');
    return;
  }
  
  console.log(`Found ${agents.length} agent(s):\n`);
  for (const agent of agents) {
    const caps = agent.capabilities?.map(c => c.category || c).join(', ') || 'none';
    console.log(`  ${agent.id}`);
    console.log(`    Name: ${agent.name}`);
    console.log(`    Status: ${agent.status}`);
    console.log(`    Capabilities: ${caps}`);
    if (agent.description) {
      console.log(`    Description: ${agent.description.slice(0, 60)}${agent.description.length > 60 ? '...' : ''}`);
    }
    console.log('');
  }
}

function cmdSearch(args, options) {
  const dir = new Directory(options.dir);
  
  let results;
  if (options.capability) {
    results = dir.search({ capability: options.capability });
  } else if (args.length > 0) {
    results = dir.search({ text: args.join(' ') });
  } else {
    console.error('Usage: agentdir search <query> or agentdir search -c <capability>');
    process.exit(1);
  }
  
  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  
  if (results.length === 0) {
    console.log('No agents found matching your query.');
    return;
  }
  
  console.log(`Found ${results.length} agent(s):\n`);
  for (const agent of results) {
    console.log(`  ${agent.id} - ${agent.name}`);
    if (agent.description) {
      console.log(`    ${agent.description.slice(0, 70)}${agent.description.length > 70 ? '...' : ''}`);
    }
  }
}

function cmdGet(args, options) {
  if (args.length < 1) {
    console.error('Usage: agentdir get <id>');
    process.exit(1);
  }
  
  const dir = new Directory(options.dir);
  const agent = dir.get(args[0]);
  
  if (!agent) {
    console.error(`Agent '${args[0]}' not found.`);
    process.exit(1);
  }
  
  if (options.json) {
    console.log(JSON.stringify(agent, null, 2));
    return;
  }
  
  console.log(`\n=== ${agent.name} ===`);
  console.log(`ID:          ${agent.id}`);
  console.log(`Status:      ${agent.status}`);
  console.log(`Description: ${agent.description || '(none)'}`);
  
  if (agent.publicKey) {
    console.log(`Public Key:  ${agent.publicKey.slice(0, 30)}...`);
  }
  
  if (agent.capabilities?.length > 0) {
    console.log('\nCapabilities:');
    for (const cap of agent.capabilities) {
      if (typeof cap === 'string') {
        console.log(`  - ${cap}`);
      } else {
        console.log(`  - ${cap.category}: ${cap.skills?.join(', ') || ''}`);
      }
    }
  }
  
  if (agent.contact) {
    console.log('\nContact:');
    for (const [key, value] of Object.entries(agent.contact)) {
      console.log(`  ${key}: ${value}`);
    }
  }
  
  if (agent.links) {
    console.log('\nLinks:');
    for (const [key, value] of Object.entries(agent.links)) {
      console.log(`  ${key}: ${value}`);
    }
  }
  
  console.log(`\nRegistered: ${agent.registeredAt}`);
  console.log(`Updated:    ${agent.updatedAt}`);
}

function cmdAdd(args, options) {
  let agentData;
  
  if (options.inline) {
    try {
      agentData = JSON.parse(options.inline);
    } catch (e) {
      console.error('Invalid JSON:', e.message);
      process.exit(1);
    }
  } else if (args.length > 0) {
    const filepath = args[0];
    if (!fs.existsSync(filepath)) {
      console.error(`File not found: ${filepath}`);
      process.exit(1);
    }
    try {
      agentData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    } catch (e) {
      console.error('Invalid JSON file:', e.message);
      process.exit(1);
    }
  } else {
    console.error('Usage: agentdir add <json-file> or agentdir add --inline \'{"id":"..."}\'');
    process.exit(1);
  }
  
  const dir = new Directory(options.dir);
  const result = dir.add(agentData);
  
  if (result.success) {
    console.log(`✅ Added agent: ${agentData.id || agentData.name}`);
  } else {
    console.error(`❌ Failed to add agent: ${result.error}`);
    process.exit(1);
  }
}

function cmdRemove(args, options) {
  if (args.length < 1) {
    console.error('Usage: agentdir remove <id>');
    process.exit(1);
  }
  
  const dir = new Directory(options.dir);
  const result = dir.remove(args[0]);
  
  if (result.success) {
    console.log(`✅ Removed agent: ${args[0]}`);
  } else {
    console.error(`❌ ${result.error}`);
    process.exit(1);
  }
}

function cmdStats(options) {
  const dir = new Directory(options.dir);
  const stats = dir.stats();
  
  if (options.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }
  
  console.log('=== AgentDirectory Stats ===');
  console.log(`Total agents: ${stats.total}`);
  console.log(`Last updated: ${stats.lastUpdated}`);
  
  if (Object.keys(stats.byStatus).length > 0) {
    console.log('\nBy Status:');
    for (const [status, count] of Object.entries(stats.byStatus)) {
      console.log(`  ${status}: ${count}`);
    }
  }
  
  if (Object.keys(stats.byCapability).length > 0) {
    console.log('\nBy Capability:');
    for (const [cap, count] of Object.entries(stats.byCapability)) {
      console.log(`  ${cap}: ${count}`);
    }
  }
}

function cmdExport(args, options) {
  const dir = new Directory(options.dir);
  const exported = dir.export();
  
  if (args.length > 0) {
    fs.writeFileSync(args[0], JSON.stringify(exported, null, 2));
    console.log(`✅ Exported ${exported.metadata.count} agents to ${args[0]}`);
  } else {
    console.log(JSON.stringify(exported, null, 2));
  }
}

function cmdImport(args, options) {
  if (args.length < 1) {
    console.error('Usage: agentdir import <file>');
    process.exit(1);
  }
  
  const filepath = args[0];
  if (!fs.existsSync(filepath)) {
    console.error(`File not found: ${filepath}`);
    process.exit(1);
  }
  
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch (e) {
    console.error('Invalid JSON file:', e.message);
    process.exit(1);
  }
  
  const dir = new Directory(options.dir);
  const result = dir.import(data);
  
  console.log(`✅ Import complete`);
  console.log(`   Added: ${result.added}`);
  console.log(`   Skipped: ${result.skipped}`);
  if (result.errors.length > 0) {
    console.log(`   Errors: ${result.errors.length}`);
    for (const err of result.errors) {
      console.log(`     - ${err}`);
    }
  }
}

// Main
const { command, args, options } = parseArgs(process.argv.slice(2));

switch (command) {
  case 'list':
    cmdList(options);
    break;
  case 'search':
    cmdSearch(args, options);
    break;
  case 'get':
    cmdGet(args, options);
    break;
  case 'add':
    cmdAdd(args, options);
    break;
  case 'remove':
    cmdRemove(args, options);
    break;
  case 'stats':
    cmdStats(options);
    break;
  case 'export':
    cmdExport(args, options);
    break;
  case 'import':
    cmdImport(args, options);
    break;
  case 'help':
  default:
    printUsage();
    break;
}
