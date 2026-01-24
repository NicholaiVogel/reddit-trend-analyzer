import * as readline from 'readline'
import {
  RedditScraper,
  CommentFetcher,
  EmbeddingPipeline,
  QdrantStorage,
  SQLiteStorage,
  ClusteringPipeline,
  ProblemSummarizer,
  QuestionExtractor,
} from '@rta/core'
import type { RedditComment, SearchResult } from '@rta/core'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function prompt(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve))
}

function progressBar(current: number, total: number, width: number = 30): string {
  const percent = total > 0 ? current / total : 0
  const filled = Math.round(percent * width)
  const empty = width - filled
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${Math.round(percent * 100)}%`
}

async function main() {
  console.log('\n=== reddit trend analyzer ===\n')

  const scraper = new RedditScraper(5000)
  const commentFetcher = new CommentFetcher(5000)
  const embeddings = new EmbeddingPipeline()
  const storage = new QdrantStorage()

  // check connections
  console.log('checking connections...')

  const ollamaOk = await embeddings.checkConnection()
  if (!ollamaOk) {
    console.error('error: cannot connect to ollama')
    console.error('run: ollama pull nomic-embed-text')
    process.exit(1)
  }
  console.log('  ollama: ok')

  const qdrantOk = await storage.checkConnection()
  if (!qdrantOk) {
    console.error('error: cannot connect to qdrant')
    process.exit(1)
  }
  console.log('  qdrant: ok')

  await storage.ensureCollection()
  const stats = await storage.getStats()
  console.log(`\ncurrent stats: ${stats.posts} posts, ${stats.comments} comments, ${stats.subreddits.length} subreddits\n`)

  let lastResults: SearchResult[] = []

  while (true) {
    console.log('\ncommands:')
    console.log('  scrape <url> [pages]  - scrape subreddit (e.g. scrape https://reddit.com/r/vfx/best 3)')
    console.log('  search <query>        - semantic search')
    console.log('  cluster [threshold]   - run clustering pipeline (default threshold 0.5)')
    console.log('  problems              - list problem clusters')
    console.log('  questions [clusterId] - list extracted questions')
    console.log('  stats                 - show collection stats')
    console.log('  export json|csv       - export last search results')
    console.log('  quit                  - exit\n')

    const input = await prompt('> ')
    const [cmd, ...args] = input.trim().split(' ')

    if (cmd === 'quit' || cmd === 'q' || cmd === 'exit') {
      console.log('bye!')
      rl.close()
      process.exit(0)
    }

    if (cmd === 'stats') {
      const s = await storage.getStats()
      console.log(`\nposts: ${s.posts.toLocaleString()}`)
      console.log(`comments: ${s.comments.toLocaleString()}`)
      console.log(`subreddits: ${s.subreddits.join(', ') || 'none'}`)
      continue
    }

    if (cmd === 'scrape') {
      const url = args[0]
      const pages = parseInt(args[1] || '3', 10)

      if (!url) {
        console.log('usage: scrape <url> [pages]')
        console.log('example: scrape https://reddit.com/r/vfx/best 5')
        continue
      }

      console.log(`\nscraping ${url} (${pages} pages)...\n`)

      try {
        // fetch posts
        scraper.setProgressCallback((p) => {
          process.stdout.write(`\rfetching posts: ${progressBar(p.current, p.total)} ${p.current}/${p.total}  `)
        })

        const posts = await scraper.fetchPosts({
          url,
          pages,
          postsPerPage: 100,
          fetchComments: true,
          delayMs: 3000,
        })
        console.log(`\nfetched ${posts.length} posts`)

        // fetch comments
        commentFetcher.setProgressCallback((p) => {
          process.stdout.write(`\rfetching comments: ${progressBar(p.current, p.total)} ${p.current}/${p.total}  `)
        })

        const commentsByPost = await commentFetcher.fetchAllComments(posts)
        const totalComments = Array.from(commentsByPost.values()).reduce((acc, c) => acc + c.length, 0)
        console.log(`\nfetched ${totalComments} comments`)

        // embed posts
        embeddings.setProgressCallback((p) => {
          process.stdout.write(`\rembedding posts: ${progressBar(p.current, p.total)} ${p.current}/${p.total}  `)
        })

        const postPoints = await embeddings.embedPosts(posts, commentsByPost)
        await storage.upsertPoints(postPoints)
        console.log(`\nembedded ${postPoints.length} posts`)

        // embed comments
        const allComments: RedditComment[] = []
        for (const comments of commentsByPost.values()) {
          allComments.push(...comments)
        }

        embeddings.setProgressCallback((p) => {
          process.stdout.write(`\rembedding comments: ${progressBar(p.current, p.total)} ${p.current}/${p.total}  `)
        })

        const commentPoints = await embeddings.embedComments(allComments)
        await storage.upsertPoints(commentPoints)
        console.log(`\nembedded ${commentPoints.length} comments`)

        console.log('\ndone!')

      } catch (err) {
        console.error('\nerror:', err instanceof Error ? err.message : err)
      }
      continue
    }

    if (cmd === 'search') {
      const query = args.join(' ')
      if (!query) {
        console.log('usage: search <query>')
        continue
      }

      try {
        console.log(`\nsearching for "${query}"...\n`)
        const vector = await embeddings.embed(query)
        const results = await storage.search(vector, 10)
        lastResults = results

        if (results.length === 0) {
          console.log('no results found')
          continue
        }

        for (const r of results) {
          const preview = (r.payload.title || r.payload.body || '').slice(0, 80).replace(/\n/g, ' ')
          const type = r.payload.type === 'post' ? '[post]' : '[comment]'
          console.log(`${type} (${r.score.toFixed(3)}) ${preview}...`)
          console.log(`  -> ${r.payload.permalink}\n`)
        }
      } catch (err) {
        console.error('error:', err instanceof Error ? err.message : err)
      }
      continue
    }

    if (cmd === 'cluster') {
      const threshold = parseFloat(args[0] || '0.5')
      console.log(`\nrunning clustering with threshold ${threshold}...\n`)

      try {
        const clustering = new ClusteringPipeline(storage)
        const result = await clustering.runClustering({
          minClusterSize: 2,
          similarityThreshold: threshold,
          samplesPerCluster: 10,
        })

        console.log(`found ${result.clusters.length} clusters (${result.stats.noisePoints} noise points)`)

        if (result.clusters.length > 0) {
          console.log('\nsummarizing clusters...')
          const summarizer = new ProblemSummarizer()
          const summaries = await summarizer.summarizeClusters(result.clusters)

          const sqlite = new SQLiteStorage()
          sqlite.saveClusters(summaries)

          console.log('extracting questions...')
          const extractor = new QuestionExtractor()
          const questionsByCluster = extractor.extractFromClusters(result.clusters)

          for (const [, questions] of questionsByCluster) {
            sqlite.saveQuestions(questions)
          }

          sqlite.close()
          console.log(`\nsaved ${summaries.length} problem summaries to database`)
        }
      } catch (err) {
        console.error('error:', err instanceof Error ? err.message : err)
      }
      continue
    }

    if (cmd === 'problems') {
      try {
        const sqlite = new SQLiteStorage()
        const clusters = sqlite.getClusters()
        sqlite.close()

        if (clusters.length === 0) {
          console.log('\nno problems found. run `cluster` first.')
          continue
        }

        console.log(`\n${clusters.length} problem clusters:\n`)
        for (const c of clusters) {
          console.log(`[${c.clusterId}] ${c.problem}`)
          console.log(`    size: ${c.size} | engagement: ${c.totalEngagement.toLocaleString()} | subreddits: ${c.subreddits.join(', ')}`)
          console.log(`    ${c.description.slice(0, 120)}...`)
          console.log()
        }
      } catch (err) {
        console.error('error:', err instanceof Error ? err.message : err)
      }
      continue
    }

    if (cmd === 'questions') {
      try {
        const sqlite = new SQLiteStorage()
        const clusterId = args[0] ? parseInt(args[0], 10) : undefined
        const questions = sqlite.getQuestions(clusterId)
        sqlite.close()

        if (questions.length === 0) {
          console.log('\nno questions found. run `cluster` first.')
          continue
        }

        console.log(`\n${questions.length} questions${clusterId !== undefined ? ` (cluster ${clusterId})` : ''}:\n`)
        for (const q of questions.slice(0, 20)) {
          const status = q.addressed ? '[x]' : '[ ]'
          console.log(`${status} ${q.text}`)
          console.log(`    cluster: ${q.clusterId} | engagement: ${q.engagement}`)
          console.log()
        }

        if (questions.length > 20) {
          console.log(`... and ${questions.length - 20} more questions`)
        }
      } catch (err) {
        console.error('error:', err instanceof Error ? err.message : err)
      }
      continue
    }

    if (cmd === 'export') {
      const format = args[0]
      if (!format || !['json', 'csv'].includes(format)) {
        console.log('usage: export json|csv')
        continue
      }

      if (lastResults.length === 0) {
        console.log('no results to export (run a search first)')
        continue
      }

      const filename = `reddit-trends.${format}`

      if (format === 'json') {
        const data = lastResults.map(r => ({
          id: r.payload.id,
          type: r.payload.type,
          subreddit: r.payload.subreddit,
          title: r.payload.title,
          body: r.payload.body,
          author: r.payload.author,
          score: r.payload.score,
          created: new Date(r.payload.created * 1000).toISOString(),
          permalink: r.payload.permalink,
          similarity: r.score,
        }))
        await Bun.write(filename, JSON.stringify(data, null, 2))
      } else {
        const headers = ['id', 'type', 'subreddit', 'title', 'body', 'author', 'score', 'created', 'permalink', 'similarity']
        const escape = (val: string | number | undefined): string => {
          if (val === undefined) return ''
          const str = String(val)
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        }
        const rows = lastResults.map(r => [
          r.payload.id, r.payload.type, r.payload.subreddit, r.payload.title || '',
          r.payload.body, r.payload.author, r.payload.score,
          new Date(r.payload.created * 1000).toISOString(), r.payload.permalink, r.score.toFixed(4),
        ].map(escape).join(','))
        await Bun.write(filename, [headers.join(','), ...rows].join('\n'))
      }

      console.log(`exported to ${filename}`)
      continue
    }

    if (cmd) {
      console.log(`unknown command: ${cmd}`)
    }
  }
}

main().catch(err => {
  console.error('fatal error:', err)
  process.exit(1)
})
