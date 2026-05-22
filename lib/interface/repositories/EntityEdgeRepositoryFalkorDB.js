import EntityEdgeRepository from '../../domain/EntityEdgeRepository';

/**
 * FalkorDB implementation of EntityEdge Repository
 */
class EntityEdgeRepositoryFalkorDB extends EntityEdgeRepository {
  constructor(connection, embedderClient) {
    super();
    this.connection = connection;
    this.embedderClient = embedderClient;
  }
  
  /**
   * Create a new entity edge (fact/relationship)
   */
  async create(edge) {
    // First create the edge as a node (to store embedding)
    const createEdgeNode = `
      CREATE (e:EntityEdge {
        uuid: $uuid,
        source_node_uuid: $source_node_uuid,
        target_node_uuid: $target_node_uuid,
        fact: $fact,
        group_id: $group_id,
        episode_uuid: $episode_uuid,
        created_at: $created_at,
        invalid_at: $invalid_at,
        fact_embedding: $fact_embedding
      })
      RETURN e
    `;
    
    const params = {
      uuid: edge.uuid,
      source_node_uuid: edge.source_node_uuid,
      target_node_uuid: edge.target_node_uuid,
      fact: edge.fact,
      group_id: edge.group_id,
      episode_uuid: edge.episode_uuid || '',
      created_at: edge.created_at || new Date().toISOString(),
      invalid_at: edge.invalid_at || '',
      fact_embedding: JSON.stringify(edge.fact_embedding || [])
    };
    
    await this.connection.query(createEdgeNode, params);
    
    // Then create the relationship between entity nodes
    const createRelationship = `
      MATCH (source:EntityNode {uuid: $source_node_uuid})
      MATCH (target:EntityNode {uuid: $target_node_uuid})
      MERGE (source)-[r:RELATED_TO {uuid: $uuid, fact: $fact}]->(target)
      RETURN r
    `;
    
    await this.connection.query(createRelationship, {
      source_node_uuid: edge.source_node_uuid,
      target_node_uuid: edge.target_node_uuid,
      uuid: edge.uuid,
      fact: edge.fact
    });
    
    return edge;
  }
  
  /**
   * Find edge by UUID
   */
  async findByUuid(uuid) {
    const cypher = `
      MATCH (e:EntityEdge {uuid: $uuid})
      RETURN e
    `;
    
    const result = await this.connection.query(cypher, { uuid });
    const record = result.data?.[0]?.[0];
    
    if (!record) return null;
    
    const edge = this._mapRecord(record);
    
    // Get source and target entity names
    const enrichCypher = `
      MATCH (source:EntityNode {uuid: $source_uuid})
      MATCH (target:EntityNode {uuid: $target_uuid})
      RETURN source.name as source_name, target.name as target_name
    `;
    
    const enrichResult = await this.connection.query(enrichCypher, {
      source_uuid: edge.source_node_uuid,
      target_uuid: edge.target_node_uuid
    });
    
    if (enrichResult.data?.[0]) {
      edge.source_name = enrichResult.data[0][0];
      edge.target_name = enrichResult.data[0][1];
    }
    
    return edge;
  }
  
  /**
   * Find similar fact between two nodes
   */
  async findSimilarFact(sourceUuid, targetUuid, fact, groupId) {
    // Simple exact match for now
    const cypher = `
      MATCH (e:EntityEdge {
        source_node_uuid: $sourceUuid,
        target_node_uuid: $targetUuid,
        group_id: $groupId
      })
      WHERE e.fact = $fact
      RETURN e
    `;
    
    const result = await this.connection.query(cypher, { sourceUuid, targetUuid, fact, groupId });
    const record = result.data?.[0]?.[0];
    return record ? this._mapRecord(record) : null;
  }
  
  /**
   * Search facts (hybrid: text + vector)
   */
  async search(query, queryEmbedding, groupIds, options = {}) {
    const limit = options.limit || 10;
    
    // First, do text search
    const textResults = await this._textSearch(query, groupIds, limit * 2);
    
    // Then calculate vector similarity for each result
    const resultsWithScores = [];
    
    for (const edge of textResults) {
      const embedding = this._parseEmbedding(edge.fact_embedding);
      const vectorScore = embedding.length > 0
        ? this.embedderClient.cosineSimilarity(queryEmbedding, embedding)
        : 0;
      
      // Combined score
      const textScore = edge.text_score || 0.5;
      const combinedScore = (textScore * 0.3) + (vectorScore * 0.7);
      
      resultsWithScores.push({
        ...edge,
        text_score: textScore,
        vector_score: vectorScore,
        score: combinedScore
      });
    }
    
    // If text search returned few results, also do vector-only search
    if (textResults.length < limit) {
      const vectorResults = await this._vectorSearch(queryEmbedding, groupIds, limit);
      
      for (const edge of vectorResults) {
        // Skip if already in results
        if (resultsWithScores.find(r => r.uuid === edge.uuid)) continue;
        
        const embedding = this._parseEmbedding(edge.fact_embedding);
        const vectorScore = embedding.length > 0
          ? this.embedderClient.cosineSimilarity(queryEmbedding, embedding)
          : 0;
        
        resultsWithScores.push({
          ...edge,
          text_score: 0,
          vector_score: vectorScore,
          score: vectorScore * 0.7
        });
      }
    }
    
    // Sort by combined score and limit
    const sortedResults = resultsWithScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // Enrich with entity names
    for (const edge of sortedResults) {
      const enrichCypher = `
        MATCH (source:EntityNode {uuid: $source_uuid})
        MATCH (target:EntityNode {uuid: $target_uuid})
        RETURN source.name as source_name, target.name as target_name
      `;
      
      const enrichResult = await this.connection.query(enrichCypher, {
        source_uuid: edge.source_node_uuid,
        target_uuid: edge.target_node_uuid
      });
      
      if (enrichResult.data?.[0]) {
        edge.source_name = enrichResult.data[0][0];
        edge.target_name = enrichResult.data[0][1];
      }
    }
    
    return sortedResults;
  }
  
