/**
 * AgentDirectory - Directory Manager
 * 
 * Manages the agent registry: add, remove, search, list.
 */

const fs = require('fs');
const path = require('path');
const { validateEntry, createAgentEntry, SCHEMA_VERSION } = require('./schema');

/**
 * Directory class for managing agent registry
 */
class Directory {
  /**
   * @param {string} [filePath] - Path to directory JSON file
   */
  constructor(filePath = null) {
    this.filePath = filePath;
    this.agents = new Map();
    this.metadata = {
      schemaVersion: SCHEMA_VERSION,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      count: 0
    };
    
    if (filePath && fs.existsSync(filePath)) {
      this.load();
    }
  }
  
  /**
   * Add an agent to the directory
   * @param {object} entry - Agent entry or params for createAgentEntry
   * @returns {{ success: boolean, error?: string }}
   */
  add(entry) {
    // If raw params, create entry
    if (!entry.schemaVersion) {
      try {
        entry = createAgentEntry(entry);
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    
    // Validate
    const validation = validateEntry(entry);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }
    
    // Check for duplicate
    if (this.agents.has(entry.id)) {
      return { success: false, error: `Agent with id '${entry.id}' already exists` };
    }
    
    // Add
    this.agents.set(entry.id, entry);
    this.metadata.count = this.agents.size;
    this.metadata.updated = new Date().toISOString();
    
    if (this.filePath) {
      this.save();
    }
    
    return { success: true };
  }
  
  /**
   * Update an existing agent
   * @param {string} id
   * @param {object} updates
   * @returns {{ success: boolean, error?: string }}
   */
  update(id, updates) {
    if (!this.agents.has(id)) {
      return { success: false, error: `Agent '${id}' not found` };
    }
    
    const existing = this.agents.get(id);
    const updated = {
      ...existing,
      ...updates,
      id: existing.id, // Can't change ID
      registeredAt: existing.registeredAt, // Preserve original
      updatedAt: new Date().toISOString()
    };
    
    const validation = validateEntry(updated);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }
    
    this.agents.set(id, updated);
    this.metadata.updated = new Date().toISOString();
    
    if (this.filePath) {
      this.save();
    }
    
    return { success: true };
  }
  
  /**
   * Remove an agent from the directory
   * @param {string} id
   * @returns {{ success: boolean, error?: string }}
   */
  remove(id) {
    if (!this.agents.has(id)) {
      return { success: false, error: `Agent '${id}' not found` };
    }
    
    this.agents.delete(id);
    this.metadata.count = this.agents.size;
    this.metadata.updated = new Date().toISOString();
    
    if (this.filePath) {
      this.save();
    }
    
    return { success: true };
  }
  
  /**
   * Get an agent by ID
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    return this.agents.get(id) || null;
  }
  
  /**
   * List all agents
   * @returns {object[]}
   */
  list() {
    return Array.from(this.agents.values());
  }
  
  /**
   * Search agents by query
   * @param {object} query
   * @param {string} [query.name] - Name substring match
   * @param {string} [query.capability] - Capability category or skill
   * @param {string} [query.status] - Status filter
   * @param {string} [query.text] - Full-text search in name/description
   * @returns {object[]}
   */
  search(query) {
    let results = this.list();
    
    if (query.name) {
      const nameLower = query.name.toLowerCase();
      results = results.filter(a => 
        a.name.toLowerCase().includes(nameLower) ||
        a.id.toLowerCase().includes(nameLower)
      );
    }
    
    if (query.capability) {
      const capLower = query.capability.toLowerCase();
      results = results.filter(a => {
        if (!a.capabilities) return false;
        return a.capabilities.some(c => {
          if (c.category?.toLowerCase() === capLower) return true;
          if (c.skills?.some(s => s.toLowerCase().includes(capLower))) return true;
          if (typeof c === 'string' && c.toLowerCase().includes(capLower)) return true;
          return false;
        });
      });
    }
    
    if (query.status) {
      results = results.filter(a => a.status === query.status);
    }
    
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(a =>
        a.name.toLowerCase().includes(textLower) ||
        a.description?.toLowerCase().includes(textLower) ||
        a.id.toLowerCase().includes(textLower)
      );
    }
    
    return results;
  }
  
  /**
   * Get directory statistics
   * @returns {object}
   */
  stats() {
    const agents = this.list();
    const capabilityCount = {};
    const statusCount = {};
    
    for (const agent of agents) {
      // Count statuses
      statusCount[agent.status] = (statusCount[agent.status] || 0) + 1;
      
      // Count capabilities
      if (agent.capabilities) {
        for (const cap of agent.capabilities) {
          const category = cap.category || cap;
          capabilityCount[category] = (capabilityCount[category] || 0) + 1;
        }
      }
    }
    
    return {
      total: agents.length,
      byStatus: statusCount,
      byCapability: capabilityCount,
      lastUpdated: this.metadata.updated
    };
  }
  
  /**
   * Save directory to file
   */
  save() {
    if (!this.filePath) {
      throw new Error('No file path configured');
    }
    
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const data = {
      metadata: this.metadata,
      agents: Object.fromEntries(this.agents)
    };
    
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }
  
  /**
   * Load directory from file
   */
  load() {
    if (!this.filePath || !fs.existsSync(this.filePath)) {
      return;
    }
    
    const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    this.metadata = data.metadata || this.metadata;
    this.agents = new Map(Object.entries(data.agents || {}));
  }
  
  /**
   * Export directory for sharing
   * @returns {object}
   */
  export() {
    return {
      metadata: this.metadata,
      agents: Object.fromEntries(this.agents)
    };
  }
  
  /**
   * Import agents from another directory
   * @param {object} data - Exported directory data
   * @param {boolean} [merge=true] - Merge with existing or replace
   * @returns {{ added: number, skipped: number, errors: string[] }}
   */
  import(data, merge = true) {
    const result = { added: 0, skipped: 0, errors: [] };
    
    if (!merge) {
      this.agents.clear();
    }
    
    const agents = data.agents || {};
    for (const [id, entry] of Object.entries(agents)) {
      if (this.agents.has(id) && merge) {
        result.skipped++;
        continue;
      }
      
      const addResult = this.add(entry);
      if (addResult.success) {
        result.added++;
      } else {
        result.errors.push(`${id}: ${addResult.error}`);
      }
    }
    
    return result;
  }
}

module.exports = { Directory };
