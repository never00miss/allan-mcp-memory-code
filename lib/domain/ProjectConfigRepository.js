/**
 * ProjectConfig Repository Interface
 * Defines the contract for project configuration persistence operations
 */
class ProjectConfigRepository {
  /**
   * Create or update project config (upsert by group_id)
   * @param {Object} config - ProjectConfig data
   * @returns {Promise<Object>} - Created/updated config
   */
  async upsert(config) {
    throw new Error('Not implemented');
  }

  /**
   * Find config by group_id
   * @param {string} groupId - Group ID
   * @returns {Promise<Object|null>} - Config or null
   */
  async findByGroupId(groupId) {
    throw new Error('Not implemented');
  }

  /**
   * List all project configs
   * @returns {Promise<Array>} - List of configs
   */
  async findAll() {
    throw new Error('Not implemented');
  }

  /**
   * Delete config by group_id
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean>} - Success flag
   */
  async deleteByGroupId(groupId) {
    throw new Error('Not implemented');
  }

  /**
   * Update last_indexed_at timestamp
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean>} - Success flag
   */
  async touchLastIndexed(groupId) {
    throw new Error('Not implemented');
  }
}

export default ProjectConfigRepository;
