/**
 * FreshnessAnnotator - Inline freshness checking service
 * 
 * Annotates entities with freshness status by comparing:
 * - File-backed entities: file mtime vs entity.updated_at
 * - Non-file entities: age-based check (fallback)
 * 
 * Used by RecallEntities to return inline freshness with search results.
 */
class FreshnessAnnotator {
  constructor({ projectConfigRepository, statCache }) {
    this.projectConfigRepository = projectConfigRepository;
    this.statCache = statCache;
    
    // Config
    this.staleBufferMs = 1000; // Ignore sub-second drift
    this.defaultMaxAgeHours = 168; // 7 days for non-file entities
  }

  /**
   * Annotate entities with freshness information
   * @param {Array} entities - List of entities to annotate
   * @param {string} groupId - Project group_id
   * @returns {Promise<Array>} - Entities with freshness field added
   */
  async annotate(entities, groupId) {
    if (!entities || entities.length === 0) return [];

    // Get project config for path resolution
    const config = await this.projectConfigRepository.findByGroupId(groupId);
    
    return Promise.all(entities.map(entity => this._annotateOne(entity, config)));
  }

  /**
   * Annotate a single entity
   */
  async _annotateOne(entity, config) {
    // Non-file-backed entities: use age-based freshness
    if (!entity.source_file) {
      return this._annotateByAge(entity);
    }

    // No project config: can't resolve path, mark as unknown
    if (!config || !config.project_root) {
      return {
        ...entity,
        freshness: {
          stale: false,
          reason: 'no_project_config',
          age_hours: this._getAgeHours(entity.updated_at)
        }
      };
    }

    // Resolve absolute path
    const absPath = this._resolvePath(config.project_root, entity.source_file);
    
    // Get file mtime
    const mtime = await this.statCache.mtime(absPath);

    // File doesn't exist
    if (mtime === null) {
      return {
        ...entity,
        freshness: {
          stale: true,
          reason: 'file_missing',
          file_path: absPath,
          age_hours: this._getAgeHours(entity.updated_at)
        }
      };
    }

    // Compare mtime vs entity.updated_at
    const entityTime = new Date(entity.updated_at).getTime();
    const isStale = mtime > (entityTime + this.staleBufferMs);

    return {
      ...entity,
      freshness: {
        stale: isStale,
        reason: isStale ? 'file_modified' : 'fresh',
        file_mtime: new Date(mtime).toISOString(),
        age_hours: this._getAgeHours(entity.updated_at)
      }
    };
  }

  /**
   * Age-based freshness for non-file entities
   */
  _annotateByAge(entity) {
    const ageHours = this._getAgeHours(entity.updated_at);
    const isStale = ageHours > this.defaultMaxAgeHours;

    return {
      ...entity,
      freshness: {
        stale: isStale,
        reason: isStale ? 'age_exceeded' : 'fresh',
        age_hours: ageHours
      }
    };
  }

  /**
   * Calculate age in hours
   */
  _getAgeHours(timestamp) {
    if (!timestamp) return 0;
    const then = new Date(timestamp).getTime();
    const now = Date.now();
    return Math.round((now - then) / 3600000 * 10) / 10; // 1 decimal place
  }

  /**
   * Resolve relative path to absolute
   */
  _resolvePath(projectRoot, sourceFile) {
    if (sourceFile.startsWith('/')) return sourceFile;
    return `${projectRoot.replace(/\/$/, '')}/${sourceFile}`;
  }

  /**
   * Check freshness for a single entity (convenience method)
   */
  async checkOne(entity, groupId) {
    const results = await this.annotate([entity], groupId);
    return results[0];
  }

  /**
   * Filter entities by freshness
   * @param {Array} entities - Annotated entities
   * @param {string} filter - 'any' | 'fresh_only' | 'stale_only'
   * @returns {Array}
   */
  filterByFreshness(entities, filter = 'any') {
    if (filter === 'any') return entities;
    
    return entities.filter(e => {
      const isStale = e.freshness?.stale === true;
      if (filter === 'fresh_only') return !isStale;
      if (filter === 'stale_only') return isStale;
      return true;
    });
  }
}

export default FreshnessAnnotator;
