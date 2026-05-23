/**
 * CheckFreshness Use Case
 * Check if stored memories are fresh or stale based on age
 */
class CheckFreshness {
  constructor({ entityNodeRepository, embedderClient }) {
    this.entityNodeRepository = entityNodeRepository;
    this.embedderClient = embedderClient;
  }
  
  /**
   * Execute the use case
   * @param {Object} input - Search input
   * @returns {string} - Results with freshness status
   */
  async execute(input) {
    const {
      query,
      group_ids = [],
      max_age_hours = 24,
      limit = 20
    } = input;
    
    if (!query) {
      throw new Error('query is required');
    }
    
    // Generate embedding for query
    const queryEmbedding = await this.embedderClient.embed(query);
    
    // Search with hybrid approach
    const results = await this.entityNodeRepository.search(
      query,
      queryEmbedding,
      group_ids,
      { limit }
    );
    
    if (results.length === 0) {
      return 'No memories found for query.';
    }
    
    const now = Date.now();
    const maxAgeMs = max_age_hours * 60 * 60 * 1000;
    
    // Format results with freshness info
    const lines = results.map(entity => {
      const type = entity.labels?.[0] || 'ENTITY';
      const createdAt = new Date(entity.created_at);
      const ageMs = now - createdAt.getTime();
      const ageStr = this._formatAge(ageMs);
      const isFresh = ageMs < maxAgeMs;
      const status = isFresh ? 'FRESH' : 'STALE';
      const sourceFile = this._extractSourceFile(entity.name);
      
      return `${entity.name} [${type}] ${status} ${ageStr}${sourceFile ? ` | ${sourceFile}` : ''}`;
    });
    
    // Add summary
    const freshCount = results.filter(e => {
      const ageMs = now - new Date(e.created_at).getTime();
      return ageMs < maxAgeMs;
    }).length;
    const staleCount = results.length - freshCount;
    
    lines.unshift(`Found ${results.length} memories: ${freshCount} FRESH, ${staleCount} STALE (threshold: ${max_age_hours}h)`);
    lines.unshift('---');
    
    return lines.join('\n');
  }
  
  /**
   * Format age in human-readable format
   */
  _formatAge(ms) {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }
  
  /**
   * Extract source file path from entity name
   * Patterns:
   * - func:project:src/auth.js:45-78@login → src/auth.js
   * - file:project:src/auth.js → src/auth.js
   */
  _extractSourceFile(name) {
    if (!name) return null;
    
    // Match file:project:path or func:project:path:lines@name
    const fileMatch = name.match(/^file:[^:]+:(.+)$/);
    if (fileMatch) return fileMatch[1];
    
    const funcMatch = name.match(/^func:[^:]+:([^:]+(?:\.[^:]+)*)(?::\d+-\d+)?@/);
    if (funcMatch) return funcMatch[1];
    
    // Match path patterns in name (contains / and file extension)
    const pathMatch = name.match(/([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/);
    if (pathMatch) return pathMatch[1];
    
    return null;
  }
}

export default CheckFreshness;
