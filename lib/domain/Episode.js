/**
 * Episode Entity
 * Represents an episodic memory (a piece of information added to the graph)
 */
class Episode {
  constructor({
    uuid,
    name,
    content,
    episode_body,
    source = 'text',
    source_description = '',
    group_id,
    created_at,
    content_embedding = []
  }) {
    this.uuid = uuid;
    this.name = name;
    this.content = content || episode_body;
    this.episode_body = episode_body || content;
    this.source = source;
    this.source_description = source_description;
    this.group_id = group_id;
    this.created_at = created_at || new Date().toISOString();
    this.content_embedding = content_embedding;
  }
  
  /**
   * Validate the episode
   * @throws {Error} if invalid
   */
  validate() {
    if (!this.uuid) {
      throw new Error('Episode uuid is required');
    }
    if (!this.content && !this.episode_body) {
      throw new Error('Episode content or episode_body is required');
    }
    if (!this.group_id) {
      throw new Error('Episode group_id is required');
    }
  }
  
  /**
   * Convert to plain object
   */
  toObject() {
    return {
      uuid: this.uuid,
      name: this.name,
      content: this.content,
      source: this.source,
      source_description: this.source_description,
      group_id: this.group_id,
      created_at: this.created_at
    };
  }
}

export default Episode;
