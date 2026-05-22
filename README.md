# Allan Memory

Knowledge Graph Service with FalkorDB - Graphiti-style memory system for LLM agents.

## Features

- Store episodes (text/json/message) and automatically extract entities + relationships
- Hybrid search (text + vector) for nodes and facts
- OpenAI-compatible LLM and embedding endpoints (works with z.ai, Ollama, OpenAI)
- Clean Architecture (DDD)
- **All-in-one Docker setup** (FalkorDB + Ollama + Service)
- **Claude Code integration** via CLAUDE.md instructions

## Quick Start (Docker)

```bash
# Edit docker-compose.yml to set your LLM_API_KEY
# Then start everything:
docker compose up -d

# First run will pull nomic-embed-text model (~270MB)
# Wait for all services to be healthy
docker compose ps

# Health check
curl http://localhost:19089/v1/health
```

### Environment Variables (in docker-compose.yml)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 19089 | Service port |
| `LLM_API_URL` | https://openrouter.ai/api/v1 | LLM endpoint |
| `LLM_API_KEY` | - | OpenRouter/OpenAI API key |
| `LLM_MODEL` | qwen/qwen3-30b-a3b | Model for entity extraction |
| `EMBEDDER_API_URL` | http://ollama:11434/v1 | Embedding endpoint |
| `EMBEDDER_MODEL` | nomic-embed-text | Embedding model |
| `FALKORDB_GRAPH_NAME` | allan_memory | Graph name |
| `LOG_LEVEL` | info | debug/info/warn/error |

### Exposed Ports

| Port | Service |
|------|---------|
| 19089 | Allan Memory API |
| 6380 | FalkorDB (Redis protocol) |
| 3001 | FalkorDB Web UI |
| 11435 | Ollama API |

---

## Claude Code Integration

Add the following to your `~/.claude/CLAUDE.md` file to enable knowledge graph memory for Claude:

```markdown
## Knowledge Graph (Allan Memory)

You have access to a knowledge graph via HTTP API at `http://localhost:19089`.
Use it to persist and recall information about codebases across sessions.

### When to READ from the knowledge graph:
- **Before answering questions about a codebase**, search nodes and facts to check for prior knowledge
- **When starting work on a known project**, retrieve existing context about architecture, patterns, and decisions
- Use the repo/project name as the `group_id` to namespace data per project

### When to WRITE to the knowledge graph:
- **After analyzing a new repo or module**, store discovered architecture, tech stack, key patterns
- **When you discover important design decisions or non-obvious patterns**, store them immediately
- **After debugging complex issues**, store the root cause and resolution
- **When the user explicitly asks you to remember something**

### API Usage:

**Add memory (store knowledge):**
\`\`\`bash
curl -X POST http://localhost:19089/v1/memory \
  -H "Content-Type: application/json" \
  -d '{"name":"<title>","episode_body":"<knowledge to store>","group_id":"<project-name>"}'
\`\`\`

**Search nodes (find entities):**
\`\`\`bash
curl -X POST http://localhost:19089/v1/memory/search/nodes \
  -H "Content-Type: application/json" \
  -d '{"query":"<search term>","group_ids":["<project-name>"],"limit":10}'
\`\`\`

**Search facts (find relationships):**
\`\`\`bash
curl -X POST http://localhost:19089/v1/memory/search/facts \
  -H "Content-Type: application/json" \
  -d '{"query":"<search term>","group_ids":["<project-name>"],"limit":10}'
\`\`\`

**Get recent episodes:**
\`\`\`bash
curl "http://localhost:19089/v1/memory/episodes?group_id=<project-name>&limit=10"
\`\`\`

### Best Practices:
- Always search before adding to avoid duplicates
- Use project/repo name as `group_id` for namespacing
- Store structured, useful knowledge — not trivial facts
- Focus on: architectural decisions, non-obvious constraints, cross-module dependencies, gotchas
```

### Example CLAUDE.md

```markdown
# Global Instructions

## Knowledge Graph (Allan Memory)

You have access to a knowledge graph at http://localhost:19089. Use it to persist codebase knowledge.

### Usage:
- Search first: `curl -X POST http://localhost:19089/v1/memory/search/nodes -H "Content-Type: application/json" -d '{"query":"...","group_ids":["my-project"]}'`
- Store knowledge: `curl -X POST http://localhost:19089/v1/memory -H "Content-Type: application/json" -d '{"name":"...","episode_body":"...","group_id":"my-project"}'`

### When to use:
- READ: Before answering codebase questions, check for stored knowledge
- WRITE: After discovering architecture, patterns, or debugging insights
```

---

## Local Development

```bash
# Start dependencies only
docker compose up falkordb ollama ollama-init -d

# Run locally
cp .env.example .env
npm install
npm run dev
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/memory` | POST | Add episode → extract entities + facts |
| `/v1/memory/search/nodes` | POST | Search entity nodes (hybrid) |
| `/v1/memory/search/facts` | POST | Search facts/relationships |
| `/v1/memory/episodes` | GET | List episodes by group_id |
| `/v1/memory/episodes/:uuid` | DELETE | Delete episode |
| `/v1/memory/edges/:uuid` | GET | Get entity edge by UUID |
| `/v1/memory/edges/:uuid` | DELETE | Delete entity edge |
| `/v1/memory/graph` | DELETE | Clear graph by group_ids |
| `/v1/health` | GET | Health check + DB status |

## Example Usage

```bash
# Add memory
curl -X POST http://localhost:19089/v1/memory \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","episode_body":"Acme Corp launched a new product called CloudSync","group_id":"test"}'

# Search nodes
curl -X POST http://localhost:19089/v1/memory/search/nodes \
  -H "Content-Type: application/json" \
  -d '{"query":"Acme Corp","group_ids":["test"]}'

# Search facts
curl -X POST http://localhost:19089/v1/memory/search/facts \
  -H "Content-Type: application/json" \
  -d '{"query":"product launch","group_ids":["test"]}'

# Get episodes
curl "http://localhost:19089/v1/memory/episodes?group_id=test&limit=10"
```

## Architecture

```
lib/
├── index.js                # Entry point
├── start.js                # Express app, routes, shutdown
├── domain/                 # Entities + Repository Interfaces
├── application/use_cases/  # Business logic
├── interface/              # Controllers, Routes, Repositories
└── infrastructure/         # Config, Gateways (FalkorDB, LLM, Embedder), Logger
```

## License

ISC
