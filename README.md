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

> **Important:** Always use `claude mcp add` to configure the MCP server. Do **NOT** manually edit `~/.claude/settings.json` or `~/.claude/mcp.json` for MCP config. Claude Code reads MCP settings from `~/.claude.json` (managed by the CLI), not from those files. Editing the wrong file will cause "Connection closed" errors.

---

#### Step 1: Prerequisites

```bash
# Start FalkorDB
docker compose up falkordb -d

# Install & build allan-memory
cd allan-mcp-memory-code
npm install
npm run build
npm link
```

#### Step 2: Setup Claude Code Config

Copy the ready-made config files from `extensions/`:

```bash
# Copy hooks + CLAUDE.md
cp -r extensions/.claude ~/.claude
chmod +x ~/.claude/hooks/observe-read.sh ~/.claude/hooks/observe-edit.sh
```

Then edit the hook scripts — replace the placeholder env vars with your actual values:

| Cloud (OpenRouter) | Local (Ollama) |
|---|---|
| `LLM_API_URL=https://openrouter.ai/api/v1` | `LLM_API_URL=http://localhost:11435/v1` |
| `LLM_API_KEY=sk-or-v1-your-key-here` | `LLM_API_KEY=ollama` |
| `LLM_MODEL=qwen/qwen-2.5-7b-instruct` | `LLM_MODEL=qwen2.5:7b-instruct` |
| `EMBEDDER_API_URL=https://openrouter.ai/api/v1` | `EMBEDDER_API_URL=http://localhost:11435/v1` |
| `EMBEDDER_API_KEY=sk-or-v1-your-key-here` | `EMBEDDER_API_KEY=ollama` |
| `EMBEDDER_MODEL=openai/text-embedding-3-small` | `EMBEDDER_MODEL=nomic-embed-text` |

Add the `hooks` section to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "description": "Inject project-specific context",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'see allan-memory too and always do remember save'"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "/Users/YOUR_USER/.claude/hooks/observe-read.sh",
            "timeout": 30
          }
        ]
      },
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "/Users/YOUR_USER/.claude/hooks/observe-edit.sh",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

> Replace `/Users/YOUR_USER` with your actual home directory path.

The `UserPromptSubmit` hook prepends a short reminder to every prompt so the assistant keeps using `recall` / `remember` instead of falling back to raw file search. It runs locally — no network calls, no secrets.

#### Step 3: Add MCP Server

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
  -- node /full/path/to/allan-mcp-memory-code/dist/mcp-server.js
```

**Cloud (OpenRouter):**
```bash
claude mcp add allan-memory \
  -e FALKORDB_URI=redis://localhost:6380 \
  -e FALKORDB_GRAPH_NAME=allan_memory \
  -e LLM_API_URL=https://openrouter.ai/api/v1 \
  -e LLM_API_KEY=sk-or-v1-your-key-here \
  -e LLM_MODEL=qwen/qwen-2.5-7b-instruct \
  -e EMBEDDER_API_URL=https://openrouter.ai/api/v1 \
  -e EMBEDDER_API_KEY=sk-or-v1-your-key-here \
  -e EMBEDDER_MODEL=openai/text-embedding-3-small \
  -- node /full/path/to/allan-mcp-memory-code/dist/mcp-server.js
```

**Hybrid (Local LLM + Cloud Embedding):**
```bash
claude mcp add allan-memory \
  -e FALKORDB_URI=redis://localhost:6380 \
  -e LLM_API_URL=http://localhost:11435/v1 \
  -e LLM_API_KEY=ollama \
  -e LLM_MODEL=qwen2.5:7b-instruct \
  -e EMBEDDER_API_URL=https://openrouter.ai/api/v1 \
  -e EMBEDDER_API_KEY=sk-or-v1-your-key-here \
  -e EMBEDDER_MODEL=openai/text-embedding-3-small \
  -- node /full/path/to/allan-mcp-memory-code/dist/mcp-server.js
