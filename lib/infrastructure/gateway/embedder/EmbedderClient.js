import OpenAI from 'openai';
import logger from '../../logger';

/**
 * Embedder Client - OpenAI-compatible embeddings
 * Works with Ollama, OpenAI, etc.
 */
class EmbedderClient {
  constructor() {
    this.client = null;
    this.model = process.env.EMBEDDER_MODEL || 'nomic-embed-text';
    this.dimensions = parseInt(process.env.EMBEDDER_DIMENSIONS || '768');
  }
  
  /**
   * Initialize the Embedder client
   */
  async init() {
    const baseURL = process.env.EMBEDDER_API_URL || 'http://localhost:11434/v1';
    const apiKey = process.env.EMBEDDER_API_KEY || 'ollama';
    
    this.client = new OpenAI({
      baseURL,
      apiKey
    });
    
    logger.info({ baseURL, model: this.model, dimensions: this.dimensions }, 'Embedder Client initialized');
    return this;
  }
  
  /**
   * Generate embedding for a single text
   * @param {string} text - Text to embed
   * @returns {Array<number>} - Embedding vector
   */
  async embed(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text is required for embedding');
    }
    
    // Truncate text if too long (most models have token limits)
    const truncatedText = text.substring(0, 8000);
    
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: truncatedText
      });
      
      return response.data[0]?.embedding || [];
    } catch (error) {
      logger.error({ err: error }, 'Embedding failed');
      // Return zero vector as fallback
      return new Array(this.dimensions).fill(0);
    }
  }
  
  /**
   * Generate embeddings for multiple texts
   * @param {Array<string>} texts - Array of texts to embed
   * @returns {Array<Array<number>>} - Array of embedding vectors
   */
  async embedBatch(texts) {
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return [];
    }
    
    // Process in batches to avoid rate limits
    const batchSize = 10;
    const results = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const truncatedBatch = batch.map(t => (t || '').substring(0, 8000));
      
      try {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: truncatedBatch
        });
        
        const embeddings = response.data.map(d => d.embedding || new Array(this.dimensions).fill(0));
        results.push(...embeddings);
      } catch (error) {
        logger.error({ err: error }, 'Batch embedding failed');
        // Return zero vectors as fallback
        results.push(...batch.map(() => new Array(this.dimensions).fill(0)));
      }
    }
    
    return results;
  }
  
  /**
   * Calculate cosine similarity between two vectors
   * @param {Array<number>} a - First vector
   * @param {Array<number>} b - Second vector
   * @returns {number} - Similarity score (0 to 1)
   */
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  /**
   * Get embedding dimensions
   * @returns {number} - Embedding dimensions
   */
  getDimensions() {
    return this.dimensions;
  }
}

export default EmbedderClient;
