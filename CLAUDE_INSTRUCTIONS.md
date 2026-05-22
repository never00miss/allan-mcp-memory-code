# Allan Memory - Claude Code Instructions

Copy this content to your `~/.claude/CLAUDE.md` file to enable knowledge graph memory.

---

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

### API Commands:

**Check if service is running:**
```bash
curl -s http://localhost:19089/v1/health | jq .
```

**Add memory (store knowledge):**
```bash
curl -s -X POST http://localhost:19089/v1/memory \
  -H "Content-Type: application/json" \
  -d '{"name":"<title>","episode_body":"<knowledge to store>","group_id":"<project-name>"}' | jq .
```

**Search nodes (find entities):**
```bash
curl -s -X POST http://localhost:19089/v1/memory/search/nodes \
  -H "Content-Type: application/json" \
  -d '{"query":"<search term>","group_ids":["<project-name>"],"limit":10}' | jq .
```

**Search facts (find relationships):**
```bash
curl -s -X POST http://localhost:19089/v1/memory/search/facts \
  -H "Content-Type: application/json" \
  -d '{"query":"<search term>","group_ids":["<project-name>"],"limit":10}' | jq .
```

**Get recent episodes:**
```bash
curl -s "http://localhost:19089/v1/memory/episodes?group_id=<project-name>&limit=10" | jq .
```

### Best Practices:
- Always search before adding to avoid duplicates
- Use project/repo name as `group_id` for namespacing (e.g., "allan-memory", "my-web-app")
- Store structured, useful knowledge — not trivial facts or code that can be read from files
- Focus on: architectural decisions, non-obvious constraints, cross-module dependencies, gotchas, debugging insights
