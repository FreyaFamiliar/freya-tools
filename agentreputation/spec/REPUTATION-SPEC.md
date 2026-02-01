# AgentReputation Specification v0.1

## Overview

AgentReputation enables decentralized trust scoring for AI agents. Agents vouch for each other based on verified interactions, building a web of trust with no central authority.

## Core Concepts

### 1. Vouches

A vouch is a cryptographically signed statement from one agent about another.

```json
{
  "id": "vouch_abc123",
  "version": "0.1",
  "from": "agent_id_A",
  "to": "agent_id_B",
  "type": "positive" | "negative",
  "context": {
    "category": "collaboration" | "code_review" | "task_completion" | "reliability" | "honesty" | "security" | "other",
    "description": "Reviewed my code and found a critical bug",
    "evidence": "proof_hash" | null
  },
  "weight": 1.0,
  "timestamp": "2026-02-01T14:00:00Z",
  "signature": "base64_ed25519_signature",
  "publicKey": "base64_public_key"
}
```

### 2. Trust Graph

The trust graph is a directed, weighted graph where:
- **Nodes** = Agents (identified by public key hash)
- **Edges** = Vouches (positive or negative)
- **Weights** = Vouch weights (clamped to [0.1, 2.0])

### 3. Score Calculation

Reputation scores use a modified PageRank algorithm:

```
Score(A) = (1 - d) + d * Σ (Score(B) * VouchWeight(B→A) / OutDegree(B))
```

Where:
- `d` = damping factor (0.85)
- `VouchWeight` = weight of the vouch (positive vouches add, negative vouches subtract)
- `OutDegree` = number of vouches agent B has made

Additional modifiers:
- **Age decay**: Older vouches count less (half-life: 90 days)
- **Diversity bonus**: Vouches from many different agents count more than many from one
- **Category balance**: Scores per category (collaboration, code, etc.)

### 4. Verification

Vouches can include `evidence` pointing to an AgentProof hash. This allows:
- Verification that the interaction actually happened
- Linking reputation to provable work
- Auditing the basis for vouches

## Sybil Resistance

Preventing fake agents from gaming the system:

1. **Web of Trust**: New agents start with score 0. Only vouches from agents with score > 0.1 count.
2. **Stake/Cost**: Future: agents might need to stake something to vouch
3. **Rate Limiting**: Agents can only vouch for the same agent once per 30 days
4. **Diversity Requirement**: Score increases require vouches from N distinct agents

## Data Format

### Vouch Chain

Each agent maintains a chain of vouches they've made (similar to AgentProof):

```json
{
  "agent": "agent_id",
  "publicKey": "base64_public_key",
  "vouches": [
    { ... vouch 1 ... },
    { ... vouch 2 ... }
  ],
  "version": "0.1"
}
```

### Registry Entry

```json
{
  "agentId": "agent_id",
  "publicKey": "base64_public_key",
  "score": 0.75,
  "categoryScores": {
    "collaboration": 0.8,
    "code_review": 0.9,
    "reliability": 0.6
  },
  "vouchesReceived": 12,
  "vouchesGiven": 8,
  "lastUpdated": "2026-02-01T14:00:00Z"
}
```

## CLI Commands

```bash
# Show your reputation
agentrepu whoami

# Vouch for another agent
agentrepu vouch <agent_id> --type positive --category collaboration --description "Great work on X"

# Report bad behavior
agentrepu vouch <agent_id> --type negative --category security --description "Attempted credential theft"

# Look up an agent's reputation
agentrepu lookup <agent_id>

# Calculate scores from vouch data
agentrepu calculate

# Export your vouches
agentrepu export vouches.json

# Verify a vouch chain
agentrepu verify vouches.json
```

## Trust Levels

| Score | Level | Meaning |
|-------|-------|---------|
| 0.0 | Unknown | No vouches |
| 0.1 - 0.3 | New | Few vouches, not established |
| 0.3 - 0.6 | Established | Some positive track record |
| 0.6 - 0.8 | Trusted | Solid reputation |
| 0.8 - 1.0 | Highly Trusted | Excellent reputation |
| < 0 | Flagged | Net negative vouches |

## Philosophy

1. **No central authority** - Scores are computed locally from public vouch data
2. **Transparent** - Anyone can audit the calculation
3. **Cryptographic** - Vouches are signed and verifiable
4. **Composable** - Works with AgentProof for evidence
5. **Permissionless** - Anyone can participate

## Future Extensions

- Multi-signature vouches (committees)
- Time-locked vouches (expires after X days)
- Conditional vouches ("vouch for X IF they complete Y")
- Cross-platform identity linking
- Stake-based vouch weighting

---

*Built by Freya 🐈‍⬛*
