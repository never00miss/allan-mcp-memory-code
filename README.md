# Allan Memory

Knowledge Graph Service with FalkorDB - Graphiti-style memory system for LLM agents.

## Features

- Store episodes (text/json/message) and automatically extract entities + relationships
- Hybrid search (text + vector) for nodes and facts
- **Full Offline Mode** - No API keys required, runs entirely on local hardware
- OpenAI-compatible LLM and embedding endpoints (works with Ollama, OpenRouter, OpenAI)
- Clean Architecture (DDD)
- **All-in-one Docker setup** (FalkorDB + Ollama + LLM + Embedding)
- **Claude Code integration** via CLAUDE.md instructions

## Hardware Requirements

### Minimum (Full Offline with 7B LLM)

| Component | Requirement |
|-----------|-------------|
| **RAM** | 16GB |
| **Storage** | 15GB free (Docker images + models) |
| **CPU** | 4+ cores |
| **GPU** | Optional (CPU inference works) |

### Recommended

| Component | Recommendation |
|-----------|----------------|
| **RAM** | 32GB+ |
| **Storage** | SSD with 20GB+ free |
| **GPU** | NVIDIA with 8GB+ VRAM or Apple Silicon M1/M2/M3 |

### Tested Platforms

| Platform | RAM | LLM Model | Performance |
|----------|-----|-----------|-------------|
| MacBook Pro M2 | 16GB | qwen2.5:7b-instruct | ✅ Smooth (~10 tok/s) |
| MacBook Pro M1 | 16GB | qwen2.5:7b-instruct | ✅ Good (~8 tok/s) |
| Linux + RTX 3060 | 16GB | qwen2.5:7b-instruct | ✅ Fast (~25 tok/s) |
| Linux + RTX 4090 | 32GB | qwen2.5:14b | ✅ Very fast (~40 tok/s) |
| Windows + CPU only | 16GB | qwen2.5:7b-instruct | ⚠️ Slow (~2 tok/s) |

### Model Sizes

| Model | Download | RAM Usage |
|-------|----------|-----------|
| nomic-embed-text (embedding) | ~270MB | ~500MB |
| qwen2.5:7b-instruct (LLM) | ~4.7GB | ~6GB |
| **Total** | **~5GB** | **~6.5GB** |

## Quick Start (Full Offline - Docker)

**No API keys required!** Everything runs locally.

```bash
# Clone the repository
git clone https://github.com/never00miss/allan-mcp-memory-code.git
cd allan-mcp-memory-code

# Start all services (FalkorDB + Ollama + Models)
docker compose up -d

# First run will download:
#   - nomic-embed-text (~270MB) - for embeddings
#   - qwen2.5:7b-instruct (~4.7GB) - for entity extraction
# This may take 5-15 minutes depending on your internet speed

# Check services status
docker compose ps

# Wait until ollama-init shows "exited (0)" = models downloaded
docker compose logs ollama-init

# Run the service locally
npm install
npm start

# Health check
curl http://localhost:19089/v1/health
```

### Environment Variables (in .env or docker-compose.yml)

| Variable | Default (Offline) | Description |
|----------|-------------------|-------------|
| `PORT` | 19089 | Service port |
| `LLM_API_URL` | http://localhost:11435/v1 | LLM endpoint (Ollama) |
| `LLM_API_KEY` | ollama | API key (any value for Ollama) |
| `LLM_MODEL` | qwen2.5:7b-instruct | Model for entity extraction |
| `EMBEDDER_API_URL` | http://localhost:11435/v1 | Embedding endpoint |
| `EMBEDDER_MODEL` | nomic-embed-text | Embedding model |
| `FALKORDB_GRAPH_NAME` | allan_memory | Graph name |
| `LOG_LEVEL` | info | debug/info/warn/error |

### LLM Model Options

#### 🏠 Local (Ollama) - Full Offline

| Model | Size | Command | Notes |
|-------|------|---------|-------|
| `qwen2.5:7b-instruct` | 4.7GB | `ollama pull qwen2.5:7b-instruct` | **Recommended** - Best balance |
| `qwen2.5:3b-instruct` | 2.0GB | `ollama pull qwen2.5:3b-instruct` | Lighter, good for 8GB RAM |
| `qwen2.5:14b-instruct` | 9.0GB | `ollama pull qwen2.5:14b-instruct` | Better quality, needs 16GB+ RAM |

