/**
 * DeleteEntityEdge Use Case
 * Delete an entity edge (fact/relationship) by UUID
 */
class DeleteEntityEdge {
  constructor({ entityEdgeRepository }) {
    this.entityEdgeRepository = entityEdgeRepository;
  }
  
  /**
   * Execute the use case
   * @param {Object} input - Input parameters
   * @returns {Object} - Deletion result
   */
  async execute(input) {
    const { uuid } = input;
    
    if (!uuid) {
      throw new Error('uuid is required');
    }
    
    const deleted = await this.entityEdgeRepository.deleteByUuid(uuid);
    
    return {
      uuid,
      deleted,
      message: deleted ? 'Entity edge deleted successfully' : 'Entity edge not found'
    };
  }
}

export default DeleteEntityEdge;
