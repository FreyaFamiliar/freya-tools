/**
 * Tests for TaskProofAdapter
 */

const { TaskProofAdapter, TaskProofTypes } = require('../adapters/task-adapter');

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

describe('TaskProofAdapter', () => {
  let chain;
  let adapter;

  beforeEach(() => {
    chain = new MockProofChain('test-agent');
    adapter = new TaskProofAdapter(chain);
  });

  test('requires a ProofChain instance', () => {
    expect(() => new TaskProofAdapter()).toThrow('requires a ProofChain');
  });

  test('taskAssigned creates proof with correct type', async () => {
    const task = {
      id: 'task-001',
      name: 'Test Task',
      priority: 'high',
      createdAt: '2026-02-02T12:00:00Z'
    };

    const proof = await adapter.taskAssigned(task, 'assigned-agent');
    
    expect(proof.data.type).toBe(TaskProofTypes.ASSIGNED);
    expect(proof.data.taskId).toBe('task-001');
    expect(proof.data.assignedTo).toBe('assigned-agent');
    expect(proof.data.priority).toBe('high');
  });

  test('taskClaimed records claiming agent', async () => {
    const task = { id: 'task-002', name: 'Claim Test', createdAt: '2026-02-02' };
    
    const proof = await adapter.taskClaimed(task);
    
    expect(proof.data.type).toBe(TaskProofTypes.CLAIMED);
    expect(proof.data.claimedBy).toBe('test-agent');
  });

  test('taskCompleted includes result hash', async () => {
    const task = { id: 'task-003', name: 'Complete Test', createdAt: '2026-02-02' };
    const result = {
      summary: 'Successfully processed 100 items',
      metrics: { itemsProcessed: 100, errorsCount: 0 }
    };
    
    const proof = await adapter.taskCompleted(task, result);
    
    expect(proof.data.type).toBe(TaskProofTypes.COMPLETED);
    expect(proof.data.result.hash).toBeDefined();
    expect(proof.data.result.summary).toBe('Successfully processed 100 items');
  });

  test('taskFailed records error info', async () => {
    const task = { id: 'task-004', name: 'Fail Test', createdAt: '2026-02-02' };
    const error = {
      code: 'TIMEOUT',
      message: 'Task timed out after 30 seconds',
      recoverable: true
    };
    
    const proof = await adapter.taskFailed(task, error);
    
    expect(proof.data.type).toBe(TaskProofTypes.FAILED);
    expect(proof.data.error.code).toBe('TIMEOUT');
    expect(proof.data.error.recoverable).toBe(true);
  });

  test('taskDelegated records handoff', async () => {
    const task = { id: 'task-005', name: 'Delegate Test', createdAt: '2026-02-02' };
    
    const proof = await adapter.taskDelegated(task, 'other-agent', 'Requires specialized skills');
    
    expect(proof.data.type).toBe(TaskProofTypes.DELEGATED);
    expect(proof.data.delegatedFrom).toBe('test-agent');
    expect(proof.data.delegatedTo).toBe('other-agent');
  });

  test('full task lifecycle', async () => {
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

    expect(chain.proofs).toHaveLength(5);
    
    // Verify history
    const history = adapter.getTaskHistory('task-full');
    expect(history).toHaveLength(5);

    // Verify completion
    const verification = adapter.verifyTaskCompletion('task-full');
    expect(verification.complete).toBe(true);
    expect(verification.stages.assigned).toBe(true);
    expect(verification.stages.claimed).toBe(true);
    expect(verification.stages.completed).toBe(true);
  });

  test('incomplete lifecycle detected', async () => {
    const task = { id: 'task-incomplete', name: 'Incomplete', createdAt: '2026-02-02' };

    // Only assign, don't complete
    await adapter.taskAssigned(task, 'worker-agent');

    const verification = adapter.verifyTaskCompletion('task-incomplete');
    expect(verification.complete).toBe(false);
    expect(verification.stages.claimed).toBe(false);
  });

  test('taskHash is deterministic', () => {
    const task1 = { id: 'same-task', name: 'Test', createdAt: '2026-02-02T12:00:00Z' };
    const task2 = { id: 'same-task', name: 'Test', createdAt: '2026-02-02T12:00:00Z' };
    
    const hash1 = adapter._hashTask(task1);
    const hash2 = adapter._hashTask(task2);
    
    expect(hash1).toBe(hash2);
  });
});
