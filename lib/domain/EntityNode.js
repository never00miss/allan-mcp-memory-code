/**
 * EntityNode Entity
 * Represents a node in the knowledge graph.
 * 
 * New schema (v2): Structured fields replace composite name convention.
 * - `type` + `scope` replace `name: "type:project:scope"` pattern
 * - `source_file` + `source_lines` enable file-mtime freshness checking
 * - `updated_at` tracks last modification for freshness comparison
 * - `episode_uuid` tracks which episode created this entity
 */

const ENTITY_TYPES = ['file', 'func', 'api', 'arch', 'pattern', 'task', 'debug', 'note', 'index'];

class EntityNode {
  constructor({
    uuid,
    name,                    // Legacy: kept for backward compat, will be auto-generated
    type,                    // NEW: file|func|api|arch|pattern|task|debug|note|index
    scope,                   // NEW: "src/auth.js" or "UserService.login" or "POST /login"
    labels = [],
    summary = '',
    group_id,
    source_file = null,      // NEW: relative path to source file (for freshness)
    source_lines = null,     // NEW: [start, end] line numbers in source
    created_at,
    updated_at,              // NEW: for freshness comparison vs file mtime
    episode_uuid = null,     // NEW: which episode created this entity
    name_embedding = []
  }) {
    this.uuid = uuid;
    this.type = type || this._inferTypeFromLabels(labels);
    this.scope = scope || this._inferScopeFromName(name);
    this.name = name || this._generateName(this.type, group_id, this.scope);
    this.labels = Array.isArray(labels) ? labels : [labels];
    this.summary = summary;
    this.group_id = group_id;
    this.source_file = source_file;
    this.source_lines = source_lines;
    this.created_at = created_at || new Date().toISOString();
    this.updated_at = updated_at || this.created_at;
    this.episode_uuid = episode_uuid;
    this.name_embedding = name_embedding;
  }

  /**
   * Infer type from legacy labels array
   */
  _inferTypeFromLabels(labels) {
    if (!labels || labels.length === 0) return 'note';
    const label = labels[0].toLowerCase();
    if (ENTITY_TYPES.includes(label)) return label;
    // Map legacy labels
    const mapping = {
      'function': 'func',
      'method': 'func',
      'class': 'func',
      'endpoint': 'api',
      'route': 'api',
      'architecture': 'arch',
      'design': 'arch',
      'entity': 'note'
    };
    return mapping[label] || 'note';
  }

  /**
   * Infer scope from legacy name (e.g., "func:project:UserService.login" -> "UserService.login")
   */
  _inferScopeFromName(name) {
    if (!name) return '';
    const parts = name.split(':');
    if (parts.length >= 3) {
      return parts.slice(2).join(':'); // Everything after type:project:
    }
    return name;
  }

  /**
   * Generate legacy-compatible name from structured fields
   */
  _generateName(type, groupId, scope) {
    return `${type}:${groupId}:${scope}`;
  }
  
  /**
   * Validate the entity node
   * @throws {Error} if invalid
   */
  validate() {
    if (!this.uuid) {
      throw new Error('EntityNode uuid is required');
    }
    if (!this.type) {
      throw new Error('EntityNode type is required');
    }
    if (!ENTITY_TYPES.includes(this.type)) {
      throw new Error(`EntityNode type must be one of: ${ENTITY_TYPES.join(', ')}`);
    }
    if (!this.scope) {
      throw new Error('EntityNode scope is required');
    }
    if (!this.group_id) {
      throw new Error('EntityNode group_id is required');
    }
  }
  
  /**
   * Get primary label (type) - legacy compat
   */
  getPrimaryLabel() {
    return this.type.toUpperCase();
  }

  /**
   * Check if this entity is file-backed (can have file-mtime freshness)
   */
  isFileBacked() {
    return !!this.source_file;
  }

  /**
   * Get natural key for upsert: (group_id, type, scope)
   */
  getNaturalKey() {
    return {
      group_id: this.group_id,
      type: this.type,
      scope: this.scope
    };
  }
  
  /**
   * Convert to plain object
   */
  toObject() {
    return {
      uuid: this.uuid,
      name: this.name,
      type: this.type,
      scope: this.scope,
      labels: this.labels,
      summary: this.summary,
      group_id: this.group_id,
      source_file: this.source_file,
      source_lines: this.source_lines,
      created_at: this.created_at,
      updated_at: this.updated_at,
      episode_uuid: this.episode_uuid
    };
  }
}

export { ENTITY_TYPES };
export default EntityNode;
