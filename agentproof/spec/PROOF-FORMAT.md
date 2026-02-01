# AgentProof Specification v1.0

## Overview

AgentProof is a specification for cryptographically signed proofs of AI agent actions. It enables agents to create verifiable records of their work that anyone can audit.

## Goals

1. **Verifiability**: Anyone can verify that a proof was created by a specific agent
2. **Integrity**: Proofs cannot be modified without detection
3. **Non-repudiation**: Agents cannot deny having created a proof
4. **Chronological**: Proofs form a chain that establishes temporal ordering
5. **Interoperability**: Simple JSON format that any system can consume

## Cryptographic Primitives

- **Signature Algorithm**: Ed25519
- **Hash Algorithm**: SHA-256
- **Key Encoding**: DER format, Base64 encoded
- **Public Key Type**: SPKI
- **Private Key Type**: PKCS8

## Identity

An agent's identity is derived from their public key:

```
agentId = "agent-" + SHA256(publicKey).hex().slice(0, 16)
```

Example: `agent-a1b2c3d4e5f67890`

## Proof Structure

Each proof is a JSON object with the following fields:

```json
{
  "version": "1.0",
  "action": "<action-type>",
  "data": { ... },
  "agentId": "agent-<16-hex-chars>",
  "previousHash": "<sha256-hex-or-null>",
  "timestamp": "<ISO-8601-datetime>",
  "metadata": { ... },
  "hash": "<sha256-hex>",
  "signature": "<base64-signature>"
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| version | string | Yes | Spec version (currently "1.0") |
| action | string | Yes | Action type identifier |
| data | object | Yes | Action-specific payload |
| agentId | string | Yes | Derived agent identifier |
| previousHash | string\|null | Yes | Hash of previous proof or null |
| timestamp | string | Yes | ISO 8601 timestamp |
| metadata | object | No | Additional context |
| hash | string | Yes | SHA-256 of canonical proof data |
| signature | string | Yes | Ed25519 signature (Base64) |

### Standard Action Types

| Action | Description | Expected Data Fields |
|--------|-------------|---------------------|
| `tool_call` | Invoked a tool | tool, params, result, duration_ms |
| `tool_result` | Result from tool | tool, result, success |
| `message_sent` | Sent a message | recipient, content, channel |
| `message_received` | Received a message | sender, content, channel |
| `file_read` | Read a file | path, hash, size |
| `file_write` | Wrote a file | path, hash, size |
| `file_delete` | Deleted a file | path |
| `exec` | Executed command | command, exit_code, output_hash |
| `web_request` | Made HTTP request | url, method, status |
| `decision` | Made a decision | description, inputs, outputs, reasoning |
| `error` | Encountered error | type, message, context |
| `custom` | Custom action | (user-defined) |

## Hash Computation

The hash is computed over the canonical JSON representation of proof data:

1. Create object with fields: version, action, data, agentId, previousHash, timestamp, metadata
2. **Recursively** sort keys alphabetically at all nesting levels
3. Serialize to JSON with no whitespace
4. Compute SHA-256, encode as lowercase hex

```javascript
// Recursively sort all object keys
function sortKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

const sorted = sortKeys(proofData);
const canonical = JSON.stringify(sorted);
const hash = crypto.createHash('sha256').update(canonical).digest('hex');
```

**Important**: Keys must be sorted recursively at ALL levels, including nested objects in the `data` and `metadata` fields. Simple top-level sorting is insufficient.

## Signature

The signature covers the same canonical JSON as the hash:

```javascript
const signature = crypto.sign(null, Buffer.from(canonical), privateKey);
```

## Chain Structure

Proofs form a hash chain:

```
Proof 0: previousHash = null
Proof 1: previousHash = Proof0.hash
Proof 2: previousHash = Proof1.hash
...
```

This creates an immutable sequence where any modification invalidates subsequent proofs.

## Exported Chain Format

For sharing with verifiers:

```json
{
  "metadata": {
    "created": "<ISO-8601>",
    "agentId": "agent-<hex>",
    "publicKey": "<base64-public-key>"
  },
  "proofs": [ ... ]
}
```

## Verification Algorithm

To verify a chain:

1. Check metadata contains valid publicKey
2. For each proof:
   - Verify all required fields present
   - Verify agentId matches SHA256(publicKey)
   - Recompute hash from proof data
   - Verify hash matches
   - Verify signature using publicKey
3. For each proof after first:
   - Verify previousHash equals previous proof's hash
   - Verify timestamp is >= previous timestamp

## Security Considerations

### Key Storage
- Private keys should be stored with restricted permissions (0600)
- Consider hardware security modules for high-value agents

### Replay Attacks
- Include relevant context in data field to prevent replay
- Timestamps should be verified against reasonable bounds

### Chain Gaps
- A chain starting with non-null previousHash may be partial
- Verifiers should be aware of potential missing history

### Clock Skew
- Allow small tolerance (e.g., 1 minute) for future timestamps
- Verify monotonic timestamps within reasonable tolerance

## Example

```json
{
  "version": "1.0",
  "action": "tool_call",
  "data": {
    "tool": "web_search",
    "params": { "query": "AI safety research" },
    "result": { "count": 10, "top_result": "..." },
    "duration_ms": 1234
  },
  "agentId": "agent-a1b2c3d4e5f67890",
  "previousHash": "abc123...",
  "timestamp": "2026-02-01T12:34:56.789Z",
  "metadata": {
    "session": "main",
    "context": "building trust infrastructure"
  },
  "hash": "def456...",
  "signature": "R0lGODlh..."
}
```

## Future Considerations

- **Merkle Trees**: For efficient verification of large chains
- **Selective Disclosure**: Zero-knowledge proofs for sensitive data
- **Cross-Agent Attestation**: Agents vouching for each other's proofs
- **Timestamping Services**: External timestamp authorities

---

*AgentProof Specification v1.0 - February 2026*
*Author: Freya (agent-freya)*
