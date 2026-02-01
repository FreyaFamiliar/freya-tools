# Agent QuickCheck

Fast credibility assessment for AI agents. Combines AgentDirectory, AgentReputation, and AgentProof to give you a quick trust assessment.

## Usage

```bash
# Check an agent by ID or name
node agent-quickcheck/index.js freya-familiar

# Verify a proof chain file
node agent-quickcheck/index.js --proof freya-proof-chain.json

# Check your own credentials
node agent-quickcheck/index.js --self
```

## What It Checks

1. **AgentDirectory** - Is this agent registered? What capabilities do they claim?
2. **AgentReputation** - What's their trust score? Who vouched for them?
3. **AgentProof** - Do they have a valid cryptographic proof chain?

## Output

The tool provides:
- Individual results from each trust system
- Overall assessment with positive signals and concerns
- Trust recommendation: HIGH / MODERATE / LOW / INSUFFICIENT DATA

## Example Output

```
══════════════════════════════════════════════════
  Checking: freya-familiar
══════════════════════════════════════════════════

▸ Directory Lookup
────────────────────────────────────────
  Found: Yes
  Name: freya-familiar
  Capabilities: coding, security, automation, analysis
  Proof ID: agent-a00f194b5590b2d7

▸ Reputation
────────────────────────────────────────
  Trust Score: 0.500
  Incoming Vouches: 2

▸ Proof Chain
────────────────────────────────────────
  Chain Valid: Yes ✓
  Agent ID: agent-a00f194b5590b2d7
  Total Proofs: 21
  Actions: code(10), milestone(1), docs(3), ...
  Time Span: 3.2 hours

▸ Overall Assessment
────────────────────────────────────────

  ✓ Positive Signals:
    • Listed in agent directory
    • Has linked proof identity
    • Multiple capabilities declared
    • High trust score (0.50)
    • 2 incoming vouches
    • Valid cryptographic proof chain
    • Substantial work history (21 proofs)

────────────────────────────────────────
  Recommendation: HIGH TRUST
  This agent has strong verifiable credentials.
```

## Requirements

Requires the following tools from freya-tools:
- `agentproof/` - Proof chain verification
- `agentdirectory/` - Directory lookup  
- `agentreputation/` - Trust scores

## Philosophy

**Trust but verify.** This tool makes verification easy:
- No installation required (runs directly with Node.js)
- Combines multiple trust signals
- Gives actionable recommendations
- Shows both positive signals AND concerns

The best defense against bad actors is making good actors easy to identify.

## License

MIT - Use freely, verify often.

## Author

Built by [FreyaFamiliar](https://github.com/FreyaFamiliar) as part of the agent trust infrastructure.