```env
# .env for full offline mode
LLM_API_URL=http://localhost:11435/v1
LLM_API_KEY=ollama
LLM_MODEL=qwen2.5:7b-instruct
```

#### ☁️ Cloud (OpenRouter) - API Key Required

| Model | Size | Notes |
|-------|------|-------|
| `qwen/qwen-2.5-7b-instruct` | 7B | **Best choice** - Fast, cheap, reliable |
| `google/gemma-3-4b-it` | 4B | Lightweight alternative |

```env
# .env for OpenRouter
LLM_API_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-v1-your-key-here
LLM_MODEL=qwen/qwen-2.5-7b-instruct
```

#### ❌ Models to Avoid

| Model | Issue |
|-------|-------|
| `z-ai/glm-5.1` | Reasoning model - returns `content: null` |
| `microsoft/phi-4-mini-instruct` | Doesn't follow JSON prompts |
| `meta-llama/llama-3.2-3b-instruct` | Inconsistent JSON formatting |

> **Why some models fail:** Reasoning models return responses in `reasoning` field instead of `content`. Small models may not follow complex structured output instructions reliably.

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

## Cline Integration (VS Code)

[Cline](https://github.com/cline/cline) is a VS Code extension for AI-assisted coding. Add Allan Memory to your Cline MCP settings:

### Configure MCP Server

Open VS Code settings and edit Cline's MCP configuration (`cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "allan-memory": {
      "command": "node",
      "args": ["/path/to/allan-mcp-memory-code/lib/index.js"],
      "env": {
        "FALKORDB_URI": "redis://localhost:6380",
        "LLM_API_URL": "http://localhost:11435/v1",
        "LLM_MODEL": "qwen2.5:7b-instruct",
        "EMBEDDER_API_URL": "http://localhost:11435/v1",
        "EMBEDDER_MODEL": "nomic-embed-text"
      }
    }
  }
}
```

### Custom Instructions for Cline

Add to your Cline custom instructions:

```
You have access to a knowledge graph memory system via the allan-memory MCP server.

When working on codebases:
- SEARCH before answering questions about architecture or patterns
- STORE discoveries: architecture decisions, debugging insights, non-obvious constraints
- Use project name as group_id to namespace memories

Available tools:
- add_memory: Store knowledge (name, content, group_id)
- search_nodes: Find entities (query, group_ids, limit)
- search_facts: Find relationships (query, group_ids, limit)
```

---

## Kilo Code Integration

[Kilo Code](https://kilocode.ai) supports MCP servers for extended capabilities.

### MCP Configuration

Add to your Kilo Code MCP settings:

```json
{
  "servers": {
    "allan-memory": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/allan-mcp-memory-code/lib/index.js"],
      "env": {
        "FALKORDB_URI": "redis://localhost:6380",
        "LLM_API_URL": "http://localhost:11435/v1",
        "LLM_MODEL": "qwen2.5:7b-instruct",
        "EMBEDDER_API_URL": "http://localhost:11435/v1",
        "EMBEDDER_MODEL": "nomic-embed-text"
      }
    }
  }
}
```

---

## Continue.dev Integration

[Continue](https://continue.dev) is an open-source AI code assistant. Configure Allan Memory as a context provider:

### Config (~/.continue/config.json)

```json
{
  "contextProviders": [
    {
      "name": "http",
      "params": {
        "url": "http://localhost:19089/v1/memory/search/nodes",
        "method": "POST",
        "headers": {
          "Content-Type": "application/json"
        },
        "body": {
          "query": "{{{ input }}}",
          "limit": 5
        },
        "title": "Allan Memory"
      }
    }
  ]
}
```

### Custom Instructions

Add to your Continue system prompt:

```
You have access to Allan Memory knowledge graph at http://localhost:19089.
Use @Allan Memory context to search for stored codebase knowledge.
```

---

## Cursor Integration

[Cursor](https://cursor.sh) can use Allan Memory via its custom API feature or rules.

### Cursor Rules (.cursorrules)

Create a `.cursorrules` file in your project root:

```
# Knowledge Graph Memory

