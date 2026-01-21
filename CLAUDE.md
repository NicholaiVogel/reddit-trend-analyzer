reddit trend analyzer
===

a CLI tool that scrapes reddit discussions, embeds them with ollama, stores in qdrant, and provides a TUI dashboard for discovering common problems/trends.

running
---

```bash
bun start        # run the app
bun dev          # run with watch mode
```

prerequisites
---

- ollama running locally with nomic-embed-text model (`ollama pull nomic-embed-text`)
- qdrant accessible at QDRANT_URL (or localhost:6333)

env vars
---

```
QDRANT_URL=https://vectors.biohazardvfx.com
QDRANT_API_KEY=<your-key>
OLLAMA_HOST=http://localhost:11434  # optional, defaults to this
```

architecture
---

```
src/
  index.ts              # entry point, connection checks, TUI setup
  scraper/
    reddit.ts           # fetch subreddit posts with pagination
    comments.ts         # fetch comments for each post
    types.ts            # reddit json response types
  embeddings/
    ollama.ts           # batch embed text with nomic-embed-text (768 dims)
  storage/
    qdrant.ts           # create collection, upsert, search
    types.ts            # point payload schema
  tui/
    app.ts              # main dashboard, wires everything together
    components/
      url-input.ts      # subreddit url input
      progress.ts       # scraping/embedding progress bars
      stats.ts          # collection stats panel
      trending.ts       # trending topics view
      search.ts         # semantic search interface
      export.ts         # export to json/csv
  utils/
    rate-limit.ts       # delay helper for reddit api
    text.ts             # text preprocessing for embedding
```

keybindings
---

- `q` or `ctrl+c` - quit
- `enter` - start scrape (when url is entered)
- `tab` - switch between url and search inputs
- `e` - export results to json
- `c` - export results to csv
- `r` - refresh stats from qdrant

coding notes
---

- uses @opentui/core standalone (no react/solid)
- reddit rate limiting: 3s delay between requests
- embeddings batched in groups of 10
- qdrant collection: reddit_trends with indexes on subreddit, type, created, score