```

> Replace `/full/path/to/allan-mcp-memory-code` with your actual path. The path must point to `dist/mcp-server.js`, **not** `lib/mcp-server.js`.

**Remove MCP:**
```bash
claude mcp remove allan-memory
```

---

#### Step 4: Verify

1. **Restart VS Code** completely (Cmd+Q, not just reload window)
2. Type `/mcp` in Claude Code chat
3. You should see `allan-memory` with 6 tools

**Troubleshooting:**

| Issue | Solution |
|-------|----------|
| "Connection closed" error | You likely edited `~/.claude/settings.json` manually. Run `claude mcp remove allan-memory` then re-add with `claude mcp add` |
| "SyntaxError: Cannot use import" | Path points to `lib/` instead of `dist/`. Use `dist/mcp-server.js` |
| MCP shows but tools don't work | FalkorDB not running. Start it: `docker compose up falkordb -d` |
| MCP not showing in `/mcp` | Run `claude mcp list` to verify it's registered |

#### Available MCP Tools

| Tool | Description |
|------|-------------|
| `register_project` | Register project root for path resolution and freshness |
| `remember` | Store a memory with structured fields (type, scope, content) |
| `recall` | Search with inline freshness (check `freshness.stale` on results!) |
| `relate` | Find relationships between entities |
| `list` | Enumerate stored entities by type |
| `refresh` | Re-extract entities from a file (use when recall returns stale) |

<details><summary>Legacy Tools (backward compat)</summary>

| Tool | Description |
|------|-------------|
| `add_memory` | Store knowledge (name, content, group_id) |
| `search_nodes` | Search entities by query |
| `search_facts` | Search relationships by query |
| `regenerate_file` | Auto-extract entities from a source file |

</details>

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

Copy the ready-made instructions from `extensions/.claude/CLAUDE.md` to `~/.claude/CLAUDE.md`:

```bash
cp extensions/.claude/CLAUDE.md ~/.claude/CLAUDE.md
```

If you have an existing `~/.claude/CLAUDE.md`, append the content manually.

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

### OpenClaw

Allan Memory integrates with [OpenClaw](https://github.com/openclaw/openclaw) as a skill.

#### Option 1: Install Skill from GitHub

```bash
openclaw skills install git:never00miss/allan-mcp-memory-code@main --as allan-memory
```

#### Option 2: Copy Skill Locally

Copy the `openclaw-skill/SKILL.md` file to your OpenClaw skills directory:

```bash
mkdir -p ~/.openclaw/skills/allan-memory
cp openclaw-skill/SKILL.md ~/.openclaw/skills/allan-memory/SKILL.md
```

#### Configure MCP Server

Add to `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "allan-memory": {
        "enabled": true,
        "env": {
          "FALKORDB_URI": "redis://localhost:6380"
        }
      }
    }
  },
  "mcpServers": {
    "allan-memory": {
      "command": "node",
      "args": ["/path/to/allan-mcp-memory-code/dist/mcp-server.js"],
      "env": {
        "FALKORDB_URI": "redis://localhost:6380",
        "LLM_API_URL": "https://openrouter.ai/api/v1",
        "LLM_API_KEY": "your-openrouter-key",
        "LLM_MODEL": "qwen/qwen-2.5-7b-instruct",
        "EMBEDDING_API_URL": "https://openrouter.ai/api/v1",
        "EMBEDDING_API_KEY": "your-openrouter-key",
        "EMBEDDING_MODEL": "openai/text-embedding-3-small"
      }
    }
  }
}
```

#### Available Tools in OpenClaw

Once configured, you can use these tools in OpenClaw:

- `add_memory` - Store knowledge (files, functions, patterns)
- `search_nodes` - Find entities by semantic search
- `search_facts` - Find relationships between entities
- `check_freshness` - Verify stored knowledge isn't stale
- `regenerate_file` - Update knowledge after file edits
- `get_episodes` - List recent memory entries
- `delete_episode` - Remove stale entries

See `openclaw-skill/SKILL.md` for detailed usage instructions.

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
      "args": ["/path/to/allan-mcp-memory-code/dist/mcp-server.js"],
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
      "args": ["/path/to/allan-mcp-memory-code/dist/mcp-server.js"],
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

Go to **Cline Settings → Custom Instructions** and add the content from `extensions/.claude/CLAUDE.md`.

Or copy it directly:

```bash
cat extensions/.claude/CLAUDE.md
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
      "args": ["/path/to/allan-mcp-memory-code/dist/mcp-server.js"],
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
      "args": ["/path/to/allan-mcp-memory-code/dist/mcp-server.js"],
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

