import ProjectConfigRepository from '../../domain/ProjectConfigRepository.js';

/**
 * FalkorDB implementation of ProjectConfig Repository
 */
class ProjectConfigRepositoryFalkorDB extends ProjectConfigRepository {
  constructor(connection) {
    super();
    this.connection = connection;
  }

  /**
   * Create or update project config (upsert by group_id)
   */
  async upsert(config) {
    // Check if exists
    const existing = await this.findByGroupId(config.group_id);
    
    if (existing) {
      // Update
      const cypher = `
        MATCH (c:ProjectConfig {group_id: $group_id})
        SET c.project_root = $project_root,
            c.last_indexed_at = $last_indexed_at,
            c.ignore_patterns = $ignore_patterns
        RETURN c
      `;
      
      const params = {
        group_id: config.group_id,
        project_root: config.project_root,
        last_indexed_at: config.last_indexed_at || null,
        ignore_patterns: JSON.stringify(config.ignore_patterns || [])
      };
      
      const result = await this.connection.query(cypher, params);
      return this._mapRecord(result.data?.[0]);
    } else {
      // Create
      const cypher = `
        CREATE (c:ProjectConfig {
          group_id: $group_id,
          project_root: $project_root,
          created_at: $created_at,
          last_indexed_at: $last_indexed_at,
          ignore_patterns: $ignore_patterns
        })
        RETURN c
      `;
      
      const params = {
        group_id: config.group_id,
        project_root: config.project_root,
        created_at: config.created_at || new Date().toISOString(),
        last_indexed_at: config.last_indexed_at || null,
        ignore_patterns: JSON.stringify(config.ignore_patterns || [])
      };
      
      const result = await this.connection.query(cypher, params);
      return this._mapRecord(result.data?.[0]);
    }
  }

  /**
   * Find config by group_id
   */
  async findByGroupId(groupId) {
    const cypher = `
      MATCH (c:ProjectConfig {group_id: $groupId})
      RETURN c
    `;
    
    const result = await this.connection.query(cypher, { groupId });
    const record = result.data?.[0];
    return record ? this._mapRecord(record) : null;
  }

  /**
   * List all project configs
   */
  async findAll() {
    const cypher = `
      MATCH (c:ProjectConfig)
      RETURN c
      ORDER BY c.group_id
    `;
    
    const result = await this.connection.query(cypher, {});
    return (result.data || []).map(row => this._mapRecord(row[0])).filter(Boolean);
  }

  /**
   * Delete config by group_id
   */
  async deleteByGroupId(groupId) {
    const cypher = `
      MATCH (c:ProjectConfig {group_id: $groupId})
      DELETE c
      RETURN count(c) as deleted
    `;
    
    const result = await this.connection.query(cypher, { groupId });
    return (result.data?.[0] || 0) > 0;
  }

  /**
   * Update last_indexed_at timestamp
   */
  async touchLastIndexed(groupId) {
    const cypher = `
      MATCH (c:ProjectConfig {group_id: $groupId})
      SET c.last_indexed_at = $last_indexed_at
      RETURN c
    `;
    
    const result = await this.connection.query(cypher, {
      groupId,
      last_indexed_at: new Date().toISOString()
    });
    
    return result.data?.length > 0;
  }

  /**
   * Map FalkorDB record to config object
   */
  _mapRecord(record) {
    if (!record) return null;
    
    let props;
    if (record.c && record.c.properties) {
      props = record.c.properties;
    } else if (record.properties) {
      props = record.properties;
    } else {
      props = record;
    }
    
    if (!props || !props.group_id) return null;
    
    let ignorePatterns = [];
    try {
      ignorePatterns = JSON.parse(props.ignore_patterns || '[]');
    } catch {}
    
    return {
      group_id: props.group_id,
      project_root: props.project_root,
      created_at: props.created_at,
      last_indexed_at: props.last_indexed_at,
      ignore_patterns: ignorePatterns
    };
  }
}

export default ProjectConfigRepositoryFalkorDB;
