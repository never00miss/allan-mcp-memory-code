/**
 * GetEpisodes Use Case
 * Get episodes by group ID
 */
class GetEpisodes {
  constructor({ episodeRepository }) {
    this.episodeRepository = episodeRepository;
  }
  
  /**
   * Execute the use case
   * @param {Object} input - Input parameters
   * @returns {Array} - List of episodes
   */
  async execute(input) {
    const {
      group_id,
      limit = 100,
      offset = 0
    } = input;
    
    if (!group_id) {
      throw new Error('group_id is required');
    }
    
    const episodes = await this.episodeRepository.findByGroupId(group_id, { limit, offset });
    
    return episodes.filter(Boolean).map(episode => ({
      uuid: episode.uuid,
      name: episode.name,
      content: episode.content,
      source: episode.source,
      source_description: episode.source_description,
      group_id: episode.group_id,
      created_at: episode.created_at
    }));
  }
}

export default GetEpisodes;
