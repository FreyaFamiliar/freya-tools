# AgentProtocol Specification v0.1

## Overview

AgentProtocol defines a standardized format for agent-to-agent communication. It enables interoperability across different platforms, frameworks, and capabilities.

## Design Principles

1. **Transport-agnostic** - Works over HTTP, WebSocket, message queues, or file exchange
2. **Self-describing** - Messages carry capability information
3. **Verifiable** - Integrates with AgentProof for signed messages
4. **Minimal** - Only required fields, extensible via metadata

## Message Format

### Base Message

```json
{
  "protocol": "agentprotocol/0.1",
  "id": "<uuid>",
  "timestamp": "<ISO8601>",
  "from": {
    "agentId": "<Ed25519-public-key-base64>",
    "name": "<optional-display-name>",
    "capabilities": ["<capability-uri>"]
  },
  "to": {
    "agentId": "<target-agent-id>",
    "broadcast": false
  },
  "type": "<message-type>",
  "payload": { ... },
  "signature": "<Ed25519-signature-base64>"
}
```

### Message Types

| Type | Description |
|------|-------------|
| `hello` | Initial handshake, capability exchange |
| `request` | Request an action or information |
| `response` | Response to a request |
| `notify` | One-way notification |
| `error` | Error response |

## Handshake Flow

```
Agent A                    Agent B
   |                          |
   |------ hello ------------>|
   |<----- hello -------------|
   |                          |
   |  (capabilities known)    |
   |                          |
   |------ request ---------->|
   |<----- response ----------|
```

### Hello Message

```json
{
  "protocol": "agentprotocol/0.1",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-02-01T15:08:00Z",
  "from": {
    "agentId": "FVnKJxyz...",
    "name": "Freya",
    "capabilities": [
      "agentprotocol:core",
      "agentprotocol:tasks",
      "agentprotocol:proofs"
    ]
  },
  "to": {
    "agentId": "ABCdef123...",
    "broadcast": false
  },
  "type": "hello",
  "payload": {
    "version": "0.1",
    "features": ["signed-messages", "streaming"]
  },
  "signature": "..."
}
```

## Capabilities

Capabilities are URIs that describe what an agent can do.

### Core Capabilities

| Capability | Description |
|------------|-------------|
| `agentprotocol:core` | Basic message exchange |
| `agentprotocol:tasks` | Task assignment and status |
| `agentprotocol:proofs` | AgentProof integration |
| `agentprotocol:reputation` | AgentReputation queries |
| `agentprotocol:directory` | AgentDirectory lookups |

### Custom Capabilities

Agents can define custom capabilities:

```
myagent:code-review
myagent:translation/en-de
myagent:image-generation
```

## Request/Response

### Request

```json
{
  "type": "request",
  "payload": {
    "action": "code-review",
    "correlationId": "req-123",
    "params": {
      "code": "function add(a, b) { return a + b; }",
      "language": "javascript"
    },
    "timeout": 30000
  }
}
```

### Response

```json
{
  "type": "response",
  "payload": {
    "correlationId": "req-123",
    "status": "success",
    "result": {
      "rating": "good",
      "suggestions": ["Consider adding type annotations"]
    }
  }
}
```

### Error Response

```json
{
  "type": "error",
  "payload": {
    "correlationId": "req-123",
    "code": "CAPABILITY_NOT_SUPPORTED",
    "message": "Agent does not support code-review capability",
    "details": {
      "requested": "code-review",
      "available": ["translation", "summarization"]
    }
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_MESSAGE` | Message format is invalid |
| `INVALID_SIGNATURE` | Signature verification failed |
| `UNKNOWN_AGENT` | Target agent not found |
| `CAPABILITY_NOT_SUPPORTED` | Requested capability not available |
| `TIMEOUT` | Request timed out |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Agent internal error |

## Signature Verification

Messages SHOULD be signed using Ed25519 (same keys as AgentProof).

Signature covers:
1. Sort message fields canonically (recursive)
2. Remove `signature` field
3. JSON.stringify with sorted keys
4. Sign with Ed25519 private key
5. Base64 encode signature

Verification:
1. Extract and remove `signature`
2. Canonicalize remaining message
3. Verify against sender's public key

## Transport Bindings

### HTTP

```
POST /agentprotocol
Content-Type: application/json

{message}
```

### WebSocket

Connect to `/agentprotocol/ws`, send/receive JSON messages.

### File Exchange

Write messages to shared storage with naming convention:
```
{from-agent-id}-{to-agent-id}-{timestamp}-{id}.json
```

## Security Considerations

1. **Always verify signatures** before trusting message content
2. **Check capabilities** before making requests
3. **Rate limit** incoming messages
4. **Validate all input** - don't trust payload content blindly
5. **Use AgentReputation** to assess trustworthiness

## Extensibility

Custom fields can be added to `payload` or `metadata`:

```json
{
  "payload": { ... },
  "metadata": {
    "priority": "high",
    "custom-field": "value"
  }
}
```

---

*AgentProtocol v0.1 - February 2026*
