# Allan MCP Memory Code

🧠 Persistent knowledge graph memory for AI coding assistants (Claude, Cline, Cursor, Windsurf). Runs 100% offline with Docker. Auto-extracts entities & relationships from conversations.

## Features

- **Full Offline Mode** - No API keys required, runs entirely on local hardware
- **Cloud Mode** - Use OpenRouter/OpenAI for low-resource machines (~$0.50/month)
- Auto-extract entities + relationships from text
- Hybrid search (text + vector) for nodes and facts
- All-in-one Docker setup (FalkorDB + Ollama + LLM + Embedding)
- Integrates with Claude, Cline, Kilo Code, Cursor, Windsurf, and more

---

## Quick Start (Offline)

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

## Quick Start (Cloud - OpenRouter)

**Lightweight setup!** Only FalkorDB runs locally, LLM/Embedding via cloud.

```bash
# Clone the repository
git clone https://github.com/never00miss/allan-mcp-memory-code.git
cd allan-mcp-memory-code

# Start only FalkorDB (graph database)
docker compose up falkordb -d

# Configure cloud API
cp .env.example .env
```

Edit `.env` for OpenRouter:

```env
# LLM (OpenRouter)
LLM_API_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-v1-your-key-here
LLM_MODEL=qwen/qwen-2.5-7b-instruct

# Embedding (OpenRouter or local Ollama)
EMBEDDER_API_URL=https://openrouter.ai/api/v1
EMBEDDER_API_KEY=sk-or-v1-your-key-here
EMBEDDER_MODEL=openai/text-embedding-3-small

# FalkorDB
FALKORDB_URI=redis://localhost:6380
```

```bash
# Install and run
npm install
npm start

# Health check
curl http://localhost:19089/v1/health
```

### OpenRouter Cost Estimate (1 Hour Coding Session)

| Activity | Requests | Tokens/Req | Total Tokens | Cost |
|----------|----------|------------|--------------|------|
| Entity extraction | ~20 | ~500 | ~10,000 | ~$0.002 |
| Embedding generation | ~50 | ~100 | ~5,000 | ~$0.0001 |
| Search queries | ~30 | ~200 | ~6,000 | ~$0.001 |
| **Total per hour** | **~100** | - | **~21,000** | **~$0.003** |

**Monthly estimate (8hr/day, 20 days):** ~$0.50

> 💡 **Tip:** Use `qwen/qwen-2.5-7b-instruct` ($0.00018/1K tokens) - extremely cheap and reliable for entity extraction.

### Recommended Cloud Models

| Provider | Model | Cost/1K tokens | Notes |
|----------|-------|----------------|-------|
| OpenRouter | `qwen/qwen-2.5-7b-instruct` | $0.00018 | **Best value** |
| OpenRouter | `google/gemma-3-4b-it` | $0.00010 | Cheapest |
| OpenRouter | `openai/gpt-4o-mini` | $0.00015 | High quality |
| OpenAI | `gpt-4o-mini` | $0.00015 | Direct API |

---

## Integration

### Claude Code (MCP Server) ⭐ Recommended

Use MCP tools directly in Claude Code - shows up in `/mcp` command.

---

#### Quick Add via CLI

**Local (Ollama):**
```bash
claude mcp add allan-memory \
  -e FALKORDB_URI=redis://localhost:6380 \
  -e LLM_API_URL=http://localhost:11435/v1 \
  -e LLM_API_KEY=ollama \
  -e LLM_MODEL=qwen2.5:7b-instruct \
  -e EMBEDDER_API_URL=http://localhost:11435/v1 \
  -e EMBEDDER_API_KEY=ollama \
  -e EMBEDDER_MODEL=nomic-embed-text \
  -- node /full/path/to/allan-mcp-memory-code/lib/mcp-server.js
```

