import EntityNodeRepository from '../../domain/EntityNodeRepository';

/**
 * FalkorDB implementation of EntityNode Repository
 */
class EntityNodeRepositoryFalkorDB extends EntityNodeRepository {
  constructor(connection, embedderClient) {
    super();
    this.connection = connection;
    this.embedderClient = embedderClient;
  }
  
  /**
   * Create a new entity node
   */
  async create(entity) {
    const cypher = `
      CREATE (n:EntityNode {
        uuid: $uuid,
        name: $name,
        labels: $labels,
        summary: $summary,
        group_id: $group_id,
        created_at: $created_at,
        name_embedding: $name_embedding
      })
      RETURN n
    `;
    
    const params = {
      uuid: entity.uuid,
      name: entity.name,
      labels: JSON.stringify(entity.labels || ['ENTITY']),
      summary: entity.summary || '',
      group_id: entity.group_id,
      created_at: entity.created_at || new Date().toISOString(),
      name_embedding: JSON.stringify(entity.name_embedding || [])
    };
    
    const result = await this.connection.query(cypher, params);
    return this._mapRecord(result.data?.[0]?.[0]);
  }
  
  /**
   * Find entity by UUID
   */
  async findByUuid(uuid) {
    const cypher = `
      MATCH (n:EntityNode {uuid: $uuid})
      RETURN n
    `;
    
    const result = await this.connection.query(cypher, { uuid });
    const record = result.data?.[0]?.[0];
    return record ? this._mapRecord(record) : null;
  }
  
  /**
   * Find entity by name and group
   */
  async findByNameAndGroup(name, groupId) {
    const cypher = `
      MATCH (n:EntityNode {name: $name, group_id: $groupId})
      RETURN n
    `;
    
    const result = await this.connection.query(cypher, { name, groupId });
    const record = result.data?.[0]?.[0];
    return record ? this._mapRecord(record) : null;
  }
  
  /**
   * Search entities (hybrid: text + vector)
   */
  async search(query, queryEmbedding, groupIds, options = {}) {
    const limit = options.limit || 10;
    
    // First, do text search
    const textResults = await this._textSearch(query, groupIds, limit * 2);
    
    // Then calculate vector similarity for each result
    const resultsWithScores = [];
    
    for (const entity of textResults) {
      const embedding = this._parseEmbedding(entity.name_embedding);
      const vectorScore = embedding.length > 0
        ? this.embedderClient.cosineSimilarity(queryEmbedding, embedding)
        : 0;
      
      // Combined score (text match + vector similarity)
      const textScore = entity.text_score || 0.5;
      const combinedScore = (textScore * 0.3) + (vectorScore * 0.7);
      
      resultsWithScores.push({
        ...entity,
        text_score: textScore,
        vector_score: vectorScore,
        score: combinedScore
      });
    }
    
    // If text search returned few results, also do vector-only search
    if (textResults.length < limit) {
      const vectorResults = await this._vectorSearch(queryEmbedding, groupIds, limit);
      
      for (const entity of vectorResults) {
        // Skip if already in results
        if (resultsWithScores.find(r => r.uuid === entity.uuid)) continue;
        
        const embedding = this._parseEmbedding(entity.name_embedding);
        const vectorScore = embedding.length > 0
          ? this.embedderClient.cosineSimilarity(queryEmbedding, embedding)
          : 0;
        
        resultsWithScores.push({
          ...entity,
          text_score: 0,
          vector_score: vectorScore,
          score: vectorScore * 0.7
        });
      }
    }
    
    // Sort by combined score and limit
    return resultsWithScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  /**
   * Text search for entities
   */
  async _textSearch(query, groupIds, limit) {
    const safeLimit = parseInt(limit) || 10;
    const safeQuery = (query || '').replace(/'/g, "\\'"); // Escape single quotes
    const groupIdFilter = groupIds.length > 0
      ? `AND n.group_id IN [${groupIds.map(g => `'${g}'`).join(', ')}]`
      : '';
    
    // Simple text matching (case-insensitive contains) - inline values for FalkorDB compatibility
    const cypher = `
      MATCH (n:EntityNode)
      WHERE (toLower(n.name) CONTAINS toLower('${safeQuery}') OR toLower(n.summary) CONTAINS toLower('${safeQuery}'))
      ${groupIdFilter}
      RETURN n
      LIMIT ${safeLimit}
    `;
    
    const result = await this.connection.query(cypher, {});
    return (result.data || []).map(row => {
      const entity = this._mapRecord(row[0]);
      if (!entity) return null;
      entity.text_score = 1.0; // Full match for contains
      return entity;
    }).filter(Boolean);
  }
  
  /**
   * Vector search for entities (fetch all in group and compute similarity)
   */
  async _vectorSearch(queryEmbedding, groupIds, limit) {
    const groupIdFilter = groupIds.length > 0
      ? `WHERE n.group_id IN [${groupIds.map(g => `'${g}'`).join(', ')}]`
      : '';
    
    const cypher = `
      MATCH (n:EntityNode)
      ${groupIdFilter}
      RETURN n
      LIMIT 1000
    `;
    
    const result = await this.connection.query(cypher, {});
    return (result.data || []).map(row => this._mapRecord(row[0])).filter(Boolean);
  }
  
  /**
   * Link entity to episode
   */
  async linkToEpisode(entityUuid, episodeUuid) {
    const cypher = `
      MATCH (n:EntityNode {uuid: $entityUuid})
      MATCH (e:EpisodicNode {uuid: $episodeUuid})
      MERGE (n)-[:HAS_EPISODE]->(e)
      RETURN n, e
    `;
    
    const result = await this.connection.query(cypher, { entityUuid, episodeUuid });
    return result.data?.length > 0;
  }
  
  /**
   * Delete entity by UUID
   */
  async deleteByUuid(uuid) {
    const cypher = `
      MATCH (n:EntityNode {uuid: $uuid})
      DETACH DELETE n
      RETURN count(n) as deleted
    `;
    
    const result = await this.connection.query(cypher, { uuid });
    return (result.data?.[0]?.[0] || 0) > 0;
  }
  
  /**
   * Delete all entities by group IDs
   */
  async deleteByGroupIds(groupIds) {
    let totalDeleted = 0;
    
    for (const groupId of groupIds) {
      const cypher = `
        MATCH (n:EntityNode {group_id: $groupId})
        WITH n, count(n) as cnt
        DETACH DELETE n
        RETURN cnt
      `;
      
      const result = await this.connection.query(cypher, { groupId });
      totalDeleted += result.data?.[0]?.[0] || 0;
    }
    
    return totalDeleted;
  }
  
  /**
   * Parse embedding from stored string
   */
  _parseEmbedding(embeddingStr) {
    if (!embeddingStr) return [];
    try {
      return JSON.parse(embeddingStr);
    } catch {
      return [];
    }
  }
  
  /**
   * Map FalkorDB record to entity
   */
  _mapRecord(record) {
    if (!record || !record.properties) {
      return null;
    }
    
    const props = record.properties;
    let labels = ['ENTITY'];
    try {
      labels = JSON.parse(props.labels || '["ENTITY"]');
    } catch {}
    
    return {
      uuid: props.uuid,
      name: props.name,
      labels,
      summary: props.summary,
      group_id: props.group_id,
      created_at: props.created_at,
      name_embedding: props.name_embedding
    };
  }
}

export default EntityNodeRepositoryFalkorDB;
