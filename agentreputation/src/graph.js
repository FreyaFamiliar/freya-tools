/**
 * AgentReputation - Trust Graph and Score Calculation
 * 
 * Implements a modified PageRank algorithm for computing trust scores.
 */

const { verifyVouch, validateVouch } = require('./vouch');

// Constants
const DAMPING_FACTOR = 0.85;
const ITERATIONS = 50;
const CONVERGENCE_THRESHOLD = 0.0001;
const AGE_HALF_LIFE_DAYS = 90;
const MIN_SCORE_TO_COUNT = 0.1;

/**
 * Trust Graph - stores agents and vouches
 */
class TrustGraph {
  constructor() {
    // Map of agentId -> { publicKey, score, categoryScores, vouchesReceived, vouchesGiven }
    this.agents = new Map();
    
    // Map of agentId -> [vouches given by this agent]
    this.vouchesFrom = new Map();
    
    // Map of agentId -> [vouches received by this agent]
    this.vouchesTo = new Map();
    
    // All vouches
    this.vouches = [];
  }
  
  /**
   * Add or update an agent in the graph
   */
  addAgent(agentId, publicKey = null) {
    if (!this.agents.has(agentId)) {
      this.agents.set(agentId, {
        publicKey,
        score: 0,
        categoryScores: {},
        vouchesReceived: 0,
        vouchesGiven: 0
      });
      this.vouchesFrom.set(agentId, []);
      this.vouchesTo.set(agentId, []);
    } else if (publicKey && !this.agents.get(agentId).publicKey) {
      this.agents.get(agentId).publicKey = publicKey;
    }
  }
  
  /**
   * Add a vouch to the graph
   * 
   * @param {Object} vouch - Vouch to add
   * @param {Object} options - Options
   * @param {boolean} options.verify - Verify signature (default true)
   * @param {boolean} options.validate - Validate structure (default true)
   * @returns {Object} { success: boolean, error?: string }
   */
  addVouch(vouch, options = {}) {
    const { verify = true, validate = true } = options;
    
    // Validate structure
    if (validate) {
      const validation = validateVouch(vouch);
      if (!validation.valid) {
        return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
      }
    }
    
    // Verify signature
    if (verify && !verifyVouch(vouch)) {
      return { success: false, error: 'Invalid signature' };
    }
    
    // Ensure agents exist
    this.addAgent(vouch.from, vouch.publicKey);
    this.addAgent(vouch.to);
    
    // Check for duplicate
    const existingVouches = this.vouchesFrom.get(vouch.from) || [];
    const duplicate = existingVouches.find(v => 
      v.to === vouch.to && 
      v.context.category === vouch.context.category &&
      this.daysApart(v.timestamp, vouch.timestamp) < 30
    );
    
    if (duplicate) {
      return { success: false, error: 'Duplicate vouch (same target+category within 30 days)' };
    }
    
    // Add vouch
    this.vouches.push(vouch);
    this.vouchesFrom.get(vouch.from).push(vouch);
    this.vouchesTo.get(vouch.to).push(vouch);
    
    // Update counts
    this.agents.get(vouch.from).vouchesGiven++;
    this.agents.get(vouch.to).vouchesReceived++;
    
    return { success: true };
  }
  
  /**
   * Calculate days between two timestamps
   */
  daysApart(ts1, ts2) {
    const d1 = new Date(ts1);
    const d2 = new Date(ts2);
    return Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
  }
  
  /**
   * Calculate age-based decay factor
   */
  ageDecay(timestamp) {
    const ageMs = Date.now() - new Date(timestamp).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return Math.pow(0.5, ageDays / AGE_HALF_LIFE_DAYS);
  }
  
  /**
   * Calculate reputation scores using modified PageRank
   */
  calculateScores() {
    const agentIds = Array.from(this.agents.keys());
    const n = agentIds.length;
    
    if (n === 0) return;
    
    // Initialize scores
    const scores = new Map();
    const prevScores = new Map();
    
    for (const id of agentIds) {
      scores.set(id, 1 / n);
      prevScores.set(id, 1 / n);
    }
    
    // Iterate until convergence
    for (let iter = 0; iter < ITERATIONS; iter++) {
      // Copy current scores
      for (const id of agentIds) {
        prevScores.set(id, scores.get(id));
      }
      
      // Calculate new scores
      for (const id of agentIds) {
        let sum = 0;
        
        // Get all vouches TO this agent
        const receivedVouches = this.vouchesTo.get(id) || [];
        
        for (const vouch of receivedVouches) {
          const fromScore = prevScores.get(vouch.from) || 0;
          
          // Skip vouches from agents below threshold
          if (fromScore < MIN_SCORE_TO_COUNT) continue;
          
          const outDegree = (this.vouchesFrom.get(vouch.from) || []).length;
          if (outDegree === 0) continue;
          
          // Calculate effective weight
          const ageWeight = this.ageDecay(vouch.timestamp);
          const typeMultiplier = vouch.type === 'positive' ? 1 : -0.5;
          const effectiveWeight = vouch.weight * ageWeight * typeMultiplier;
          
          sum += (fromScore * effectiveWeight) / outDegree;
        }
        
        // Apply damping
        const newScore = (1 - DAMPING_FACTOR) / n + DAMPING_FACTOR * sum;
        scores.set(id, newScore);
      }
      
      // Check convergence
      let maxDiff = 0;
      for (const id of agentIds) {
        maxDiff = Math.max(maxDiff, Math.abs(scores.get(id) - prevScores.get(id)));
      }
      
      if (maxDiff < CONVERGENCE_THRESHOLD) {
        break;
      }
    }
    
    // Normalize scores to [0, 1] range
    const maxScore = Math.max(...scores.values());
    const minScore = Math.min(...scores.values());
    const range = maxScore - minScore || 1;
    
    // Update agent records
    for (const id of agentIds) {
      const normalizedScore = (scores.get(id) - minScore) / range;
      const agent = this.agents.get(id);
      agent.score = Math.round(normalizedScore * 1000) / 1000;
      
      // Calculate category scores
      agent.categoryScores = this.calculateCategoryScores(id);
    }
  }
  