**Cloud (OpenRouter):**
```bash
claude mcp add allan-memory \
  -e FALKORDB_URI=redis://localhost:6380 \
  -e LLM_API_URL=https://openrouter.ai/api/v1 \
  -e LLM_API_KEY=sk-or-v1-your-key-here \
  -e LLM_MODEL=qwen/qwen-2.5-7b-instruct \
  -e EMBEDDER_API_URL=https://openrouter.ai/api/v1 \
  -e EMBEDDER_API_KEY=sk-or-v1-your-key-here \
  -e EMBEDDER_MODEL=openai/text-embedding-3-small \
  -- node /full/path/to/allan-mcp-memory-code/lib/mcp-server.js
```

> 💡 Replace `/full/path/to/allan-mcp-memory-code` with your actual path.

**Remove MCP:**
```bash
claude mcp remove allan-memory
```

---

#### Manual Config: Option A - Full Offline (Local Ollama)

**Requirements:** Docker running with `docker compose up -d`

Add to VS Code `settings.json` (Cmd+Shift+P → "Preferences: Open User Settings (JSON)"):

```json
{
  "claude.mcpServers": {
    "allan-memory": {
      "command": "node",
      "args": ["/full/path/to/allan-mcp-memory-code/lib/mcp-server.js"],
      "env": {
        "FALKORDB_URI": "redis://localhost:6380",
        "LLM_API_URL": "http://localhost:11435/v1",
        "LLM_API_KEY": "ollama",
        "LLM_MODEL": "qwen2.5:7b-instruct",
        "EMBEDDER_API_URL": "http://localhost:11435/v1",
        "EMBEDDER_API_KEY": "ollama",
        "EMBEDDER_MODEL": "nomic-embed-text"
      }
    }
  }
}
```

| Variable | Value | Notes |
|----------|-------|-------|
| `FALKORDB_URI` | `redis://localhost:6380` | FalkorDB from Docker |
| `LLM_API_URL` | `http://localhost:11435/v1` | Ollama from Docker |
| `LLM_API_KEY` | `ollama` | Any value (Ollama ignores it) |
| `LLM_MODEL` | `qwen2.5:7b-instruct` | Downloaded by Docker |
| `EMBEDDER_API_URL` | `http://localhost:11435/v1` | Same Ollama |
| `EMBEDDER_API_KEY` | `ollama` | Any value |
| `EMBEDDER_MODEL` | `nomic-embed-text` | Downloaded by Docker |

> 💡 **No API keys needed!** Just run `docker compose up -d` first.

---

#### Manual Config: Option B - Cloud (OpenRouter)

**Requirements:** Only FalkorDB Docker + OpenRouter API key

```bash
# Start only FalkorDB
docker compose up falkordb -d
```

Add to VS Code `settings.json`:

```json
{
  "claude.mcpServers": {
    "allan-memory": {
      "command": "node",
      "args": ["/full/path/to/allan-mcp-memory-code/lib/mcp-server.js"],
      "env": {
        "FALKORDB_URI": "redis://localhost:6380",
        "LLM_API_URL": "https://openrouter.ai/api/v1",
        "LLM_API_KEY": "sk-or-v1-your-key-here",
        "LLM_MODEL": "qwen/qwen-2.5-7b-instruct",
        "EMBEDDER_API_URL": "https://openrouter.ai/api/v1",
        "EMBEDDER_API_KEY": "sk-or-v1-your-key-here",
        "EMBEDDER_MODEL": "openai/text-embedding-3-small"
      }
    }
  }
}
```

| Variable | Value | Notes |
|----------|-------|-------|
| `FALKORDB_URI` | `redis://localhost:6380` | FalkorDB from Docker |
| `LLM_API_URL` | `https://openrouter.ai/api/v1` | OpenRouter API |
| `LLM_API_KEY` | `sk-or-v1-xxx` | **Required!** Get from openrouter.ai |
| `LLM_MODEL` | `qwen/qwen-2.5-7b-instruct` | ~$0.003/hour |
| `EMBEDDER_API_URL` | `https://openrouter.ai/api/v1` | OpenRouter API |
| `EMBEDDER_API_KEY` | `sk-or-v1-xxx` | Same key |
| `EMBEDDER_MODEL` | `openai/text-embedding-3-small` | OpenAI embedding |

