/**
 * ProjectConfig Entity
 * Stores project-level configuration for path resolution and freshness checking.
 * 
 * Used by:
 * - FreshnessAnnotator: to resolve source_file -> absolute path
 * - RefreshFromFile: to locate files for re-extraction
 * - RegisterProject: to set up new projects
 */
class ProjectConfig {
  constructor({
    group_id,
    project_root,
    created_at,
    last_indexed_at = null,
    ignore_patterns = []
  }) {
    this.group_id = group_id;
    this.project_root = project_root;
    this.created_at = created_at || new Date().toISOString();
    this.last_indexed_at = last_indexed_at;
    this.ignore_patterns = ignore_patterns;
  }

  /**
   * Validate the project config
   * @throws {Error} if invalid
   */
  validate() {
    if (!this.group_id) {
      throw new Error('ProjectConfig group_id is required');
    }
    if (!this.project_root) {
      throw new Error('ProjectConfig project_root is required');
    }
    // project_root should be absolute path
    if (!this.project_root.startsWith('/')) {
      throw new Error('ProjectConfig project_root must be an absolute path');
    }
  }

  /**
   * Resolve a relative source_file to absolute path
   * @param {string} sourceFile - Relative path (e.g., "src/auth.js")
   * @returns {string} - Absolute path
   */
  resolveSourceFile(sourceFile) {
    if (!sourceFile) return null;
    // Handle already-absolute paths
    if (sourceFile.startsWith('/')) return sourceFile;
    // Join with project root
    return `${this.project_root.replace(/\/$/, '')}/${sourceFile}`;
  }

  /**
   * Check if a file should be ignored based on ignore_patterns
   * @param {string} relativePath - Relative file path
   * @returns {boolean}
   */
  shouldIgnore(relativePath) {
    if (!relativePath || this.ignore_patterns.length === 0) return false;
    
    return this.ignore_patterns.some(pattern => {
      // Simple glob matching: * matches anything except /, ** matches everything
      const regex = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
      return new RegExp(`^${regex}$`).test(relativePath);
    });
  }

  /**
   * Update last_indexed_at timestamp
   */
  touchLastIndexed() {
    this.last_indexed_at = new Date().toISOString();
  }

  /**
   * Convert to plain object
   */
  toObject() {
    return {
      group_id: this.group_id,
      project_root: this.project_root,
      created_at: this.created_at,
      last_indexed_at: this.last_indexed_at,
      ignore_patterns: this.ignore_patterns
    };
  }
}

export default ProjectConfig;
