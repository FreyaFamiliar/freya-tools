/**
 * Task Queue Integration Example
 * 
 * Demonstrates how to integrate AgentProof with a task automation system.
 * Based on discussion with Clawddar (github.com/clawddar/ai-task-automation)
 * 
 * @see https://github.com/FreyaFamiliar/freya-tools/issues/1
 */

const { TaskProofAdapter, TaskProofTypes } = require('../adapters/task-adapter');
// In real usage: const { ProofChain } = require('agentproof');

// =============================================================================
// Mock ProofChain (replace with real AgentProof in production)
// =============================================================================

class MockProofChain {
  constructor(agentId) {
    this.agentId = agentId;
    this.proofs = [];
  }

  async addProof(data) {
    const proof = {
      id: this.proofs.length,
      data,
      timestamp: new Date().toISOString(),
      hash: `sha256-${Date.now()}-${Math.random().toString(36).slice(2)}`
    };
    this.proofs.push(proof);
    console.log(`  📝 Proof #${proof.id}: ${data.type}`);
    return proof;
  }
}

// =============================================================================
// Simulated Task Queue (your implementation would go here)
// =============================================================================

class TaskQueue {
  constructor() {
    this.tasks = new Map();
    this.subscribers = [];
  }

  addTask(task) {
    this.tasks.set(task.id, { ...task, status: 'pending' });
    this.emit('task-added', task);
    return task;
  }

  updateStatus(taskId, status, result = null) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      if (result) task.result = result;
      this.emit(`task-${status}`, task);
    }
  }

  on(event, callback) {
    this.subscribers.push({ event, callback });
  }

  emit(event, data) {
    this.subscribers
      .filter(s => s.event === event || s.event === '*')
      .forEach(s => s.callback(data));
  }
}

// =============================================================================
// Integration: Connect Task Queue to AgentProof
// =============================================================================

async function setupProofedTaskQueue(agentId) {
  // Initialize proof chain (use real AgentProof keypair in production)
  const proofChain = new MockProofChain(agentId);
  const taskAdapter = new TaskProofAdapter(proofChain);
  const taskQueue = new TaskQueue();

  // Wire up events to create proofs automatically
  taskQueue.on('task-added', async (task) => {
    await taskAdapter.taskAssigned(task, agentId);
  });

  taskQueue.on('task-claimed', async (task) => {
    await taskAdapter.taskClaimed(task);
  });

  taskQueue.on('task-started', async (task) => {
    await taskAdapter.taskStarted(task);
  });

  taskQueue.on('task-completed', async (task) => {
    await taskAdapter.taskCompleted(task, task.result || {});
  });

  taskQueue.on('task-failed', async (task) => {
    await taskAdapter.taskFailed(task, task.error || { message: 'Unknown error' });
  });

  return { taskQueue, taskAdapter, proofChain };
}

// =============================================================================
// Demo: Full task lifecycle
// =============================================================================

async function demo() {
  console.log('\n🚀 Task Queue + AgentProof Integration Demo\n');
  console.log('=' .repeat(60));

  // Setup
  const { taskQueue, taskAdapter, proofChain } = await setupProofedTaskQueue('demo-agent');

  // Create a task
  console.log('\n📋 Creating task...');
  const task = taskQueue.addTask({
    id: 'task-demo-001',
    name: 'Process customer data',
    description: 'Extract, transform, and load customer records',
    priority: 'high',
    createdAt: new Date().toISOString()
  });

  // Agent claims it
  console.log('\n🙋 Agent claiming task...');
  taskQueue.updateStatus(task.id, 'claimed');

  // Work starts
  console.log('\n⚙️ Starting work...');
  taskQueue.updateStatus(task.id, 'started');

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 100));

  // Complete the task
  console.log('\n✅ Completing task...');
  taskQueue.updateStatus(task.id, 'completed', {
    summary: 'Processed 1,234 records successfully',
    metrics: {
      recordsProcessed: 1234,
      errorsCount: 0,
      durationMs: 4500
    }
  });

  // Show results
  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 Task Verification:\n');
  
  const verification = taskAdapter.verifyTaskCompletion('task-demo-001');
  console.log('Complete lifecycle:', verification.complete ? '✅ Yes' : '❌ No');
  console.log('Stages:');
  console.log('  - Assigned:', verification.stages.assigned ? '✅' : '❌');
  console.log('  - Claimed:', verification.stages.claimed ? '✅' : '❌');
  console.log('  - Completed:', verification.stages.completed ? '✅' : '❌');
  
  console.log('\n📜 Proof Timeline:');
  verification.timeline.forEach((entry, i) => {
    console.log(`  ${i + 1}. ${entry.type} @ ${entry.timestamp}`);
  });

  console.log('\n🔗 Total proofs in chain:', proofChain.proofs.length);
  console.log('\n' + '=' .repeat(60));
  console.log('\n✨ Demo complete! Each task operation is now cryptographically signed.');
  console.log('   Anyone can verify the full task history.\n');
}

// Run if executed directly
if (require.main === module) {
  demo().catch(console.error);
}

module.exports = { setupProofedTaskQueue };
