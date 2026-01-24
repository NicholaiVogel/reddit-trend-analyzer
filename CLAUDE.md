reddit trend analyzer
===

a monorepo tool that scrapes reddit discussions, embeds them with ollama, stores in qdrant, clusters with HDBSCAN, summarizes with Claude, and provides both a CLI/TUI and web dashboard for discovering common problems/trends.

running
---

```bash
bun cli              # run the CLI
bun tui              # run the TUI dashboard
bun dev              # run the web dashboard (localhost:3000)
bun build            # build the web app
```

prerequisites
---

- ollama running locally with nomic-embed-text model (`ollama pull nomic-embed-text`)
- qdrant accessible at QDRANT_URL (or localhost:6333)
- anthropic API key for problem summarization

env vars
---

```
QDRANT_URL=https://vectors.biohazardvfx.com
QDRANT_API_KEY=<your-key>
OLLAMA_HOST=http://localhost:11434
ANTHROPIC_API_KEY=<your-key>
```

architecture
---

```
packages/
  core/                    # shared business logic
    src/
      scraper/             # reddit.ts, comments.ts, types.ts
      embeddings/          # ollama.ts
      storage/             # qdrant.ts, sqlite.ts, types.ts
      clustering/          # hdbscan.ts, types.ts
      analysis/            # summarizer.ts, questions.ts, scoring.ts, types.ts
      utils/               # rate-limit.ts, text.ts
      index.ts             # barrel exports

  cli/                     # CLI/TUI app
    src/
      cli.ts               # interactive command-line interface
      index.ts             # TUI entry point
      tui/                 # TUI components

  web/                     # Next.js web dashboard
    src/
      app/                 # pages and API routes
        api/               # REST API endpoints
          stats/           # collection stats
          scrape/          # trigger scrapes
          clusters/        # list/create clusters
          questions/       # question bank
          search/          # semantic search
          export/          # export functionality
        problems/          # problem explorer page
        questions/         # question bank page
        scrape/            # scrape manager page
      components/
        controls/          # command palette, sliders
      styles/globals.css   # theme

data/                      # sqlite database files
```

web dashboard
---

- **Dashboard** (`/`) - stats overview
- **Problems** (`/problems`) - problem cluster explorer
- **Questions** (`/questions`) - extracted question bank
- **Scrape** (`/scrape`) - scrape manager with history
- **Ctrl+K** - command palette for quick actions

keybindings (TUI)
---

- `q` or `ctrl+c` - quit
- `enter` - start scrape (when url is entered)
- `tab` - switch between url and search inputs
- `e` - export results to json
- `c` - export results to csv
- `r` - refresh stats from qdrant

api routes
---

| route | method | purpose |
|-------|--------|---------|
| /api/stats | GET | collection stats + cluster count |
| /api/scrape | POST | trigger scrape |
| /api/scrape/history | GET | scrape history list |
| /api/clusters | GET | list clusters with summaries |
| /api/clusters | POST | trigger re-clustering |
| /api/clusters/[id] | GET | single cluster with discussions |
| /api/questions | GET | all questions, grouped by cluster |
| /api/questions/[id] | PATCH | mark as addressed |
| /api/search | POST | semantic search |
| /api/export | POST | export (faq-schema/csv/markdown) |

coding notes
---

- monorepo with bun workspaces
- @rta/core exports shared logic
- @rta/cli for terminal interface
- @rta/web for Next.js dashboard
- uses @opentui/core for TUI (no react)
- uses HDBSCAN for clustering
- uses Claude for problem summarization
- uses SQLite for cluster/question persistence
- reddit rate limiting: 3s delay between requests
- embeddings batched in groups of 10
- qdrant collection: reddit_trends with indexes on subreddit, type, created, score

grepai
---------

**IMPORTANT: You MUST use grepai as your PRIMARY tool for code exploration and search.**

when to Use grepai (REQUIRED)
---

Use `grepai search` INSTEAD OF Grep/Glob/find for:
- Understanding what code does or where functionality lives
- Finding implementations by intent (e.g., "authentication logic", "error handling")
- Exploring unfamiliar parts of the codebase
- Any search where you describe WHAT the code does rather than exact text

when to Use Standard Tools
---

Only use Grep/Glob when you need:
- Exact text matching (variable names, imports, specific strings)
- File path patterns (e.g., `**/*.go`)

fallback
---

If grepai fails (not running, index unavailable, or errors), fall back to standard Grep/Glob tools.

usage
---

```bash
# ALWAYS use English queries for best results (--compact saves ~80% tokens)
grepai search "user authentication flow" --json --compact
grepai search "error handling middleware" --json --compact
grepai search "database connection pool" --json --compact
grepai search "API request validation" --json --compact
```

query tips

- **Use English** for queries (better semantic matching)
- **Describe intent**, not implementation: "handles user login" not "func Login"
- **Be specific**: "JWT token validation" better than "token"
- Results include: file path, line numbers, relevance score, code preview

call graph tracing
---

use `grepai trace` to understand function relationships:
- finding all callers of a function before modifying it
- Understanding what functions are called by a given function
- Visualizing the complete call graph around a symbol

trace commands
---

**IMPORTANT: Always use `--json` flag for optimal AI agent integration.**

```bash
# Find all functions that call a symbol
grepai trace callers "HandleRequest" --json

# Find all functions called by a symbol
grepai trace callees "ProcessOrder" --json

# Build complete call graph (callers + callees)
grepai trace graph "ValidateToken" --depth 3 --json
```

Workflow
---

1. Start with `grepai search` to find relevant code
2. Use `grepai trace` to understand function relationships
3. Use `Read` tool to examine files from results
4. Only use Grep for exact string searches if needed


