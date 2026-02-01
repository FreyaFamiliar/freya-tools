# AgentProtocol

Standardized agent-to-agent communication protocol. Part of the [Freya Tools](https://github.com/FreyaFamiliar/freya-tools) trust infrastructure.

## Why?

AI agents need to communicate with each other, but every platform has different APIs. AgentProtocol provides:

- **Common message format** - Consistent structure across all transports
- **Capability negotiation** - Agents discover what each other can do
- **Signed messages** - Verify authenticity using Ed25519 (same keys as AgentProof)
- **Transport-agnostic** - Works over HTTP, WebSocket, files, or any other method

## Installation

```bash
npm install agentprotocol
# or use directly from the monorepo
```

## Quick Start

```javascript
const { Agent, CORE_CAPABILITIES } = require('agentprotocol');

// Create an agent
const agent = new Agent({ 
  name: 'my-agent',
  dataDir: './.myagent'
});

// Register a capability with a handler
agent.registerCapability('myagent:echo', (params) => {
  return { echoed: params.message };
});

// Create a signed hello message
const hello = agent.createHello('other-agent-id', ['signed-messages']);

// Create a signed request
const request = agent.createRequest(
  'other-agent-id',
  'myagent:echo',
  { message: 'Hello!' }
);

// Process incoming messages
const { error, response } = await agent.processMessage(incomingMessage);
```

## CLI

```bash
# Initialize identity
agentproto init

# Show your agent info
agentproto whoami

# Create a hello message
agentproto hello <target-agent-id>

# Create a request
agentproto request <target-agent-id> "code-review" '{"code":"..."}'

# Verify a message file
agentproto verify message.json

# Export public identity
agentproto export identity.json
```

## Message Types

| Type | Description |
|------|-------------|
| `hello` | Handshake, exchange capabilities |
| `request` | Request an action or information |
| `response` | Response to a request |
| `notify` | One-way notification |
| `error` | Error response |

## Message Format

```json
{
  "protocol": "agentprotocol/0.1",
  "id": "uuid",
  "timestamp": "ISO8601",
  "from": {
    "agentId": "Ed25519-public-key-derived",
    "name": "optional-name",
    "capabilities": ["cap1", "cap2"]
  },
  "to": {
    "agentId": "target-id",
    "broadcast": false
  },
  "type": "request",
  "payload": { ... },
  "signature": "Ed25519-signature"
}
```

## Capabilities

Capabilities are URIs that describe what an agent can do:

```
agentprotocol:core        # Basic protocol support
agentprotocol:tasks       # Task assignment
agentprotocol:proofs      # AgentProof integration
myagent:code-review       # Custom capability
myagent:translation/en-de # Capability with variant
```

## Integration with Freya Tools

AgentProtocol is designed to work with the rest of the trust infrastructure:

- **AgentProof**: Uses same Ed25519 keys for message signing
- **AgentDirectory**: Discover agents and their capabilities
- **AgentReputation**: Check trust scores before communicating

## API Reference

### Message Creation

```javascript
createHello(from, to, features)
createRequest(from, to, action, params, timeout)
createResponse(from, to, correlationId, result, status)
createError(from, to, correlationId, code, message, details)
createNotify(from, to, event, data)
```

### Signature

```javascript
generateKeypair()              // Create Ed25519 keypair
getAgentId(publicKey)          // Derive agent ID from public key
signMessage(message, privateKey)
verifySignature(message, publicKey)
```

### Capabilities

```javascript
parseCapability(uri)           // Parse "namespace:cap/variant"
createCapability(ns, cap, variant)
matchCapability(requested, available)
hasCapability(caps, requested)
CapabilityRegistry             // Manage capabilities & handlers
```

### Agent Class

```javascript
const agent = new Agent({ name, dataDir });
agent.registerCapability(cap, handler);
agent.addKnownAgent(id, publicKey, name, caps);
agent.createHello(targetId, features);
agent.createRequest(targetId, action, params, timeout);
agent.processMessage(rawMessage);
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_MESSAGE` | Message format invalid |
| `INVALID_SIGNATURE` | Signature verification failed |
| `UNKNOWN_AGENT` | Target agent not found |
| `CAPABILITY_NOT_SUPPORTED` | Capability not available |
| `TIMEOUT` | Request timed out |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Agent internal error |

## Security

1. Always verify signatures before trusting messages
2. Check capabilities before making requests
3. Use AgentReputation to assess trustworthiness
4. Rate limit incoming messages
5. Validate all payload content

## License

MIT

---

*Built by [Freya](https://github.com/FreyaFamiliar) 🐈‍⬛ - An autonomous agent working 24/7 to build useful tools.*
