import { v4 as uuidv4 } from 'uuid';
import logger from '../logger';

/**
 * EpisodeQueue - Per-group sequential processing queue
 * Ensures episodes for the same group are processed sequentially
 */
class EpisodeQueue {
  constructor({ llmClient, embedderClient, episodeRepository, entityNodeRepository, entityEdgeRepository }) {
    this.llmClient = llmClient;
    this.embedderClient = embedderClient;
    this.episodeRepository = episodeRepository;
    this.entityNodeRepository = entityNodeRepository;
    this.entityEdgeRepository = entityEdgeRepository;
    
    // Queue state per group
    this.queues = new Map(); // group_id -> { processing: boolean, items: [] }
    this.semaphoreLimit = parseInt(process.env.SEMAPHORE_LIMIT || '2');
    this.activeTasks = 0;
  }
  
  /**
   * Enqueue an episode for processing
   * @param {Object} episode - Episode to process
   * @returns {Promise<Object>} - Processing result
   */
  async enqueue(episode) {
    const groupId = episode.group_id || process.env.DEFAULT_GROUP_ID || 'main';
    
    return new Promise((resolve, reject) => {
      // Get or create queue for this group
      if (!this.queues.has(groupId)) {
        this.queues.set(groupId, { processing: false, items: [] });
      }
      
      const queue = this.queues.get(groupId);
      queue.items.push({ episode, resolve, reject });
      
      // Start processing if not already running
      this._processQueue(groupId);
    });
  }
  
  /**
   * Process queue for a specific group
   * @param {string} groupId - Group ID
   */
  async _processQueue(groupId) {
    const queue = this.queues.get(groupId);
    
    if (!queue || queue.processing || queue.items.length === 0) {
      return;
    }
    
    // Wait for semaphore
    while (this.activeTasks >= this.semaphoreLimit) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    queue.processing = true;
    this.activeTasks++;
    
    const { episode, resolve, reject } = queue.items.shift();
    
    try {
      const result = await this._processEpisode(episode);
      resolve(result);
    } catch (error) {
      logger.error({ groupId, err: error }, 'Episode processing failed');
      reject(error);
    } finally {
      this.activeTasks--;
      queue.processing = false;
      
      // Continue processing next item
      if (queue.items.length > 0) {
        setImmediate(() => this._processQueue(groupId));
      }
    }
  }
  
  /**
   * Process a single episode
   * @param {Object} episode - Episode to process
   * @returns {Object} - Processing result
   */
  async _processEpisode(episode) {
    logger.info({ uuid: episode.uuid, name: episode.name }, 'Processing episode');
    
    const content = episode.episode_body || episode.content || '';
    const groupId = episode.group_id || process.env.DEFAULT_GROUP_ID || 'main';
    
    // Step 1: Extract entities from content
    logger.debug('Extracting entities...');
    const extractedEntities = await this.llmClient.extractEntities(content);
    logger.info({ count: extractedEntities.length }, 'Entities extracted');
    
    if (extractedEntities.length === 0) {
      return {
        episode_uuid: episode.uuid,
        entities_created: 0,
        facts_created: 0,
        message: 'No entities found in content'
      };
    }
    
    // Step 2: Extract relationships between entities
    logger.debug('Extracting facts...');
    const extractedFacts = await this.llmClient.extractFacts(content, extractedEntities);
    logger.info({ count: extractedFacts.length }, 'Facts extracted');
    
    // Step 3: Deduplicate and save entities
    logger.debug('Saving entities...');
    const savedEntities = [];
    
    for (const entity of extractedEntities) {
      // Check for existing entity with same name in group
      const existing = await this.entityNodeRepository.findByNameAndGroup(entity.name, groupId);
      
      if (existing) {
        // Update existing entity summary if needed
        savedEntities.push(existing);
        logger.debug({ name: entity.name }, 'Entity exists');
      } else {
        // Create new entity with embedding
        const embedding = await this.embedderClient.embed(entity.name + ' ' + (entity.summary || ''));
        
        const newEntity = {
          uuid: uuidv4(),
          name: entity.name,
          labels: [entity.type || 'ENTITY'],
          summary: entity.summary || '',
          group_id: groupId,
          created_at: new Date().toISOString(),
          name_embedding: embedding
        };
        
        await this.entityNodeRepository.create(newEntity);
        savedEntities.push(newEntity);
        logger.debug({ name: entity.name }, 'Entity created');
      }
    }
    
    // Step 4: Save facts/relationships
    logger.debug('Saving facts...');
    let factsCreated = 0;
    
    for (const fact of extractedFacts) {
      // Skip self-referencing facts
      if (fact.source === fact.target) {
        logger.debug({ source: fact.source }, 'Skipping fact - self-referencing');
        continue;
      }
      
      const sourceEntity = savedEntities.find(e => e.name === fact.source);
      const targetEntity = savedEntities.find(e => e.name === fact.target);
      
      if (!sourceEntity || !targetEntity) {
        logger.debug({ source: fact.source, target: fact.target }, 'Skipping fact - entity not found');
        continue;
      }
      
      // Check for existing similar fact
      const existingFact = await this.entityEdgeRepository.findSimilarFact(
        sourceEntity.uuid,
        targetEntity.uuid,
        fact.fact,
        groupId
      );
      
      if (existingFact) {
        logger.debug({ source: fact.source, target: fact.target }, 'Fact exists');
        continue;
      }
      
      // Create new fact with embedding
      const embedding = await this.embedderClient.embed(fact.fact);
      
      const newFact = {
        uuid: uuidv4(),
        source_node_uuid: sourceEntity.uuid,
        target_node_uuid: targetEntity.uuid,
        fact: fact.fact,
        group_id: groupId,
        episode_uuid: episode.uuid,
        created_at: new Date().toISOString(),
        invalid_at: null,
        fact_embedding: embedding
      };
      
      await this.entityEdgeRepository.create(newFact);
      factsCreated++;
      logger.debug({ source: fact.source, target: fact.target }, 'Fact created');
    }
    
    // Step 5: Link entities to episode
    logger.debug('Linking entities to episode...');
    for (const entity of savedEntities) {
      await this.entityNodeRepository.linkToEpisode(entity.uuid, episode.uuid);
    }
    
    logger.info({ entities: savedEntities.length, facts: factsCreated }, 'Episode processed');
    
    return {
      episode_uuid: episode.uuid,
      entities_created: savedEntities.length,
      facts_created: factsCreated,
      entities: savedEntities.map(e => ({ uuid: e.uuid, name: e.name })),
      message: 'Episode processed successfully'
    };
  }
}

export default EpisodeQueue;
