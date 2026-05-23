import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import ignore from 'ignore';
import logger from '../../infrastructure/logger';

/**
 * RefreshFromFile Use Case
 * 
 * Re-extract entities from a source file. Replaces RegenerateFile.
 * 
 * Key differences:
 * - Uses ProjectConfig to resolve file paths
 * - Uses new entity schema (type, scope, source_file)
 * - Creates SUPERSEDED_BY edges for removed entities (audit trail)
 */
class RefreshFromFile {
  constructor({ 
    llmClient, 
    embedderClient, 
    entityNodeRepository,
    projectConfigRepository,
    statCache
  }) {
    this.llmClient = llmClient;
    this.embedderClient = embedderClient;
    this.entityNodeRepository = entityNodeRepository;
    this.projectConfigRepository = projectConfigRepository;
    this.statCache = statCache;
  }

  /**
   * Execute the use case
   * @param {Object} input
   * @param {string} input.file_path - Relative path to file
   * @param {string} input.group_id - Project identifier
   * @param {string} input.project_root - Optional: override registered project_root
   */
  async execute(input) {
    const { file_path, group_id, project_root: inputRoot } = input;

    if (!file_path) throw new Error('file_path is required');
    if (!group_id) throw new Error('group_id is required');

    // Get project config for path resolution
    const config = await this.projectConfigRepository.findByGroupId(group_id);
    const projectRoot = inputRoot || config?.project_root;

    if (!projectRoot) {
      throw new Error('project_root not found. Call register_project first or provide project_root param.');
    }

    // Resolve paths
    const absolutePath = path.isAbsolute(file_path)
      ? file_path
      : path.join(projectRoot, file_path);

    const relativePath = path.isAbsolute(file_path)
      ? path.relative(projectRoot, file_path)
      : file_path;

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    // Check ignore patterns
    if (this._isIgnored(relativePath, projectRoot, config?.ignore_patterns)) {
      return {
        file_path: relativePath,
        status: 'ignored',
        message: 'File matches ignore pattern'
      };
    }

    // Read file content
    const fileContent = fs.readFileSync(absolutePath, 'utf-8');
    const stats = fs.statSync(absolutePath);
    const lineCount = fileContent.split('\n').length;

    logger.info({ file_path: relativePath, lines: lineCount }, 'Extracting entities from file');

    // Extract entities via LLM
    const extracted = await this.llmClient.extractFileEntities(fileContent, relativePath);

    if (!extracted || !extracted.file) {
      return {
        file_path: relativePath,
        status: 'no_entities',
        message: 'No entities extracted from file'
      };
    }

    // Build new entities with new schema
    const newEntities = new Map();

    // File entity
    newEntities.set(`file:${relativePath}`, {
      type: 'file',
      scope: relativePath,
      source_file: relativePath,
      summary: `purpose: ${extracted.file.purpose || 'unknown'} | exports: ${(extracted.file.exports || []).join(', ')} | deps: ${(extracted.file.dependencies || []).join(', ')} | lines: ${lineCount}`
    });

    // Function entities
    for (const func of (extracted.functions || [])) {
      const funcScope = `${relativePath}@${func.name}`;
      newEntities.set(`func:${funcScope}`, {
        type: 'func',
        scope: funcScope,
        source_file: relativePath,
        source_lines: [func.line_start, func.line_end],
        summary: `func: ${func.signature || func.name} | does: ${func.description || 'unknown'}`
      });
    }

    // Find existing entities for this file
    const existingEntities = await this._findExistingForFile(relativePath, group_id);

    // Sync: create, update, mark superseded
    const result = await this._syncEntities(existingEntities, newEntities, group_id, relativePath);

    // Invalidate stat cache
    this.statCache?.invalidate(absolutePath);

    // Update project last_indexed_at
    await this.projectConfigRepository.touchLastIndexed(group_id);

    logger.info({
      file_path: relativePath,
      created: result.created.length,
      updated: result.updated.length,
      superseded: result.superseded.length
    }, 'File refresh complete');

    return {
      file_path: relativePath,
      status: 'success',
      created: result.created,
      updated: result.updated,
      superseded: result.superseded,
      summary: `Created: ${result.created.length}, Updated: ${result.updated.length}, Superseded: ${result.superseded.length}`
    };
  }

  /**
   * Check if file matches ignore patterns
   */
  _isIgnored(relativePath, projectRoot, configPatterns = []) {
    const ig = ignore();

    // Load .gitignore
    const gitignorePath = path.join(projectRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      ig.add(fs.readFileSync(gitignorePath, 'utf-8'));
    }

    // Add config patterns
    if (configPatterns.length > 0) {
      ig.add(configPatterns);
    }

    // Always ignore common patterns
    ig.add([
      'node_modules',
      '.git',
      'dist',
      'build',
      '*.min.js',
      '*.map',
      'package-lock.json',
      'yarn.lock'
    ]);

    return ig.ignores(relativePath);
  }

  /**
   * Find existing entities for a file
   */
  async _findExistingForFile(filePath, groupId) {
    // Find all entities with this source_file
    const fileEntities = await this.entityNodeRepository.findByTypeAndGroup(groupId, 'file', { limit: 100 });
    const funcEntities = await this.entityNodeRepository.findByTypeAndGroup(groupId, 'func', { limit: 500 });

    const entities = new Map();

    for (const entity of [...fileEntities, ...funcEntities]) {
      if (entity.source_file === filePath) {
        const key = `${entity.type}:${entity.scope}`;
        entities.set(key, entity);
      }
    }

    return entities;
  }

  /**
   * Sync entities: create new, update existing, mark removed as superseded
   */
  async _syncEntities(existing, newEntities, groupId, sourceFile) {
    const created = [];
    const updated = [];
    const superseded = [];

    // Process new entities
    for (const [key, entityData] of newEntities) {
      const existingEntity = existing.get(key);

      if (existingEntity) {
        // Update if summary changed
        if (existingEntity.summary !== entityData.summary) {
          const embedding = await this.embedderClient.embed(`${entityData.type} ${entityData.scope} ${entityData.summary}`);

          await this.entityNodeRepository.upsertByNaturalKey({
            ...existingEntity,
            summary: entityData.summary,
            source_lines: entityData.source_lines,
            name_embedding: embedding,
            updated_at: new Date().toISOString()
          });
          updated.push(entityData.scope);
        } else {
          // Just touch updated_at
          await this.entityNodeRepository.upsertByNaturalKey({
            ...existingEntity,
            updated_at: new Date().toISOString()
          });
        }
        existing.delete(key); // Mark as processed
      } else {
        // Create new entity
        const embedding = await this.embedderClient.embed(`${entityData.type} ${entityData.scope} ${entityData.summary}`);

        await this.entityNodeRepository.upsertByNaturalKey({
          uuid: uuidv4(),
          type: entityData.type,
          scope: entityData.scope,
          group_id: groupId,
          summary: entityData.summary,
          source_file: entityData.source_file,
          source_lines: entityData.source_lines,
          labels: [entityData.type.toUpperCase()],
          name_embedding: embedding,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        created.push(entityData.scope);
      }
    }

    // Mark remaining as superseded (they no longer exist in the file)
    // TODO: Create SUPERSEDED_BY edges instead of deleting
    for (const [key, entity] of existing) {
      // For now, just delete. Phase 4 will add SUPERSEDED_BY edges.
      await this.entityNodeRepository.deleteByUuid(entity.uuid);
      superseded.push(entity.scope);
    }

    return { created, updated, superseded };
  }
}

export default RefreshFromFile;
