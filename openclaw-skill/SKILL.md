---
name: allan-memory
description: Persistent knowledge graph memory for AI coding assistants. Search, store, and retrieve codebase knowledge across sessions.
metadata:
  {
    "openclaw":
      {
        "emoji": "🧠",
        "homepage": "https://github.com/never00miss/allan-mcp-memory-code",
        "requires": { "env": ["FALKORDB_URI"] },
        "primaryEnv": "FALKORDB_URI",
        "install":
          [
            {
              "id": "docker",
              "kind": "shell",
              "command": "docker compose up -d",
              "label": "Start Allan Memory (Docker)",
              "bins": ["docker"]
            }
          ]
      }
  }
---

# Allan Memory - Persistent Knowledge Graph for Coding

Allan Memory gives you persistent memory across conversations. It stores entities and relationships in a knowledge graph (FalkorDB) so you can:

- **Remember** codebase structure, functions, patterns, and decisions
- **Search** your stored knowledge instead of re-reading files
- **Save 74-94% tokens** compared to re-reading files every time

## MCP Tools Available

When connected via MCP, you have these tools:

| Tool | Purpose |
|------|---------|
| `add_memory` | Store new knowledge (file summaries, functions, patterns) |
| `search_nodes` | Find entities by semantic search |
| `search_facts` | Find relationships between entities |
| `check_freshness` | Verify if stored knowledge is stale |
| `regenerate_file` | Auto-update knowledge after editing a file |
| `get_episodes` | List recent memory entries |
| `delete_episode` | Remove stale entries |

## Workflow

### First time exploring code:
```
1. search_nodes("index:[project]") → Check if project is indexed
2. Empty? → Read files → add_memory() for each important file/function
3. Found? → Use cached knowledge directly
```

### After editing a file:
```
regenerate_file({ file_path: "src/auth.js", project_root: "/path/to/project", group_id: "my-project" })
```

### Before using cached knowledge:
```
check_freshness({ query: "auth functions", group_id: "my-project", max_age_hours: 24 })
→ FRESH? Use it
→ STALE? Run regenerate_file or re-read and add_memory
```

## Naming Convention

Always use this format: `[type]:[project]:[scope]`

| Type | Example | Use For |
|------|---------|---------|
| index | `index:my-project` | Project overview (create FIRST!) |
| file | `file:my-project:src/auth.js` | File summary |
| func | `func:my-project:auth.js@login` | Function signature |
| api | `api:my-project:POST /auth` | API endpoint |
| pattern | `pattern:my-project:error-handling` | Code pattern |

## Content Templates

**For files:**
```
path: src/auth.js
purpose: Authentication service
exports: login(), logout(), validateToken()
deps: jwt-lib, bcrypt
lines: 150
```

**For functions:**
```
func: login(email: str, pass: str) → User|null
does: Validates credentials, returns user
calls: hashPass(), findUser()
```

## Hard Rules

1. **Always include `group_id`** — use project name in kebab-case
2. **Search before reading** — `search_nodes` first, file read only if empty
3. **Save after reading** — if you read a file, store what you learned
4. **Max 5 lines per memory** — keep it compressed
5. **Include identifiers** — file paths, function names, routes

## Token Savings

| Scenario | Without Memory | With Memory | Savings |
|----------|----------------|-------------|---------|
| Single query | 3,400 tokens | 3,650 tokens | -7% (overhead) |
| 5 queries same file | 17,000 tokens | 4,450 tokens | **74%** |
| 10 queries codebase | 248,000 tokens | 28,600 tokens | **88%** |
| 1-hour session | 496,000 tokens | 30,600 tokens | **94%** |

Break-even: 2 queries about the same code.
