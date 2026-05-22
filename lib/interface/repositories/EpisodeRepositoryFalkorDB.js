import EpisodeRepository from '../../domain/EpisodeRepository';

/**
 * FalkorDB implementation of Episode Repository
 */
class EpisodeRepositoryFalkorDB extends EpisodeRepository {
  constructor(connection) {
    super();
    this.connection = connection;
  }
  
  /**
   * Create a new episode
   */
  async create(episode) {
    const cypher = `
      CREATE (e:EpisodicNode {
        uuid: $uuid,
        name: $name,
        content: $content,
        source: $source,
        source_description: $source_description,
        group_id: $group_id,
        created_at: $created_at
      })
      RETURN e
    `;
    
    const params = {
      uuid: episode.uuid,
      name: episode.name || '',
      content: episode.content || episode.episode_body || '',
      source: episode.source || 'text',
      source_description: episode.source_description || '',
      group_id: episode.group_id,
      created_at: episode.created_at || new Date().toISOString()
    };
    
    // Store embedding separately if provided (as property)
    if (episode.content_embedding && episode.content_embedding.length > 0) {
      params.content_embedding = JSON.stringify(episode.content_embedding);
    }
    
    const result = await this.connection.query(cypher, params);
    return this._mapRecord(result.data?.[0]?.[0]);
  }
  
  /**
   * Find episode by UUID
   */
  async findByUuid(uuid) {
    const cypher = `
      MATCH (e:EpisodicNode {uuid: $uuid})
      RETURN e
    `;
    
    const result = await this.connection.query(cypher, { uuid });
    const record = result.data?.[0]?.[0];
    return record ? this._mapRecord(record) : null;
  }
  
  /**
   * Find episodes by group ID
   */
  async findByGroupId(groupId, options = {}) {
    const limit = parseInt(options.limit) || 100;
    const offset = parseInt(options.offset) || 0;
    const safeGroupId = (groupId || '').replace(/'/g, "\\'");
    
    // FalkorDB - use inline values for compatibility
    const cypher = `
      MATCH (e:EpisodicNode {group_id: '${safeGroupId}'})
      RETURN e
      ORDER BY e.created_at DESC
      SKIP ${offset}
      LIMIT ${limit}
    `;
    
    const result = await this.connection.query(cypher, {});
    return (result.data || []).map(row => this._mapRecord(row[0])).filter(Boolean);
  }
  
  /**
   * Delete episode by UUID
   */
  async deleteByUuid(uuid) {
    const cypher = `
      MATCH (e:EpisodicNode {uuid: $uuid})
      DETACH DELETE e
      RETURN count(e) as deleted
    `;
    
    const result = await this.connection.query(cypher, { uuid });
    return (result.data?.[0]?.[0] || 0) > 0;
  }
  
  /**
   * Delete all episodes by group IDs
   */
  async deleteByGroupIds(groupIds) {
    let totalDeleted = 0;
    
    for (const groupId of groupIds) {
      const cypher = `
        MATCH (e:EpisodicNode {group_id: $groupId})
        WITH e, count(e) as cnt
        DETACH DELETE e
        RETURN cnt
      `;
      
      const result = await this.connection.query(cypher, { groupId });
      totalDeleted += result.data?.[0]?.[0] || 0;
    }
    
    return totalDeleted;
  }
  
  /**
   * Map FalkorDB record to entity
   */
  _mapRecord(record) {
    if (!record || !record.properties) {
      return null;
    }
    
    const props = record.properties;
    return {
      uuid: props.uuid,
      name: props.name,
      content: props.content,
      source: props.source,
      source_description: props.source_description,
      group_id: props.group_id,
      created_at: props.created_at
    };
  }
}

export default EpisodeRepositoryFalkorDB;