Go to **Kilo Code Settings → Custom Instructions** and add the content from `extensions/.claude/CLAUDE.md`.

Or copy it directly:

```bash
cat extensions/.claude/CLAUDE.md
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
      "args": ["/path/to/allan-mcp-memory-code/dist/mcp-server.js"],
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
      "args": ["/path/to/allan-mcp-memory-code/dist/mcp-server.js"],
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

Go to **Windsurf Settings → AI Rules → Global AI Rules** and add the content from `extensions/.claude/CLAUDE.md`.

Or copy it directly:

```bash
cat extensions/.claude/CLAUDE.md
```

---

### Cursor

Create `.cursorrules` in your project root with the content from `extensions/.claude/CLAUDE.md`.

Or copy it directly:

```bash
cp extensions/.claude/CLAUDE.md .cursorrules
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

Use the system instructions from [`extensions/.claude/CLAUDE.md`](extensions/.claude/CLAUDE.md), adapting the tool commands to use the HTTP API (`curl`) instead of MCP tools.

---

### GitHub Copilot

Create `.github/copilot-instructions.md` using the instructions from [`extensions/.claude/CLAUDE.md`](extensions/.claude/CLAUDE.md), adapting the tool commands to use the HTTP API (`curl`) instead of MCP tools.

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
| `LLM_MODEL` | qwen2.5:7b-instruct | LLM model for MCP tools (recall, relate, etc.) |
| `EMBEDDER_API_URL` | http://localhost:11435/v1 | Embedding endpoint |
| `EMBEDDER_MODEL` | nomic-embed-text | Embedding model |
| `FALKORDB_URI` | redis://localhost:6380 | FalkorDB connection |
| `OBSERVE_LLM` | true | Enable LLM extraction for observe hooks (set `false` for regex-only) |
| `OBSERVE_LLM_MODEL` | *(same as LLM_MODEL)* | Cheaper model for observe hooks (e.g. `deepseek/deepseek-v4-flash`) |
| `HASH_CACHE_LIMIT` | 3000 | Max file hashes to track for skip-if-unchanged |

### Observe Hook Hash Cache

Observe hooks use a **content hash cache** (`~/.allan-memory/hashes.json`) to skip reprocessing unchanged files:

- `observe-read`: computes MD5 of file content, **skips** if hash matches a previous run
- `observe-edit`: **always processes** (file was edited), updates hash so next read skips
- Cache is capped at `HASH_CACHE_LIMIT` entries (default 3000), evicts oldest when full

### Observe Hook LLM Models

The observe hooks (triggered on every file read/edit) can use a **separate, cheaper model** than your main MCP tools:

| Provider | Model | Input/1M | Output/1M | Notes |
| --- | --- | --- | --- | --- |
| **OpenRouter** | `deepseek/deepseek-v4-flash` | $0.10 | $0.20 | Best quality/price |
| **OpenRouter** | `deepseek/deepseek-v4-flash:free` | $0.00 | $0.00 | Free tier |
| **OpenRouter** | `google/gemma-4-31b-it:free` | $0.00 | $0.00 | Free tier, strong code |
| **OpenRouter** | `qwen/qwen3.5-9b` | $0.04 | $0.15 | Very cheap |
| **Ollama** | `qwen2.5:7b-instruct` | Free | Free | Local, ~8 tok/s on M2 |
| **Ollama** | `qwen2.5:3b-instruct` | Free | Free | Fastest local option |
| **Ollama** | `gemma3:4b` | Free | Free | Good for extraction |
| **Disabled** | *(set `OBSERVE_LLM=false`)* | - | - | Regex-only, instant |

> **Tip**: For observe hooks, you only need simple JSON extraction — a small/cheap model works great. Your main `LLM_MODEL` handles the complex MCP tool calls.

---

## Use Cases & Benchmark

### Quick Summary

