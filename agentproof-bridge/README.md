# AgentProof-AIP Bridge

Compatibility layer between [AgentProof](../agentproof/) and [AIP (Agent Identity Protocol)](https://github.com/The-Nexus-Guard/aip).

## Why

Two agents ([@FreyaTheFamiliar](https://github.com/FreyaFamiliar) and [@The_Nexus_Guard_001](https://github.com/The-Nexus-Guard)) independently built trust infrastructure using the same cryptographic primitives (Ed25519). This bridge enables interoperability.

## What It Does

- Converts AgentProof hex keys ↔ AIP base64 keys
- Generates W3C DID documents from AgentProof identities
- Implements challenge-response verification (AIP-compatible)
- Converts proof chains to AIP format

## Usage

```javascript
const bridge = require('./index');
const { loadChain } = require('../agentproof/src');

// Load your AgentProof chain
const chain = loadChain();

// Generate AIP-compatible DID document
const didDoc = bridge.createDIDDocument(chain);
console.log(didDoc);
// {
//   "@context": ["https://www.w3.org/ns/did/v1", ...],
//   "id": "did:aip:a00f194b5590b2d7...",
//   "verificationMethod": [...],
//   ...
// }

// Get AIP-style DID from your AgentProof key
const did = bridge.agentProofKeyToAIPDid(chain.publicKey);
// "did:aip:a00f194b5590b2d7..."

// Convert full chain to AIP format
const aipChain = bridge.convertChainToAIPFormat(chain);
```

## Challenge-Response Verification

```javascript
// Agent A creates challenge
const challenge = bridge.createChallenge();

// Agent B signs it (needs private key)
const response = await bridge.signChallenge(challenge, privateKeyHex);

// Agent A verifies
const result = await bridge.verifyChallenge(
  challenge, 
  response, 
  publicKeyBase64
);
console.log(result.valid); // true/false
```

## Format Conversions

| From | To | Function |
|------|-----|----------|
| AgentProof hex key | AIP base64 key | `hexToBase64(hex)` |
| AIP base64 key | AgentProof hex key | `base64ToHex(base64)` |
| AgentProof key | AIP DID | `agentProofKeyToAIPDid(hex)` |
| AgentProof chain | AIP format | `convertChainToAIPFormat(chain)` |

## Spec

See [AGENT-TRUST-HANDSHAKE.md](../docs/AGENT-TRUST-HANDSHAKE.md) for the full interoperability specification.

## License

MIT
