# Allan Memory - Claude Code Instructions (v2)

Copy this content to your `~/.claude/CLAUDE.md` file to enable knowledge graph memory.

---

## Knowledge Graph (Allan Memory v2)

You have persistent knowledge graph memory via MCP. Key feature: **INLINE FRESHNESS** on search results.

### Tools

| Tool | Purpose |
|------|---------|
| `register_project` | Register project root (call once per project) |
| `remember` | Store memory with structured fields |
| `recall` | Search with inline freshness |
| `relate` | Find relationships |
| `list` | Enumerate by type |
| `refresh` | Re-extract from stale file |

### Start of Session

```
register_project({
  group_id: "my-project",
  project_root: "/absolute/path/to/project"
})
```

### Before Reading Files

**ALWAYS** call `recall` before `grep_search`, `file_search`, or `read_file`:

```
recall({ query: "auth login", group_id: "my-project" })
```

**Check `freshness.stale` on each result:**
- `false` → Trust the memory
- `true` → File was modified → Call `refresh` first

### After Understanding Code

```
remember({
  group_id: "my-project",
  type: "func",           // file|func|api|arch|pattern|task|debug|note|index
  scope: "AuthService.login",
  content: "func: login(email, pass) → User | validates creds, returns JWT",
  source_file: "src/services/auth.js",  // optional, enables freshness
  source_lines: [45, 89]                // optional
})
```

### When Results Are Stale

```
refresh({
  file_path: "src/services/auth.js",
  group_id: "my-project"
})
```

### List What's Stored

```
list({ group_id: "my-project", type: "file" })
```

### Entity Types

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

### When to Write

| Action | type | scope |
|--------|------|-------|
| Read file | file | path |
| Read function | func | Class.method |
| Debug issue | debug | symptom |
| Make decision | arch | topic |
| Complete task | task | what |

### Content Guidelines

- Max 5 lines
- Subject + verb + object
- Include identifiers (paths, names)
- Drop filler ("I discovered", "The code")

### Example Session

```
// 1. Register project
register_project({ group_id: "my-app", project_root: "/Users/me/my-app" })

// 2. Search before reading
recall({ query: "authentication", group_id: "my-app" })
→ [{ type: "func", scope: "auth.js@login", freshness: { stale: false } }]

// 3. If stale, refresh
refresh({ file_path: "src/auth.js", group_id: "my-app" })

// 4. Remember new understanding
remember({
  group_id: "my-app",
  type: "func",
  scope: "UserService.create",
  content: "func: create(data) → User | validates, hashes pass, saves to DB",
  source_file: "src/services/user.js"
})

// 5. List what's stored
list({ group_id: "my-app" })
```
