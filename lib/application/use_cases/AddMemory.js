import { v4 as uuidv4 } from 'uuid';
import logger from '../../infrastructure/logger';

/**
 * AddMemory Use Case
 * Adds an episode to memory and triggers entity/fact extraction
 */
class AddMemory {
  constructor({ episodeRepository, episodeQueue }) {
    this.episodeRepository = episodeRepository;
    this.episodeQueue = episodeQueue;
  }
  
  /**
   * Execute the use case
   * @param {Object} input - Input data
   * @returns {Object} - Created episode with processing status
   */
  async execute(input) {
    const {
      name,
      episode_body,
      content,
      source = 'text',
      source_description = '',
      group_id
    } = input;
    
    // Validate required fields
    const episodeContent = episode_body || content;
    if (!episodeContent) {
      throw new Error('episode_body or content is required');
    }
    
    const resolvedGroupId = group_id || process.env.DEFAULT_GROUP_ID || 'main';
    
    // Create episode
    const episode = {
      uuid: uuidv4(),
      name: name || `Episode ${new Date().toISOString()}`,
      content: episodeContent,
      episode_body: episodeContent,
      source,
      source_description,
      group_id: resolvedGroupId,
      created_at: new Date().toISOString()
    };
    
    // Save episode to database
    await this.episodeRepository.create(episode);
    
    // Enqueue for processing (async extraction)
    // Don't await - let it process in background
    this.episodeQueue.enqueue(episode)
      .then(result => {
        logger.info({ uuid: episode.uuid, result }, 'Episode processing complete');
      })
      .catch(error => {
        logger.error({ uuid: episode.uuid, err: error }, 'Episode processing failed');
      });
    
    return {
      uuid: episode.uuid,
      name: episode.name,
      group_id: episode.group_id,
      created_at: episode.created_at,
      status: 'processing',
      message: 'Episode created and queued for entity extraction'
    };
  }
}

export default AddMemory;