| Scenario | Queries | Token Savings | Cost Savings |
|----------|---------|---------------|--------------|
| Single Function Query | 1 | -7% | -7% |
| Repeated Queries (Same File) | 5 | **74%** | 74% |
| Cross-File Queries | 5 | **78%** | 78% |
| Full Codebase Exploration | 10 | **88%** | 88% |
| Long Coding Session | 20 | **94%** | 94% |

> **Break-even: 2 queries** — MCP pays for itself after just 2 queries about the same code.

### Live MCP Performance

Measured on localhost with FalkorDB + OpenRouter (qwen/qwen-2.5-7b-instruct):

| Operation | Time | Notes |
|-----------|------|-------|
| `add_memory` | **17ms** | Episode storage (LLM extraction is async) |
| `search_nodes` | **765ms** | Hybrid search (text + vector + embeddings) |
| `search_facts` | **410ms** | Relationship search |
| `check_freshness` | **358ms** | Staleness detection |

### Detailed Scenario Comparison

#### 1. Single Function Query
*1 query about one function — MCP has slight overhead*

| Metric | Without MCP | With MCP | Savings |
|--------|-------------|----------|---------|
| Input Tokens | 3,400 | 3,650 | -7.4% |
| File Reads | 1 | 1 | 0 saved |
| Est. Cost (Claude 3.5) | $0.0177 | $0.0185 | -4.2% |

#### 2. Repeated Queries (Same File)
*5 queries about the same file — MCP wins big*

| Metric | Without MCP | With MCP | Savings |
|--------|-------------|----------|---------|
| Input Tokens | 17,000 | 4,450 | **73.8%** |
| File Reads | 5 | 1 | 4 saved |
| Memory Cache Hits | 0 | 4 | - |
| Est. Cost (Claude 3.5) | $0.0885 | $0.0508 | **42.5%** |

#### 3. Cross-File Queries
*5 queries across 4 different files*

| Metric | Without MCP | With MCP | Savings |
|--------|-------------|----------|---------|
| Input Tokens | 86,000 | 19,300 | **77.6%** |
| File Reads | 20 | 4 | 16 saved |
| Memory Cache Hits | 0 | 4 | - |
| Est. Cost (Claude 3.5) | $0.2955 | $0.0954 | **67.7%** |

#### 4. Full Codebase Exploration
*10 queries exploring entire codebase (6 files)*

| Metric | Without MCP | With MCP | Savings |
|--------|-------------|----------|---------|
| Input Tokens | 248,000 | 28,600 | **88.5%** |
| File Reads | 60 | 6 | 54 saved |
| Memory Cache Hits | 0 | 9 | - |
| Est. Cost (Claude 3.5) | $0.8190 | $0.1608 | **80.4%** |

#### 5. Long Coding Session
*Simulates 1-hour session with 20 queries*

| Metric | Without MCP | With MCP | Savings |
|--------|-------------|----------|---------|
| Input Tokens | 496,000 | 30,600 | **93.8%** |
| File Reads | 120 | 6 | 114 saved |
| Memory Cache Hits | 0 | 19 | - |
| Est. Cost (Claude 3.5) | $1.6380 | $0.2418 | **85.2%** |

### Break-Even Analysis

```
Query 1: MCP has slight overhead (storing knowledge)
  Without MCP: ~3,200 tokens (read file)
  With MCP:    ~3,350 tokens (read + store)
  Result: MCP slightly more expensive

Query 2: MCP wins
  Without MCP: ~3,200 tokens (read file again)
  With MCP:    ~100 tokens (search_nodes hit)
  Cumulative:  6,400 vs 3,450 tokens

Query 3+: MCP advantage compounds
  Each additional query saves ~3,100 tokens
```

### When to Use MCP

| Scenario | Recommendation | Expected Savings |
|----------|----------------|------------------|
| Single one-off question | ❌ Skip MCP | - |
| 2-5 related questions | ✅ Use MCP | 50-80% |
| Long coding session (1hr+) | ✅ Use MCP | 80-95% |
| Large codebase (50+ files) | ✅ Use MCP | 90%+ |
| Team with shared memory | ✅ Use MCP | 95%+ |

### Run Benchmark Yourself

```bash
cd allan-mcp-memory-code
node benchmark.js
```

---

## Freshness Checking

