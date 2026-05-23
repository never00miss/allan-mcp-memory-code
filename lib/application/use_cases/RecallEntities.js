/**
 * RecallEntities Use Case
 * 
 * Search the knowledge graph with INLINE FRESHNESS.
 * Replaces SearchNodes.
 * 
 * Key features:
 * - Returns entities with freshness field on each result
 * - Supports freshness_filter: any | fresh_only | stale_only
 * - skip_freshness option for fast queries
 * - Default limit: 15 (reduced from 77)
 */
class RecallEntities {
  constructor({ 
    entityNodeRepository, 
    embedderClient, 
    freshnessAnnotator 
  }) {
    this.entityNodeRepository = entityNodeRepository;
    this.embedderClient = embedderClient;
    this.freshnessAnnotator = freshnessAnnotator;
  }

  /**
   * Execute the use case
   * @param {Object} input
   * @param {string} input.query - Search query (natural language or "type:scope")
   * @param {string|Array} input.group_id - Project(s) to search
   * @param {string} input.type - Optional type filter
   * @param {string} input.freshness_filter - "any" | "fresh_only" | "stale_only"
   * @param {boolean} input.skip_freshness - Skip freshness annotation for speed
   * @param {number} input.limit - Max results (default 15)
   */
  async execute(input) {
    const {
      query,
      group_id,
      group_ids,
      type = null,
      freshness_filter = 'any',
      skip_freshness = false,
      limit = 15
    } = input;

    if (!query) {
      throw new Error('query is required');
    }

    // Normalize group_ids
    let resolvedGroupIds = [];
    if (group_ids && Array.isArray(group_ids)) {
      resolvedGroupIds = group_ids;
    } else if (group_id) {
      resolvedGroupIds = Array.isArray(group_id) ? group_id : [group_id];
    }

    // Check for exact lookup pattern: "type:scope" or "type:project:scope"
    const exactMatch = this._parseExactPattern(query);
    if (exactMatch && resolvedGroupIds.length === 1) {
      const entity = await this.entityNodeRepository.findByNaturalKey(
        resolvedGroupIds[0],
        exactMatch.type,
        exactMatch.scope
      );
      
      if (entity) {
        const results = skip_freshness 
          ? [entity]
          : await this.freshnessAnnotator.annotate([entity], resolvedGroupIds[0]);
        return this._formatResults(results);
      }
    }

    // Generate query embedding for hybrid search
    const queryEmbedding = await this.embedderClient.embed(query);

    // Search with hybrid (text + vector)
    const fetchLimit = Math.min(limit * 2, 50); // Fetch extra for filtering
    let results = await this.entityNodeRepository.search(
      query,
      queryEmbedding,
      resolvedGroupIds,
      { limit: fetchLimit, type }
    );

    // Annotate freshness (unless skipped)
    if (!skip_freshness && results.length > 0) {
      // Use first group_id for freshness (multi-project freshness is complex)
      const primaryGroupId = resolvedGroupIds[0] || results[0]?.group_id;
      results = await this.freshnessAnnotator.annotate(results, primaryGroupId);
    }

    // Filter by freshness
    if (freshness_filter !== 'any') {
      results = this.freshnessAnnotator.filterByFreshness(results, freshness_filter);
    }

    // Apply final limit
    results = results.slice(0, limit);

    return this._formatResults(results);
  }

  /**
   * Parse exact lookup pattern
   * Formats: "type:scope" or "type:project:scope"
   */
  _parseExactPattern(query) {
    const validTypes = ['file', 'func', 'api', 'arch', 'pattern', 'task', 'debug', 'note', 'index'];
    const parts = query.split(':');
    
    if (parts.length >= 2) {
      const maybeType = parts[0].toLowerCase();
      if (validTypes.includes(maybeType)) {
        // type:scope or type:project:scope
        const scope = parts.length >= 3 ? parts.slice(2).join(':') : parts[1];
        return { type: maybeType, scope };
      }
    }
    
    return null;
  }

  /**
   * Format results for output
   * Returns structured objects (not text lines like SearchNodes)
   */
  _formatResults(results) {
    return results.map(entity => ({
      uuid: entity.uuid,
      type: entity.type,
      scope: entity.scope,
      summary: entity.summary,
      group_id: entity.group_id,
      source_file: entity.source_file,
      updated_at: entity.updated_at,
      freshness: entity.freshness || null,
      score: entity.score
    }));
  }
}

export default RecallEntities;
