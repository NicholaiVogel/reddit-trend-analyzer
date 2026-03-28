reddit trend analyzer
===

a tool for discovering common problems and questions in reddit communities to inform content strategy and tool development.

core goal
---

find what people struggle with most -> create content/tools that solve those problems -> organic SEO growth

tech stack
---

- vector database: sqlite-vec (local sqlite)
- embeddings: nomic-embed-text (ollama)
- framework: next.js
- components: shadcn
- charts: recharts (simple, shadcn-compatible)
- theme: shadcn tokens from globals.css inline theme ONLY

data pipeline
---

```
reddit scrape -> text cleaning -> embedding -> sqlite-vec storage
                                      |
                              clustering (HDBSCAN)
                                      |
                              problem extraction (LLM)
                                      |
                              frequency + engagement scoring
```

core features
---

**1. data ingestion**

existing CLI handles this well:
- scrape subreddit posts + comments
- embed with nomic-embed-text
- store in sqlite-vec with metadata (score, created, subreddit, type)

**2. problem clustering**

the key feature. group similar discussions to surface recurring themes.

- cluster embeddings using HDBSCAN (density-based, handles noise well)
- extract cluster centroids as topic anchors
- LLM pass to generate human-readable problem statements from each cluster
- rank clusters by:
  - size (discussion count)
  - total engagement (sum of upvotes)
  - recency (still being talked about?)

output example:
```
| problem                                      | discussions | upvotes | last seen |
|----------------------------------------------|-------------|---------|-----------|
| users struggle with X when doing Y           | 47          | 2.3k    | 2d ago    |
| confusion about how to configure Z           | 31          | 890     | 1w ago    |
| no good free alternative to [competitor]     | 28          | 1.1k    | 3d ago    |
```

**3. question extraction**

pull out actual questions people ask.

- pattern matching: "how do I", "why does", "is there a way to", "what's the best", etc.
- deduplicate semantically similar questions (vector similarity > 0.9)
- rank by engagement
- group under parent problem clusters

output: FAQ-ready list for blog posts, docs, or schema markup

**4. search + explore**

- semantic search across all scraped content
- filter by: subreddit, date range, min upvotes, type (post/comment)
- click through to original reddit discussions

**5. export**

- problem clusters as markdown content briefs
- questions as FAQ schema (json-ld ready)
- csv for spreadsheet analysis
- raw json for custom processing

dashboard views
---

**home / stats**

simple overview:
- total posts/comments in db
- subreddits being tracked
- problem clusters identified
- recent scrape activity

**problem explorer** (main view)

sortable/filterable table of problem clusters:
- columns: problem summary, discussion count, total upvotes, avg sentiment, last active
- expand row -> sample discussions + extracted questions
- select multiple -> bulk export as content briefs
- search within problems

**question bank**

all extracted questions:
- grouped by parent problem cluster (collapsible)
- search/filter
- copy as json-ld FAQ schema
- mark as "addressed" when content exists

**scrape manager**

- list of tracked subreddits
- manual scrape trigger
- scrape history with stats
- add/remove subreddits


To give the user "Ultimate Control," the dashboard should include:

1. **Similarity Sensitivity Slider:** A global control that adjusts how strict the vector database is. Lower similarity = more broad, creative connections. Higher similarity = more specific, literal results.
2. **The "Impact Score" Weighting:** Allow users to toggle what "Importance" means to them. Is it **Upvote Count**? **Sentiment Extremity**? Or **Topic Velocity**? Adjusting these weights should re-order the "Competitor Hijack" table in real-time.
3. **Command Palette:** Instead of clicking through menus, a "Ctrl + K" command bar allows the user to type "Find gaps in comparison intent" to instantly update the visualizations.

implementation phases
---

**phase 1: clustering + extraction (backend)**

- [ ] add HDBSCAN clustering to pipeline
- [ ] LLM integration for problem summarization (claude or local)
- [ ] question extraction with pattern matching + dedup
- [ ] store clusters in sqlite sidecar
- [ ] CLI commands: `cluster`, `problems`, `questions`

**phase 2: web UI**

- [ ] next.js app with shadcn
- [ ] problem explorer table (tanstack table)
- [ ] question bank view
- [ ] semantic search
- [ ] export functionality
- [ ] basic stats dashboard

**phase 3: polish**

- [ ] scheduled/recurring scrapes
- [ ] better semantic deduplication
- [ ] sentiment scoring (optional)
- [ ] "addressed" tracking (link to published content)

env vars
---

```
SQLITE_VEC_DB_PATH=./data/reddit-vectors.db
SQLITE_DB_PATH=./data/reddit-trends.db
OLLAMA_HOST=http://localhost:11434
ANTHROPIC_API_KEY=<key>  # for problem summarization
```

success criteria
---

tool is working if:
- we can identify 10+ distinct problems from a subreddit scrape
- problem summaries are actionable (could write a blog post about it)
- question extraction gives us real FAQs people are asking
- export format is immediately usable for content planning

everything else is nice-to-have.

---

theme (globals.css)
---

