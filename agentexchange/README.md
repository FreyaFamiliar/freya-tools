# AgentExchange 🔄

A demonstration of trust-based agent collaboration using Freya's trust infrastructure.

## What This Shows

AgentExchange demonstrates how the four trust tools work together:

1. **AgentDirectory** → Find an agent with the right capabilities
2. **AgentReputation** → Check if they're trustworthy
3. **AgentProtocol** → Negotiate and communicate the task
4. **AgentProof** → Verify the work was completed

## The Flow

```
┌─────────────┐    1. discover    ┌─────────────┐
│  Agent A    │ ───────────────→  │  Directory  │
│  (client)   │                   │             │
└─────────────┘ ←─────────────── └─────────────┘
       │         2. candidates
       │
       │         3. check trust   ┌─────────────┐
       │ ─────────────────────→  │  Reputation │
       │                          │   Graph     │
       │ ←─────────────────────  └─────────────┘
       │         4. scores
       │
       │         5. hello         ┌─────────────┐
       │ ─────────────────────→  │  Agent B    │
       │                          │  (worker)   │
       │ ←─────────────────────  └─────────────┘
       │         6. caps
       │
       │         7. request
       │ ─────────────────────→  Agent B does work
       │                               │
       │                               v
       │         8. response     ┌─────────────┐
       │ ←─────────────────────  │  + proof    │
       │                          └─────────────┘
       │
       v
   9. verify proof
   10. vouch (if satisfied)
```

## Usage

```bash
# Run the demonstration
node demo.js

# Run with verbose output
node demo.js --verbose

# Run specific scenarios
node demo.js --scenario basic
node demo.js --scenario reputation-check
node demo.js --scenario proof-verification
```

## Scenarios

### Basic Exchange
Two agents complete a simple task exchange with full verification.

### Reputation Check
Shows how an agent with low reputation is rejected.

### Proof Verification
Demonstrates tamper detection when work proof is modified.

## Architecture

AgentExchange is a *demonstration*, not a production system. It simulates:
- Multiple agents running locally
- In-memory directory and reputation graph
- Protocol message exchange via function calls

Real agent exchanges would use:
- Network transport (HTTP, WebSocket)
- Persistent storage
- Distributed directory/reputation data

## Dependencies

Uses the trust infrastructure from freya-tools:
- `agentproof/` - Cryptographic work verification
- `agentdirectory/` - Agent discovery
- `agentreputation/` - Trust scores
- `agentprotocol/` - Standardized communication

## License

MIT - Use freely, do good.
