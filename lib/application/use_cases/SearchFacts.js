/**
 * SearchFacts Use Case
 * Search facts/relationships using hybrid (text + vector) search
 */
class SearchFacts {
  constructor({ entityEdgeRepository, embedderClient }) {
    this.entityEdgeRepository = entityEdgeRepository;
    this.embedderClient = embedderClient;
  }
  
  /**
   * Execute the use case
   * @param {Object} input - Search input
   * @returns {Array} - Search results
   */
  async execute(input) {
    const {
      query,
      group_ids = [],
      limit = 10
    } = input;
    
    if (!query) {
      throw new Error('query is required');
    }
    
    // Generate embedding for query
    const queryEmbedding = await this.embedderClient.embed(query);
    
    // Search with hybrid approach
    const results = await this.entityEdgeRepository.search(
      query,
      queryEmbedding,
      group_ids,
      { limit }
    );
    
    // Format results
    return results.map(edge => ({
      uuid: edge.uuid,
      source_node_uuid: edge.source_node_uuid,
      target_node_uuid: edge.target_node_uuid,
      source_name: edge.source_name,
      target_name: edge.target_name,
      fact: edge.fact,
      group_id: edge.group_id,
      episode_uuid: edge.episode_uuid,
      created_at: edge.created_at,
      invalid_at: edge.invalid_at,
      score: edge.score,
      text_score: edge.text_score,
      vector_score: edge.vector_score
    }));
  }
}

export default SearchFacts;