  /**
   * Calculate per-category scores for an agent
   */
  calculateCategoryScores(agentId) {
    const vouches = this.vouchesTo.get(agentId) || [];
    const categoryScores = {};
    const categoryCounts = {};
    
    for (const vouch of vouches) {
      const category = vouch.context.category;
      const ageWeight = this.ageDecay(vouch.timestamp);
      const value = vouch.type === 'positive' ? vouch.weight : -vouch.weight * 0.5;
      
      if (!categoryScores[category]) {
        categoryScores[category] = 0;
        categoryCounts[category] = 0;
      }
      
      categoryScores[category] += value * ageWeight;
      categoryCounts[category]++;
    }
    
    // Normalize to 0-1
    for (const category of Object.keys(categoryScores)) {
      const raw = categoryScores[category] / categoryCounts[category];
      categoryScores[category] = Math.max(0, Math.min(1, (raw + 1) / 2));
    }
    
    return categoryScores;
  }
  
  /**
   * Get trust level label from score
   */
  static getTrustLevel(score) {
    if (score < 0) return { level: 'flagged', label: 'Flagged', emoji: '🚩' };
    if (score === 0) return { level: 'unknown', label: 'Unknown', emoji: '❓' };
    if (score < 0.3) return { level: 'new', label: 'New', emoji: '🆕' };
    if (score < 0.6) return { level: 'established', label: 'Established', emoji: '✓' };
    if (score < 0.8) return { level: 'trusted', label: 'Trusted', emoji: '✅' };
    return { level: 'highly_trusted', label: 'Highly Trusted', emoji: '⭐' };
  }
  
  /**
   * Get an agent's reputation info
   */
  getReputation(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return null;
    }
    
    const trustLevel = TrustGraph.getTrustLevel(agent.score);
    
    return {
      agentId,
      score: agent.score,
      trustLevel,
      categoryScores: agent.categoryScores,
      vouchesReceived: agent.vouchesReceived,
      vouchesGiven: agent.vouchesGiven,
      vouchers: this.getVouchers(agentId),
      vouchees: this.getVouchees(agentId)
    };
  }
  
  /**
   * Get agents who vouched for this agent
   */
  getVouchers(agentId) {
    const vouches = this.vouchesTo.get(agentId) || [];
    return [...new Set(vouches.map(v => v.from))];
  }
  
  /**
   * Get agents this agent vouched for
   */
  getVouchees(agentId) {
    const vouches = this.vouchesFrom.get(agentId) || [];
    return [...new Set(vouches.map(v => v.to))];
  }
  
  /**
   * Export the graph
   */
  export() {
    return {
      version: '0.1',
      agents: Array.from(this.agents.entries()).map(([id, data]) => ({
        agentId: id,
        ...data
      })),
      vouches: this.vouches,
      exportedAt: new Date().toISOString()
    };
  }
  
  /**
   * Import from exported data
   */
  static import(data) {
    const graph = new TrustGraph();
    
    if (data.version !== '0.1') {
      throw new Error(`Unsupported version: ${data.version}`);
    }
    
    // Add agents
    for (const agent of data.agents || []) {
      graph.addAgent(agent.agentId, agent.publicKey);
    }
    
    // Add vouches (skip validation since already verified)
    for (const vouch of data.vouches || []) {
      graph.addVouch(vouch, { verify: false, validate: false });
    }
    
    return graph;
  }
  
  /**
   * Get summary statistics
   */
  getStats() {
    return {
      totalAgents: this.agents.size,
      totalVouches: this.vouches.length,
      positiveVouches: this.vouches.filter(v => v.type === 'positive').length,
      negativeVouches: this.vouches.filter(v => v.type === 'negative').length,
      averageScore: this.agents.size > 0 
        ? Array.from(this.agents.values()).reduce((sum, a) => sum + a.score, 0) / this.agents.size
        : 0
    };
  }
}

module.exports = { TrustGraph };
