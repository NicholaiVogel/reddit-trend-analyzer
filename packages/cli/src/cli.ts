#!/usr/bin/env bun

import {
  RedditScraper,
  CommentFetcher,
  EmbeddingPipeline,
  SQLiteVecStorage,
  SQLiteStorage,
  ClusteringPipeline,
  ProblemSummarizer,
  QuestionExtractor,
  parseSubredditFromUrl,
} from '../../core/src/index.ts'
import type { RedditComment, SearchResult } from '../../core/src/index.ts'

type FlagValue = string | boolean

interface ParsedArgs {
  positionals: string[]
  flags: Record<string, FlagValue>
}

interface SerializableSearchResult {
  id: string
  type: 'post' | 'comment'
  subreddit: string
  title?: string
  body: string
  author: string
  score: number
  created: string
  permalink: string
  similarity: number
}

function printHelp(): void {
  console.log(`Usage: rta <command> [options]

Commands:
  doctor                   Check Ollama + SQLite-vec connectivity
  stats                    Show vector + sqlite stats
  scrape                   Scrape + embed subreddit content
  search                   Semantic search
  cluster                  Run clustering, summaries, and question extraction
  problems                 List saved problem clusters
  questions                List extracted questions
  scrape-history           Show scrape history
  help                     Show this help

Global options:
  -h, --help               Show help for a command
  -j, --json               JSON output for agent workflows

Examples:
  rta doctor --json
  rta scrape --url https://reddit.com/r/vfx/best --pages 3 --json
  rta search --query "camera tracking" --limit 20 --json
  rta cluster --threshold 0.55 --json`)
}

function printCommandHelp(command: string): void {
  const docs: Record<string, string> = {
    doctor: 'Usage: rta doctor [--json]',
    stats: 'Usage: rta stats [--json]',
    scrape: 'Usage: rta scrape --url <reddit-url> [--pages 3] [--delay-ms 3000] [--posts-per-page 100] [--no-comments] [--json]',
    search: 'Usage: rta search --query <text> [--limit 10] [--subreddit vfx] [--type post|comment] [--min-score 5] [--after-date 2026-01-01] [--out <file.json|file.csv>] [--json]',
    cluster: 'Usage: rta cluster [--threshold 0.5] [--min-cluster-size 2] [--samples-per-cluster 10] [--model llama3.2] [--json]',
    problems: 'Usage: rta problems [--limit 50] [--json]',
    questions: 'Usage: rta questions [--cluster-id 3] [--limit 50] [--json]',
    'scrape-history': 'Usage: rta scrape-history [--limit 50] [--json]',
    help: 'Usage: rta help',
  }

  console.log(docs[command] || `Unknown command: ${command}`)
}

function parseArgv(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  const flags: Record<string, FlagValue> = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg) continue

    if (arg.startsWith('--')) {
      const trimmed = arg.slice(2)
      if (!trimmed) continue

      const eqIndex = trimmed.indexOf('=')
      if (eqIndex >= 0) {
        const key = trimmed.slice(0, eqIndex)
        const value = trimmed.slice(eqIndex + 1)
        flags[key] = value
        continue
      }

      const next = argv[i + 1]
      if (next && !next.startsWith('-')) {
        flags[trimmed] = next
        i++
      } else {
        flags[trimmed] = true
      }
      continue
    }

    if (arg.startsWith('-') && arg.length > 1) {
      for (const short of arg.slice(1)) {
        if (short === 'h') flags.help = true
        else if (short === 'j') flags.json = true
        else flags[short] = true
      }
      continue
    }

    positionals.push(arg)
  }

  return { positionals, flags }
}

function hasFlag(args: ParsedArgs, name: string): boolean {
  return args.flags[name] === true
}

function getStringFlag(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags[name]
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    fail(`--${name} requires a value`)
  }
  return value
}

function getNumberFlag(args: ParsedArgs, name: string, defaultValue?: number): number {
  const raw = getStringFlag(args, name)
  if (raw === undefined) {
    if (defaultValue === undefined) {
      fail(`--${name} is required`)
    }
    return defaultValue
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    fail(`--${name} must be a number`)
  }
  return parsed
}

function assertAllowedFlags(args: ParsedArgs, command: string, allowed: string[]): void {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(args.flags)) {
    if (!allowedSet.has(key)) {
      fail(`unknown option for '${command}': --${key}`)
    }
  }
}

function fail(message: string, code: number = 1): never {
  console.error(`error: ${message}`)
  process.exit(code)
}

