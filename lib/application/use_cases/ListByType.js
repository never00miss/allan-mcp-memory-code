/**
 * ListByType Use Case
 * 
 * Enumerate stored entities by type. NEW use case.
 * 
 * Cheap deterministic query - no embedding computation.
 * Use instead of "memorizing what's stored".
 */
class ListByType {
  constructor({ entityNodeRepository, freshnessAnnotator }) {
    this.entityNodeRepository = entityNodeRepository;
    this.freshnessAnnotator = freshnessAnnotator;
  }

  /**
   * Execute the use case
   * @param {Object} input
   * @param {string} input.group_id - Project identifier (required)
   * @param {string} input.type - Optional type filter
   * @param {number} input.limit - Max results (default 50)
   * @param {boolean} input.include_freshness - Include freshness info (slower)
   */
  async execute(input) {
    const {
      group_id,
      type = null,
      limit = 50,
      include_freshness = false
    } = input;

    if (!group_id) {
      throw new Error('group_id is required');
    }

    // Validate type if provided
    if (type) {
      const validTypes = ['file', 'func', 'api', 'arch', 'pattern', 'task', 'debug', 'note', 'index'];
      if (!validTypes.includes(type)) {
        throw new Error(`type must be one of: ${validTypes.join(', ')}`);
      }
    }

    // Get entities (light query - no embeddings)
    let results = await this.entityNodeRepository.listByType(group_id, type, { limit });

    // Optionally add freshness
    if (include_freshness && results.length > 0) {
      results = await this.freshnessAnnotator.annotate(results, group_id);
    }

    // Group by type for easier consumption
    const byType = {};
    for (const entity of results) {
      const t = entity.type || 'unknown';
      if (!byType[t]) byType[t] = [];
      byType[t].push({
        scope: entity.scope,
        source_file: entity.source_file,
        updated_at: entity.updated_at,
        freshness: entity.freshness || null
      });
    }

    return {
      group_id,
      total: results.length,
      by_type: byType,
      entities: results
    };
  }
}

export default ListByType;
