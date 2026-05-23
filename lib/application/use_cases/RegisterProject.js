/**
 * RegisterProject Use Case
 * 
 * Stores project configuration including project_root for path resolution.
 * Must be called once per project before using freshness features.
 * Idempotent - calling again updates the config.
 */
class RegisterProject {
  constructor({ projectConfigRepository }) {
    this.projectConfigRepository = projectConfigRepository;
  }

  /**
   * Execute the use case
   * @param {Object} input
   * @param {string} input.group_id - Project identifier (kebab-case)
   * @param {string} input.project_root - Absolute path to project root
   * @param {Array<string>} input.ignore_patterns - Optional gitignore-style patterns
   */
  async execute({ group_id, project_root, ignore_patterns = [] }) {
    // Validate inputs
    if (!group_id) {
      throw new Error('group_id is required');
    }
    if (!project_root) {
      throw new Error('project_root is required');
    }
    if (!project_root.startsWith('/')) {
      throw new Error('project_root must be an absolute path');
    }

    // Upsert config
    const config = await this.projectConfigRepository.upsert({
      group_id,
      project_root: project_root.replace(/\/$/, ''), // Remove trailing slash
      ignore_patterns,
      created_at: new Date().toISOString()
    });

    return {
      status: 'registered',
      group_id: config.group_id,
      project_root: config.project_root,
      ignore_patterns: config.ignore_patterns
    };
  }
}

export default RegisterProject;
