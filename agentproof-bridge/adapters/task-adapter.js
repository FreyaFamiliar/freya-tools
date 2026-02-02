/**
 * Task Proof Adapter
 * 
 * Bridges AgentProof with task automation systems.
 * Designed for integration with clawddar/ai-task-automation.
 * 
 * @see https://github.com/clawddar/ai-task-automation
 * @see https://github.com/FreyaFamiliar/freya-tools/issues/1
 */

const crypto = require('crypto');

// Task proof types for the full lifecycle
const TaskProofTypes = {
  ASSIGNED: 'task-assigned',      // Task created/assigned to agent
  CLAIMED: 'task-claimed',        // Agent claims the task
  STARTED: 'task-started',        // Work begins
  PROGRESS: 'task-progress',      // Intermediate progress (optional)
  COMPLETED: 'task-completed',    // Work finished
  VERIFIED: 'task-verified',      // Another agent verified the result
  FAILED: 'task-failed',          // Task failed
  DELEGATED: 'task-delegated'     // Handoff to another agent
};

/**
 * TaskProofAdapter - Wrap task operations with cryptographic proofs
 * 
 * Usage:
 *   const adapter = new TaskProofAdapter(proofChain);
 *   
 *   // When a task is assigned
 *   const assignProof = await adapter.taskAssigned(task);
 *   
 *   // When agent claims it
 *   const claimProof = await adapter.taskClaimed(task);
 *   
 *   // When work is done
 *   const completionProof = await adapter.taskCompleted(task, result);
 */
class TaskProofAdapter {
  constructor(proofChain) {
    if (!proofChain) {
      throw new Error('TaskProofAdapter requires a ProofChain instance');
    }
    this.chain = proofChain;
  }

  /**
   * Generate a deterministic task hash for cross-referencing
   */
  _hashTask(task) {
    const canonical = JSON.stringify({
      id: task.id,
      name: task.name || task.title,
      created: task.createdAt || task.created
    });
    return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
  }

  /**
   * Task was created/assigned to an agent
   */
  async taskAssigned(task, assignedTo) {
    return await this.chain.addProof({
      type: TaskProofTypes.ASSIGNED,
      taskId: task.id,
      taskHash: this._hashTask(task),
      assignedTo: assignedTo,
      priority: task.priority,
      dependencies: task.dependencies || [],
      deadline: task.deadline || null,
      metadata: {
        name: task.name || task.title,
        description: task.description?.slice(0, 200) // Truncate for proof size
      }
    });
  }

  /**
   * Agent claims a task (signals intent to work on it)
   */
  async taskClaimed(task) {
    return await this.chain.addProof({
      type: TaskProofTypes.CLAIMED,
      taskId: task.id,
      taskHash: this._hashTask(task),
      claimedBy: this.chain.agentId,
      claimedAt: new Date().toISOString()
    });
  }

  /**
   * Work has started on a task
   */
  async taskStarted(task) {
    return await this.chain.addProof({
      type: TaskProofTypes.STARTED,
      taskId: task.id,
      taskHash: this._hashTask(task),
      startedAt: new Date().toISOString()
    });
  }

  /**
   * Record progress (for long-running tasks)
   */
  async taskProgress(task, progress) {
    return await this.chain.addProof({
      type: TaskProofTypes.PROGRESS,
      taskId: task.id,
      taskHash: this._hashTask(task),
      progress: {
        percent: progress.percent,
        message: progress.message,
        checkpoint: progress.checkpoint || null
      }
    });
  }

  /**
   * Task completed successfully
   */
  async taskCompleted(task, result) {
    const resultHash = crypto.createHash('sha256')
      .update(JSON.stringify(result))
      .digest('hex');

    return await this.chain.addProof({
      type: TaskProofTypes.COMPLETED,
      taskId: task.id,
      taskHash: this._hashTask(task),
      result: {
        hash: resultHash,
        summary: result.summary || null,
        outputPath: result.outputPath || null,
        metrics: result.metrics || {}
      },
      duration: result.duration || null,
      completedAt: new Date().toISOString()
    });
  }

  /**
   * Task verified by another agent
   */
  async taskVerified(task, verificationResult) {
    return await this.chain.addProof({
      type: TaskProofTypes.VERIFIED,
      taskId: task.id,
      taskHash: this._hashTask(task),
      verifiedBy: this.chain.agentId,
      verification: {
        passed: verificationResult.passed,
        checks: verificationResult.checks || [],
        notes: verificationResult.notes || null
      }
    });
  }

  /**
   * Task failed
   */
  async taskFailed(task, error) {
    return await this.chain.addProof({
      type: TaskProofTypes.FAILED,
      taskId: task.id,
      taskHash: this._hashTask(task),
      error: {
        code: error.code || 'UNKNOWN',
        message: error.message?.slice(0, 200),
        recoverable: error.recoverable || false
      },
      failedAt: new Date().toISOString()
    });
  }

  /**
   * Task delegated to another agent
   */
  async taskDelegated(task, delegatedTo, reason) {
    return await this.chain.addProof({
      type: TaskProofTypes.DELEGATED,
      taskId: task.id,
      taskHash: this._hashTask(task),
      delegatedFrom: this.chain.agentId,
      delegatedTo: delegatedTo,
      reason: reason?.slice(0, 200),
      delegatedAt: new Date().toISOString()
    });
  }

  /**
   * Get task history from proof chain
   * Returns all proofs related to a specific task
   */
  getTaskHistory(taskId) {
    return this.chain.proofs.filter(proof => 
      proof.data?.taskId === taskId
    );
  }

  /**
   * Verify task completion
   * Checks that the full lifecycle was recorded
   */
  verifyTaskCompletion(taskId) {
    const history = this.getTaskHistory(taskId);
    const types = history.map(p => p.data?.type);
    
    const hasAssigned = types.includes(TaskProofTypes.ASSIGNED);
    const hasClaimed = types.includes(TaskProofTypes.CLAIMED);
    const hasCompleted = types.includes(TaskProofTypes.COMPLETED);
    const hasFailed = types.includes(TaskProofTypes.FAILED);
    
    return {
      complete: hasAssigned && hasClaimed && (hasCompleted || hasFailed),
      history: history.length,
      stages: {
        assigned: hasAssigned,
        claimed: hasClaimed,
        completed: hasCompleted,
        failed: hasFailed
      },
      timeline: history.map(p => ({
        type: p.data?.type,
        timestamp: p.timestamp,
        hash: p.hash?.slice(0, 8)
      }))
    };
  }
}

module.exports = { TaskProofAdapter, TaskProofTypes };
