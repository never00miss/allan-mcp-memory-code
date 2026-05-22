import OpenAI from 'openai';
import logger from '../../logger';

/**
 * LLM Client - OpenAI-compatible chat/completions
 * Works with z.ai, Ollama, OpenAI, etc.
 */
class LLMClient {
  constructor() {
    this.client = null;
    this.model = process.env.LLM_MODEL || 'glm-4.6';
  }
  
  /**
   * Initialize the LLM client
   */
  async init() {
    const baseURL = process.env.LLM_API_URL || 'https://api.openai.com/v1';
    const apiKey = process.env.LLM_API_KEY || 'sk-xxx';
    
    this.client = new OpenAI({
      baseURL,
      apiKey
    });
    
    logger.info({ baseURL, model: this.model }, 'LLM Client initialized');
    return this;
  }
  
  /**
   * Chat completion
   * @param {string} systemPrompt - System prompt
   * @param {string} userContent - User content
   * @param {Object} options - Additional options
   * @returns {string} - Response content
   */
  async chat(systemPrompt, userContent, options = {}) {
    try {
      const response = await this.client.chat.completions.create({
        model: options.model || this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens || 4096
      });
      
      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error({
        status: error.status,
        message: error.message,
        err: error.error || error
      }, 'LLM Chat Error');
      throw error;
    }
  }
  
  /**
   * Chat completion with JSON response
   * @param {string} systemPrompt - System prompt
   * @param {string} userContent - User content
   * @param {Object} options - Additional options
   * @returns {Object} - Parsed JSON response
   */
  async chatJSON(systemPrompt, userContent, options = {}) {
    const content = await this.chat(systemPrompt, userContent, options);
    
    // Try to extract JSON from the response
    try {
      // Try direct parse first
      return JSON.parse(content);
    } catch {
      // Try to find JSON in markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim());
      }
      
      // Try to find JSON array or object
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]);
      }
      
      const objectMatch = content.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }
      
      throw new Error(`Failed to parse JSON from LLM response: ${content.substring(0, 200)}`);
    }
  }
  
  /**
   * Extract entities from episode content
   * @param {string} content - Episode content
   * @returns {Array} - Array of entities
   */
  async extractEntities(content) {
    const systemPrompt = `You are an entity extraction system. Extract all named entities from the given text.
Return a JSON array of entities with the following structure:
[
  {
    "name": "Entity Name",
    "type": "PERSON|ORGANIZATION|PRODUCT|LOCATION|CONCEPT|EVENT|OTHER",
    "summary": "Brief description of the entity based on context"
  }
]

Rules:
- Extract real entities (people, companies, products, places, concepts, events)
- Use consistent naming (e.g., "Acme Corp" not "acme" or "ACME CORP")
- Provide a brief summary based on the context
- Return empty array [] if no entities found
- Return ONLY valid JSON, no explanations`;

    try {
      const entities = await this.chatJSON(systemPrompt, content);
      return Array.isArray(entities) ? entities : [];
    } catch (error) {
      logger.error({ err: error }, 'Entity extraction failed');
      return [];
    }
  }
  
  /**
   * Extract relationships/facts between entities
   * @param {string} content - Episode content
   * @param {Array} entities - Extracted entities
   * @returns {Array} - Array of relationships
   */
  async extractFacts(content, entities) {
    if (!entities || entities.length < 2) {
      return [];
    }
    
    const entityList = entities.map(e => `- ${e.name} (${e.type})`).join('\n');
    
    const systemPrompt = `You are a relationship extraction system. Given text and a list of entities, extract factual relationships between them.
Return a JSON array of relationships with the following structure:
[
  {
    "source": "Source Entity Name",
    "target": "Target Entity Name", 
    "fact": "Description of the relationship or fact connecting these entities"
  }
]

Rules:
- Only create relationships between entities from the provided list
- The fact should be a clear, concise statement
- Source and target must match entity names exactly
- Return empty array [] if no relationships found
- Return ONLY valid JSON, no explanations`;

    const userContent = `ENTITIES:\n${entityList}\n\nTEXT:\n${content}`;

    try {
      const facts = await this.chatJSON(systemPrompt, userContent);
      return Array.isArray(facts) ? facts : [];
    } catch (error) {
      logger.error({ err: error }, 'Fact extraction failed');
      return [];
    }
  }
  
  /**
   * Deduplicate entity against existing entities
   * @param {Object} newEntity - New entity to check
   * @param {Array} existingEntities - Existing entities
   * @returns {Object|null} - Matching existing entity or null
   */
  async deduplicateEntity(newEntity, existingEntities) {
    if (!existingEntities || existingEntities.length === 0) {
      return null;
    }
    
    const existingList = existingEntities
      .map(e => `- "${e.name}" (${e.type}): ${e.summary || 'No description'}`)
      .join('\n');
    
    const systemPrompt = `You are a deduplication system. Determine if the new entity matches any existing entity.
Return a JSON object:
{
  "match": true/false,
  "matched_name": "Name of the matched existing entity" or null
}

Rules:
- Match if entities refer to the same real-world thing
- Consider different spellings, abbreviations, nicknames
- Return ONLY valid JSON`;

    const userContent = `NEW ENTITY: "${newEntity.name}" (${newEntity.type}): ${newEntity.summary || 'No description'}

EXISTING ENTITIES:
${existingList}`;

    try {
      const result = await this.chatJSON(systemPrompt, userContent);
      if (result.match && result.matched_name) {
        return existingEntities.find(e => e.name === result.matched_name) || null;
      }
      return null;
    } catch (error) {
      logger.error({ err: error }, 'Deduplication failed');
      return null;
    }
  }
}

export default LLMClient;