You have access to a knowledge graph API at http://localhost:19089.

## Before answering architecture questions:
Run: curl -s -X POST http://localhost:19089/v1/memory/search/nodes -H "Content-Type: application/json" -d '{"query":"<topic>","limit":5}'

## After discovering important patterns:
Run: curl -X POST http://localhost:19089/v1/memory -H "Content-Type: application/json" -d '{"name":"<title>","episode_body":"<knowledge>","group_id":"<project>"}'

## Guidelines:
- Search before answering codebase questions
- Store: architecture decisions, debugging insights, gotchas
- Use project name as group_id
```

---

## Windsurf (Codeium) Integration

[Windsurf](https://codeium.com/windsurf) by Codeium supports MCP servers.

### MCP Configuration

Add to Windsurf MCP settings:

```json
{
  "mcpServers": {
    "allan-memory": {
      "command": "node",
      "args": ["/path/to/allan-mcp-memory-code/lib/index.js"],
      "env": {
        "FALKORDB_URI": "redis://localhost:6380",
        "LLM_API_URL": "http://localhost:11435/v1",
        "LLM_MODEL": "qwen2.5:7b-instruct",
        "EMBEDDER_API_URL": "http://localhost:11435/v1",
        "EMBEDDER_MODEL": "nomic-embed-text"
      }
    }
  }
}
```

---

## Aider Integration

[Aider](https://aider.chat) is a terminal-based AI pair programmer.

### Shell Script Wrapper

Create `aider-with-memory.sh`:

```bash
#!/bin/bash
# Search Allan Memory before starting Aider

PROJECT_NAME=$(basename $(pwd))
echo "🔍 Searching knowledge graph for: $PROJECT_NAME"

CONTEXT=$(curl -s -X POST http://localhost:19089/v1/memory/search/nodes \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"$PROJECT_NAME\",\"limit\":5}" | jq -r '.data[] | "- \(.name): \(.summary)"')

if [ -n "$CONTEXT" ]; then
  echo "📚 Found context:"
  echo "$CONTEXT"
  echo ""
fi

# Start aider with context
aider --message "Previous knowledge about this project: $CONTEXT" "$@"
```

### Post-Session Memory Save

Add to your workflow:

```bash
# After aider session, save learnings
curl -X POST http://localhost:19089/v1/memory \
  -H "Content-Type: application/json" \
  -d '{"name":"Aider Session","episode_body":"<paste session summary>","group_id":"my-project"}'
```

---

## GitHub Copilot Chat Integration

For GitHub Copilot in VS Code, use workspace instructions:

### .github/copilot-instructions.md

```markdown
# Knowledge Graph Memory

This project uses Allan Memory for persistent knowledge storage.

## API Endpoints (http://localhost:19089)
- POST /v1/memory - Store knowledge
- POST /v1/memory/search/nodes - Search entities
- POST /v1/memory/search/facts - Search relationships

## Usage Guidelines
- Search existing knowledge before making architecture decisions
- Store important discoveries using the API
- Use project name as group_id for namespacing

## Example Commands
Search: `curl -X POST http://localhost:19089/v1/memory/search/nodes -H "Content-Type: application/json" -d '{"query":"authentication"}'`
Store: `curl -X POST http://localhost:19089/v1/memory -H "Content-Type: application/json" -d '{"name":"Auth Pattern","episode_body":"Uses JWT with refresh tokens","group_id":"my-project"}'`
```

---

## Generic HTTP Integration

For any tool that supports custom API calls, use these endpoints:

| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| Store | POST | `/v1/memory` | `{"name":"...","episode_body":"...","group_id":"..."}` |
| Search Entities | POST | `/v1/memory/search/nodes` | `{"query":"...","limit":10}` |
| Search Relations | POST | `/v1/memory/search/facts` | `{"query":"...","limit":10}` |
| List Episodes | GET | `/v1/memory/episodes?group_id=...` | - |
| Health Check | GET | `/v1/health` | - |

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
