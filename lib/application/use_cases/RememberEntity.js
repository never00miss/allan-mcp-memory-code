import { v4 as uuidv4 } from 'uuid';
import logger from '../../infrastructure/logger';

/**
 * RememberEntity Use Case
 * 
 * Stores a memory with structured fields. Replaces AddMemory.
 * 
 * Key differences from AddMemory:
 * - Required: type, scope, content, group_id (structured fields)
 * - Optional: source_file, source_lines (for file-mtime freshness)
 * - Upserts by natural key (group_id, type, scope) - no duplicates
 * - Still triggers async entity extraction for relationships
 */
class RememberEntity {
  constructor({ 
    episodeRepository, 
    episodeQueue, 
    entityNodeRepository,
    embedderClient 
  }) {
    this.episodeRepository = episodeRepository;
    this.episodeQueue = episodeQueue;
    this.entityNodeRepository = entityNodeRepository;
    this.embedderClient = embedderClient;
  }

  /**
   * Execute the use case
   * @param {Object} input
   * @param {string} input.group_id - Project identifier (required)
   * @param {string} input.type - Entity type: file|func|api|arch|pattern|task|debug|note|index
   * @param {string} input.scope - Identifier: "src/auth.js" or "UserService.login"
   * @param {string} input.content - The memory content (summary)
   * @param {string} input.source_file - Optional: relative path for freshness
   * @param {Array} input.source_lines - Optional: [start, end] line numbers
   * @param {boolean} input.sync - Optional: if true, wait for extraction
   */
  async execute(input) {
    const {
      group_id,
      type,
      scope,
      content,
      source_file = null,
      source_lines = null,
      sync = false
    } = input;

    // Validate required fields
    if (!group_id) throw new Error('group_id is required');
    if (!type) throw new Error('type is required');
    if (!scope) throw new Error('scope is required');
    if (!content) throw new Error('content is required');

    const validTypes = ['file', 'func', 'api', 'arch', 'pattern', 'task', 'debug', 'note', 'index'];
    if (!validTypes.includes(type)) {
      throw new Error(`type must be one of: ${validTypes.join(', ')}`);
    }

    // Generate embedding for the entity
    const embeddingText = `${type} ${scope} ${content}`;
    const embedding = await this.embedderClient.embed(embeddingText);

    // Upsert entity by natural key
    const entity = await this.entityNodeRepository.upsertByNaturalKey({
      uuid: uuidv4(),
      type,
      scope,
      group_id,
      summary: content,
      source_file,
      source_lines,
      labels: [type.toUpperCase()],
      name_embedding: embedding,
      updated_at: new Date().toISOString()
    });

    // Also create episode for relationship extraction
    const episode = {
      uuid: uuidv4(),
      name: `${type}:${group_id}:${scope}`,
      content: content,
      episode_body: content,
      source: 'remember',
      source_description: `${type} memory for ${scope}`,
      group_id,
      created_at: new Date().toISOString()
    };

    await this.episodeRepository.create(episode);

    // Trigger extraction (sync or async)
    if (sync) {
      try {
        await this.episodeQueue.processNow(episode);
      } catch (err) {
        logger.warn({ err, uuid: episode.uuid }, 'Sync extraction failed');
      }
    } else {
      this.episodeQueue.enqueue(episode)
        .then(() => logger.debug({ uuid: episode.uuid }, 'Episode queued'))
        .catch(err => logger.error({ err, uuid: episode.uuid }, 'Queue failed'));
    }

    return {
      uuid: entity.uuid,
      type: entity.type,
      scope: entity.scope,
      group_id: entity.group_id,
      source_file: entity.source_file,
      updated_at: entity.updated_at,
      status: sync ? 'complete' : 'processing',
      message: sync 
        ? 'Entity stored and relationships extracted'
        : 'Entity stored, relationship extraction queued (~3s)'
    };
  }
}

export default RememberEntity;
