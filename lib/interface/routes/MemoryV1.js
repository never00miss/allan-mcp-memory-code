import { Router } from 'express';
import MemoryController from '../controller/MemoryController';

/**
 * Memory API v1 Routes
 */
const MemoryV1 = (locator) => {
  const router = Router();
  const controller = new MemoryController(locator);
  
  // Add memory (episode)
  router.post('/memory', (req, res) => controller.addMemory(req, res));
  
  // Search nodes
  router.post('/memory/search/nodes', (req, res) => controller.searchNodes(req, res));
  
  // Search facts
  router.post('/memory/search/facts', (req, res) => controller.searchFacts(req, res));
  
  // Get episodes by group_id
  router.get('/memory/episodes', (req, res) => controller.getEpisodes(req, res));
  
  // Delete episode
  router.delete('/memory/episodes/:uuid', (req, res) => controller.deleteEpisode(req, res));
  
  // Get entity edge
  router.get('/memory/edges/:uuid', (req, res) => controller.getEntityEdge(req, res));
  
  // Delete entity edge
  router.delete('/memory/edges/:uuid', (req, res) => controller.deleteEntityEdge(req, res));
  
  // Clear graph
  router.delete('/memory/graph', (req, res) => controller.clearGraph(req, res));
  
  return router;
};

export default MemoryV1;
