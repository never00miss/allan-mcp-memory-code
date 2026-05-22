/**
 * EntityNode Entity
 * Represents a node in the knowledge graph (person, organization, concept, etc.)
 */
class EntityNode {
  constructor({
    uuid,
    name,
    labels = [],
    summary = '',
    group_id,
    created_at,
    name_embedding = []
  }) {
    this.uuid = uuid;
    this.name = name;
    this.labels = Array.isArray(labels) ? labels : [labels];
    this.summary = summary;
    this.group_id = group_id;
    this.created_at = created_at || new Date().toISOString();
    this.name_embedding = name_embedding;
  }
  
  /**
   * Validate the entity node
   * @throws {Error} if invalid
   */
  validate() {
    if (!this.uuid) {
      throw new Error('EntityNode uuid is required');
    }
    if (!this.name) {
      throw new Error('EntityNode name is required');
    }
    if (!this.group_id) {
      throw new Error('EntityNode group_id is required');
    }
  }
  
  /**
   * Get primary label (type)
   */
  getPrimaryLabel() {
    return this.labels[0] || 'ENTITY';
  }
  
  /**
   * Convert to plain object
   */
  toObject() {
    return {
      uuid: this.uuid,
      name: this.name,
      labels: this.labels,
      summary: this.summary,
      group_id: this.group_id,
      created_at: this.created_at
    };
  }
}

export default EntityNode;
