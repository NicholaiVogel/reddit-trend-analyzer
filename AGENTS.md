# Repository Guidelines

## Project Structure & Module Organization
This is a Bun + TypeScript monorepo with a **CLI-first architecture**:
- `packages/core/src/`: shared pipeline logic (scraping, embeddings, clustering, analysis, storage).
- `packages/cli/src/`: primary command entrypoint (`cli.ts`) for non-interactive agent workflows.
- `data/`: local runtime data (SQLite DB files, exports).

Put domain logic in `@rta/core`; keep CLI as the first integration target.

## Build, Test, and Development Commands
Run from repo root:
- `bun install`: install workspace dependencies.
- `bun run cli help`: list available commands/options.
- `bun run cli doctor --json`: machine-readable health checks.
- `bun run cli scrape --url <reddit-url> --json`: scrape and embed data.
- `bun run cli search --query "<text>" --json`: semantic retrieval for agents.
- `bun run start`: default entrypoint, same as `bun run cli`.

For feature work, validate command outputs with `--json`.

## Coding Style & Naming Conventions
- TypeScript, ES modules, strict mode.
- Match existing style: 2-space indentation, single quotes, no semicolons.
- Use lowercase, domain-based file names (`reddit.ts`, `sqlite-vec.ts`, `summarizer.ts`).
- Re-export public modules via `src/index.ts`.
- Prefer explicit types (`SearchResult`, `ProblemSummary`); avoid `any`.

## Testing Guidelines
No formal test suite yet. Minimum validation for every PR:
1. Smoke test command paths affected by the change.
2. For pipeline/storage changes, verify against local Ollama + SQLite DB files.

When adding tests, place `*.test.ts` near the module under test.

## Commit & Pull Request Guidelines
History is short and mostly imperative, with some Conventional Commit usage (`refactor: ...`). Recommended format:
- `type: short imperative summary` (example: `feat: add scrape progress command`).
- Keep commits atomic and scoped.
- PRs must include: purpose, key changes, and local verification steps (CLI-first).
- Link issues/tasks and note env/config impacts.

## Security & Configuration Tips
Never commit `.env`, `data/*.db`, or exports. Use `.env.example` for new variables. If a change introduces external runtime requirements (for example Ollama model changes), document setup and failure modes in the PR.
