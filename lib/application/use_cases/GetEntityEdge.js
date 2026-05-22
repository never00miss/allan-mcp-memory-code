/**
 * GetEntityEdge Use Case
 * Get entity edge (fact/relationship) by UUID
 */
class GetEntityEdge {
  constructor({ entityEdgeRepository }) {
    this.entityEdgeRepository = entityEdgeRepository;
  }
  
  /**
   * Execute the use case
   * @param {Object} input - Input parameters
   * @returns {Object|null} - Entity edge or null
   */
  async execute(input) {
    const { uuid } = input;
    
    if (!uuid) {
      throw new Error('uuid is required');
    }
    
    const edge = await this.entityEdgeRepository.findByUuid(uuid);
    
    if (!edge) {
      return null;
    }
    
    return {
      uuid: edge.uuid,
      source_node_uuid: edge.source_node_uuid,
      target_node_uuid: edge.target_node_uuid,
      source_name: edge.source_name,
      target_name: edge.target_name,
      fact: edge.fact,
      group_id: edge.group_id,
      episode_uuid: edge.episode_uuid,
      created_at: edge.created_at,
      invalid_at: edge.invalid_at
    };
  }
}

export default GetEntityEdge;
