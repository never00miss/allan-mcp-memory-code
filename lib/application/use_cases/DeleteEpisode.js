/**
 * DeleteEpisode Use Case
 * Delete an episode by UUID
 */
class DeleteEpisode {
  constructor({ episodeRepository }) {
    this.episodeRepository = episodeRepository;
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
    
    const deleted = await this.episodeRepository.deleteByUuid(uuid);
    
    return {
      uuid,
      deleted,
      message: deleted ? 'Episode deleted successfully' : 'Episode not found'
    };
  }
}

export default DeleteEpisode;
