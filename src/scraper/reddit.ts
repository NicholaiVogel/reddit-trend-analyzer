import { RateLimiter, fetchWithRetry } from '../utils/rate-limit'
import type {
  RedditPost,
  RedditListing,
  RedditPostData,
  ScrapeOptions,
  ScrapeProgress,
} from './types'

const USER_AGENT = 'reddit-trend-analyzer/1.0 (by /u/trend-analyzer-bot)'

export function normalizeRedditUrl(url: string): string {
  let normalized = url.trim()

  if (!normalized.startsWith('http')) {
    normalized = `https://www.reddit.com${normalized.startsWith('/') ? '' : '/'}${normalized}`
  }

  normalized = normalized
    .replace('old.reddit.com', 'www.reddit.com')
    .replace('new.reddit.com', 'www.reddit.com')

  if (!normalized.endsWith('.json') && !normalized.includes('.json?')) {
    const hasQuery = normalized.includes('?')
    normalized = hasQuery
      ? normalized.replace('?', '.json?')
      : normalized + '.json'
  }

  return normalized
}

export function parseSubredditFromUrl(url: string): string {
  const match = url.match(/\/r\/([^/?]+)/)
  return match?.[1] ?? 'unknown'
}

export class RedditScraper {
  private rateLimiter: RateLimiter
  private onProgress?: (progress: ScrapeProgress) => void

  constructor(delayMs: number = 5000) {
    this.rateLimiter = new RateLimiter(delayMs)
  }

  setProgressCallback(callback: (progress: ScrapeProgress) => void): void {
    this.onProgress = callback
  }

  private emitProgress(progress: ScrapeProgress): void {
    this.onProgress?.(progress)
  }

  async fetchPosts(options: ScrapeOptions): Promise<RedditPost[]> {
    const baseUrl = normalizeRedditUrl(options.url)
    const subreddit = parseSubredditFromUrl(options.url)
    const posts: RedditPost[] = []
    let after: string | null = null

    for (let page = 0; page < options.pages; page++) {
      const url = new URL(baseUrl)
      url.searchParams.set('limit', String(options.postsPerPage))
      if (after) {
        url.searchParams.set('after', after)
      }

      this.emitProgress({
        phase: 'posts',
        current: posts.length,
        total: options.pages * options.postsPerPage,
        message: `Fetching page ${page + 1}/${options.pages}...`,
      })

      const listing = await fetchWithRetry<RedditListing<RedditPostData>>(
        url.toString(),
        {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
          },
        },
        this.rateLimiter,
        3
      )

      for (const child of listing.data.children) {
        if (child.kind !== 't3') continue
        const data = child.data

        posts.push({
          id: data.id,
          name: data.name,
          title: data.title,
          selftext: data.selftext || '',
          author: data.author,
          score: data.score,
          upvote_ratio: data.upvote_ratio,
          num_comments: data.num_comments,
          created_utc: data.created_utc,
          permalink: data.permalink,
          subreddit: subreddit,
          url: data.url,
          is_self: data.is_self,
        })
      }

      after = listing.data.after
      if (!after) break
    }

    this.emitProgress({
      phase: 'posts',
      current: posts.length,
      total: posts.length,
      message: `Fetched ${posts.length} posts`,
    })

    return posts
  }
}
