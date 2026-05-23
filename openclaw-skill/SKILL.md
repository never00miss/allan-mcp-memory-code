---
name: allan-memory
description: Persistent knowledge graph memory for AI coding assistants. Search with INLINE FRESHNESS, store structured memories, track file changes.
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

# Allan Memory v2 - Persistent Knowledge Graph for Coding

Allan Memory gives you persistent memory across conversations with **inline freshness checking**. It stores entities in a knowledge graph (FalkorDB) so you can:

- **Remember** codebase structure, functions, patterns, and decisions
- **Search** with automatic freshness status on each result
- **Detect stale** memories when source files change
- **Save 74-94% tokens** compared to re-reading files every time

## MCP Tools (v2)

| Tool | Purpose |
|------|---------|
| `register_project` | Register project root for path resolution (call once) |
| `remember` | Store memory with structured fields (type, scope, content) |
| `recall` | Search with **INLINE FRESHNESS** - check `freshness.stale`! |
| `relate` | Find relationships between entities |
| `list` | Enumerate stored entities by type |
| `refresh` | Re-extract entities from a stale file |

## Key Feature: Inline Freshness

`recall` returns freshness info on each result:

```json
{
  "type": "func",
  "scope": "AuthService.login",
  "freshness": {
    "stale": true,
    "reason": "file_modified",
    "age_hours": 24.5
  }
}
```

- `stale: false` → Memory is fresh, trust it
- `stale: true` → Source file modified → Call `refresh` before trusting

## Workflow

### Session Start
```
register_project({
  group_id: "my-project",
  project_root: "/path/to/project"
})
```

### Before Reading Files
```
recall({ query: "auth", group_id: "my-project" })
→ Check freshness.stale on results
→ If stale, call refresh()
```

### After Understanding Code
```
remember({
  group_id: "my-project",
  type: "func",
  scope: "AuthService.login",
  content: "func: login(email, pass) → User | validates creds",
  source_file: "src/auth.js"
})
```

### When Results Are Stale
```
refresh({
  file_path: "src/auth.js",
  group_id: "my-project"
})
```

## Entity Types

| Type | Use For |
|------|---------|
| `file` | File summary |
| `func` | Function signature |
| `api` | API endpoint |
| `arch` | Architecture |
| `pattern` | Code pattern |
| `task` | Task summary |
| `debug` | Debug session |
| `note` | General note |
| `index` | Project overview |

## Content Templates

**For files:**
```
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