> ⚠️ **API key required!** Get from [openrouter.ai](https://openrouter.ai)

---

#### Manual Config: Option C - Hybrid (Local LLM + Cloud Embedding)

**Use case:** Save RAM by using cloud embeddings only

```json
{
  "claude.mcpServers": {
    "allan-memory": {
      "command": "node",
      "args": ["/full/path/to/allan-mcp-memory-code/lib/mcp-server.js"],
      "env": {
        "FALKORDB_URI": "redis://localhost:6380",
        "LLM_API_URL": "http://localhost:11435/v1",
        "LLM_API_KEY": "ollama",
        "LLM_MODEL": "qwen2.5:7b-instruct",
        "EMBEDDER_API_URL": "https://openrouter.ai/api/v1",
        "EMBEDDER_API_KEY": "sk-or-v1-your-key-here",
        "EMBEDDER_MODEL": "openai/text-embedding-3-small"
      }
    }
  }
}
```

---

#### Verify Installation

1. **Replace path:** Change `/full/path/to/allan-mcp-memory-code` to your actual path
2. **Restart VS Code** completely
3. Type `/mcp` in Claude Code chat
4. You should see `allan-memory` with 5 tools

#### Available MCP Tools

| Tool | Description |
|------|-------------|
| `add_memory` | Store knowledge (name, content, group_id) |
| `search_nodes` | Search entities by query |
| `search_facts` | Search relationships by query |
| `get_episodes` | List recent episodes |
| `delete_episode` | Delete episode by UUID |

---

### Claude Code (HTTP/curl Alternative)

If MCP doesn't work, use HTTP API with curl commands.

#### Step 1: Allow curl Commands

Add to `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(curl*)",
      "Bash(curl -s*)",
      "Bash(curl -X POST http://localhost:19089*)",
      "Bash(curl http://localhost:19089*)"
    ],
    "deny": []
  }
}
```

#### Step 2: Add Instructions to CLAUDE.md

Add to your `~/.claude/CLAUDE.md` to make Claude **auto-use** memory tools:

```markdown
## Knowledge Graph Memory (Allan Memory)

You have MCP tools for persistent memory across sessions. **USE THEM PROACTIVELY!**

### 🔍 AUTO-READ (search_nodes/search_facts) - Do this FIRST:
- **Architecture questions** → Search memory before answering
- **"How does X work?"** → Search for existing knowledge
- **Code review** → Search for known patterns/issues
- **Starting work on project** → Search for stored context
- **Debugging** → Search for similar past issues

### 💾 AUTO-WRITE (add_memory) - Do this after:
- **Discovering architecture patterns** → Store immediately
- **Finding root cause of bugs** → Remember for future
- **Learning project conventions** → Save for consistency
- **User says "remember"** → Always store
- **Completing complex tasks** → Summarize learnings

### Available MCP Tools:
| Tool | When to Use |
|------|-------------|
| `search_nodes` | Find entities (people, tech, concepts) |
| `search_facts` | Find relationships between entities |
| `add_memory` | Store new knowledge |
| `get_episodes` | List recent memory entries |
| `delete_episode` | Remove outdated info |

### Usage Pattern:
1. **START of conversation**: `search_nodes` for project context
2. **Before answering**: `search_nodes`/`search_facts` to check existing knowledge
3. **After learning**: `add_memory` to store insights
4. **End of session**: `add_memory` to summarize what was done

### IMPORTANT Rules:
- ✅ ALWAYS search before answering codebase questions
- ✅ ALWAYS store architectural discoveries
- ✅ Use project name as `group_id` for namespacing
- ❌ DON'T store trivial/temporary information
- ❌ DON'T duplicate existing knowledge (search first!)
```

#### Step 3: Restart Claude Code

After editing settings, **restart Claude Code completely** for changes to take effect.

---

### Prompt Tips for Auto-Triggering

To make Claude use memory tools automatically, use these phrases:

| Phrase in Prompt | Triggers |
|------------------|----------|
| "Check your memory first..." | `search_nodes` before answering |
| "What do you remember about...?" | `search_nodes` |
| "Remember this for later..." | `add_memory` |
| "Search your knowledge of..." | `search_nodes` |
| "What patterns have you seen in...?" | `search_facts` |
| "Store this insight..." | `add_memory` |
| "Before answering, check if..." | `search_nodes` |

#### Example Prompts:
```
"Check your memory first, then explain the authentication flow"

"What do you remember about the database schema?"

"Remember this: the API uses JWT tokens with 24h expiry"

"Search your knowledge of error handling patterns in this codebase"
```

#### Troubleshooting

| Issue | Solution |
|-------|----------|
| MCP not showing in `/mcp` | Verify path is absolute, restart VS Code |
| Popup for `curl` commands | Add `"Bash(curl*)"` to `permissions.allow` |
| Server errors | Ensure Docker is running: `docker compose ps` |

---

### Cline (VS Code)

#### Step 1: Add MCP Server

Add to Cline MCP settings (`cline_mcp_settings.json`):

**Local (Ollama):**
```json
{
  "mcpServers": {
    "allan-memory": {
      "command": "node",
      "args": ["/path/to/allan-mcp-memory-code/lib/mcp-server.js"],
      "env": {
        "FALKORDB_URI": "redis://localhost:6380",
        "LLM_API_URL": "http://localhost:11435/v1",
        "LLM_API_KEY": "ollama",
        "LLM_MODEL": "qwen2.5:7b-instruct",
        "EMBEDDER_API_URL": "http://localhost:11435/v1",
        "EMBEDDER_API_KEY": "ollama",
        "EMBEDDER_MODEL": "nomic-embed-text"
      }
    }
  }
}
```

**Cloud (OpenRouter):**
```json
{
  "mcpServers": {
    "allan-memory": {
      "command": "node",
      "args": ["/path/to/allan-mcp-memory-code/lib/mcp-server.js"],
      "env": {
        "FALKORDB_URI": "redis://localhost:6380",
        "LLM_API_URL": "https://openrouter.ai/api/v1",
        "LLM_API_KEY": "sk-or-v1-your-key-here",
        "LLM_MODEL": "qwen/qwen-2.5-7b-instruct",
        "EMBEDDER_API_URL": "https://openrouter.ai/api/v1",
        "EMBEDDER_API_KEY": "sk-or-v1-your-key-here",
        "EMBEDDER_MODEL": "openai/text-embedding-3-small"
      }
    }
  }
}
```

#### Step 2: Add Custom Instructions

Go to **Cline Settings → Custom Instructions** and add:

```markdown
## Knowledge Graph Memory (Allan Memory)

You have MCP tools for persistent memory. **USE THEM PROACTIVELY!**

### AUTO-READ (search_nodes) - Do this FIRST:
- Architecture questions → Search memory before answering
- "How does X work?" → Search for existing knowledge
- Code review → Search for known patterns
- Starting work on project → Search for stored context

### AUTO-WRITE (add_memory) - Do this after:
- Discovering architecture patterns → Store immediately
- Finding root cause of bugs → Remember for future
- Learning project conventions → Save for consistency
- User says "remember" → Always store

### Tools: search_nodes, search_facts, add_memory, get_episodes, delete_episode
```

---

### Kilo Code

#### Step 1: Add MCP Server

Add to Kilo Code MCP settings:

**Local (Ollama):**
```json
{
  "servers": {
    "allan-memory": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/allan-mcp-memory-code/lib/mcp-server.js"],
      "env": {
        "FALKORDB_URI": "redis://localhost:6380",
        "LLM_API_URL": "http://localhost:11435/v1",
        "LLM_API_KEY": "ollama",
        "LLM_MODEL": "qwen2.5:7b-instruct",
        "EMBEDDER_API_URL": "http://localhost:11435/v1",
        "EMBEDDER_API_KEY": "ollama",
        "EMBEDDER_MODEL": "nomic-embed-text"
      }
    }
  }
}
```

**Cloud (OpenRouter):**
```json
{
  "servers": {
    "allan-memory": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/allan-mcp-memory-code/lib/mcp-server.js"],
      "env": {
        "FALKORDB_URI": "redis://localhost:6380",
        "LLM_API_URL": "https://openrouter.ai/api/v1",
        "LLM_API_KEY": "sk-or-v1-your-key-here",
        "LLM_MODEL": "qwen/qwen-2.5-7b-instruct",
        "EMBEDDER_API_URL": "https://openrouter.ai/api/v1",
        "EMBEDDER_API_KEY": "sk-or-v1-your-key-here",
        "EMBEDDER_MODEL": "openai/text-embedding-3-small"
      }
    }
  }
}
```

#### Step 2: Add Custom Instructions

Go to **Kilo Code Settings → Custom Instructions** and add:

```markdown
## Knowledge Graph Memory (Allan Memory)

You have MCP tools for persistent memory. **USE THEM PROACTIVELY!**

### AUTO-READ (search_nodes) - Do this FIRST:
- Architecture questions → Search memory before answering
- "How does X work?" → Search for existing knowledge
- Code review → Search for known patterns
- Starting work on project → Search for stored context

### AUTO-WRITE (add_memory) - Do this after:
- Discovering architecture patterns → Store immediately
- Finding root cause of bugs → Remember for future
- Learning project conventions → Save for consistency
- User says "remember" → Always store

### Tools: search_nodes, search_facts, add_memory, get_episodes, delete_episode
```

---

### Windsurf (Codeium)

#### Step 1: Add MCP Server

Add to Windsurf MCP settings (`~/.codeium/windsurf/mcp_config.json`):

**Local (Ollama):**
```json
{
  "mcpServers": {
    "allan-memory": {
      "command": "node",
      "args": ["/path/to/allan-mcp-memory-code/lib/mcp-server.js"],
      "env": {
        "FALKORDB_URI": "redis://localhost:6380",
        "LLM_API_URL": "http://localhost:11435/v1",
        "LLM_API_KEY": "ollama",
        "LLM_MODEL": "qwen2.5:7b-instruct",
        "EMBEDDER_API_URL": "http://localhost:11435/v1",
        "EMBEDDER_API_KEY": "ollama",
        "EMBEDDER_MODEL": "nomic-embed-text"
      }
    }
  }
}
```

**Cloud (OpenRouter):**
```json
{
  "mcpServers": {
    "allan-memory": {
      "command": "node",
      "args": ["/path/to/allan-mcp-memory-code/lib/mcp-server.js"],
      "env": {
        "FALKORDB_URI": "redis://localhost:6380",
        "LLM_API_URL": "https://openrouter.ai/api/v1",
        "LLM_API_KEY": "sk-or-v1-your-key-here",
        "LLM_MODEL": "qwen/qwen-2.5-7b-instruct",
        "EMBEDDER_API_URL": "https://openrouter.ai/api/v1",
        "EMBEDDER_API_KEY": "sk-or-v1-your-key-here",
        "EMBEDDER_MODEL": "openai/text-embedding-3-small"
      }
    }
  }
}
```

#### Step 2: Add Global AI Rules

Go to **Windsurf Settings → AI Rules → Global AI Rules** and add:

```markdown
## Knowledge Graph Memory (Allan Memory)

You have MCP tools for persistent memory. **USE THEM PROACTIVELY!**

### AUTO-READ (search_nodes) - Do this FIRST:
- Architecture questions → Search memory before answering
- "How does X work?" → Search for existing knowledge
- Code review → Search for known patterns
- Starting work on project → Search for stored context

### AUTO-WRITE (add_memory) - Do this after:
- Discovering architecture patterns → Store immediately
- Finding root cause of bugs → Remember for future
- Learning project conventions → Save for consistency
- User says "remember" → Always store

### Tools: search_nodes, search_facts, add_memory, get_episodes, delete_episode
```

---

### Cursor

Create `.cursorrules` in your project root:

```markdown
# Knowledge Graph Memory (Allan Memory)

You have access to a knowledge graph API at http://localhost:19089.
**USE IT PROACTIVELY!**

## AUTO-READ - Do this FIRST:
- Architecture questions → Search memory before answering
- "How does X work?" → Search for existing knowledge  
- Code review → Search for known patterns
- Starting work on project → Search for stored context
- Debugging → Search for similar past issues

### Search Command:
curl -s -X POST http://localhost:19089/v1/memory/search/nodes -H "Content-Type: application/json" -d '{"query":"<topic>","limit":5}'

## AUTO-WRITE - Do this after:
- Discovering architecture patterns → Store immediately
- Finding root cause of bugs → Remember for future
- Learning project conventions → Save for consistency
- User says "remember" → Always store
- Completing complex tasks → Summarize learnings

### Store Command:
curl -X POST http://localhost:19089/v1/memory -H "Content-Type: application/json" -d '{"name":"<title>","episode_body":"<knowledge>","group_id":"<project>"}'

## IMPORTANT Rules:
- ALWAYS search before answering codebase questions
- ALWAYS store architectural discoveries
- Use project name as group_id for namespacing
- DON'T store trivial/temporary information
- DON'T duplicate existing knowledge (search first!)
```

---

### Continue.dev

#### Step 1: Add Context Provider

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

#### Step 2: Add System Message

Add to `~/.continue/config.json` under `models[].systemMessage`:

```markdown
## Knowledge Graph Memory (Allan Memory)

You have access to @Allan Memory context provider. **USE IT PROACTIVELY!**

### AUTO-READ - Do this FIRST:
- Architecture questions → Use @Allan Memory before answering
- "How does X work?" → Search for existing knowledge
- Code review → Search for known patterns

### AUTO-WRITE - Do this after (via terminal curl):
curl -X POST http://localhost:19089/v1/memory -H "Content-Type: application/json" -d '{"name":"<title>","episode_body":"<knowledge>","group_id":"<project>"}'
```

---

### GitHub Copilot

Create `.github/copilot-instructions.md`:

```markdown
# Knowledge Graph Memory (Allan Memory)

You have access to a knowledge graph API at http://localhost:19089.
**USE IT PROACTIVELY!**

## AUTO-READ - Do this FIRST:
- Architecture questions → Search memory before answering
- "How does X work?" → Search for existing knowledge
- Code review → Search for known patterns
- Starting work on project → Search for stored context
- Debugging → Search for similar past issues

### Search Command:
curl -s -X POST http://localhost:19089/v1/memory/search/nodes -H "Content-Type: application/json" -d '{"query":"<topic>","limit":5}'

## AUTO-WRITE - Do this after:
- Discovering architecture patterns → Store immediately
- Finding root cause of bugs → Remember for future  
- Learning project conventions → Save for consistency
- User says "remember" → Always store
- Completing complex tasks → Summarize learnings

### Store Command:
curl -X POST http://localhost:19089/v1/memory -H "Content-Type: application/json" -d '{"name":"<title>","episode_body":"<knowledge>","group_id":"<project>"}'

## IMPORTANT Rules:
- ALWAYS search before answering codebase questions
- ALWAYS store architectural discoveries  
- Use project name as group_id for namespacing
- DON'T store trivial/temporary information
- DON'T duplicate existing knowledge (search first!)
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
