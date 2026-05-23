import EntityNodeRepository from '../../domain/EntityNodeRepository.js';

/**
 * FalkorDB implementation of EntityNode Repository
 * 
 * v2 Changes:
 * - Added new fields: type, scope, source_file, source_lines, updated_at, episode_uuid
 * - Added upsertByNaturalKey for (group_id, type, scope) uniqueness
 * - Added findByNaturalKey, listByType methods
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
        type: $type,
        scope: $scope,
        labels: $labels,
        summary: $summary,
        group_id: $group_id,
        source_file: $source_file,
        source_lines: $source_lines,
        created_at: $created_at,
        updated_at: $updated_at,
        episode_uuid: $episode_uuid,
        name_embedding: $name_embedding
      })
      RETURN n
    `;
    
    const params = {
      uuid: entity.uuid,
      name: entity.name,
      type: entity.type || 'note',
      scope: entity.scope || entity.name,
      labels: JSON.stringify(entity.labels || ['ENTITY']),
      summary: entity.summary || '',
      group_id: entity.group_id,
      source_file: entity.source_file || null,
      source_lines: entity.source_lines ? JSON.stringify(entity.source_lines) : null,
      created_at: entity.created_at || new Date().toISOString(),
      updated_at: entity.updated_at || entity.created_at || new Date().toISOString(),
      episode_uuid: entity.episode_uuid || null,
      name_embedding: JSON.stringify(entity.name_embedding || [])
    };
    
    const result = await this.connection.query(cypher, params);
    return this._mapRecord(result.data?.[0]);
  }

  /**
   * Create or update entity by natural key (group_id, type, scope)
   */
  async upsertByNaturalKey(entity) {
    const existing = await this.findByNaturalKey(entity.group_id, entity.type, entity.scope);
    
    if (existing) {
      // Update existing entity
      const cypher = `
        MATCH (n:EntityNode {group_id: $group_id, type: $type, scope: $scope})
        SET n.name = $name,
            n.labels = $labels,
            n.summary = $summary,
            n.source_file = $source_file,
            n.source_lines = $source_lines,
            n.updated_at = $updated_at,
            n.episode_uuid = $episode_uuid,
            n.name_embedding = $name_embedding
        RETURN n
      `;
      
      const params = {
        group_id: entity.group_id,
        type: entity.type,
        scope: entity.scope,
        name: entity.name || `${entity.type}:${entity.group_id}:${entity.scope}`,
        labels: JSON.stringify(entity.labels || [entity.type.toUpperCase()]),
        summary: entity.summary || existing.summary,
        source_file: entity.source_file !== undefined ? entity.source_file : existing.source_file,
        source_lines: entity.source_lines ? JSON.stringify(entity.source_lines) : (existing.source_lines ? JSON.stringify(existing.source_lines) : null),
        updated_at: new Date().toISOString(),
        episode_uuid: entity.episode_uuid || existing.episode_uuid,
        name_embedding: JSON.stringify(entity.name_embedding || [])
      };
      
      const result = await this.connection.query(cypher, params);
      return this._mapRecord(result.data?.[0]);
    } else {
      // Create new
      return this.create({
        ...entity,
        uuid: entity.uuid || this._generateUuid(),
        name: entity.name || `${entity.type}:${entity.group_id}:${entity.scope}`,
        labels: entity.labels || [entity.type.toUpperCase()]
      });
    }
  }

  /**
   * Generate UUID (simple implementation)
   */
  _generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Find entity by natural key (group_id, type, scope)
   */
  async findByNaturalKey(groupId, type, scope) {
    const safeScope = (scope || '').replace(/'/g, "\\'");
    const cypher = `
      MATCH (n:EntityNode {group_id: $groupId, type: $type})
      WHERE n.scope = '${safeScope}'
      RETURN n
    `;
    
    const result = await this.connection.query(cypher, { groupId, type });
    const record = result.data?.[0];
    return record ? this._mapRecord(record) : null;
  }

  /**
   * Find entities by type within a group
   */
  async findByTypeAndGroup(groupId, type, options = {}) {
    const limit = options.limit || 100;
    const cypher = `
      MATCH (n:EntityNode {group_id: $groupId, type: $type})
      RETURN n
      ORDER BY n.updated_at DESC
      LIMIT ${limit}
    `;
    
    const result = await this.connection.query(cypher, { groupId, type });
    return (result.data || []).map(row => this._mapRecord(row[0])).filter(Boolean);
  }

  /**
   * List entities by type (or all) within a group
   * Returns light objects (no embedding) for enumeration
   */
  async listByType(groupId, type = null, options = {}) {
    const limit = options.limit || 50;
    const typeFilter = type ? `AND n.type = '${type}'` : '';
    
    const cypher = `
      MATCH (n:EntityNode {group_id: $groupId})
      WHERE 1=1 ${typeFilter}
      RETURN n.uuid as uuid, n.type as type, n.scope as scope, 
             n.source_file as source_file, n.updated_at as updated_at,
             n.summary as summary
      ORDER BY n.type, n.scope
      LIMIT ${limit}
    `;
    
    const result = await this.connection.query(cypher, { groupId });
    return (result.data || []).map(row => ({
      uuid: row[0],
      type: row[1],
      scope: row[2],
      source_file: row[3],
      updated_at: row[4],
      summary: row[5]
    }));
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
    const record = result.data?.[0];
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
    const record = result.data?.[0];
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
      const entity = this._mapRecord(row);
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
    return (result.data || []).map(row => this._mapRecord(row)).filter(Boolean);
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
    return (result.data?.[0] || 0) > 0;
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
      totalDeleted += result.data?.[0] || 0;
    }
    
    return totalDeleted;
  }
  
  /**
   * Search entities by name pattern (contains)
   */
  async searchByNamePattern(pattern, groupId) {
    const safePattern = (pattern || '').replace(/'/g, "\\'");
    
    const cypher = `
      MATCH (n:EntityNode)
      WHERE n.name CONTAINS '${safePattern}'
      ${groupId ? `AND n.group_id = '${groupId}'` : ''}
      RETURN n
      LIMIT 100
    `;
    
    const result = await this.connection.query(cypher, {});
    return (result.data || []).map(row => this._mapRecord(row)).filter(Boolean);
  }
  
  /**
   * Update entity summary
   */
  async updateSummary(uuid, summary) {
    const cypher = `
      MATCH (n:EntityNode {uuid: $uuid})
      SET n.summary = $summary, n.updated_at = $updated_at
      RETURN n
    `;
    
    const result = await this.connection.query(cypher, {
      uuid,
      summary,
      updated_at: new Date().toISOString()
    });
    
    return result.data?.length > 0;
  }
  
  /**
   * Delete entity by UUID (alias for deleteByUuid)
   */
  async delete(uuid) {
    return this.deleteByUuid(uuid);
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
    if (!record) {
      return null;
    }
    
    // FalkorDB can return data in different formats
    // Handle: {n: {properties: {...}}} or {properties: {...}} or direct props
    let props;
    if (record.n && record.n.properties) {
      // Format: {n: {id, labels, properties}}
      props = record.n.properties;
    } else if (record.properties) {
      // Format: {id, labels, properties}
      props = record.properties;
    } else {
      // Direct properties object
      props = record;
    }
    
    if (!props || !props.uuid) {
      return null;
    }
    
    let labels = ['ENTITY'];
    try {
      labels = JSON.parse(props.labels || '["ENTITY"]');
    } catch {}

    let sourceLines = null;
    try {
      if (props.source_lines) {
        sourceLines = JSON.parse(props.source_lines);
      }
    } catch {}
    
    return {
      uuid: props.uuid,
      name: props.name,
      type: props.type || 'note',
      scope: props.scope || props.name,
      labels,
      summary: props.summary,
      group_id: props.group_id,
      source_file: props.source_file || null,
      source_lines: sourceLines,
      created_at: props.created_at,
      updated_at: props.updated_at || props.created_at,
      episode_uuid: props.episode_uuid || null,
      name_embedding: props.name_embedding
    };
  }
}

export default EntityNodeRepositoryFalkorDB;
