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
      
      const message = response.choices[0]?.message;
      // Handle both regular models (content) and reasoning models (reasoning)
      return message?.content || message?.reasoning || '';
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
    const systemPrompt = `You are an entity extraction system for code projects. Extract all named entities from the given text.
Return a JSON array of entities with the following structure:
[
  {
    "name": "Entity Name",
    "type": "FILE|FUNCTION|API|OTHER",
    "summary": "Brief description of the entity based on context"
  }
]

Rules:
- FILE: source files (.js, .ts, .jsx, .py, .css, .html, .go, .php, etc.)
- FUNCTION: functions, methods, classes
- API: endpoints, routes (/api/*, POST /auth)
- OTHER: anything else
- Use consistent naming
- Provide a brief summary based on the context
- Do NOT use vague names like "purpose", "the FILE", or generic placeholders
- Do NOT include words like "likely" in summaries - be definitive based on context
- Each summary must be specific and actionable (not generic like "a function that does something")
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
- Source must NOT equal target (no self-referencing relationships)
- The fact must be specific and informative, NOT generic like "depends on" or "is exported from"
- Include the actual relationship: "AuthService uses JWT for token validation" not "AuthService depends on jsonwebtoken"
- Source and target must match entity names exactly
- Skip trivial or obvious relationships
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
  
  /**
   * Extract entities from a source file
   * @param {string} fileContent - File content
   * @param {string} filePath - Relative file path
   * @param {string} modelOverride - Optional model to use instead of default
   * @returns {Object} - Extracted file and function entities
   */
  async extractFileEntities(fileContent, filePath, modelOverride) {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    
    const systemPrompt = `You are a code analyzer. Extract structured information from this source file.
Return a JSON object with this structure:
{
  "file": {
    "path": "${filePath}",
    "purpose": "Brief description of what this file does",
    "exports": ["exported1", "exported2"],
    "dependencies": ["dep1", "dep2"]
  },
  "functions": [
    {
      "name": "functionName",
      "line_start": 10,
      "line_end": 45,
      "signature": "functionName(param1: type, param2: type) → ReturnType",
      "description": "Brief description of what this function does"
    }
  ]
}

Rules:
- Extract ALL functions/methods/classes in the file
- Include accurate line numbers (line_start is first line, line_end is last line)
- signature should show parameters with types if available
- For exports: list all exported names (export default counts as "default")
- For dependencies: list imported packages/modules
- Keep descriptions concise (1 sentence max)
- Return ONLY valid JSON, no explanations
- If file is too short or trivial, return minimal info`;

    try {
      const result = await this.chatJSON(systemPrompt, fileContent, { model: modelOverride || this.model });
      return result;
    } catch (error) {
      logger.error({ err: error, filePath }, 'File entity extraction failed');
      return null;
    }
  }
}

export default LLMClient;
