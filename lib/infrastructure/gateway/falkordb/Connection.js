import { FalkorDB } from 'falkordb';
import logger from '../../logger';

/**
 * FalkorDB Connection singleton
 * Manages connection to FalkorDB graph database
 */
class Connection {
  constructor() {
    this.client = null;
    this.graph = null;
    this.graphName = process.env.FALKORDB_GRAPH_NAME || 'allan_memory';
  }
  
  /**
   * Connect to FalkorDB
   */
  async connect() {
    if (this.client) {
      return this;
    }
    
    const uri = process.env.FALKORDB_URI || 'redis://localhost:6379';
    logger.info({ uri }, 'Connecting to FalkorDB...');
    
    try {
      this.client = await FalkorDB.connect({
        socket: {
          host: this._parseHost(uri),
          port: this._parsePort(uri)
        }
      });
      
      this.graph = this.client.selectGraph(this.graphName);
      
      // Initialize schema
      await this._initializeSchema();
      
      logger.info({ graph: this.graphName }, 'Connected to FalkorDB');
      return this;
    } catch (error) {
      logger.error({ err: error }, 'Failed to connect to FalkorDB');
      throw error;
    }
  }
  
  /**
   * Parse host from redis URI
   */
  _parseHost(uri) {
    const match = uri.match(/redis:\/\/([^:\/]+)/);
    return match ? match[1] : 'localhost';
  }
  
  /**
   * Parse port from redis URI
   */
  _parsePort(uri) {
    const match = uri.match(/:(\d+)$/);
    return match ? parseInt(match[1]) : 6379;
  }
  
  /**
   * Initialize graph schema with indexes
   */
  async _initializeSchema() {
    try {
      // Create indexes for EpisodicNode
      await this.graph.query(`
        CREATE INDEX IF NOT EXISTS FOR (n:EpisodicNode) ON (n.uuid)
      `).catch(() => {});
      
      await this.graph.query(`
        CREATE INDEX IF NOT EXISTS FOR (n:EpisodicNode) ON (n.group_id)
      `).catch(() => {});
      
      // Create indexes for EntityNode
      await this.graph.query(`
        CREATE INDEX IF NOT EXISTS FOR (n:EntityNode) ON (n.uuid)
      `).catch(() => {});
      
      await this.graph.query(`
        CREATE INDEX IF NOT EXISTS FOR (n:EntityNode) ON (n.name)
      `).catch(() => {});
      
      await this.graph.query(`
        CREATE INDEX IF NOT EXISTS FOR (n:EntityNode) ON (n.group_id)
      `).catch(() => {});
      
      // Create indexes for EntityEdge
      await this.graph.query(`
        CREATE INDEX IF NOT EXISTS FOR (n:EntityEdge) ON (n.uuid)
      `).catch(() => {});
      
      await this.graph.query(`
        CREATE INDEX IF NOT EXISTS FOR (n:EntityEdge) ON (n.group_id)
      `).catch(() => {});
      
      logger.debug('Graph schema initialized');
    } catch (error) {
      // Indexes might already exist, that's ok
      logger.debug('Schema initialization (some indexes may already exist)');
    }
  }
  
  /**
   * Get the graph instance
   */
  getGraph() {
    if (!this.graph) {
      throw new Error('Not connected to FalkorDB');
    }
    return this.graph;
  }
  
  /**
   * Execute a Cypher query
   */
  async query(cypher, params = {}) {
    const graph = this.getGraph();
    // FalkorDB driver expects { params: {...} } as options
    const options = Object.keys(params).length > 0 ? { params } : undefined;
    logger.debug({ query: cypher.substring(0, 100), params }, 'FalkorDB query');
    const result = await graph.query(cypher, options);
    logger.debug({ count: result.data?.length }, 'FalkorDB result');
    return result;
  }
  
  /**
   * Check if connected
   */
  async isConnected() {
    try {
      if (!this.client) return false;
      await this.graph.query('RETURN 1');
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Close connection
   */
  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.graph = null;
      logger.info('FalkorDB connection closed');
    }
  }
}

export default Connection;
