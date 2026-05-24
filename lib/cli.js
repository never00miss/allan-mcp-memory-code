#!/usr/bin/env node

/**
 * Allan Memory CLI
 *
 * Commands for Claude Code hooks and manual operations.
 * Logs are written to ./logs/ directory.
 *
 * Usage:
 *   allan-memory observe-read --file <path> [--group <id>]
 *   allan-memory observe-edit --file <path> [--group <id>]
 *   allan-memory status
 */

// Set CLI mode BEFORE any imports (routes logs to file)
process.env.ALLAN_CLI_MODE = '1';

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const logger = require('./infrastructure/logger').default;
const { flushLogs } = require('./infrastructure/logger');

// Hash cache for skip-if-unchanged
const HASH_CACHE_PATH = path.join(os.homedir(), '.allan-memory', 'hashes.json');
const HASH_CACHE_LIMIT = parseInt(process.env.HASH_CACHE_LIMIT || '3000', 10);

function loadHashCache() {
  try {
    if (fs.existsSync(HASH_CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(HASH_CACHE_PATH, 'utf-8'));
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to load hash cache, starting fresh');
  }
  return {};
}

function saveHashCache(cache) {
  const dir = path.dirname(HASH_CACHE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(HASH_CACHE_PATH, JSON.stringify(cache), 'utf-8');
}

function computeFileHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

// Returns true if file was already processed (same content hash exists)
function checkHashSkip(filePath, content) {
  const hash = computeFileHash(content);
  const key = filePath;
  const cache = loadHashCache();

  if (cache[key] === hash) {
    return true; // skip
  }

  // Add/update hash, evict oldest if over limit
  cache[key] = hash;
  const entries = Object.keys(cache);
  if (entries.length > HASH_CACHE_LIMIT) {
    // Delete oldest entries (first inserted)
    const toDelete = entries.slice(0, entries.length - HASH_CACHE_LIMIT);
    for (const k of toDelete) {
      delete cache[k];
    }
  }

  saveHashCache(cache);
  return false;
}

// Lazy-load Locator to avoid slow startup for simple commands
let _locator = null;
async function getLocator() {
  if (!_locator) {
    const Locator = require('./infrastructure/config/Locator').default;
    await Locator.init();
    _locator = Locator;
  }
  return _locator;
}

// Detect project group_id from cwd or git
function detectGroupId(filePath) {
  let dir = path.dirname(path.resolve(filePath));
  while (dir !== '/') {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return path.basename(dir);
    }
    dir = path.dirname(dir);
  }
  return path.basename(path.dirname(path.resolve(filePath)));
}

// Detect project root from .git
function detectProjectRoot(filePath) {
  let dir = path.dirname(path.resolve(filePath));
  while (dir !== '/') {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return path.dirname(path.resolve(filePath));
}

// Quick regex-based file info (fallback when LLM unavailable)
function extractFileInfoQuick(filePath, content) {
  const lineCount = content.split('\n').length;

  const exports = [];
  const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g;
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  const deps = [];
  const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
  while ((match = importRegex.exec(content)) !== null) {
    if (!match[1].startsWith('.')) {
      deps.push(match[1].split('/')[0]);
    }
  }

  return {
    exports: [...new Set(exports.slice(0, 10))],
    deps: [...new Set(deps.slice(0, 10))],
    lines: lineCount
  };
}

// Build a rich summary using LLM extraction
async function extractFileInfoWithLLM(llmClient, filePath, relativePath, content, modelOverride) {
  const model = modelOverride || process.env.LLM_MODEL || 'default';
  logger.info({ file: relativePath, model, input_lines: content.split('\n').length }, '[LLM INPUT]');

  try {
    const result = await llmClient.extractFileEntities(content, relativePath, modelOverride);

    logger.info({ file: relativePath, model, output: JSON.stringify(result) }, '[LLM OUTPUT]');

    if (!result || !result.file) {
      logger.warn({ file: relativePath }, '[LLM OUTPUT] No file entity returned');
      return null;
    }

    const f = result.file;
    const parts = [];
    if (f.purpose && f.purpose !== `${path.extname(filePath)} file`) {
      parts.push(`purpose: ${f.purpose}`);
    }
    if (f.exports?.length) {
      parts.push(`exports: ${f.exports.join(', ')}`);
    }
    if (f.dependencies?.length) {
      parts.push(`deps: ${f.dependencies.join(', ')}`);
    }
    parts.push(`lines: ${content.split('\n').length}`);

    // Include function summaries if present
    if (result.functions?.length) {
      const funcLines = result.functions
        .slice(0, 8)
        .map(fn => `  - ${fn.signature || fn.name}: ${fn.description || ''}`)
        .join('\n');
      parts.push(`functions:\n${funcLines}`);
    }

    return parts.join('\n');
  } catch (err) {
    logger.error({ err, file: relativePath, model }, '[LLM ERROR] Extraction failed');
    return null;
  }
}

// Build content from LLM or fallback to regex
async function buildFileMemory(llmClient, filePath, relativePath, content) {
  const useLLM = process.env.OBSERVE_LLM !== 'false';
  const observeModel = process.env.OBSERVE_LLM_MODEL || null; // null = use default LLM_MODEL

  if (useLLM) {
    const llmContent = await extractFileInfoWithLLM(llmClient, filePath, relativePath, content, observeModel);
    if (llmContent) return llmContent;
  }

  // Fallback to regex
  const info = extractFileInfoQuick(filePath, content);
  return [
    info.exports.length ? `exports: ${info.exports.join(', ')}` : null,
    info.deps.length ? `deps: ${info.deps.join(', ')}` : null,
    `lines: ${info.lines}`
  ].filter(Boolean).join('\n');
}

program
  .name('allan-memory')
  .description('CLI for Allan Memory - persistent knowledge graph for coding')
  .version('1.3.0');

program
  .command('observe-read')
  .description('Record a file read (for Claude Code hooks)')
  .requiredOption('-f, --file <path>', 'File path that was read')
  .option('-g, --group <id>', 'Project group ID (auto-detected if not provided)')
  .option('-q, --quiet', 'Suppress output')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    const startTime = Date.now();
    try {
      const filePath = path.resolve(options.file);

      if (!fs.existsSync(filePath)) {
        if (!options.quiet) console.error(`File not found: ${filePath}`);
        process.exit(1);
      }

      const groupId = options.group || detectGroupId(filePath);
      const projectRoot = detectProjectRoot(filePath);
      const relativePath = path.relative(projectRoot, filePath);

      if (options.verbose) {
        console.log(`[observe-read] File: ${filePath}`);
        console.log(`[observe-read] Group: ${groupId}`);
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      // Skip if file content unchanged since last observe
      if (checkHashSkip(filePath, content)) {
        logger.info({ command: 'observe-read', file: relativePath }, 'Skipped (unchanged)');
        if (options.verbose) console.log(`[observe-read] Skipped: ${relativePath} (unchanged)`);
        await flushLogs();
        process.exit(0);
      }

      const locator = await getLocator();

      // Ensure project is registered
      const registerProject = locator.get('RegisterProject');
      await registerProject.execute({
        group_id: groupId,
        project_root: projectRoot
      });

      // Use LLM for rich extraction (with regex fallback)
      const llmClient = locator.get('LLMClient');
      const memoryContent = await buildFileMemory(llmClient, filePath, relativePath, content);

      if (options.verbose) {
        console.log(`[observe-read] Output:\n${memoryContent}`);
      }

      // Remember the file
      const remember = locator.get('RememberEntity');
      await remember.execute({
        group_id: groupId,
        type: 'file',
        scope: relativePath,
        content: memoryContent,
        source_file: relativePath,
        sync: false
      });

      const duration = Date.now() - startTime;
      logger.info({ command: 'observe-read', file: relativePath, groupId, duration }, `CLI observe-read: ${relativePath}`);

      if (!options.quiet) {
        if (options.verbose) {
          console.log(`Remembered: ${relativePath} (${groupId}) [${duration}ms]`);
        } else {
          console.log(`Remembered: ${relativePath} (${groupId})`);
        }
      }

      await flushLogs();
      process.exit(0);
    } catch (err) {
      logger.error({ command: 'observe-read', error: err.message }, `CLI observe-read error`);
      await flushLogs();
      if (!options.quiet) console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('observe-edit')
  .description('Record a file edit (for Claude Code hooks)')
  .requiredOption('-f, --file <path>', 'File path that was edited')
  .option('-g, --group <id>', 'Project group ID (auto-detected if not provided)')
  .option('-q, --quiet', 'Suppress output')
  .action(async (options) => {
    const startTime = Date.now();
    try {
      const filePath = path.resolve(options.file);

      if (!fs.existsSync(filePath)) {
        if (!options.quiet) console.error(`File not found: ${filePath}`);
        process.exit(1);
      }

      const groupId = options.group || detectGroupId(filePath);
      const projectRoot = detectProjectRoot(filePath);
      const relativePath = path.relative(projectRoot, filePath);

      const content = fs.readFileSync(filePath, 'utf-8');

      // Track hash so next observe-read skips if unchanged (edits always process)
      checkHashSkip(filePath, content);

      const locator = await getLocator();

      const registerProject = locator.get('RegisterProject');
      await registerProject.execute({
        group_id: groupId,
        project_root: projectRoot
      });

      // Use LLM for rich extraction (with regex fallback)
      const llmClient = locator.get('LLMClient');
      const memoryContent = await buildFileMemory(llmClient, filePath, relativePath, content);

      // Use sync=true for edits (more important — extracts relationships immediately)
      const remember = locator.get('RememberEntity');
      await remember.execute({
        group_id: groupId,
        type: 'file',
        scope: relativePath,
        content: memoryContent,
        source_file: relativePath,
        sync: true
      });

      const duration = Date.now() - startTime;
      logger.info({ command: 'observe-edit', file: relativePath, groupId, duration, output: memoryContent }, `CLI observe-edit: ${relativePath}`);

      if (!options.quiet) {
        console.log(`Updated: ${relativePath} (${groupId}) [${duration}ms]`);
        console.log(`--- Output ---`);
        console.log(memoryContent);
        console.log(`---`);
      }

      await flushLogs();
      process.exit(0);
    } catch (err) {
      logger.error({ command: 'observe-edit', error: err.message }, `CLI observe-edit error`);
      await flushLogs();
      if (!options.quiet) console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check Allan Memory service status')
  .action(async () => {
    try {
      const locator = await getLocator();
      const connection = locator.get('FalkorDBConnection');
      const isConnected = await connection.isConnected();

      if (isConnected) {
        console.log('Allan Memory: Connected to FalkorDB');
      } else {
        console.log('Allan Memory: Not connected');
        process.exit(1);
      }

      process.exit(0);
    } catch (err) {
      console.log(`Allan Memory: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('recall')
  .description('Search memories')
  .argument('<query>', 'Search query')
  .option('-g, --group <id>', 'Project group ID')
  .option('-l, --limit <n>', 'Result limit', '5')
  .action(async (query, options) => {
    try {
      const locator = await getLocator();
      const recall = locator.get('RecallEntities');

      const result = await recall.execute({
        query,
        group_id: options.group,
        limit: parseInt(options.limit)
      });

      if (result.length === 0) {
        console.log('No results found.');
      } else {
        result.forEach((entity, i) => {
          const stale = entity.freshness?.stale ? ' [STALE]' : '';
          console.log(`\n${i + 1}. [${entity.type}] ${entity.scope}${stale}`);
          console.log(`   ${entity.summary?.substring(0, 100)}...`);
        });
      }

      process.exit(0);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
