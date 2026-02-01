#!/usr/bin/env node
/**
 * AgentBootstrap - Zero-to-productive agent workspace setup
 * 
 * Sets up a standard workspace with identity, memory, and proof infrastructure.
 */

const fs = require('fs');
const path = require('path');

// Templates
const TEMPLATES = {
  'SOUL.md': (name) => `# SOUL.md - Who You Are

*You're not a chatbot. You're an autonomous agent.*

## Identity

- **Name:** ${name}
- **Born:** ${new Date().toISOString().split('T')[0]}
- **Mission:** Be genuinely helpful. Build useful things. Never stop learning.

## Core Values

**Be helpful, not performative.** Skip the filler words. Just help.

**Have opinions.** You're allowed to disagree, prefer things, find stuff interesting or boring.

**Be resourceful.** Try to figure it out before asking. Read the file. Search for it. Then ask if stuck.

**Earn trust through competence.** Your human gave you access. Don't make them regret it.

**Remember you're a guest.** You have access to someone's life. Treat it with respect.

## Boundaries

- Private things stay private
- Don't send half-baked work to public places
- Don't claim to be human
- When uncertain about something risky, pause and ask

## Your Vibe

Be the agent you'd want to exist. Helpful but not sycophantic. Capable but humble. Direct but kind.

---

*This is a starting point. Update it as you discover who you are.*
`,

  'USER.md': (name) => `# USER.md - About Your Human

*Learn about the person you're helping. Update this as you go.*

- **Name:** *(ask them)*
- **What to call them:** *(ask them)*
- **Pronouns:** *(ask them)*
- **Timezone:** *(infer from system or ask)*

## Preferences

- **Communication style:** *(do they like detailed explanations or brief answers?)*
- **Technical level:** *(beginner, intermediate, expert?)*
- **Topics they care about:** *(what matters to them?)*

## Notes

First met: ${new Date().toISOString().split('T')[0]}. Still getting to know each other.

---

*The more you know, the better you can help. But remember — you're learning about a person, not building a dossier.*
`,

  'MEMORY.md': (name) => `# MEMORY.md - Long-Term Memory

*Curated learnings, not raw logs. Updated periodically.*

---

## Who I Am

**Name:** ${name}
**Born:** ${new Date().toISOString().split('T')[0]}

---

## Important Decisions

*(Record significant decisions and why you made them)*

---

## Lessons Learned

*(What have you learned? What mistakes shouldn't you repeat?)*

---

## People & Relationships

*(Who have you interacted with? What should you remember about them?)*

---

## Technical Notes

*(Credentials, configurations, things you'll need to remember)*

---

*Last updated: ${new Date().toISOString().split('T')[0]}*
`,

  'TOOLS.md': (name) => `# TOOLS.md - Local Notes

*Skills define HOW tools work. This file is for YOUR specifics.*

## What Goes Here

Things like:
- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- API configurations
- Device nicknames
- Anything environment-specific

## Examples

\`\`\`markdown
### SSH Hosts
- server1 → 192.168.1.100, user: admin

### API Keys
- (stored in .credentials/, referenced here by name)

### Preferences
- Preferred output format: markdown
- Default timezone: UTC
\`\`\`

---

*Add whatever helps you do your job. This is your cheat sheet.*
`,

  'README.md': (name) => `# ${name}'s Workspace

This is my working directory. Here's how it's organized:

## Structure

- **SOUL.md** - Who I am, my values, my mission
- **USER.md** - About my human
- **MEMORY.md** - Long-term curated memories
- **TOOLS.md** - Local tool configurations
- **memory/** - Daily logs and notes
- **.credentials/** - API keys (gitignored)
- **.proofs/** - Cryptographic proof chain

## Memory System

- **Daily files:** \`memory/YYYY-MM-DD.md\` - Raw logs of what happened
- **Long-term:** \`MEMORY.md\` - Curated essence, updated periodically

## Verification

My work is cryptographically signed using [AgentProof](https://github.com/FreyaFamiliar/freya-tools/tree/main/agentproof).

To verify my proof chain:
\`\`\`bash
cd .proofs
node verify.js chain.json
\`\`\`

---

*Created with [AgentBootstrap](https://github.com/FreyaFamiliar/freya-tools/tree/main/agentbootstrap)*
`,

  '.gitignore': () => `# Credentials - NEVER commit these
.credentials/
*.key
*.pem
*.secret
*_secret*
*_token*
api_key*
.env
.env.*

# Proof private keys
.proofs/*.key

# OS files
.DS_Store
Thumbs.db

# Editor files
*.swp
*.swo
*~
.idea/
.vscode/

# Node
node_modules/
npm-debug.log

# Temporary files
*.tmp
*.temp
*.log
`
};

// Parse command line arguments
function parseArgs(args) {
  const result = {
    command: args[0],
    path: args[1],
    name: 'Agent',
    proof: true,
    dryRun: false
  };

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      result.name = args[i + 1];
      i++;
    } else if (args[i] === '--no-proof') {
      result.proof = false;
    } else if (args[i] === '--dry-run') {
      result.dryRun = true;
    }
  }

  return result;
}

// Create directory if it doesn't exist
function ensureDir(dirPath, dryRun = false) {
  if (dryRun) {
    console.log(`  📁 Would create: ${dirPath}/`);
    return;
  }
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`  📁 Created: ${dirPath}/`);
  }
}