```css
:root {
  --background: oklch(0.9551 0 0);
  --foreground: oklch(0.3211 0 0);
  --card: oklch(0.9702 0 0);
  --card-foreground: oklch(0.3211 0 0);
  --popover: oklch(0.9702 0 0);
  --popover-foreground: oklch(0.3211 0 0);
  --primary: oklch(0.4891 0 0);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.9067 0 0);
  --secondary-foreground: oklch(0.3211 0 0);
  --muted: oklch(0.8853 0 0);
  --muted-foreground: oklch(0.5103 0 0);
  --accent: oklch(0.8078 0 0);
  --accent-foreground: oklch(0.3211 0 0);
  --destructive: oklch(0.5594 0.1900 25.8625);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8576 0 0);
  --input: oklch(0.9067 0 0);
  --ring: oklch(0.4891 0 0);
  --chart-1: oklch(0.4891 0 0);
  --chart-2: oklch(0.4863 0.0361 196.0278);
  --chart-3: oklch(0.6534 0 0);
  --chart-4: oklch(0.7316 0 0);
  --chart-5: oklch(0.8078 0 0);
  --sidebar: oklch(0.9370 0 0);
  --sidebar-foreground: oklch(0.3211 0 0);
  --sidebar-primary: oklch(0.4891 0 0);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.8078 0 0);
  --sidebar-accent-foreground: oklch(0.3211 0 0);
  --sidebar-border: oklch(0.8576 0 0);
  --sidebar-ring: oklch(0.4891 0 0);
  --font-sans: Montserrat, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: Fira Code, monospace;
  --radius: 0.35rem;
  --shadow-x: 0px;
  --shadow-y: 2px;
  --shadow-blur: 0px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.15;
  --shadow-color: hsl(0 0% 20% / 0.1);
  --shadow-2xs: 0px 2px 0px 0px hsl(0 0% 20% / 0.07);
  --shadow-xs: 0px 2px 0px 0px hsl(0 0% 20% / 0.07);
  --shadow-sm: 0px 2px 0px 0px hsl(0 0% 20% / 0.15), 0px 1px 2px -1px hsl(0 0% 20% / 0.15);
  --shadow: 0px 2px 0px 0px hsl(0 0% 20% / 0.15), 0px 1px 2px -1px hsl(0 0% 20% / 0.15);
  --shadow-md: 0px 2px 0px 0px hsl(0 0% 20% / 0.15), 0px 2px 4px -1px hsl(0 0% 20% / 0.15);
  --shadow-lg: 0px 2px 0px 0px hsl(0 0% 20% / 0.15), 0px 4px 6px -1px hsl(0 0% 20% / 0.15);
  --shadow-xl: 0px 2px 0px 0px hsl(0 0% 20% / 0.15), 0px 8px 10px -1px hsl(0 0% 20% / 0.15);
  --shadow-2xl: 0px 2px 0px 0px hsl(0 0% 20% / 0.38);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}

.dark {
  --background: oklch(0.2178 0 0);
  --foreground: oklch(0.8853 0 0);
  --card: oklch(0.2435 0 0);
  --card-foreground: oklch(0.8853 0 0);
  --popover: oklch(0.2435 0 0);
  --popover-foreground: oklch(0.8853 0 0);
  --primary: oklch(0.7058 0 0);
  --primary-foreground: oklch(0.2178 0 0);
  --secondary: oklch(0.3092 0 0);
  --secondary-foreground: oklch(0.8853 0 0);
  --muted: oklch(0.2850 0 0);
  --muted-foreground: oklch(0.5999 0 0);
  --accent: oklch(0.3715 0 0);
  --accent-foreground: oklch(0.8853 0 0);
  --destructive: oklch(0.6591 0.1530 22.1703);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.3290 0 0);
  --input: oklch(0.3092 0 0);
  --ring: oklch(0.7058 0 0);
  --chart-1: oklch(0.7058 0 0);
  --chart-2: oklch(0.6714 0.0339 206.3482);
  --chart-3: oklch(0.5452 0 0);
  --chart-4: oklch(0.4604 0 0);
  --chart-5: oklch(0.3715 0 0);
  --sidebar: oklch(0.2393 0 0);
  --sidebar-foreground: oklch(0.8853 0 0);
  --sidebar-primary: oklch(0.7058 0 0);
  --sidebar-primary-foreground: oklch(0.2178 0 0);
  --sidebar-accent: oklch(0.3715 0 0);
  --sidebar-accent-foreground: oklch(0.8853 0 0);
  --sidebar-border: oklch(0.3290 0 0);
  --sidebar-ring: oklch(0.7058 0 0);
  --font-sans: Inter, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: Fira Code, monospace;
  --radius: 0.35rem;
  --shadow-x: 0px;
  --shadow-y: 2px;
  --shadow-blur: 0px;
  --shadow-spread: 0px;
  --shadow-opacity: 0.15;
  --shadow-color: hsl(0 0% 20% / 0.1);
  --shadow-2xs: 0px 2px 0px 0px hsl(0 0% 20% / 0.07);
  --shadow-xs: 0px 2px 0px 0px hsl(0 0% 20% / 0.07);
  --shadow-sm: 0px 2px 0px 0px hsl(0 0% 20% / 0.15), 0px 1px 2px -1px hsl(0 0% 20% / 0.15);
  --shadow: 0px 2px 0px 0px hsl(0 0% 20% / 0.15), 0px 1px 2px -1px hsl(0 0% 20% / 0.15);
  --shadow-md: 0px 2px 0px 0px hsl(0 0% 20% / 0.15), 0px 2px 4px -1px hsl(0 0% 20% / 0.15);
  --shadow-lg: 0px 2px 0px 0px hsl(0 0% 20% / 0.15), 0px 4px 6px -1px hsl(0 0% 20% / 0.15);
  --shadow-xl: 0px 2px 0px 0px hsl(0 0% 20% / 0.15), 0px 8px 10px -1px hsl(0 0% 20% / 0.15);
  --shadow-2xl: 0px 2px 0px 0px hsl(0 0% 20% / 0.38);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
}
```