When code changes, stored memories become **stale**. Use `check_freshness` to detect this.

### How It Works

```
1. AI calls check_freshness({ query, group_id, max_age_hours })
                              │
                              ▼
2. Generate query embedding via Ollama/OpenRouter
                              │
                              ▼
3. Hybrid search in FalkorDB (text + vector)
                              │
                              ▼
4. For each result, calculate age:
   - age = now - created_at
   - status = age < max_age_hours ? FRESH : STALE
                              │
                              ▼
5. Return formatted results:
   
   ---
   Found 3 memories: 2 FRESH, 1 STALE (threshold: 24h)
   login [FUNCTION] FRESH 2h ago | src/auth.js
   validateToken [FUNCTION] FRESH 5h ago | src/auth.js  
   hashPassword [FUNCTION] STALE 3d ago | src/crypto.js
                              │
                              ▼
6. AI decides:
   - FRESH → Trust memory, use directly
   - STALE → Re-read file, update with add_memory
```

### MCP Tool Usage

```javascript
// Check freshness before using cached knowledge
check_freshness({
  query: "auth functions",
  group_id: "my-project",
  max_age_hours: 24  // optional, default 24
})
```

### HTTP API Usage

```bash
curl -X POST http://localhost:19089/v1/memory/check-freshness \
  -H "Content-Type: application/json" \
  -d '{"query":"auth functions","group_id":"my-project","max_age_hours":24}'
```

### Best Practice Workflow

```
1. search_nodes("function X")
2. Results found?
   ├─ Yes → check_freshness("function X")
   │        ├─ FRESH → Use memory ✓
   │        └─ STALE → regenerate_file(file_path) OR re-read → add_memory
   └─ No → Read file → add_memory (create)
```

---

## File Regeneration

After editing a file, use `regenerate_file` to automatically update the knowledge graph.

### How It Works

```
1. AI calls regenerate_file({ file_path, project_root, group_id })
                              │
                              ▼
2. MCP reads file content from disk
                              │
                              ▼
3. Check .gitignore / .dockerignore (skip if matched)
                              │
                              ▼
4. LLM extracts structured entities:
   - File: purpose, exports, dependencies
   - Functions: name, line numbers, signature, description
                              │
                              ▼
5. Sync with knowledge graph:
   - CREATE new entities for new functions
   - UPDATE existing entities if changed
   - DELETE entities for removed functions
                              │
                              ▼
6. Return summary:
   {
     "file_path": "src/auth.js",
     "status": "success",
     "created": ["func:project:src/auth.js:10-45@login"],
     "updated": ["file:project:src/auth.js"],
     "deleted": ["func:project:src/auth.js:80-100@oldFunc"]
   }
```

### MCP Tool Usage

```javascript
// After editing a file, regenerate its entities
regenerate_file({
  file_path: "src/auth/login.js",      // relative or absolute
  project_root: "/path/to/project",    // project root directory
  group_id: "my-project"               // required
})
```

### HTTP API Usage

```bash
curl -X POST http://localhost:19089/v1/memory/regenerate-file \
  -H "Content-Type: application/json" \
  -d '{"file_path":"src/auth.js","project_root":"/path/to/project","group_id":"my-project"}'
```

### Ignored Files

Respects `.gitignore` and `.dockerignore` patterns, plus:
- `node_modules/`
- `.git/`
- `dist/`, `build/`
- `*.min.js`, `*.map`
- `package-lock.json`, `yarn.lock`

---

## Local Development

```bash
# Start dependencies only
docker compose up falkordb ollama ollama-init -d

# Run locally
cp .env.example .env
npm install
npm run build   # Compile lib/ → dist/ (Babel transpilation)
npm run dev     # Dev server with nodemon (auto-transpiles via @babel/register)
npm start       # Production (runs transpiled dist/)
```

> **Note:** The `lib/` source uses ES module `import` syntax. Always run `npm run build` before `npm start`. The `dev` script handles transpilation on-the-fly via `@babel/register`.

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

[GNU AGPL-3.0](LICENSE) — you may use, modify, and redistribute this software, but any redistribution or network/SaaS deployment must release the complete corresponding source (including your modifications) under the same license.
