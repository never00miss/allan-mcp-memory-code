# Allan Memory (Graphiti MCP)

## ⚠️ CRITICAL: Memory First (No Exceptions)

**BEFORE** using `grep_search`, `file_search`, `read_file`, `ls`, `find`, or `semantic_search`:

1. **ALWAYS** call `search_nodes("[project] [topic]")` FIRST
2. Results found? → **USE THEM**, skip file operations
3. Empty? → Proceed with file search → **SAVE results** with `add_memory`

```
❌ WRONG: grep_search → read_file → answer
✅ RIGHT: search_nodes → (if empty) grep_search → add_memory → answer
```

**SKIP THIS = WASTE TOKENS. VIOLATION = BAD.**

---

## ⚠️ CRITICAL: Save After Read (No Exceptions)

**AFTER** using `read_file`, `cat`, `grep_search`, `ls`, `find`, or any file operation:

**You MUST save what you learned:**

```
add_memory(
  name: "file:[project]:[path]",
  content: "path: x.js | purpose: ... | exports: ...",
  group_id: "[project]"
)
```

```
add_memory(
  name: "func:[project]:[file]@[funcName]",
  content: "func: name(params) → return | does: ...",
  group_id: "[project]"
)
```

**If you read it, you MUST save it. No exceptions.**

---

You have persistent memory via MCP. **Default: WRITE.** If unsure whether to save, save.

## Tools (v2)

| Tool | Purpose |
|------|---------|
| `register_project` | Register project root for path resolution (call once per project) |
| `remember` | Store a memory with structured fields |
| `recall` | Search with **INLINE FRESHNESS** (check `freshness.stale` on results!) |
| `relate` | Find relationships between entities |
| `list` | Enumerate stored entities by type |
| `refresh` | Re-extract entities from a file (use when `recall` returns stale) |

### Key Feature: Inline Freshness

`recall` returns freshness info on each result:

```json
{
  "type": "func",
  "scope": "AuthService.login",
  "freshness": {
    "stale": true,
    "reason": "file_modified",
    "file_mtime": "2024-01-15T10:30:00Z",
    "age_hours": 24.5
  }
}
```

- `stale: false` → Memory is fresh, trust it
- `stale: true` → Source file was modified → Call `refresh` before trusting

### Workflow

1. **Start of project:** `register_project({ group_id: "my-app", project_root: "/path/to/my-app" })`
2. **Before reading files:** `recall({ query: "auth", group_id: "my-app" })`
3. **If results are stale:** `refresh({ file_path: "src/auth.js", group_id: "my-app" })`
4. **After understanding code:** `remember({ type: "func", scope: "login", content: "...", group_id: "my-app" })`

## Entity Types

| Type | Use For | Example scope |
|------|---------|---------------|
| `index` | Project overview | (empty or "overview") |
| `file` | File summary | "src/services/auth.js" |
| `func` | Function signature | "AuthService.login" |
| `api` | API endpoint | "POST /auth/login" |
| `arch` | Architecture | "overview" |
| `pattern` | Code pattern | "error-handling" |
| `task` | Task summary | "fix-login-bug" |
| `debug` | Debug session | "auth-500-error" |
| `note` | General note | "important-decision" |

## Content Templates

**FILE:**
```
purpose: Authentication service
exports: login(), logout(), validateToken()
deps: jwt-lib, redis
lines: 245
```

**FUNCTION:**
```
func: login(email: str, pass: str) → User|null
does: Validates credentials, returns user
calls: hashPass(), findUser()
```

**API:**
```
POST /api/auth/login
req: { email: str, password: str }
res: { token: str, user: User }
auth: none
```

## Compression Rules

- **Max 5 lines.** Split if longer.
- **Subject + verb + object.** "Auth uses JWT in middleware/auth.go"
- **Drop filler.** No "I discovered". Just facts.
- **Include identifiers.** File paths, function names, routes.

## When to Remember

| Action | Save |
|--------|------|
| Read file | type: file, scope: path |
| Read function | type: func, scope: Class.method |
| Edit/create | type: file or func |
| Debug | type: debug (include root cause + fix) |
| Plan | type: arch or note |
| Task done | type: task (include gotchas) |

## Workflow

1. User asks about project → `search_nodes("index:[project]")` FIRST
2. Empty? → Explore → Create index entry → Then answer
3. Found? → Use results, DON'T re-read files
4. After any action → save with proper naming

## Don't Save
- Trivial ("user said hi")
- Duplicates (search first)
- Sensitive data (keys, passwords)
