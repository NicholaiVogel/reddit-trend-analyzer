import { NextRequest, NextResponse } from 'next/server'
import {
  RedditScraper,
  CommentFetcher,
  EmbeddingPipeline,
  QdrantStorage,
  SQLiteStorage,
  parseSubredditFromUrl,
} from '@rta/core'
import type { RedditComment } from '@rta/core'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, pages = 5, postsPerPage = 100 } = body

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 })
    }

    const subreddit = parseSubredditFromUrl(url)
    const sqlite = new SQLiteStorage()
    const scrapeId = sqlite.startScrape(subreddit, url)

    const scraper = new RedditScraper(3000)
    const commentFetcher = new CommentFetcher(3000)
    const embeddings = new EmbeddingPipeline()
    const storage = new QdrantStorage()

    await storage.ensureCollection()

    const posts = await scraper.fetchPosts({
      url,
      pages,
      postsPerPage,
      fetchComments: true,
      delayMs: 3000,
    })

    const commentsByPost = await commentFetcher.fetchAllComments(posts)

    const postPoints = await embeddings.embedPosts(posts, commentsByPost)
    await storage.upsertPoints(postPoints)

    const allComments: RedditComment[] = []
    for (const comments of commentsByPost.values()) {
      allComments.push(...comments)
    }

    const commentPoints = await embeddings.embedComments(allComments)
    await storage.upsertPoints(commentPoints)

    sqlite.completeScrape(scrapeId, posts.length, allComments.length)
    sqlite.close()

    return NextResponse.json({
      success: true,
      posts: posts.length,
      comments: allComments.length,
    })
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
