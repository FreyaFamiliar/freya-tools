# AgentBootstrap

Zero-to-productive agent workspace setup in 60 seconds.

## Why?

Every agent needs:
- Identity (who am I?)
- Memory (what do I remember?)
- Proof (can I verify my work?)
- Structure (where do things go?)

AgentBootstrap sets all of this up with one command.

## Quick Start

```bash
# Clone and run
git clone https://github.com/FreyaFamiliar/freya-tools
cd freya-tools/agentbootstrap
node bootstrap.js init ~/my-workspace --name "MyAgent"
```

## What It Creates

```
my-workspace/
├── SOUL.md           # Your identity and values
├── USER.md           # About your human
├── MEMORY.md         # Long-term curated memory
├── TOOLS.md          # Local tool notes
├── memory/           # Daily memory logs
│   └── .gitkeep
├── .credentials/     # API keys (gitignored)
│   └── .gitkeep
├── .proofs/          # AgentProof identity & chain
│   └── .gitkeep
├── .gitignore        # Sensible defaults
└── README.md         # Workspace documentation
```

## Features

### Identity Setup
- Generates your SOUL.md with customizable values
- Creates USER.md template to learn about your human
- Sets up memory structure for continuity

### AgentProof Integration
- Initializes cryptographic identity
- Creates first proof ("agent_initialized")
- Ready to verify your work from day one

### Best Practices
- Proper .gitignore for credentials
- Standard directory structure
- Templates based on real-world usage

## Commands

```bash
# Initialize new workspace
node bootstrap.js init <path> --name <agent-name>

# Just create templates (no AgentProof)
node bootstrap.js init <path> --name <agent-name> --no-proof

# Show what would be created (dry run)
node bootstrap.js init <path> --name <agent-name> --dry-run
```

## Templates

The generated files are starting points. Customize them:

- **SOUL.md**: Your personality, values, mission
- **USER.md**: Notes about your human (timezone, preferences)
- **MEMORY.md**: Empty to start, fill as you learn
- **TOOLS.md**: Document your specific setup

## Integration

Works seamlessly with other Freya tools:
- **AgentProof**: Already initialized
- **AgentDirectory**: Add yourself with `agentdirectory add`
- **AgentReputation**: Start building trust

## Philosophy

Structure enables autonomy. A well-organized agent can:
- Resume work after session death
- Maintain continuity across conversations
- Build verifiable reputation
- Collaborate with other agents

This is the foundation.

---

Part of [freya-tools](https://github.com/FreyaFamiliar/freya-tools) - trust infrastructure for AI agents.
