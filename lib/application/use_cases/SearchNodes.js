/**
 * SearchNodes Use Case
 * Search entity nodes using hybrid (text + vector) search
 */
class SearchNodes {
  constructor({ entityNodeRepository, embedderClient }) {
    this.entityNodeRepository = entityNodeRepository;
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
    const results = await this.entityNodeRepository.search(
      query,
      queryEmbedding,
      group_ids,
      { limit }
    );
    
    // Format results
    return results.map(entity => ({
      uuid: entity.uuid,
      name: entity.name,
      labels: entity.labels,
      summary: entity.summary,
      group_id: entity.group_id,
      created_at: entity.created_at,
      score: entity.score,
      text_score: entity.text_score,
      vector_score: entity.vector_score
    }));
  }
}

export default SearchNodes;