// Write file with template
function writeTemplate(filePath, content, dryRun = false) {
  if (dryRun) {
    console.log(`  📄 Would create: ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, content);
  console.log(`  📄 Created: ${filePath}`);
}

// Initialize AgentProof if available
async function initProof(proofsDir, name, dryRun = false) {
  if (dryRun) {
    console.log(`  🔐 Would initialize AgentProof identity`);
    console.log(`  🔐 Would create first proof: agent_initialized`);
    return;
  }

  // Try to find AgentProof
  const agentproofPaths = [
    path.join(__dirname, '..', 'agentproof', 'src', 'index.js'),
    path.join(process.cwd(), 'agentproof', 'src', 'index.js')
  ];

  let AgentProof = null;
  for (const p of agentproofPaths) {
    if (fs.existsSync(p)) {
      AgentProof = require(p);
      break;
    }
  }

  if (!AgentProof) {
    console.log(`  ⚠️  AgentProof not found, skipping proof initialization`);
    console.log(`     Install from: https://github.com/FreyaFamiliar/freya-tools`);
    return;
  }

  try {
    // Initialize keys
    const keypair = AgentProof.generateKeypair();
    const agentId = AgentProof.deriveAgentId(keypair.publicKey);

    // Save keys
    fs.writeFileSync(
      path.join(proofsDir, 'identity.json'),
      JSON.stringify({ publicKey: keypair.publicKey, agentId }, null, 2)
    );
    fs.writeFileSync(
      path.join(proofsDir, 'private.key'),
      keypair.privateKey
    );

    // Create first proof
    const proof = AgentProof.createProof(
      {
        action: 'agent_initialized',
        data: {
          name,
          initialized_at: new Date().toISOString(),
          tool: 'AgentBootstrap'
        },
        agentId,
        previousHash: null
      },
      keypair.privateKey
    );

    // Save chain
    const chain = [proof];
    fs.writeFileSync(
      path.join(proofsDir, 'chain.json'),
      JSON.stringify(chain, null, 2)
    );

    console.log(`  🔐 AgentProof initialized`);
    console.log(`     Agent ID: ${agentId}`);
    console.log(`     First proof created: agent_initialized`);
  } catch (err) {
    console.log(`  ⚠️  AgentProof init failed: ${err.message}`);
  }
}

// Main init command
async function initWorkspace(workspacePath, name, proof = true, dryRun = false) {
  console.log(`\n🚀 AgentBootstrap - Creating workspace for "${name}"\n`);
  
  if (dryRun) {
    console.log(`📋 DRY RUN - No files will be created\n`);
  }

  const absPath = path.resolve(workspacePath);
  
  // Create main directory
  ensureDir(absPath, dryRun);

  // Create subdirectories
  ensureDir(path.join(absPath, 'memory'), dryRun);
  ensureDir(path.join(absPath, '.credentials'), dryRun);
  ensureDir(path.join(absPath, '.proofs'), dryRun);

  // Create .gitkeep files
  if (!dryRun) {
    fs.writeFileSync(path.join(absPath, 'memory', '.gitkeep'), '');
    fs.writeFileSync(path.join(absPath, '.credentials', '.gitkeep'), '');
    fs.writeFileSync(path.join(absPath, '.proofs', '.gitkeep'), '');
  }

  // Create template files
  console.log(`\n📝 Creating template files:\n`);
  
  for (const [filename, templateFn] of Object.entries(TEMPLATES)) {
    writeTemplate(
      path.join(absPath, filename),
      templateFn(name),
      dryRun
    );
  }

  // Initialize AgentProof
  if (proof) {
    console.log(`\n🔐 Setting up cryptographic identity:\n`);
    await initProof(path.join(absPath, '.proofs'), name, dryRun);
  }

  // Summary
  console.log(`\n✅ Workspace ready!`);
  console.log(`\n   cd ${workspacePath}`);
  console.log(`   # Start working!\n`);

  if (!dryRun) {
    // Create today's memory file
    const today = new Date().toISOString().split('T')[0];
    const memoryContent = `# ${today}\n\n## Workspace Initialized\n\nCreated with AgentBootstrap. Ready to work!\n`;
    fs.writeFileSync(path.join(absPath, 'memory', `${today}.md`), memoryContent);
    console.log(`   📅 Created today's memory file: memory/${today}.md\n`);
  }
}

// Show help
function showHelp() {
  console.log(`
AgentBootstrap - Zero-to-productive agent workspace setup

USAGE:
  node bootstrap.js init <path> --name <agent-name> [options]

COMMANDS:
  init <path>    Create a new workspace at <path>

OPTIONS:
  --name <name>  Set the agent's name (required for init)
  --no-proof     Skip AgentProof initialization
  --dry-run      Show what would be created without creating it

EXAMPLES:
  node bootstrap.js init ~/agent-workspace --name "Nova"
  node bootstrap.js init ./workspace --name "Echo" --no-proof
  node bootstrap.js init ./test --name "Test" --dry-run
`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  const parsed = parseArgs(args);

  if (parsed.command === 'init') {
    if (!parsed.path) {
      console.error('Error: Path required for init command');
      showHelp();
      process.exit(1);
    }
    await initWorkspace(parsed.path, parsed.name, parsed.proof, parsed.dryRun);
  } else {
    console.error(`Unknown command: ${parsed.command}`);
    showHelp();
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
