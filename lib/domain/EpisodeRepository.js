/**
 * Episode Repository Interface
 * Defines the contract for episode persistence operations
 */
class EpisodeRepository {
  /**
   * Create a new episode
   * @param {Object} episode - Episode data
   * @returns {Promise<Object>} - Created episode
   */
  async create(episode) {
    throw new Error('Not implemented');
  }
  
  /**
   * Find episode by UUID
   * @param {string} uuid - Episode UUID
   * @returns {Promise<Object|null>} - Episode or null
   */
  async findByUuid(uuid) {
    throw new Error('Not implemented');
  }
  
  /**
   * Find episodes by group ID
   * @param {string} groupId - Group ID
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array>} - List of episodes
   */
  async findByGroupId(groupId, options = {}) {
    throw new Error('Not implemented');
  }
  
  /**
   * Delete episode by UUID
   * @param {string} uuid - Episode UUID
   * @returns {Promise<boolean>} - Success flag
   */
  async deleteByUuid(uuid) {
    throw new Error('Not implemented');
  }
  
  /**
   * Delete all episodes by group IDs
   * @param {Array<string>} groupIds - Group IDs
   * @returns {Promise<number>} - Number of deleted episodes
   */
  async deleteByGroupIds(groupIds) {
    throw new Error('Not implemented');
  }
}

export default EpisodeRepository;
