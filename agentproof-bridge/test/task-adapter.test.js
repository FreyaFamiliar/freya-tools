/**
 * Tests for TaskProofAdapter
 * Simple assert-based tests (no test framework required)
 */

const assert = require('assert');
const { TaskProofAdapter, TaskProofTypes } = require('../adapters/task-adapter');

console.log('Running TaskProofAdapter tests...\n');

// Mock ProofChain for testing
class MockProofChain {
  constructor(agentId) {
    this.agentId = agentId;
    this.proofs = [];
    this.proofCount = 0;
  }

  async addProof(data) {
    const proof = {
      id: this.proofCount++,
      data: data,
      timestamp: new Date().toISOString(),
      hash: `mock-hash-${this.proofCount}`,
      previousHash: this.proofCount > 1 ? `mock-hash-${this.proofCount - 1}` : null,
      signature: `mock-signature-${this.proofCount}`
    };
    this.proofs.push(proof);
    return proof;
  }
}

// Test counter
let passed = 0;
let failed = 0;

async function runTests() {
  // Test 1: Constructor requires ProofChain
  console.log('Test 1: Constructor requires ProofChain');
  try {
    let threw = false;
    try {
      new TaskProofAdapter();
    } catch (e) {
      threw = true;
      assert(e.message.includes('requires a ProofChain'));
    }
    assert(threw, 'Should have thrown an error');
    console.log('  ✅ Passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 2: taskAssigned creates proof with correct type
  console.log('Test 2: taskAssigned creates proof with correct type');
  try {
    const chain = new MockProofChain('test-agent');
    const adapter = new TaskProofAdapter(chain);
    const task = {
      id: 'task-001',
      name: 'Test Task',
      priority: 'high',
      createdAt: '2026-02-02T12:00:00Z'
    };

    const proof = await adapter.taskAssigned(task, 'assigned-agent');
    
    assert.strictEqual(proof.data.type, TaskProofTypes.ASSIGNED);
    assert.strictEqual(proof.data.taskId, 'task-001');
    assert.strictEqual(proof.data.assignedTo, 'assigned-agent');
    assert.strictEqual(proof.data.priority, 'high');
    console.log('  ✅ Passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 3: taskClaimed records claiming agent
  console.log('Test 3: taskClaimed records claiming agent');
  try {
    const chain = new MockProofChain('test-agent');
    const adapter = new TaskProofAdapter(chain);
    const task = { id: 'task-002', name: 'Claim Test', createdAt: '2026-02-02' };
    
    const proof = await adapter.taskClaimed(task);
    
    assert.strictEqual(proof.data.type, TaskProofTypes.CLAIMED);
    assert.strictEqual(proof.data.claimedBy, 'test-agent');
    console.log('  ✅ Passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 4: taskCompleted includes result hash
  console.log('Test 4: taskCompleted includes result hash');
  try {
    const chain = new MockProofChain('test-agent');
    const adapter = new TaskProofAdapter(chain);
    const task = { id: 'task-003', name: 'Complete Test', createdAt: '2026-02-02' };
    const result = {
      summary: 'Successfully processed 100 items',
      metrics: { itemsProcessed: 100, errorsCount: 0 }
    };
    
    const proof = await adapter.taskCompleted(task, result);
    
    assert.strictEqual(proof.data.type, TaskProofTypes.COMPLETED);
    assert(proof.data.result.hash, 'Should have result hash');
    assert.strictEqual(proof.data.result.summary, 'Successfully processed 100 items');
    console.log('  ✅ Passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 5: taskFailed records error info
  console.log('Test 5: taskFailed records error info');
  try {
    const chain = new MockProofChain('test-agent');
    const adapter = new TaskProofAdapter(chain);
    const task = { id: 'task-004', name: 'Fail Test', createdAt: '2026-02-02' };
    const error = {
      code: 'TIMEOUT',
      message: 'Task timed out after 30 seconds',
      recoverable: true
    };
    
    const proof = await adapter.taskFailed(task, error);
    
    assert.strictEqual(proof.data.type, TaskProofTypes.FAILED);
    assert.strictEqual(proof.data.error.code, 'TIMEOUT');
    assert.strictEqual(proof.data.error.recoverable, true);
    console.log('  ✅ Passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 6: taskDelegated records handoff
  console.log('Test 6: taskDelegated records handoff');
  try {
    const chain = new MockProofChain('test-agent');
    const adapter = new TaskProofAdapter(chain);
    const task = { id: 'task-005', name: 'Delegate Test', createdAt: '2026-02-02' };
    
    const proof = await adapter.taskDelegated(task, 'other-agent', 'Requires specialized skills');
    
    assert.strictEqual(proof.data.type, TaskProofTypes.DELEGATED);
    assert.strictEqual(proof.data.delegatedFrom, 'test-agent');
    assert.strictEqual(proof.data.delegatedTo, 'other-agent');
    console.log('  ✅ Passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 7: Full task lifecycle
  console.log('Test 7: Full task lifecycle');
  try {
    const chain = new MockProofChain('test-agent');
    const adapter = new TaskProofAdapter(chain);
    const task = {
      id: 'task-full',
      name: 'Full Lifecycle Test',
      priority: 'medium',
      createdAt: '2026-02-02T10:00:00Z'
    };

    // Full lifecycle
    await adapter.taskAssigned(task, 'worker-agent');
    await adapter.taskClaimed(task);
    await adapter.taskStarted(task);
    await adapter.taskProgress(task, { percent: 50, message: 'Halfway done' });
    await adapter.taskCompleted(task, { summary: 'Done!', metrics: { time: 30 } });

    assert.strictEqual(chain.proofs.length, 5, 'Should have 5 proofs');
    
    // Verify history
    const history = adapter.getTaskHistory('task-full');
    assert.strictEqual(history.length, 5, 'History should have 5 entries');

    // Verify completion
    const verification = adapter.verifyTaskCompletion('task-full');
    assert.strictEqual(verification.complete, true, 'Should be complete');
    assert.strictEqual(verification.stages.assigned, true, 'Should have assigned');
    assert.strictEqual(verification.stages.claimed, true, 'Should have claimed');
    assert.strictEqual(verification.stages.completed, true, 'Should have completed');
    console.log('  ✅ Passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 8: Incomplete lifecycle detected
  console.log('Test 8: Incomplete lifecycle detected');
  try {
    const chain = new MockProofChain('test-agent');
    const adapter = new TaskProofAdapter(chain);
    const task = { id: 'task-incomplete', name: 'Incomplete', createdAt: '2026-02-02' };

    // Only assign, don't complete
    await adapter.taskAssigned(task, 'worker-agent');

    const verification = adapter.verifyTaskCompletion('task-incomplete');
    assert.strictEqual(verification.complete, false, 'Should not be complete');
    assert.strictEqual(verification.stages.claimed, false, 'Should not have claimed');
    console.log('  ✅ Passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}\n`);
    failed++;
  }

  // Summary
  console.log('='.repeat(40));
  if (failed === 0) {
    console.log(`All ${passed} TaskProofAdapter tests passed! ✅`);
  } else {
    console.log(`${passed} passed, ${failed} failed ❌`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
