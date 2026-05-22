/**
 * EntityEdge Repository Interface
 * Defines the contract for entity edge (relationship) persistence operations
 */
class EntityEdgeRepository {
  /**
   * Create a new entity edge
   * @param {Object} edge - Edge data
   * @returns {Promise<Object>} - Created edge
   */
  async create(edge) {
    throw new Error('Not implemented');
  }
  
  /**
   * Find edge by UUID
   * @param {string} uuid - Edge UUID
   * @returns {Promise<Object|null>} - Edge or null
   */
  async findByUuid(uuid) {
    throw new Error('Not implemented');
  }
  
  /**
   * Find similar fact between two nodes
   * @param {string} sourceUuid - Source node UUID
   * @param {string} targetUuid - Target node UUID
   * @param {string} fact - Fact text
   * @param {string} groupId - Group ID
   * @returns {Promise<Object|null>} - Existing edge or null
   */
  async findSimilarFact(sourceUuid, targetUuid, fact, groupId) {
    throw new Error('Not implemented');
  }
  
  /**
   * Search facts by text query (hybrid search)
   * @param {string} query - Search query
   * @param {Array<number>} queryEmbedding - Query embedding vector
   * @param {Array<string>} groupIds - Group IDs to search in
   * @param {Object} options - Search options (limit)
   * @returns {Promise<Array>} - List of edges with scores
   */
  async search(query, queryEmbedding, groupIds, options = {}) {
    throw new Error('Not implemented');
  }
  
  /**
   * Delete edge by UUID
   * @param {string} uuid - Edge UUID
   * @returns {Promise<boolean>} - Success flag
   */
  async deleteByUuid(uuid) {
    throw new Error('Not implemented');
  }
  
  /**
   * Delete all edges by group IDs
   * @param {Array<string>} groupIds - Group IDs
   * @returns {Promise<number>} - Number of deleted edges
   */
  async deleteByGroupIds(groupIds) {
    throw new Error('Not implemented');
  }
}

export default EntityEdgeRepository;
