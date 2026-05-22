# Allan MCP Memory Code

🧠 Persistent knowledge graph memory for AI coding assistants (Claude, Cline, Cursor, Windsurf). Runs 100% offline with Docker. Auto-extracts entities & relationships from conversations.

## Features

- **Full Offline Mode** - No API keys required, runs entirely on local hardware
- Auto-extract entities + relationships from text
- Hybrid search (text + vector) for nodes and facts
- All-in-one Docker setup (FalkorDB + Ollama + LLM + Embedding)
- Integrates with Claude, Cline, Kilo Code, Cursor, Windsurf, and more

---

## Quick Start

**No API keys required!** Everything runs locally.

```bash
# Clone the repository
git clone https://github.com/never00miss/allan-mcp-memory-code.git
cd allan-mcp-memory-code

# Start all services (FalkorDB + Ollama + Models)
docker compose up -d

# First run downloads ~5GB of models (5-15 min depending on internet)
# Wait until models are ready:
docker compose logs ollama-init -f

# When you see "All models ready!", the service is available at:
# http://localhost:19089
```

**That's it!** Now integrate with your AI coding assistant below.

---

## Integration

### Claude Code

Add to your `~/.claude/CLAUDE.md`:

```markdown
## Knowledge Graph (Allan Memory)

You have access to a knowledge graph at http://localhost:19089.

### When to READ:
- Before answering codebase questions, search for stored knowledge
- When starting work on a known project

### When to WRITE:
- After discovering architecture, patterns, or debugging insights
- When user asks you to remember something

### API:
- Search: `curl -X POST http://localhost:19089/v1/memory/search/nodes -H "Content-Type: application/json" -d '{"query":"...","limit":10}'`
- Store: `curl -X POST http://localhost:19089/v1/memory -H "Content-Type: application/json" -d '{"name":"...","episode_body":"...","group_id":"project-name"}'`
```

---

### Cline (VS Code)

Add to Cline MCP settings (`cline_mcp_settings.json`):

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

### Kilo Code

Add to Kilo Code MCP settings:

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

### Windsurf (Codeium)

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

### Cursor

Create `.cursorrules` in your project root:

```
# Knowledge Graph Memory

You have access to a knowledge graph API at http://localhost:19089.

## Before answering architecture questions:
Run: curl -s -X POST http://localhost:19089/v1/memory/search/nodes -H "Content-Type: application/json" -d '{"query":"<topic>","limit":5}'

## After discovering important patterns:
Run: curl -X POST http://localhost:19089/v1/memory -H "Content-Type: application/json" -d '{"name":"<title>","episode_body":"<knowledge>","group_id":"<project>"}'
```

---

### Continue.dev

Add to `~/.continue/config.json`:

```json
{
  "contextProviders": [
    {
      "name": "http",
      "params": {
        "url": "http://localhost:19089/v1/memory/search/nodes",
        "method": "POST",
        "headers": { "Content-Type": "application/json" },
        "body": { "query": "{{{ input }}}", "limit": 5 },
        "title": "Allan Memory"
      }
    }
  ]
}
```

---

### GitHub Copilot

Create `.github/copilot-instructions.md`:

```markdown
# Knowledge Graph Memory

API at http://localhost:19089:
- Search: `curl -X POST http://localhost:19089/v1/memory/search/nodes -H "Content-Type: application/json" -d '{"query":"..."}'`
- Store: `curl -X POST http://localhost:19089/v1/memory -H "Content-Type: application/json" -d '{"name":"...","episode_body":"...","group_id":"project"}'`
```

---

### Generic HTTP API

| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| Store | POST | `/v1/memory` | `{"name":"...","episode_body":"...","group_id":"..."}` |
| Search Entities | POST | `/v1/memory/search/nodes` | `{"query":"...","limit":10}` |
| Search Relations | POST | `/v1/memory/search/facts` | `{"query":"...","limit":10}` |
| List Episodes | GET | `/v1/memory/episodes?group_id=...` | - |
| Health Check | GET | `/v1/health` | - |

---

## Exposed Ports

| Port | Service |
|------|---------|
| 19089 | Allan Memory API |
| 6380 | FalkorDB (Redis protocol) |
| 3001 | FalkorDB Web UI |
| 11435 | Ollama API |

---

## Hardware Requirements

### Minimum

| Component | Requirement |
|-----------|-------------|
| **RAM** | 16GB |
| **Storage** | 15GB free |
| **CPU** | 4+ cores |

### Model Sizes

| Model | Download | RAM Usage |
|-------|----------|-----------|
| nomic-embed-text | ~270MB | ~500MB |
| qwen2.5:7b-instruct | ~4.7GB | ~6GB |
| **Total** | **~5GB** | **~6.5GB** |

### Tested Platforms

| Platform | Performance |
|----------|-------------|
| MacBook Pro M2 16GB | ✅ Smooth (~10 tok/s) |
| MacBook Pro M1 16GB | ✅ Good (~8 tok/s) |
| Linux + RTX 3060 | ✅ Fast (~25 tok/s) |
| Linux + RTX 4090 | ✅ Very fast (~40 tok/s) |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 19089 | Service port |
| `LLM_API_URL` | http://localhost:11435/v1 | LLM endpoint |
| `LLM_MODEL` | qwen2.5:7b-instruct | LLM model |
| `EMBEDDER_API_URL` | http://localhost:11435/v1 | Embedding endpoint |
| `EMBEDDER_MODEL` | nomic-embed-text | Embedding model |
| `FALKORDB_URI` | redis://localhost:6380 | FalkorDB connection |

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

---

## Architecture

```
lib/
├── index.js                # Entry point
├── domain/                 # Entities + Repository Interfaces
├── application/use_cases/  # Business logic
├── interface/              # Controllers, Routes, Repositories
└── infrastructure/         # Gateways (FalkorDB, LLM, Embedder)
```

## License

ISC
