import { RateLimiter, fetchWithRetry } from '../utils/rate-limit'
import type {
  RedditComment,
  RedditPost,
  RedditListing,
  RedditCommentData,
  ScrapeProgress,
} from './types'

const USER_AGENT = 'reddit-trend-analyzer/1.0 (by /u/trend-analyzer-bot)'

export class CommentFetcher {
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

  private extractComments(
    listing: RedditListing<RedditCommentData>,
    subreddit: string,
    depth: number = 0
  ): RedditComment[] {
    const comments: RedditComment[] = []

    for (const child of listing.data.children) {
      if (child.kind !== 't1') continue
      const data = child.data

      if (data.author === '[deleted]' || !data.body) continue

      comments.push({
        id: data.id,
        name: data.name,
        body: data.body,
        author: data.author,
        score: data.score,
        created_utc: data.created_utc,
        permalink: data.permalink,
        parent_id: data.parent_id,
        subreddit: subreddit,
        depth: depth,
      })

      if (data.replies && typeof data.replies === 'object') {
        comments.push(
          ...this.extractComments(data.replies, subreddit, depth + 1)
        )
      }
    }

    return comments
  }

  async fetchCommentsForPost(post: RedditPost): Promise<RedditComment[]> {
    const url = `https://www.reddit.com${post.permalink}.json?limit=100&depth=3`

    try {
      const response = await fetchWithRetry<
        [RedditListing<RedditCommentData>, RedditListing<RedditCommentData>]
      >(
        url,
        {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
          },
        },
        this.rateLimiter,
        3
      )

      if (!response[1]?.data?.children) {
        return []
      }

      return this.extractComments(response[1], post.subreddit)
    } catch (error) {
      // silently skip failed posts
      return []
    }
  }

  async fetchAllComments(posts: RedditPost[]): Promise<Map<string, RedditComment[]>> {
    const commentsByPost = new Map<string, RedditComment[]>()

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]
      if (!post) continue

      this.emitProgress({
        phase: 'comments',
        current: i + 1,
        total: posts.length,
        message: `Fetching comments for post ${i + 1}/${posts.length}`,
      })

      const comments = await this.fetchCommentsForPost(post)
      commentsByPost.set(post.id, comments)
    }

    this.emitProgress({
      phase: 'comments',
      current: posts.length,
      total: posts.length,
      message: 'Done fetching comments',
    })

    return commentsByPost
  }
}