function progressLine(label: string, current: number, total: number): string {
  const width = 24
  const percent = total > 0 ? current / total : 0
  const filled = Math.round(percent * width)
  const empty = width - filled
  return `\r${label}: [${'█'.repeat(filled)}${'░'.repeat(empty)}] ${current}/${total}`
}

function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${ms}ms`))
        }, ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function toIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString()
}

function serializeSearchResults(results: SearchResult[]): SerializableSearchResult[] {
  return results.map((r) => ({
    id: r.payload.id,
    type: r.payload.type,
    subreddit: r.payload.subreddit,
    title: r.payload.title,
    body: r.payload.body,
    author: r.payload.author,
    score: r.payload.score,
    created: toIso(r.payload.created),
    permalink: r.payload.permalink,
    similarity: r.score,
  }))
}

function escapeCsv(value: string | number | undefined): string {
  if (value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function searchResultsToCsv(rows: SerializableSearchResult[]): string {
  const headers = ['id', 'type', 'subreddit', 'title', 'body', 'author', 'score', 'created', 'permalink', 'similarity']
  const dataRows = rows.map((row) => [
    row.id,
    row.type,
    row.subreddit,
    row.title || '',
    row.body,
    row.author,
    row.score,
    row.created,
    row.permalink,
    row.similarity.toFixed(6),
  ].map(escapeCsv).join(','))

  return [headers.join(','), ...dataRows].join('\n')
}

function parseAfterTimestamp(args: ParsedArgs): number | undefined {
  const after = getStringFlag(args, 'after')
  const afterDate = getStringFlag(args, 'after-date')
  const raw = afterDate || after
  if (!raw) return undefined

  if (/^\d+$/.test(raw)) {
    return Number(raw)
  }

  const parsedMs = Date.parse(raw)
  if (!Number.isFinite(parsedMs)) {
    fail(`invalid date for --after-date: ${raw}`)
  }
  return Math.floor(parsedMs / 1000)
}

async function commandDoctor(args: ParsedArgs): Promise<void> {
  assertAllowedFlags(args, 'doctor', ['help', 'json'])

  const json = hasFlag(args, 'json')

  const embeddings = new EmbeddingPipeline()
  const storage = new SQLiteVecStorage()

  const ollamaReachable = await withTimeout(embeddings.checkConnection(), 10000, 'ollama connectivity check')
    .catch(() => false)
  const ollamaModelReady = ollamaReachable
    ? await withTimeout(embeddings.checkConnection(true), 10000, 'ollama model check').catch(() => false)
    : false
  const vectorReachable = await withTimeout(storage.checkConnection(), 10000, 'sqlite-vec connectivity check')
    .catch(() => false)

  const result = {
    ok: ollamaReachable && ollamaModelReady && vectorReachable,
    services: {
      ollama: {
        host: process.env.OLLAMA_HOST || 'http://localhost:11434',
        reachable: ollamaReachable,
        model: 'nomic-embed-text',
        modelReady: ollamaModelReady,
      },
      vectorStore: {
        engine: 'sqlite-vec',
        path: process.env.SQLITE_VEC_DB_PATH || 'data/reddit-vectors.db',
        reachable: vectorReachable,
      },
    },
  }

  if (json) {
    printJson(result)
  } else {
    console.log(`ollama: ${ollamaReachable ? 'ok' : 'unreachable'} (${result.services.ollama.host})`)
    console.log(`model (${result.services.ollama.model}): ${ollamaModelReady ? 'ok' : 'missing'}`)
    console.log(`sqlite-vec: ${vectorReachable ? 'ok' : 'unreachable'} (${result.services.vectorStore.path})`)
    console.log(result.ok ? '\nall checks passed' : '\none or more checks failed')
  }

  if (!result.ok) process.exit(1)
}

async function commandStats(args: ParsedArgs): Promise<void> {
  assertAllowedFlags(args, 'stats', ['help', 'json'])

  const json = hasFlag(args, 'json')
  const storage = new SQLiteVecStorage()
  let vectorError: string | undefined
  const vector = await withTimeout(storage.getStats(), 10000, 'sqlite-vec stats')
    .catch((error) => {
      vectorError = error instanceof Error ? error.message : String(error)
      return { posts: 0, comments: 0, subreddits: [] }
    })

  const sqlite = new SQLiteStorage()
  const analysis = sqlite.getStats()
  sqlite.close()

  const result = {
    vector,
    vectorError,
    analysis,
  }

  if (json) {
    printJson(result)
    return
  }

  console.log('vector store')
  console.log(`  posts: ${vector.posts.toLocaleString()}`)
  console.log(`  comments: ${vector.comments.toLocaleString()}`)
  console.log(`  subreddits: ${vector.subreddits.join(', ') || 'none'}`)
  console.log('')
  console.log('analysis store')
  console.log(`  clusters: ${analysis.clusterCount.toLocaleString()}`)
  console.log(`  questions: ${analysis.questionCount.toLocaleString()}`)
  console.log(`  addressed questions: ${analysis.addressedCount.toLocaleString()}`)
}

async function commandScrape(args: ParsedArgs): Promise<void> {
  assertAllowedFlags(args, 'scrape', ['help', 'json', 'url', 'pages', 'delay-ms', 'posts-per-page', 'no-comments'])

  const json = hasFlag(args, 'json')
  const url = getStringFlag(args, 'url') || args.positionals[0]
  if (!url) fail('scrape requires --url <reddit-url>')

  const pages = getNumberFlag(args, 'pages', 3)
  const delayMs = getNumberFlag(args, 'delay-ms', 3000)
  const postsPerPage = getNumberFlag(args, 'posts-per-page', 100)
  const includeComments = !hasFlag(args, 'no-comments')

  const scraper = new RedditScraper(delayMs)
  const commentFetcher = new CommentFetcher(delayMs)
  const embeddings = new EmbeddingPipeline()
  const storage = new SQLiteVecStorage()

  const ollamaOk = await withTimeout(embeddings.checkConnection(true), 10000, 'ollama connectivity check')
    .catch(() => false)
  if (!ollamaOk) {
    fail('cannot connect to ollama or nomic-embed-text is missing. run: ollama pull nomic-embed-text')
  }

  const vectorOk = await withTimeout(storage.checkConnection(), 10000, 'sqlite-vec connectivity check')
    .catch(() => false)
  if (!vectorOk) {
    fail('cannot connect to sqlite-vec storage')
  }

  await storage.ensureCollection()

  if (!json) {
    scraper.setProgressCallback((p) => {
      process.stdout.write(progressLine('fetching posts', p.current, p.total))
    })
    commentFetcher.setProgressCallback((p) => {
      process.stdout.write(progressLine('fetching comments', p.current, p.total))
    })
    embeddings.setProgressCallback((p) => {
      process.stdout.write(progressLine('embedding', p.current, p.total))
    })
  }

  const sqlite = new SQLiteStorage()
  const subreddit = parseSubredditFromUrl(url)
  const scrapeId = sqlite.startScrape(subreddit, url)

  try {
    const posts = await scraper.fetchPosts({
      url,
      pages,
      postsPerPage,
      fetchComments: includeComments,
      delayMs,
    })
    if (!json) process.stdout.write('\n')

    const commentsByPost = includeComments
      ? await commentFetcher.fetchAllComments(posts)
      : new Map<string, RedditComment[]>()
    if (!json && includeComments) process.stdout.write('\n')

    const postPoints = await embeddings.embedPosts(posts, commentsByPost)
    await storage.upsertPoints(postPoints)
    if (!json) process.stdout.write('\n')

    let commentPointsCount = 0
    if (includeComments) {
      const allComments: RedditComment[] = []
      for (const comments of commentsByPost.values()) {
        allComments.push(...comments)
      }

      const commentPoints = await embeddings.embedComments(allComments)
      await storage.upsertPoints(commentPoints)
      commentPointsCount = commentPoints.length
      if (!json) process.stdout.write('\n')
    }

    const totalComments = includeComments
      ? Array.from(commentsByPost.values()).reduce((acc, comments) => acc + comments.length, 0)
      : 0

    sqlite.completeScrape(scrapeId, posts.length, totalComments)

    const result = {
      ok: true,
      scrapeId,
      subreddit,
      url,
      pages,
      postsScraped: posts.length,
      commentsScraped: totalComments,
      postsEmbedded: postPoints.length,
      commentsEmbedded: commentPointsCount,
    }

    if (json) {
      printJson(result)
    } else {
      console.log(`scrape complete`)
      console.log(`  posts scraped: ${result.postsScraped}`)
      console.log(`  comments scraped: ${result.commentsScraped}`)
      console.log(`  posts embedded: ${result.postsEmbedded}`)
      console.log(`  comments embedded: ${result.commentsEmbedded}`)
    }
  } finally {
    sqlite.close()
  }
}

async function commandSearch(args: ParsedArgs): Promise<void> {
  assertAllowedFlags(args, 'search', ['help', 'json', 'query', 'limit', 'subreddit', 'type', 'min-score', 'after', 'after-date', 'out'])

  const json = hasFlag(args, 'json')
  const queryFromFlag = getStringFlag(args, 'query')
  const query = queryFromFlag || args.positionals.join(' ').trim()
  if (!query) fail('search requires --query <text>')

  const limit = getNumberFlag(args, 'limit', 10)
  const subredditRaw = getStringFlag(args, 'subreddit')
  const subreddit = subredditRaw?.replace(/^r\//, '')

  const typeRaw = getStringFlag(args, 'type')
  if (typeRaw && typeRaw !== 'post' && typeRaw !== 'comment') {
    fail('--type must be post or comment')
  }

  const minScoreRaw = getStringFlag(args, 'min-score')
  const minScore = minScoreRaw ? Number(minScoreRaw) : undefined
  if (minScoreRaw && !Number.isFinite(minScore)) {
    fail('--min-score must be a number')
  }

  const afterDate = parseAfterTimestamp(args)
  const outputPath = getStringFlag(args, 'out')

  const embeddings = new EmbeddingPipeline()
  const storage = new SQLiteVecStorage()

  const ollamaOk = await withTimeout(embeddings.checkConnection(true), 10000, 'ollama connectivity check')
    .catch(() => false)
  if (!ollamaOk) {
    fail('cannot connect to ollama or nomic-embed-text is missing. run: ollama pull nomic-embed-text')
  }

  const vectorOk = await withTimeout(storage.checkConnection(), 10000, 'sqlite-vec connectivity check')
    .catch(() => false)
  if (!vectorOk) {
    fail('cannot connect to sqlite-vec storage')
  }

  const vector = await embeddings.embed(query)
  const results = await storage.search(vector, limit, {
    subreddit,
    type: typeRaw as 'post' | 'comment' | undefined,
    minScore,
    afterDate,
  })

  const serialized = serializeSearchResults(results)
  const payload = {
    query,
    count: results.length,
    results: serialized,
  }

  if (outputPath) {
    if (outputPath.endsWith('.csv')) {
      await Bun.write(outputPath, searchResultsToCsv(serialized))
    } else {
      await Bun.write(outputPath, JSON.stringify(payload, null, 2))
    }
  }

  if (json) {
    printJson(payload)
    return
  }

  if (results.length === 0) {
    console.log('no results found')
    return
  }

  for (const row of serialized) {
    const preview = (row.title || row.body || '').slice(0, 80).replace(/\n/g, ' ')
    console.log(`[${row.type}] (${row.similarity.toFixed(3)}) ${preview}...`)
    console.log(`  -> ${row.permalink}`)
  }

  if (outputPath) {
    console.log(`\nwritten: ${outputPath}`)
  }
}

async function commandCluster(args: ParsedArgs): Promise<void> {
  assertAllowedFlags(args, 'cluster', ['help', 'json', 'threshold', 'min-cluster-size', 'samples-per-cluster', 'model'])

  const json = hasFlag(args, 'json')
  const threshold = getNumberFlag(args, 'threshold', 0.5)
  const minClusterSize = getNumberFlag(args, 'min-cluster-size', 2)
  const samplesPerCluster = getNumberFlag(args, 'samples-per-cluster', 10)
  const model = getStringFlag(args, 'model')

  const storage = new SQLiteVecStorage()
  const clustering = new ClusteringPipeline(storage)

  const vectorOk = await withTimeout(storage.checkConnection(), 10000, 'sqlite-vec connectivity check')
    .catch(() => false)
  if (!vectorOk) {
    fail('cannot connect to sqlite-vec storage')
  }

  if (!json) {
    console.log(`running clustering (threshold=${threshold}, minClusterSize=${minClusterSize})`)
  }

  const result = await clustering.runClustering({
    minClusterSize,
    similarityThreshold: threshold,
    samplesPerCluster,
  })

  const summarizer = new ProblemSummarizer(model ? { model } : undefined)
  const summaries = await summarizer.summarizeClusters(result.clusters)

  const extractor = new QuestionExtractor()
  const questionsByCluster = extractor.extractFromClusters(result.clusters)
  const questionCount = Array.from(questionsByCluster.values()).reduce((acc, items) => acc + items.length, 0)

  const sqlite = new SQLiteStorage()
  sqlite.saveClusters(summaries)
  for (const [, questions] of questionsByCluster) {
    sqlite.saveQuestions(questions)
  }
  sqlite.close()

  const payload = {
    ok: true,
    threshold,
    minClusterSize,
    samplesPerCluster,
    clusters: result.clusters.length,
    noisePoints: result.stats.noisePoints,
    summarizedClusters: summaries.length,
    extractedQuestions: questionCount,
  }

  if (json) {
    printJson(payload)
    return
  }

  console.log(`clusters: ${payload.clusters}`)
  console.log(`noise points: ${payload.noisePoints}`)
  console.log(`summaries saved: ${payload.summarizedClusters}`)
  console.log(`questions saved: ${payload.extractedQuestions}`)
}

async function commandProblems(args: ParsedArgs): Promise<void> {
  assertAllowedFlags(args, 'problems', ['help', 'json', 'limit'])

  const json = hasFlag(args, 'json')
  const limit = getNumberFlag(args, 'limit', 50)

  const sqlite = new SQLiteStorage()
  const clusters = sqlite.getClusters().slice(0, limit)
  sqlite.close()

  if (json) {
    printJson({ count: clusters.length, clusters })
    return
  }

  if (clusters.length === 0) {
    console.log('no problem clusters found. run: rta cluster')
    return
  }

  for (const cluster of clusters) {
    console.log(`[${cluster.clusterId}] ${cluster.problem}`)
    console.log(`  size: ${cluster.size} | engagement: ${cluster.totalEngagement} | subreddits: ${cluster.subreddits.join(', ')}`)
    console.log(`  ${cluster.description}`)
    console.log('')
  }
}

async function commandQuestions(args: ParsedArgs): Promise<void> {
  assertAllowedFlags(args, 'questions', ['help', 'json', 'cluster-id', 'limit'])

  const json = hasFlag(args, 'json')
  const clusterIdRaw = getStringFlag(args, 'cluster-id')
  const clusterId = clusterIdRaw ? Number(clusterIdRaw) : undefined
  if (clusterIdRaw && !Number.isFinite(clusterId)) {
    fail('--cluster-id must be a number')
  }
  const limit = getNumberFlag(args, 'limit', 50)

  const sqlite = new SQLiteStorage()
  const questions = sqlite.getQuestions(clusterId).slice(0, limit)
  sqlite.close()

  if (json) {
    printJson({ count: questions.length, questions })
    return
  }

  if (questions.length === 0) {
    console.log('no questions found. run: rta cluster')
    return
  }

  for (const question of questions) {
    const marker = question.addressed ? '[x]' : '[ ]'
    console.log(`${marker} ${question.text}`)
    console.log(`  cluster: ${question.clusterId} | engagement: ${question.engagement} | id: ${question.id}`)
  }
}

async function commandScrapeHistory(args: ParsedArgs): Promise<void> {
  assertAllowedFlags(args, 'scrape-history', ['help', 'json', 'limit'])

  const json = hasFlag(args, 'json')
  const limit = getNumberFlag(args, 'limit', 50)

  const sqlite = new SQLiteStorage()
  const history = sqlite.getScrapeHistory(limit)
  sqlite.close()

  const payload = history.map((item) => ({
    ...item,
    startedAtIso: toIso(item.startedAt),
    completedAtIso: item.completedAt ? toIso(item.completedAt) : null,
  }))

  if (json) {
    printJson({ count: payload.length, history: payload })
    return
  }

  if (payload.length === 0) {
    console.log('no scrape history found')
    return
  }

  for (const item of payload) {
    console.log(`#${item.id} r/${item.subreddit} (${item.postsScraped} posts, ${item.commentsScraped} comments)`)
    console.log(`  started: ${item.startedAtIso}`)
    console.log(`  completed: ${item.completedAtIso || 'incomplete'}`)
    console.log(`  url: ${item.url}`)
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const [commandRaw, ...rest] = argv
  const command = commandRaw || 'help'

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  const args = parseArgv(rest)
  if (hasFlag(args, 'help')) {
    printCommandHelp(command)
    return
  }

  switch (command) {
    case 'doctor':
      await commandDoctor(args)
      return
    case 'stats':
    case 'status':
      await commandStats(args)
      return
    case 'scrape':
      await commandScrape(args)
      return
    case 'search':
      await commandSearch(args)
      return
    case 'cluster':
      await commandCluster(args)
      return
    case 'problems':
    case 'clusters':
      await commandProblems(args)
      return
    case 'questions':
      await commandQuestions(args)
      return
    case 'scrape-history':
    case 'history':
      await commandScrapeHistory(args)
      return
    default:
      console.error(`error: unknown command '${command}'`)
      printHelp()
      process.exit(1)
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error('fatal error:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