  /**
   * Text search for facts
   */
  async _textSearch(query, groupIds, limit) {
    const safeLimit = parseInt(limit) || 10;
    const safeQuery = (query || '').replace(/'/g, "\\'"); // Escape single quotes
    const groupIdFilter = groupIds.length > 0
      ? `AND e.group_id IN [${groupIds.map(g => `'${g}'`).join(', ')}]`
      : '';
    
    const cypher = `
      MATCH (e:EntityEdge)
      WHERE toLower(e.fact) CONTAINS toLower('${safeQuery}')
      ${groupIdFilter}
      RETURN e
      LIMIT ${safeLimit}
    `;
    
    const result = await this.connection.query(cypher, {});
    return (result.data || []).map(row => {
      const edge = this._mapRecord(row[0]);
      if (!edge) return null;
      edge.text_score = 1.0;
      return edge;
    }).filter(Boolean);
  }
  
  /**
   * Vector search for facts
   */
  async _vectorSearch(queryEmbedding, groupIds, limit) {
    const groupIdFilter = groupIds.length > 0
      ? `WHERE e.group_id IN [${groupIds.map(g => `'${g}'`).join(', ')}]`
      : '';
    
    const cypher = `
      MATCH (e:EntityEdge)
      ${groupIdFilter}
      RETURN e
      LIMIT 1000
    `;
    
    const result = await this.connection.query(cypher, {});
    return (result.data || []).map(row => this._mapRecord(row[0])).filter(Boolean);
  }
  
  /**
   * Delete edge by UUID
   */
  async deleteByUuid(uuid) {
    // Delete the edge node
    const deleteNode = `
      MATCH (e:EntityEdge {uuid: $uuid})
      DETACH DELETE e
      RETURN count(e) as deleted
    `;
    
    await this.connection.query(deleteNode, { uuid });
    
    // Delete the relationship
    const deleteRel = `
      MATCH ()-[r:RELATED_TO {uuid: $uuid}]->()
      DELETE r
      RETURN count(r) as deleted
    `;
    
    const result = await this.connection.query(deleteRel, { uuid });
    return true;
  }
  
  /**
   * Delete all edges by group IDs
   */
  async deleteByGroupIds(groupIds) {
    let totalDeleted = 0;
    
    for (const groupId of groupIds) {
      // Get UUIDs first to delete relationships too
      const getUuids = `
        MATCH (e:EntityEdge {group_id: $groupId})
        RETURN e.uuid as uuid
      `;
      
      const uuidsResult = await this.connection.query(getUuids, { groupId });
      const uuids = (uuidsResult.data || []).map(row => row[0]);
      
      // Delete edge nodes
      const deleteNodes = `
        MATCH (e:EntityEdge {group_id: $groupId})
        WITH e, count(e) as cnt
        DETACH DELETE e
        RETURN cnt
      `;
      
      const result = await this.connection.query(deleteNodes, { groupId });
      totalDeleted += result.data?.[0]?.[0] || 0;
      
      // Delete relationships
      for (const uuid of uuids) {
        const deleteRel = `
          MATCH ()-[r:RELATED_TO {uuid: $uuid}]->()
          DELETE r
        `;
        await this.connection.query(deleteRel, { uuid });
      }
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
   * Map FalkorDB record to edge
   */
  _mapRecord(record) {
    if (!record || !record.properties) {
      return null;
    }
    
    const props = record.properties;
    return {
      uuid: props.uuid,
      source_node_uuid: props.source_node_uuid,
      target_node_uuid: props.target_node_uuid,
      fact: props.fact,
      group_id: props.group_id,
      episode_uuid: props.episode_uuid,
      created_at: props.created_at,
      invalid_at: props.invalid_at || null,
      fact_embedding: props.fact_embedding
    };
  }
}

export default EntityEdgeRepositoryFalkorDB;
