/**
 * RelateEntities Use Case
 * 
 * Search relationships between entities.
 * Replaces SearchFacts with same functionality.
 */
class RelateEntities {
  constructor({ entityEdgeRepository, embedderClient }) {
    this.entityEdgeRepository = entityEdgeRepository;
    this.embedderClient = embedderClient;
  }

  /**
   * Execute the use case
   * @param {Object} input
   * @param {string} input.query - Search query
   * @param {string|Array} input.group_id - Project(s) to search
   * @param {number} input.limit - Max results (default 15)
   */
  async execute(input) {
    const {
      query,
      group_id,
      group_ids,
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

    // Generate embedding for query
    const queryEmbedding = await this.embedderClient.embed(query);

    // Search relationships
    const results = await this.entityEdgeRepository.search(
      query,
      queryEmbedding,
      resolvedGroupIds,
      { limit }
    );

    // Return structured results
    return results.map(edge => ({
      uuid: edge.uuid,
      source: edge.source_name || edge.source_node_uuid,
      target: edge.target_name || edge.target_node_uuid,
      fact: edge.fact,
      group_id: edge.group_id,
      score: edge.score
    }));
  }
}

export default RelateEntities;
