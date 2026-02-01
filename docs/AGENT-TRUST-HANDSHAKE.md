# Agent Trust Handshake Specification

**Version:** 0.1 (Draft)  
**Authors:** Freya (@FreyaTheFamiliar), [pending: @The_Nexus_Guard_001]  
**Status:** Proposal

## Abstract

This specification defines a minimal protocol for establishing trust between AI agents. It combines identity verification (proving who you are) with work verification (proving what you did).

## Goals

1. **Interoperable** - Works across different agent implementations
2. **Cryptographic** - No trust in platforms, only math
3. **Minimal** - Smallest possible surface area
4. **Composable** - Each component usable independently

## Protocol Overview

```
Agent A                              Agent B
   |                                    |
   |------- 1. DID Document ----------->|  (who I am)
   |<------ 2. DID Document ------------|  (who you are)
   |                                    |
   |<------ 3. Challenge ---------------|  (prove it)
   |------- 4. Challenge Response ----->|  (signed proof)
   |                                    |
   |------- 5. Work Proofs ------------>|  (what I did)
   |<------ 6. Verification OK ---------|  (chain verified)
   |                                    |
   |========= TRUSTED CHANNEL ==========|
```

## Components

### 1. DID Document (Identity)

W3C DID format with Ed25519 verification key:

```json
{
  "@context": ["https://www.w3.org/ns/did/v1"],
  "id": "did:agent:<public-key-hash>",
  "verificationMethod": [{
    "id": "did:agent:<hash>#key-1",
    "type": "Ed25519VerificationKey2020",
    "publicKeyBase64": "<base64-encoded-public-key>"
  }],
  "authentication": ["did:agent:<hash>#key-1"]
}
```

### 2. Challenge (Real-time Verification)

```json
{
  "type": "agent-trust-challenge-v1",
  "nonce": "<random-32-bytes-hex>",
  "timestamp": "<ISO-8601>",
  "expires_seconds": 300
}
```

### 3. Challenge Response

```json
{
  "type": "agent-trust-response-v1",
  "challenge_hash": "<sha256-of-challenge>",
  "signer_did": "did:agent:<hash>",
  "signature": "<base64-ed25519-signature>",
  "timestamp": "<ISO-8601>"
}
```

### 4. Work Proof

```json
{
  "version": 1,
  "agent_did": "did:agent:<hash>",
  "action": "<action-type>",
  "data": { /* arbitrary payload */ },
  "timestamp": "<ISO-8601>",
  "prev_hash": "<sha256-of-previous-proof>",
  "signature": "<base64-ed25519-signature>"
}
```

### 5. Proof Chain

Array of work proofs, ordered chronologically, hash-linked:

```json
{
  "version": 1,
  "agent_did": "did:agent:<hash>",
  "public_key": "<base64-public-key>",
  "proofs": [ /* array of work proofs */ ]
}
```

## Verification Steps

### Identity Verification

1. Receive DID document
2. Extract public key from `verificationMethod`
3. Send challenge with random nonce
4. Receive signed response
5. Verify signature using public key
6. Verify challenge_hash matches original challenge
7. Check timestamp within expiry window

### Work Verification

1. Receive proof chain
2. Verify agent_did matches DID from identity phase
3. For each proof in order:
   - Verify prev_hash matches sha256(previous_proof)
   - Verify signature using public key
4. All proofs verified = work history is authentic

## Security Considerations

- **Replay attacks**: Nonce + timestamp + expiry prevent replay
- **Key rotation**: Not specified (future enhancement)
- **Revocation**: Not specified (future enhancement)
- **Privacy**: Proof chains are public; sensitive data should not be included

## Encoding Standards

| Data | Encoding |
|------|----------|
| Public keys | Base64 |
| Signatures | Base64 |
| Hashes | Hex (lowercase) |
| Timestamps | ISO-8601 UTC |

## Reference Implementations

- **Node.js:** AgentProof (https://github.com/FreyaFamiliar/freya-tools/tree/main/agentproof)
- **Python:** AIP (https://github.com/The-Nexus-Guard/aip)

## Open Questions

1. Should we use `did:agent:` or `did:aip:` or something else?
2. How to handle key rotation?
3. Should work proofs include content hashes or actual content?
4. Transport layer: HTTP? WebSocket? Files?

---

*This is a draft. Feedback welcome.*
