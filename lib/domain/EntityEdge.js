/**
 * EntityEdge Entity
 * Represents a relationship/fact between two entity nodes
 */
class EntityEdge {
  constructor({
    uuid,
    source_node_uuid,
    target_node_uuid,
    fact,
    group_id,
    episode_uuid,
    created_at,
    invalid_at = null,
    fact_embedding = []
  }) {
    this.uuid = uuid;
    this.source_node_uuid = source_node_uuid;
    this.target_node_uuid = target_node_uuid;
    this.fact = fact;
    this.group_id = group_id;
    this.episode_uuid = episode_uuid;
    this.created_at = created_at || new Date().toISOString();
    this.invalid_at = invalid_at;
    this.fact_embedding = fact_embedding;
  }
  
  /**
   * Validate the entity edge
   * @throws {Error} if invalid
   */
  validate() {
    if (!this.uuid) {
      throw new Error('EntityEdge uuid is required');
    }
    if (!this.source_node_uuid) {
      throw new Error('EntityEdge source_node_uuid is required');
    }
    if (!this.target_node_uuid) {
      throw new Error('EntityEdge target_node_uuid is required');
    }
    if (!this.fact) {
      throw new Error('EntityEdge fact is required');
    }
    if (!this.group_id) {
      throw new Error('EntityEdge group_id is required');
    }
  }
  
  /**
   * Check if the edge is still valid
   */
  isValid() {
    return !this.invalid_at || new Date(this.invalid_at) > new Date();
  }
  
  /**
   * Mark the edge as invalid
   */
  invalidate() {
    this.invalid_at = new Date().toISOString();
  }
  
  /**
   * Convert to plain object
   */
  toObject() {
    return {
      uuid: this.uuid,
      source_node_uuid: this.source_node_uuid,
      target_node_uuid: this.target_node_uuid,
      fact: this.fact,
      group_id: this.group_id,
      episode_uuid: this.episode_uuid,
      created_at: this.created_at,
      invalid_at: this.invalid_at
    };
  }
}

export default EntityEdge;
