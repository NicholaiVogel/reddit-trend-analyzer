# reddit-trend-analyzer

Agent-first command CLI for Reddit trend analysis (Bun + TypeScript).

## Quick start

Prerequisites:
- Ollama running with `nomic-embed-text` available
- local filesystem access for SQLite DB files (`data/`)

```bash
bun install
ollama pull nomic-embed-text
bun run start
```

`start` runs the non-interactive `rta` command.
Vector search data is stored locally in SQLite (`data/reddit-vectors.db`).

## install globally (local checkout)

```bash
bun install
bun link
rta help
```

## Examples

```bash
bun run cli doctor --json
bun run cli scrape --url https://reddit.com/r/vfx/best --pages 3 --json
bun run cli search --query "camera tracking" --limit 20 --json
bun run cli cluster --threshold 0.55 --json
bun run cli problems --limit 10 --json
bun run cli questions --cluster-id 1 --limit 25 --json
```

Run help:

```bash
bun run cli help
```
