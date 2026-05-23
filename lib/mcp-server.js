#!/usr/bin/env node
/**
 * Allan Memory MCP Server v2
 * Model Context Protocol server for Claude Code integration
 * 
 * Tools: register_project, remember, recall, relate, list, refresh
 * Key feature: Inline freshness on recall results
 */
const path = require('path');
const rootDir = path.resolve(__dirname, '..');

// Set log directory for MCP server
process.env.ALLAN_LOG_DIR = rootDir;

require('dotenv').config({ path: path.join(rootDir, '.env') });


const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Import locator and logger after babel register
const Locator = require('./infrastructure/config/Locator').default;
const logger = require('./infrastructure/logger').default;

const server = new Server(
  {
    name: 'allan-memory',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'register_project',
        description: `Register a project for path resolution and freshness checking.
Call once per project before using refresh or freshness features.
Idempotent - call again to update project_root.

Example: register_project({ group_id: "my-app", project_root: "/Users/me/my-app" })`,
        inputSchema: {
          type: 'object',
          properties: {
            group_id: {
              type: 'string',
              description: 'Project identifier (kebab-case)',
            },
            project_root: {
              type: 'string',
              description: 'Absolute path to project root',
            },
            ignore_patterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional gitignore-style patterns',
            },
          },
          required: ['group_id', 'project_root'],
        },
      },
      {
        name: 'remember',
        description: `Store a memory with structured fields. Use liberally - default is to WRITE.

Required fields:
- type: file | func | api | arch | pattern | task | debug | note | index
- scope: identifier (e.g., "src/auth.js" or "UserService.login")
- content: the memory (max 5 lines, compressed)
- group_id: project name (kebab-case)

Optional:
- source_file: relative path for freshness tracking
- source_lines: [start, end] line numbers

Example:
  remember({
    group_id: "my-app",
    type: "func",
    scope: "AuthService.login",
    content: "func: login(email, pass) → User | validates creds, returns JWT",
    source_file: "src/services/auth.js",
    source_lines: [45, 89]
  })

WHEN TO REMEMBER:
- After reading a file → type: file
- After understanding a function → type: func
- After designing/planning → type: arch or note
- After debugging → type: debug (include root cause + fix)
- After completing a task → type: task (include gotchas)`,
        inputSchema: {
          type: 'object',
          properties: {
            group_id: {
              type: 'string',
              description: 'Project name (kebab-case)',
            },
            type: {
              type: 'string',
              enum: ['file', 'func', 'api', 'arch', 'pattern', 'task', 'debug', 'note', 'index'],
              description: 'Entity type',
            },
            scope: {
              type: 'string',
              description: 'Identifier: "src/auth.js" or "UserService.login"',
            },
            content: {
              type: 'string',
              description: 'The memory content (max 5 lines)',
            },
            source_file: {
              type: 'string',
              description: 'Optional: relative path for freshness',
            },
            source_lines: {
              type: 'array',
              items: { type: 'number' },
              description: 'Optional: [start, end] line numbers',
            },
          },
          required: ['group_id', 'type', 'scope', 'content'],
        },
      },
      {
        name: 'recall',
        description: `Search the knowledge graph. Returns entities with INLINE FRESHNESS.

Check freshness.stale on each result:
- false: Memory is fresh, trust it
- true: Source file was modified since memory was stored
  → Consider calling refresh before trusting content

ALWAYS call this BEFORE grep_search, file_search, or read_file.
Pre-stored knowledge beats re-exploration.

Params:
- query: natural language or "type:scope" pattern
- group_id: project name (kebab-case)
- type: optional filter (file, func, api, etc.)
- freshness_filter: "any" (default) | "fresh_only" | "stale_only"
- limit: default 15

Example:
  recall({ query: "auth login", group_id: "my-app" })
  → [{ type: "func", scope: "AuthService.login", freshness: { stale: false, age_hours: 2.5 }, ... }]`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            group_id: {
              type: 'string',
              description: 'Project name (kebab-case)',
            },
            type: {
              type: 'string',
              enum: ['file', 'func', 'api', 'arch', 'pattern', 'task', 'debug', 'note', 'index'],
              description: 'Optional type filter',
            },
            freshness_filter: {
              type: 'string',
              enum: ['any', 'fresh_only', 'stale_only'],
              description: 'Filter by freshness (default: any)',
            },
            limit: {
              type: 'number',
              description: 'Max results (default: 15)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'relate',
        description: `Search relationships between entities.

Use after recall for context:
- "What calls AuthService.login?"
- "What depends on database?"
- "What does UserController use?"`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query for relationships',
            },
            group_id: {
              type: 'string',
              description: 'Project name (kebab-case)',
            },
            limit: {
              type: 'number',
              description: 'Max results (default: 15)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list',
        description: `Enumerate stored entities by type. Cheap, deterministic query.

Use instead of memorizing what's been stored:
- "What files do I have for my-app?" → list({ group_id: "my-app", type: "file" })
- "What's been indexed?" → list({ group_id: "my-app" })`,
        inputSchema: {
          type: 'object',
          properties: {
            group_id: {
              type: 'string',
              description: 'Project name (kebab-case)',
            },
            type: {
              type: 'string',
              enum: ['file', 'func', 'api', 'arch', 'pattern', 'task', 'debug', 'note', 'index'],
              description: 'Optional type filter',
            },
            limit: {
              type: 'number',
              description: 'Max results (default: 50)',
            },
            include_freshness: {
              type: 'boolean',
              description: 'Include freshness info (slower)',
            },
          },
          required: ['group_id'],
        },
      },
      {
        name: 'refresh',
        description: `Re-extract entities from a source file. Use when recall returns stale=true.

Reads the file, extracts entities via LLM, and syncs with graph:
- Creates new entities for new functions
- Updates existing entities if changed
- Marks removed entities as superseded

Requires: Call register_project first, or provide project_root.`,
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Relative path to the file',
            },
            group_id: {
              type: 'string',
              description: 'Project name (kebab-case)',
            },
            project_root: {
              type: 'string',
              description: 'Optional: override registered project_root',
            },
          },
          required: ['file_path', 'group_id'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const startTime = Date.now();
  
  logger.info({ tool: name, args: JSON.stringify(args).substring(0, 200) }, `MCP tool called: ${name}`);

  try {
    let result;
    
    switch (name) {
      case 'register_project': {
        const registerProject = Locator.get('RegisterProject');
        result = await registerProject.execute({
          group_id: args.group_id,
          project_root: args.project_root,
          ignore_patterns: args.ignore_patterns || [],
        });
        break;
      }

      case 'remember': {
        const rememberEntity = Locator.get('RememberEntity');
        result = await rememberEntity.execute({
          group_id: args.group_id,
          type: args.type,
          scope: args.scope,
          content: args.content,
          source_file: args.source_file,
          source_lines: args.source_lines,
        });
        break;
      }

      case 'recall': {
        const recallEntities = Locator.get('RecallEntities');
        result = await recallEntities.execute({
          query: args.query,
          group_id: args.group_id,
          type: args.type,
          freshness_filter: args.freshness_filter || 'any',
          limit: args.limit || 15,
        });
        break;
      }

      case 'relate': {
        const relateEntities = Locator.get('RelateEntities');
        result = await relateEntities.execute({
          query: args.query,
          group_id: args.group_id,
          limit: args.limit || 15,
        });
        break;
      }

      case 'list': {
        const listByType = Locator.get('ListByType');
        result = await listByType.execute({
          group_id: args.group_id,
          type: args.type,
          limit: args.limit || 50,
          include_freshness: args.include_freshness || false,
        });
        break;
      }

      case 'refresh': {
        const refreshFromFile = Locator.get('RefreshFromFile');
        result = await refreshFromFile.execute({
          file_path: args.file_path,
          group_id: args.group_id,
          project_root: args.project_root,
        });
        break;
      }

      // Legacy tools (backward compat)
      case 'add_memory': {
        const addMemory = Locator.get('AddMemory');
        result = await addMemory.execute({
          name: args.name,
          episode_body: args.content,
          group_id: args.group_id || 'default',
        });
        break;
      }

      case 'search_nodes': {
        const searchNodes = Locator.get('SearchNodes');
        result = await searchNodes.execute({
          query: args.query,
          group_ids: args.group_id ? [args.group_id] : [],
          limit: args.limit || 15,
        });
        break;
      }

      case 'search_facts': {
        const searchFacts = Locator.get('SearchFacts');
        result = await searchFacts.execute({
          query: args.query,
          group_ids: args.group_id ? [args.group_id] : [],
          limit: args.limit || 15,
        });
        break;
      }

      case 'regenerate_file': {
        const regenerateFile = Locator.get('RegenerateFile');
        result = await regenerateFile.execute({
          file_path: args.file_path,
          project_root: args.project_root,
          group_id: args.group_id,
        });
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    const duration = Date.now() - startTime;
    const resultCount = Array.isArray(result) ? result.length : 1;
    logger.info({ tool: name, duration, resultCount }, `MCP tool completed: ${name} (${duration}ms)`);
    
    return {
      content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error({ tool: name, error: error.message, duration }, `MCP tool error: ${name}`);
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  try {
    // Initialize dependencies
    await Locator.init();
    
    logger.info('Allan Memory MCP server v2 starting...');
    
    // Start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info('Allan Memory MCP server v2 connected via stdio');
    console.error('Allan Memory MCP server v2 started');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to start MCP server');
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
