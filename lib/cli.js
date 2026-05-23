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

require('@babel/register')({
  presets: ['@babel/preset-env'],
  ignore: [/node_modules/]
});

const { program } = require('commander');
const path = require('path');
const fs = require('fs');

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
  // Try to find .git directory to get repo name
  let dir = path.dirname(path.resolve(filePath));
  while (dir !== '/') {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return path.basename(dir);
    }
    dir = path.dirname(dir);
  }
  // Fallback to parent directory name
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

// Extract basic file info for memory
function extractFileInfo(filePath, content) {
  const ext = path.extname(filePath);
  const lines = content.split('\n');
  const lineCount = lines.length;
  
  // Extract exports (JS/TS)
  const exports = [];
  const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g;
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  
  // Extract imports (for deps)
  const deps = [];
  const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
  while ((match = importRegex.exec(content)) !== null) {
    if (!match[1].startsWith('.')) {
      deps.push(match[1].split('/')[0]);
    }
  }
  const uniqueDeps = [...new Set(deps)];
  
  // Try to extract purpose from first comment
  let purpose = '';
  const commentMatch = content.match(/^\/\*\*?\s*\n?\s*\*?\s*(.+?)(?:\n|\*\/)/);
  if (commentMatch) {
    purpose = commentMatch[1].trim();
  }
  
  return {
    purpose: purpose || `${ext} file`,
    exports: exports.slice(0, 10),
    deps: uniqueDeps.slice(0, 10),
    lines: lineCount
  };
}

program
  .name('allan-memory')
  .description('CLI for Allan Memory - persistent knowledge graph for coding')
  .version('1.2.0');

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
      
      // Check file exists
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
        console.log(`[observe-read] Project root: ${projectRoot}`);
      }
      
      // Read file content
      const content = fs.readFileSync(filePath, 'utf-8');
      const info = extractFileInfo(filePath, content);
      
      if (options.verbose) {
        console.log(`[observe-read] Lines: ${info.lines}`);
        console.log(`[observe-read] Exports: ${info.exports.join(', ') || 'none'}`);
        console.log(`[observe-read] Deps: ${info.deps.join(', ') || 'none'}`);
      }
      
      // Build memory content
      const memoryContent = [
        info.purpose ? `purpose: ${info.purpose}` : null,
        info.exports.length ? `exports: ${info.exports.join(', ')}` : null,
        info.deps.length ? `deps: ${info.deps.join(', ')}` : null,
        `lines: ${info.lines}`
      ].filter(Boolean).join('\n');
      
      // Store via Locator
      const locator = await getLocator();
      
      if (options.verbose) {
        console.log(`[observe-read] Connecting to FalkorDB...`);
      }
      
      // Ensure project is registered
      const registerProject = locator.get('RegisterProject');
      await registerProject.execute({
        group_id: groupId,
        project_root: projectRoot
      });
      
      // Remember the file
      const remember = locator.get('RememberEntity');
      await remember.execute({
        group_id: groupId,
        type: 'file',
        scope: relativePath,
        content: memoryContent,
        source_file: relativePath,
        sync: false // Async for speed
      });
      
      const duration = Date.now() - startTime;
      if (!options.quiet) {
        if (options.verbose) {
          console.log(`📝 Remembered: ${relativePath} (${groupId}) [${duration}ms]`);
        } else {
          console.log(`📝 Remembered: ${relativePath} (${groupId})`);
        }
      }
      
      process.exit(0);
    } catch (err) {
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
      const info = extractFileInfo(filePath, content);
      
      const memoryContent = [
        info.purpose ? `purpose: ${info.purpose}` : null,
        info.exports.length ? `exports: ${info.exports.join(', ')}` : null,
        info.deps.length ? `deps: ${info.deps.join(', ')}` : null,
        `lines: ${info.lines}`
      ].filter(Boolean).join('\n');
      
      const locator = await getLocator();
      
      const registerProject = locator.get('RegisterProject');
      await registerProject.execute({
        group_id: groupId,
        project_root: projectRoot
      });
      
      // Use remember with sync=true for edits (more important)
      const remember = locator.get('RememberEntity');
      await remember.execute({
        group_id: groupId,
        type: 'file',
        scope: relativePath,
        content: memoryContent,
        source_file: relativePath,
        sync: true
      });
      
      if (!options.quiet) {
        console.log(`✏️  Updated: ${relativePath} (${groupId})`);
      }
      
      process.exit(0);
    } catch (err) {
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
        console.log('✅ Allan Memory: Connected to FalkorDB');
      } else {
        console.log('❌ Allan Memory: Not connected');
        process.exit(1);
      }
      
      process.exit(0);
    } catch (err) {
      console.log(`❌ Allan Memory: ${err.message}`);
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
          const stale = entity.freshness?.stale ? ' ⚠️ STALE' : '';
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
