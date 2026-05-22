import logger from '../../infrastructure/logger';

/**
 * Memory Controller
 * Handles HTTP request/response for memory operations
 */
class MemoryController {
  constructor(locator) {
    this.locator = locator;
  }
  
  /**
   * Add memory (POST /v1/memory)
   */
  async addMemory(req, res) {
    try {
      const addMemory = this.locator.get('AddMemory');
      const result = await addMemory.execute(req.body);
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ err: error }, 'AddMemory error');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * Search nodes (POST /v1/memory/search/nodes)
   */
  async searchNodes(req, res) {
    try {
      const searchNodes = this.locator.get('SearchNodes');
      const results = await searchNodes.execute(req.body);
      
      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      logger.error({ err: error }, 'SearchNodes error');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * Search facts (POST /v1/memory/search/facts)
   */
  async searchFacts(req, res) {
    try {
      const searchFacts = this.locator.get('SearchFacts');
      const results = await searchFacts.execute(req.body);
      
      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      logger.error({ err: error }, 'SearchFacts error');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * Get episodes (GET /v1/memory/episodes)
   */
  async getEpisodes(req, res) {
    try {
      const getEpisodes = this.locator.get('GetEpisodes');
      const results = await getEpisodes.execute({
        group_id: req.query.group_id,
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      });
      
      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      logger.error({ err: error }, 'GetEpisodes error');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * Delete episode (DELETE /v1/memory/episodes/:uuid)
   */
  async deleteEpisode(req, res) {
    try {
      const deleteEpisode = this.locator.get('DeleteEpisode');
      const result = await deleteEpisode.execute({ uuid: req.params.uuid });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ err: error }, 'DeleteEpisode error');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * Get entity edge (GET /v1/memory/edges/:uuid)
   */
  async getEntityEdge(req, res) {
    try {
      const getEntityEdge = this.locator.get('GetEntityEdge');
      const result = await getEntityEdge.execute({ uuid: req.params.uuid });
      
      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Entity edge not found'
        });
      }
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ err: error }, 'GetEntityEdge error');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * Delete entity edge (DELETE /v1/memory/edges/:uuid)
   */
  async deleteEntityEdge(req, res) {
    try {
      const deleteEntityEdge = this.locator.get('DeleteEntityEdge');
      const result = await deleteEntityEdge.execute({ uuid: req.params.uuid });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ err: error }, 'DeleteEntityEdge error');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * Clear graph (DELETE /v1/memory/graph)
   */
  async clearGraph(req, res) {
    try {
      const clearGraph = this.locator.get('ClearGraph');
      const result = await clearGraph.execute({
        group_ids: req.body.group_ids
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ err: error }, 'ClearGraph error');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default MemoryController;
