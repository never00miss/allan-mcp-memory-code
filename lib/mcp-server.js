#!/usr/bin/env node
/**
 * Allan Memory MCP Server
 * Model Context Protocol server for Claude Code integration
 */
const path = require('path');
const rootDir = path.resolve(__dirname, '..');

require('dotenv').config({ path: path.join(rootDir, '.env') });
require('@babel/register')({
  root: rootDir,
  only: [rootDir]
});

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Import locator after babel register
const Locator = require('./infrastructure/config/Locator').default;

const server = new Server(
  {
    name: 'allan-memory',
    version: '1.0.0',
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
        name: 'add_memory',
        description: `Store knowledge in the knowledge graph. USE LIBERALLY - default is to WRITE.

NAMING CONVENTION (for efficient retrieval):
  [type]:[project]:[scope]
  
  Types: file | func | arch | api | pattern | index | task | debug
  
  Examples:
  - "index:vyber-html" → Project overview (CREATE THIS FIRST!)
  - "file:vyber-html:src/auth.js" → File summary
  - "func:vyber-html:UserService.login" → Function signature
  - "api:vyber-html:POST /auth/login" → API endpoint
  - "arch:vyber-html:overview" → Architecture summary
  - "pattern:vyber-html:error-handling" → Code pattern
  - "task:vyber-html:fix-login-bug" → Task summary
  - "debug:vyber-html:auth-500-error" → Debug session

CONTENT TEMPLATES (token-efficient):

  For INDEX (create first per project):
    files: file1.js, file2.js, dir/file3.js
    components: Component1, Component2
    routes: /, /api, /auth
    patterns: Pattern1, Pattern2
    key-funcs: func1(), func2()

  For FILE:
    path: src/services/auth.js
    purpose: Authentication service
    exports: login(), logout(), validateToken()
    deps: jwt-lib, redis-client
    lines: 245

  For FUNCTION:
    func: authenticate(email: str, password: str) → User|null
    does: Validates credentials against DB
    calls: hashPassword(), findUser()
    called-by: LoginController.handle()

  For API:
    POST /api/auth/login
    req: { email: str, password: str }
    res: { token: str, user: User }
    auth: none

  For ARCHITECTURE:
    components: API → Service → Repo → DB
    flow: Request → Middleware → Controller → Service
    patterns: Clean Architecture, Repository

SAVE AFTER EVERY ACTION:
- bash/shell → command + output + revealed
- grep/search → pattern + matches + files
- ls/tree → path + structure
- read file → path + purpose + exports
- read function → name + params + return + does
- edit/create → path + what changed + why
- debug → symptom + root cause + fix
- plan → the plan summarized
- task done → what + how + gotchas

COMPRESSION: Max 5 lines. Subject+verb+object. Drop filler. Include identifiers.
CADENCE: explore → save → explore → save → plan → save → execute → save
If unsure → SAVE.`,
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Use format [type]:[project]:[scope]. Types: index, file, func, api, arch, pattern, task, debug',
            },
            content: {
              type: 'string',
              description: 'Use templates above. Max 5 lines, compressed. Include paths, names, identifiers.',
            },
            group_id: {
              type: 'string',
              description: 'REQUIRED: Project name in kebab-case. Must match [project] in name field.',
            },
          },
          required: ['name', 'content', 'group_id'],
        },
      },
      {
        name: 'search_nodes',
        description: `⚠️ MANDATORY: Call this BEFORE any grep_search, file_search, read_file, or semantic_search!

Search knowledge graph for stored project knowledge. Saves tokens by avoiding file re-reads.

SEARCH PATTERNS:
1. "index:[project]" → Project overview (ALWAYS FIRST!)
2. "file:[project]:path" → File summaries
3. "func:[project]:Class.method" → Function docs
4. "api:[project]:METHOD /path" → API endpoints
5. "[project] keyword" → General search

WORKFLOW:
1. User asks about project → search "index:[project]" FIRST
2. Found? → Use results, DON'T re-read files
3. Empty? → Then use grep/read → SAVE results with add_memory

⚠️ SKIP THIS = WASTE TOKENS. Always search memory before exploring files.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query. Use "index:[project]" first, then "[type]:[project]:[scope]" for specifics',
            },
            group_id: {
              type: 'string',
              description: 'Project name (kebab-case) to filter',
            },
            limit: {
              type: 'number',
              description: 'Max results (default: 10)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_facts',
        description: `Search relationships between entities. Use after search_nodes for context:
- "What uses auth service?"
- "What depends on database?"
- "What calls this function?"`,
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
              description: 'Max results (default: 10)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_episodes',
        description: 'List recent memory episodes for a project.',
        inputSchema: {
          type: 'object',
          properties: {
            group_id: {
              type: 'string',
              description: 'Project name (kebab-case)',
            },
            limit: {
              type: 'number',
              description: 'Max results (default: 10)',
            },
          },
        },
      },
      {
        name: 'delete_episode',
        description: 'Delete memory episode by UUID.',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: {
              type: 'string',
              description: 'UUID to delete',
            },
          },
          required: ['uuid'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'add_memory': {
        const addMemory = Locator.get('AddMemory');
        const result = await addMemory.execute({
          name: args.name,
          episode_body: args.content,
          group_id: args.group_id || 'default',
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'search_nodes': {
        const searchNodes = Locator.get('SearchNodes');
        const results = await searchNodes.execute({
          query: args.query,
          group_ids: args.group_id ? [args.group_id] : [],
          limit: args.limit || 20,
        });
        return {
          content: [
            {
              type: 'text',
              text: results,
            },
          ],
        };
      }

      case 'search_facts': {
        const searchFacts = Locator.get('SearchFacts');
        const results = await searchFacts.execute({
          query: args.query,
          group_ids: args.group_id ? [args.group_id] : [],
          limit: args.limit || 20,
        });
        return {
          content: [
            {
              type: 'text',
              text: results,
            },
          ],
        };
      }

      case 'get_episodes': {
        const getEpisodes = Locator.get('GetEpisodes');
        const results = await getEpisodes.execute({
          group_id: args.group_id,
          limit: args.limit || 10,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'delete_episode': {
        const deleteEpisode = Locator.get('DeleteEpisode');
        const result = await deleteEpisode.execute({
          uuid: args.uuid,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  try {
    // Initialize dependencies
    await Locator.init();
    
    // Start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('Allan Memory MCP server started');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
