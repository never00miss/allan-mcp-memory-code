/**
 * EntityNode Repository Interface
 * Defines the contract for entity node persistence operations
 * 
 * v2 Changes:
 * - Added upsertByNaturalKey for (group_id, type, scope) uniqueness
 * - Added findByNaturalKey, findByTypeAndGroup
 * - Added listByType for enumeration
 */
class EntityNodeRepository {
  /**
   * Create a new entity node
   * @param {Object} entity - Entity data
   * @returns {Promise<Object>} - Created entity
   */
  async create(entity) {
    throw new Error('Not implemented');
  }

  /**
   * Create or update entity by natural key (group_id, type, scope)
   * @param {Object} entity - Entity data with type, scope, group_id
   * @returns {Promise<Object>} - Created/updated entity
   */
  async upsertByNaturalKey(entity) {
    throw new Error('Not implemented');
  }
  
  /**
   * Find entity by UUID
   * @param {string} uuid - Entity UUID
   * @returns {Promise<Object|null>} - Entity or null
   */
  async findByUuid(uuid) {
    throw new Error('Not implemented');
  }

  /**
   * Find entity by natural key (group_id, type, scope)
   * @param {string} groupId - Group ID
   * @param {string} type - Entity type
   * @param {string} scope - Entity scope
   * @returns {Promise<Object|null>} - Entity or null
   */
  async findByNaturalKey(groupId, type, scope) {
    throw new Error('Not implemented');
  }
  
  /**
   * Find entity by name and group (legacy compat)
   * @param {string} name - Entity name
   * @param {string} groupId - Group ID
   * @returns {Promise<Object|null>} - Entity or null
   */
  async findByNameAndGroup(name, groupId) {
    throw new Error('Not implemented');
  }

  /**
   * Find entities by type within a group
   * @param {string} groupId - Group ID
   * @param {string} type - Entity type (file, func, api, etc.)
   * @param {Object} options - { limit }
   * @returns {Promise<Array>} - List of entities
   */
  async findByTypeAndGroup(groupId, type, options = {}) {
    throw new Error('Not implemented');
  }

  /**
   * List entities by type (or all) within a group
   * For enumeration without embedding computation
   * @param {string} groupId - Group ID
   * @param {string|null} type - Optional type filter
   * @param {Object} options - { limit }
   * @returns {Promise<Array>} - List of entities (light: no embedding)
   */
  async listByType(groupId, type = null, options = {}) {
    throw new Error('Not implemented');
  }
  
  /**
   * Search entities by text query (hybrid search)
   * @param {string} query - Search query
   * @param {Array<number>} queryEmbedding - Query embedding vector
   * @param {Array<string>} groupIds - Group IDs to search in
   * @param {Object} options - Search options (limit)
   * @returns {Promise<Array>} - List of entities with scores
   */
  async search(query, queryEmbedding, groupIds, options = {}) {
    throw new Error('Not implemented');
  }
  
  /**
   * Link entity to episode
   * @param {string} entityUuid - Entity UUID
   * @param {string} episodeUuid - Episode UUID
   * @returns {Promise<boolean>} - Success flag
   */
  async linkToEpisode(entityUuid, episodeUuid) {
    throw new Error('Not implemented');
  }
  
  /**
   * Delete entity by UUID
   * @param {string} uuid - Entity UUID
   * @returns {Promise<boolean>} - Success flag
   */
  async deleteByUuid(uuid) {
    throw new Error('Not implemented');
  }
  
  /**
   * Delete all entities by group IDs
   * @param {Array<string>} groupIds - Group IDs
   * @returns {Promise<number>} - Number of deleted entities
   */
  async deleteByGroupIds(groupIds) {
    throw new Error('Not implemented');
  }
}

export default EntityNodeRepository;
