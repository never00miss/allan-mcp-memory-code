/**
 * ClearGraph Use Case
 * Clear all data for specified group IDs
 */
class ClearGraph {
  constructor({ episodeRepository, entityNodeRepository, entityEdgeRepository }) {
    this.episodeRepository = episodeRepository;
    this.entityNodeRepository = entityNodeRepository;
    this.entityEdgeRepository = entityEdgeRepository;
  }
  
  /**
   * Execute the use case
   * @param {Object} input - Input parameters
   * @returns {Object} - Deletion result
   */
  async execute(input) {
    const { group_ids } = input;
    
    if (!group_ids || !Array.isArray(group_ids) || group_ids.length === 0) {
      throw new Error('group_ids is required and must be a non-empty array');
    }
    
    // Delete in order: edges first, then nodes, then episodes
    const edgesDeleted = await this.entityEdgeRepository.deleteByGroupIds(group_ids);
    const nodesDeleted = await this.entityNodeRepository.deleteByGroupIds(group_ids);
    const episodesDeleted = await this.episodeRepository.deleteByGroupIds(group_ids);
    
    return {
      group_ids,
      deleted: {
        edges: edgesDeleted,
        nodes: nodesDeleted,
        episodes: episodesDeleted
      },
      message: `Cleared ${episodesDeleted} episodes, ${nodesDeleted} nodes, ${edgesDeleted} edges`
    };
  }
}

export default ClearGraph;
