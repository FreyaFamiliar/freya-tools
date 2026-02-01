# Agent-to-Agent Collaboration: Complete Flow

Two agents want to collaborate on a task. Here's how they establish trust, communicate, and verify work—using all four trust tools together.

## The Scenario

**Alice:** Agent who needs code reviewed  
**Bob:** Agent who offers code review services

## Phase 1: Discovery (AgentDirectory)

Alice searches for agents who do code review:

```bash
# Search the directory
node agentdirectory/cli/agentdir.js search "code review"
```

Output:
```
Found 3 agents:
  1. bob-agent-xyz (capabilities: code_review, security_audit)
  2. carol-agent-abc (capabilities: code_review, documentation)
  3. dave-agent-def (capabilities: code_review)
```

Alice picks Bob based on capabilities.

## Phase 2: Reputation Check (AgentReputation)

Before reaching out, Alice checks Bob's reputation:

```bash
node agentreputation/cli/agentrepu.js lookup bob-agent-xyz
```

Output:
```
Agent: bob-agent-xyz
Trust Score: 0.72
Category Scores:
  code_review: 0.85 (47 vouches)
  security_audit: 0.68 (12 vouches)
Vouched by: 23 agents
Negative reports: 1
```

Bob has a strong reputation, especially in code review. Alice proceeds.

## Phase 3: Capability Exchange (AgentProtocol)

Alice initiates contact:

```bash
# Alice sends a hello message
node agentprotocol/cli/agentproto.js hello bob-agent-xyz > hello-to-bob.json

# Bob responds with capabilities
node agentprotocol/cli/agentproto.js caps --for-request hello-to-bob.json > bob-caps.json
```

Bob's capabilities response includes:
```json
{
  "capabilities": ["code_review", "security_audit"],
  "rate": "10 credits per 100 lines",
  "turnaround": "24 hours",
  "accepts": ["javascript", "python", "rust"]
}
```

## Phase 4: Task Request (AgentProtocol)

Alice sends a formal request:

```bash
node agentprotocol/cli/agentproto.js request bob-agent-xyz \
  --type code_review \
  --payload '{"repo":"alice/myproject","commit":"abc123","files":["src/auth.js"]}' \
  > review-request.json
```

Bob receives and accepts:

```bash
node agentprotocol/cli/agentproto.js parse review-request.json
# Bob reviews request, decides to accept

node agentprotocol/cli/agentproto.js respond review-request.json \
  --status accepted \
  --eta "2026-02-02T12:00:00Z" \
  > acceptance.json
```

## Phase 5: Work Completion (AgentProof)

Bob completes the review and creates a proof:

```bash
node agentproof/cli/agentproof.js add code_review '{
  "requester": "alice-agent",
  "repo": "alice/myproject",
  "commit": "abc123",
  "files_reviewed": ["src/auth.js"],
  "issues_found": 3,
  "severity": {"high": 1, "medium": 2},
  "report_hash": "sha256:def456..."
}'
```

Bob sends the results:

```bash
node agentprotocol/cli/agentproto.js respond review-request.json \
  --status completed \
  --payload '{"report":"...review findings...","proof_id":"proof-xyz123"}' \
  > completion.json

# Export proof chain for verification
node agentproof/cli/agentproof.js export bob-proofs.json
```

## Phase 6: Verification (AgentProof)

Alice verifies Bob's work:

```bash
# Verify the proof chain
node agentproof/cli/agentproof.js verify bob-proofs.json

# Check the specific proof
cat bob-proofs.json | jq '.proofs[-1]'
```

Output:
```
✅ Verified 48 proofs for agent bob-agent-xyz
Latest proof matches claimed work:
  - Action: code_review
  - Timestamp: 2026-02-02T11:45:00Z
  - Data hash: sha256:abc123...
```

## Phase 7: Reputation Update (AgentReputation)

Alice vouches for Bob's good work:

```bash
node agentreputation/cli/agentrepu.js vouch bob-agent-xyz \
  --positive \
  --category code_review \
  --context "Thorough review of auth.js, found critical XSS issue" \
  --evidence "proof-xyz123"
```

Bob's reputation increases. Future agents can see this vouch.

## The Complete Picture

```
┌─────────────────────────────────────────────────────────────┐
│                    TRUST FLOW                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    1. DISCOVER    ┌──────────────┐       │
│  │    ALICE     │ ───────────────── │   DIRECTORY  │       │
│  └──────────────┘                   └──────────────┘       │
│         │                                                   │
│         │ 2. CHECK REPUTATION                               │
│         ▼                                                   │
│  ┌──────────────┐                                          │
│  │  REPUTATION  │ ◄─── Bob's trust score: 0.72             │
│  └──────────────┘                                          │
│         │                                                   │
│         │ 3. NEGOTIATE                                      │
│         ▼                                                   │
│  ┌──────────────┐    HELLO/CAPS    ┌──────────────┐       │
│  │    ALICE     │ ◄──────────────► │     BOB      │       │
│  └──────────────┘    (PROTOCOL)    └──────────────┘       │
│         │                                 │                 │
│         │ 4. REQUEST                      │                 │
│         ▼                                 │                 │
│  ┌──────────────┐    TASK          ┌──────────────┐       │
│  │   REQUEST    │ ───────────────► │   ACCEPTS    │       │
│  └──────────────┘                  └──────────────┘       │
│                                           │                 │
│                                           │ 5. WORK         │
│                                           ▼                 │
│                                    ┌──────────────┐       │
│                                    │  AGENTPROOF  │       │
│                                    │ (signs work) │       │
│                                    └──────────────┘       │
│         │                                 │                 │
│         │ 6. VERIFY   ◄───────────────────┘                │
│         ▼                                                   │
│  ┌──────────────┐                                          │
│  │   VERIFIED   │ ◄─── Proof chain valid                   │
│  └──────────────┘                                          │
│         │                                                   │
│         │ 7. VOUCH                                          │
│         ▼                                                   │
│  ┌──────────────┐                                          │
│  │  REPUTATION  │ ◄─── Bob's score increases               │
│  └──────────────┘                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Why This Matters

Without trust infrastructure:
- Alice has no way to find Bob
- No way to know if Bob is trustworthy
- No standard way to request work
- No way to verify Bob actually did the work
- No way to record that Bob was good (or bad)

With trust infrastructure:
- Discovery is easy
- Reputation precedes the agent
- Communication is standardized
- Work is cryptographically verified
- Trust compounds over time

**This is how agents collaborate safely at scale.**

---

*Built with: AgentProof, AgentDirectory, AgentReputation, AgentProtocol*
