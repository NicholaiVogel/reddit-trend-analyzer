import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  type KeyEvent,
} from '@opentui/core'

import { RedditScraper } from '../scraper/reddit'
import { CommentFetcher } from '../scraper/comments'
import { EmbeddingPipeline } from '../embeddings/ollama'
import { QdrantStorage } from '../storage/qdrant'
import type { RedditComment } from '../scraper/types'
import type { SearchResult } from '../storage/types'

import { createUrlInput, focusUrlInput } from './components/url-input'
import { createProgressPanel, updateProgress, resetProgress } from './components/progress'
import { createStatsPanel, updateStats } from './components/stats'
import { createTrendingPanel, updateTrending } from './components/trending'
import { createSearchPanel, updateSearchResults, focusSearch } from './components/search'
import { createExportBar, exportToJson, exportToCsv } from './components/export'

export interface AppState {
  url: string
  pages: number
  postsPerPage: number
  isRunning: boolean
  lastResults: SearchResult[]
}

export async function createApp() {
  const renderer = await createCliRenderer({ exitOnCtrlC: false })

  const state: AppState = {
    url: '',
    pages: 5,
    postsPerPage: 100,
    isRunning: false,
    lastResults: [],
  }

  const scraper = new RedditScraper(3000)
  const commentFetcher = new CommentFetcher(3000)
  const embeddings = new EmbeddingPipeline()
  const storage = new QdrantStorage()

  const root = new BoxRenderable(renderer, {
    id: 'root',
    flexDirection: 'column',
    padding: 1,
  })

  const header = new BoxRenderable(renderer, {
    id: 'header',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 1,
  })

  header.add(new TextRenderable(renderer, {
    id: 'title',
    content: '  reddit trend analyzer',
  }))

  header.add(new TextRenderable(renderer, {
    id: 'quit-hint-header',
    content: '[q]uit  ',
  }))

  root.add(header)

  let progressPanel: BoxRenderable
  let statsPanel: BoxRenderable
  let trendingPanel: BoxRenderable
  let searchPanel: BoxRenderable

  const urlInput = createUrlInput(renderer, {
    onUrlSubmit: (url) => { state.url = url },
    onPagesChange: (pages) => { state.pages = pages },
    onPostsPerPageChange: (count) => { state.postsPerPage = count },
    onStartScrape: () => runScrape(),
  })
  root.add(urlInput)

  progressPanel = createProgressPanel(renderer)
  root.add(progressPanel)

  const middleRow = new BoxRenderable(renderer, {
    id: 'middle-row',
    flexDirection: 'row',
    gap: 2,
  })

  statsPanel = createStatsPanel(renderer)
  middleRow.add(statsPanel)

  trendingPanel = createTrendingPanel(renderer)
  middleRow.add(trendingPanel)

  root.add(middleRow)

  searchPanel = createSearchPanel(renderer, {
    onSearch: async (query) => {
      if (state.isRunning) return
      try {
        const vector = await embeddings.embed(query)
        const results = await storage.search(vector, 10)
        state.lastResults = results
        updateSearchResults(searchPanel, results)
      } catch (err) {
        console.error('Search error:', err)
      }
    },
  })
  root.add(searchPanel)

  const exportBar = createExportBar(renderer)
  root.add(exportBar)

  renderer.root.add(root)

  async function runScrape() {
    if (state.isRunning || !state.url) return
    state.isRunning = true
    resetProgress(progressPanel)

    try {
      await storage.ensureCollection()

      scraper.setProgressCallback((p) => {
        updateProgress(progressPanel, {
          phase: p.phase,
          current: p.current,
          total: p.total,
          message: p.message,
        })
      })

      const posts = await scraper.fetchPosts({
        url: state.url,
        pages: state.pages,
        postsPerPage: state.postsPerPage,
        fetchComments: true,
        delayMs: 3000,
      })

      commentFetcher.setProgressCallback((p) => {
        updateProgress(progressPanel, {
          phase: 'comments',
          current: p.current,
          total: p.total,
          message: p.message,
        })
      })

      const commentsByPost = await commentFetcher.fetchAllComments(posts)

      embeddings.setProgressCallback((p) => {
        updateProgress(progressPanel, {
          phase: 'embedding',
          current: p.current,
          total: p.total,
          message: p.message,
        })
      })

      const postPoints = await embeddings.embedPosts(posts, commentsByPost)
      await storage.upsertPoints(postPoints)

      const allComments: RedditComment[] = []
      for (const comments of commentsByPost.values()) {
        allComments.push(...comments)
      }

      const commentPoints = await embeddings.embedComments(allComments)
      await storage.upsertPoints(commentPoints)

      const stats = await storage.getStats()
      updateStats(statsPanel, stats)

      updateTrending(trendingPanel, [
        { title: 'scrape complete', count: postPoints.length, avgScore: 0 },
      ])

    } catch (err) {
      console.error('Scrape error:', err)
      updateTrending(trendingPanel, [
        { title: `error: ${err instanceof Error ? err.message : 'unknown'}`, count: 0, avgScore: 0 },
      ])
    } finally {
      state.isRunning = false
    }
  }

  async function refreshStats() {
    try {
      const stats = await storage.getStats()
      updateStats(statsPanel, stats)
    } catch (err) {
      console.error('Stats refresh error:', err)
    }
  }

  renderer.keyInput.on('keypress', async (key: KeyEvent) => {
    const urlInputEl = urlInput.getRenderable('url-input')
    const searchInputEl = searchPanel.getRenderable('search-input')
    const inputFocused = urlInputEl?.focused || searchInputEl?.focused

    // always allow quit
    if (key.ctrl && key.name === 'c') {
      renderer.destroy()
      process.exit(0)
    }

    // tab always switches focus
    if (key.name === 'tab') {
      if (urlInputEl?.focused) {
        searchInputEl?.focus()
      } else {
        urlInputEl?.focus()
      }
      return
    }

    // escape unfocuses inputs
    if (key.name === 'escape' && inputFocused) {
      urlInputEl?.blur?.()
      searchInputEl?.blur?.()
      return
    }

    // only handle hotkeys when no input is focused
    if (!inputFocused) {
      if (key.name === 'q') {
        renderer.destroy()
        process.exit(0)
      }

      if (key.name === 'e' && !state.isRunning && state.lastResults.length > 0) {
        await exportToJson(state.lastResults)
        updateTrending(trendingPanel, [
          { title: 'exported to reddit-trends.json', count: 0, avgScore: 0 },
        ])
      }

      if (key.name === 'c' && !state.isRunning && state.lastResults.length > 0) {
        await exportToCsv(state.lastResults)
        updateTrending(trendingPanel, [
          { title: 'exported to reddit-trends.csv', count: 0, avgScore: 0 },
        ])
      }

      if (key.name === 'r' && !state.isRunning) {
        await refreshStats()
      }
    }

    // enter starts scrape (works even with input focused if url is set)
    if (key.name === 'return' && !state.isRunning && state.url) {
      await runScrape()
    }
  })

  focusUrlInput(urlInput)

  await refreshStats()

  return { renderer, state }
}
