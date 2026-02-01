#!/usr/bin/env node

/**
 * AgentProtocol CLI - Command-line interface for AgentProtocol
 */

const fs = require('fs');
const path = require('path');
const { 
  Agent, 
  parseMessage, 
  validateMessage, 
  verifySignature,
  CORE_CAPABILITIES 
} = require('../src');

const DATA_DIR = process.env.AGENTPROTOCOL_DIR || path.join(process.env.HOME || '.', '.agentprotocol');

function getAgent() {
  return new Agent({ dataDir: DATA_DIR, name: 'cli-agent' });
}

function printHelp() {
  console.log(`
AgentProtocol CLI v0.1

USAGE:
  agentproto <command> [options]

COMMANDS:
  init              Initialize agent identity
  whoami            Show agent ID and info
  hello <agentId>   Create a hello message
  request <agentId> <action> [params-json]  Create a request
  verify <file>     Verify a message file
  parse <file>      Parse and validate a message file
  caps              List registered capabilities
  register <cap>    Register a capability
  export [file]     Export public identity

EXAMPLES:
  agentproto init
  agentproto whoami
  agentproto hello ABC123def
  agentproto request ABC123def "code-review" '{"code":"console.log(1)"}'
  agentproto verify message.json
  agentproto caps
`);
}

function cmd_init() {
  const agent = getAgent();
  console.log('✅ Identity initialized');
  console.log(`   Agent ID: ${agent.agentId}`);
  console.log(`   Data dir: ${DATA_DIR}`);
}

function cmd_whoami() {
  const agent = getAgent();
  console.log(`Agent ID: ${agent.agentId}`);
  console.log(`Name: ${agent.name}`);
  console.log(`Public Key: ${agent.publicKey.slice(0, 50)}...`);
  console.log(`Capabilities: ${agent.capabilities.list().join(', ') || '(none)'}`);
  console.log(`Data dir: ${DATA_DIR}`);
}

function cmd_hello(targetId) {
  if (!targetId) {
    console.error('Usage: agentproto hello <target-agent-id>');
    process.exit(1);
  }
  const agent = getAgent();
  const msg = agent.createHello(targetId, ['signed-messages']);
  console.log(JSON.stringify(msg, null, 2));
}

function cmd_request(targetId, action, paramsJson) {
  if (!targetId || !action) {
    console.error('Usage: agentproto request <target-agent-id> <action> [params-json]');
    process.exit(1);
  }
  const agent = getAgent();
  const params = paramsJson ? JSON.parse(paramsJson) : {};
  const msg = agent.createRequest(targetId, action, params);
  console.log(JSON.stringify(msg, null, 2));
}

function cmd_verify(filePath) {
  if (!filePath) {
    console.error('Usage: agentproto verify <message-file>');
    process.exit(1);
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const msg = JSON.parse(content);
    
    // First validate structure
    const validation = validateMessage(msg);
    if (!validation.valid) {
      console.log('❌ Invalid message structure:');
      validation.errors.forEach(e => console.log(`   - ${e}`));
      process.exit(1);
    }
    
    if (!msg.signature) {
      console.log('⚠️  Message has no signature');
      console.log('   Structure is valid, but cannot verify authenticity');
      return;
    }
    
    // Need public key to verify
    console.log('✅ Message structure valid');
    console.log(`   From: ${msg.from.agentId}`);
    console.log(`   Type: ${msg.type}`);
    console.log(`   Timestamp: ${msg.timestamp}`);
    console.log(`   Has signature: yes`);
    console.log('\n⚠️  To verify signature, need sender\'s public key');
    console.log('   Use --pubkey <base64> to provide it');
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

function cmd_parse(filePath) {
  if (!filePath) {
    console.error('Usage: agentproto parse <message-file>');
    process.exit(1);
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = parseMessage(content);
    
    if (result.error) {
      console.log('❌ Parse error:', result.error);
      process.exit(1);
    }
    
    const msg = result.message;
    console.log('✅ Message parsed successfully');
    console.log(`   Protocol: ${msg.protocol}`);
    console.log(`   ID: ${msg.id}`);
    console.log(`   From: ${msg.from.agentId} (${msg.from.name || 'unnamed'})`);
    console.log(`   To: ${msg.to.agentId || 'broadcast'}`);
    console.log(`   Type: ${msg.type}`);
    console.log(`   Timestamp: ${msg.timestamp}`);
    console.log(`   Signed: ${msg.signature ? 'yes' : 'no'}`);
    console.log('\nPayload:');
    console.log(JSON.stringify(msg.payload, null, 2));
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

function cmd_caps() {
  const agent = getAgent();
  const caps = agent.capabilities.list();
  console.log('Registered capabilities:');
  caps.forEach(c => console.log(`  - ${c}`));
  if (caps.length === 0) {
    console.log('  (none)');
  }
}

function cmd_register(capability) {
  if (!capability) {
    console.error('Usage: agentproto register <capability-uri>');
    process.exit(1);
  }
  // Note: This would need persistent storage to be useful
  console.log(`⚠️  Capability registration not persisted in CLI mode`);
  console.log(`   Use the Agent class programmatically to register capabilities`);
}

function cmd_export(outputFile) {
  const agent = getAgent();
  const exported = {
    agentId: agent.agentId,
    name: agent.name,
    publicKey: agent.publicKey,
    capabilities: agent.capabilities.list(),
    exportedAt: new Date().toISOString()
  };
  
  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(exported, null, 2));
    console.log(`✅ Identity exported to ${outputFile}`);
  } else {
    console.log(JSON.stringify(exported, null, 2));
  }
}

// Main
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'init':
    cmd_init();
    break;
  case 'whoami':
    cmd_whoami();
    break;
  case 'hello':
    cmd_hello(args[1]);
    break;
  case 'request':
    cmd_request(args[1], args[2], args[3]);
    break;
  case 'verify':
    cmd_verify(args[1]);
    break;
  case 'parse':
    cmd_parse(args[1]);
    break;
  case 'caps':
    cmd_caps();
    break;
  case 'register':
    cmd_register(args[1]);
    break;
  case 'export':
    cmd_export(args[1]);
    break;
  case '-h':
  case '--help':
  case 'help':
  case undefined:
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}
