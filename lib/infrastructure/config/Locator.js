import Connection from '../gateway/falkordb/Connection';
import LLMClient from '../gateway/llm/LLMClient';
import EmbedderClient from '../gateway/embedder/EmbedderClient';
import EpisodeQueue from '../queue/EpisodeQueue';
import StatCache from '../cache/StatCache';
import logger from '../logger';

// Repositories
import EpisodeRepositoryFalkorDB from '../../interface/repositories/EpisodeRepositoryFalkorDB';
import EntityNodeRepositoryFalkorDB from '../../interface/repositories/EntityNodeRepositoryFalkorDB';
import EntityEdgeRepositoryFalkorDB from '../../interface/repositories/EntityEdgeRepositoryFalkorDB';
import ProjectConfigRepositoryFalkorDB from '../../interface/repositories/ProjectConfigRepositoryFalkorDB';

// Domain Services
import FreshnessAnnotator from '../../domain/services/FreshnessAnnotator';

// Use Cases (Legacy - kept for backward compat)
import AddMemory from '../../application/use_cases/AddMemory';
import SearchNodes from '../../application/use_cases/SearchNodes';
import SearchFacts from '../../application/use_cases/SearchFacts';
import CheckFreshness from '../../application/use_cases/CheckFreshness';
import RegenerateFile from '../../application/use_cases/RegenerateFile';
import GetEpisodes from '../../application/use_cases/GetEpisodes';
import GetEntityEdge from '../../application/use_cases/GetEntityEdge';
import DeleteEpisode from '../../application/use_cases/DeleteEpisode';
import DeleteEntityEdge from '../../application/use_cases/DeleteEntityEdge';
import ClearGraph from '../../application/use_cases/ClearGraph';

// Use Cases (New v2)
import RegisterProject from '../../application/use_cases/RegisterProject';
import RememberEntity from '../../application/use_cases/RememberEntity';
import RecallEntities from '../../application/use_cases/RecallEntities';
import RelateEntities from '../../application/use_cases/RelateEntities';
import ListByType from '../../application/use_cases/ListByType';
import RefreshFromFile from '../../application/use_cases/RefreshFromFile';

/**
 * Locator - Dependency Injection Container
 * Manages all application dependencies
 */
class Locator {
  constructor() {
    this.services = new Map();
  }
  
  /**
   * Initialize all dependencies
   */
  async init() {
    logger.info('Initializing Locator...');
    
    // Infrastructure - Gateways
    const falkorDBConnection = new Connection();
    await falkorDBConnection.connect();
    this.register('FalkorDBConnection', falkorDBConnection);
    
    const llmClient = new LLMClient();
    await llmClient.init();
    this.register('LLMClient', llmClient);
    
    const embedderClient = new EmbedderClient();
    await embedderClient.init();
    this.register('EmbedderClient', embedderClient);
    
    // Repositories
    const episodeRepository = new EpisodeRepositoryFalkorDB(falkorDBConnection);
    this.register('EpisodeRepository', episodeRepository);
    
    const entityNodeRepository = new EntityNodeRepositoryFalkorDB(falkorDBConnection, embedderClient);
    this.register('EntityNodeRepository', entityNodeRepository);
    
    const entityEdgeRepository = new EntityEdgeRepositoryFalkorDB(falkorDBConnection, embedderClient);
    this.register('EntityEdgeRepository', entityEdgeRepository);

    const projectConfigRepository = new ProjectConfigRepositoryFalkorDB(falkorDBConnection);
    this.register('ProjectConfigRepository', projectConfigRepository);

    // Cache
    const statCache = new StatCache({ ttlMs: 5000, maxEntries: 1000 });
    this.register('StatCache', statCache);

    // Domain Services
    const freshnessAnnotator = new FreshnessAnnotator({
      projectConfigRepository,
      statCache
    });
    this.register('FreshnessAnnotator', freshnessAnnotator);
    
    // Queue
    const episodeQueue = new EpisodeQueue({
      llmClient,
      embedderClient,
      episodeRepository,
      entityNodeRepository,
      entityEdgeRepository
    });
    this.register('EpisodeQueue', episodeQueue);
    
    // Use Cases
    this.register('AddMemory', new AddMemory({
      episodeRepository,
      episodeQueue
    }));
    
    this.register('SearchNodes', new SearchNodes({
      entityNodeRepository,
      embedderClient
    }));
    
    this.register('SearchFacts', new SearchFacts({
      entityEdgeRepository,
      embedderClient
    }));
    
    this.register('CheckFreshness', new CheckFreshness({
      entityNodeRepository,
      embedderClient
    }));
    
    this.register('RegenerateFile', new RegenerateFile({
      llmClient,
      embedderClient,
      entityNodeRepository
    }));
    
    this.register('GetEpisodes', new GetEpisodes({
      episodeRepository
    }));
    
    this.register('GetEntityEdge', new GetEntityEdge({
      entityEdgeRepository
    }));
    
    this.register('DeleteEpisode', new DeleteEpisode({
      episodeRepository
    }));
    
    this.register('DeleteEntityEdge', new DeleteEntityEdge({
      entityEdgeRepository
    }));
    
    this.register('ClearGraph', new ClearGraph({
      episodeRepository,
      entityNodeRepository,
      entityEdgeRepository
    }));

    // New v2 Use Cases
    this.register('RegisterProject', new RegisterProject({
      projectConfigRepository
    }));

    this.register('RememberEntity', new RememberEntity({
      episodeRepository,
      episodeQueue,
      entityNodeRepository,
      embedderClient
    }));

    this.register('RecallEntities', new RecallEntities({
      entityNodeRepository,
      embedderClient,
      freshnessAnnotator
    }));

    this.register('RelateEntities', new RelateEntities({
      entityEdgeRepository,
      embedderClient
    }));

    this.register('ListByType', new ListByType({
      entityNodeRepository,
      freshnessAnnotator
    }));

    this.register('RefreshFromFile', new RefreshFromFile({
      llmClient,
      embedderClient,
      entityNodeRepository,
      projectConfigRepository,
      statCache
    }));
    
    logger.info('Locator initialized successfully');
    return this;
  }
  
  /**
   * Register a service
   * @param {string} name - Service name
   * @param {*} instance - Service instance
   */
  register(name, instance) {
    this.services.set(name, instance);
  }
  
  /**
   * Get a service by name
   * @param {string} name - Service name
   * @returns {*} - Service instance
   */
  get(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }
    return service;
  }
  
  /**
   * Check if a service exists
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.services.has(name);
  }
  
  /**
   * Shutdown all services
   */
  async shutdown() {
    logger.info('Shutting down Locator...');
    
    // Close FalkorDB connection
    if (this.has('FalkorDBConnection')) {
      await this.get('FalkorDBConnection').close();
    }
    
    this.services.clear();
    logger.info('Locator shutdown complete');
  }
}

// Export singleton instance
export default new Locator();
