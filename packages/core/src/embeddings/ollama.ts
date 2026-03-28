import { Ollama } from 'ollama'
import { prepareForEmbedding, cleanText } from '../utils/text'
import type { RedditPost, RedditComment } from '../scraper/types'
import type { PointPayload } from '../storage/types'

const MODEL = 'nomic-embed-text'
const VECTOR_DIM = 768
const BATCH_SIZE = 10

export interface EmbeddedPoint {
  id: string
  vector: number[]
  payload: PointPayload
}

export interface EmbeddingProgress {
  current: number
  total: number
  message: string
}

export class EmbeddingPipeline {
  private ollama: Ollama
  private onProgress?: (progress: EmbeddingProgress) => void

  constructor(host?: string) {
    this.ollama = new Ollama({
      host: host || process.env.OLLAMA_HOST || 'http://localhost:11434',
    })
  }

  setProgressCallback(callback: (progress: EmbeddingProgress) => void): void {
    this.onProgress = callback
  }

  private emitProgress(progress: EmbeddingProgress): void {
    this.onProgress?.(progress)
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.ollama.embed({
      model: MODEL,
      input: text,
    })
    return response.embeddings[0] ?? []
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.ollama.embed({
      model: MODEL,
      input: texts,
    })
    return response.embeddings
  }

  async embedPosts(
    posts: RedditPost[],
    commentsByPost: Map<string, RedditComment[]>
  ): Promise<EmbeddedPoint[]> {
    const points: EmbeddedPoint[] = []
    const batches: Array<{ text: string; payload: PointPayload }> = []

    for (const post of posts) {
      const comments = commentsByPost.get(post.id) || []
      const topComments = comments
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(c => c.body)

      const text = prepareForEmbedding(post.title, post.selftext, topComments)

      batches.push({
        text,
        payload: {
          id: post.id,
          type: 'post',
          subreddit: post.subreddit,
          title: post.title,
          author: post.author,
          body: post.selftext || '',
          score: post.score,
          created: post.created_utc,
          permalink: `https://reddit.com${post.permalink}`,
        },
      })
    }

    for (let i = 0; i < batches.length; i += BATCH_SIZE) {
      const batch = batches.slice(i, i + BATCH_SIZE)

      this.emitProgress({
        current: Math.min(i + BATCH_SIZE, batches.length),
        total: batches.length,
        message: `Embedding posts ${i + 1}-${Math.min(i + BATCH_SIZE, batches.length)}`,
      })

      const texts = batch.map(b => b.text)
      const embeddings = await this.embedBatch(texts)

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j]
        const embedding = embeddings[j]
        if (item && embedding) {
          points.push({
            id: item.payload.id,
            vector: embedding,
            payload: item.payload,
          })
        }
      }
    }

    return points
  }

  async embedComments(comments: RedditComment[]): Promise<EmbeddedPoint[]> {
    const points: EmbeddedPoint[] = []

    const validComments = comments.filter(
      c => c.body && c.body.length > 20 && c.author !== '[deleted]'
    )

    for (let i = 0; i < validComments.length; i += BATCH_SIZE) {
      const batch = validComments.slice(i, i + BATCH_SIZE)

      this.emitProgress({
        current: Math.min(i + BATCH_SIZE, validComments.length),
        total: validComments.length,
        message: `Embedding comments ${i + 1}-${Math.min(i + BATCH_SIZE, validComments.length)}`,
      })

      const texts = batch.map(c => cleanText(c.body))
      const embeddings = await this.embedBatch(texts)

      for (let j = 0; j < batch.length; j++) {
        const comment = batch[j]
        const embedding = embeddings[j]
        if (comment && embedding) {
          points.push({
            id: comment.id,
            vector: embedding,
            payload: {
              id: comment.id,
              type: 'comment',
              subreddit: comment.subreddit,
              author: comment.author,
              body: comment.body,
              score: comment.score,
              created: comment.created_utc,
              permalink: `https://reddit.com${comment.permalink}`,
              parent_id: comment.parent_id,
            },
          })
        }
      }
    }

    return points
  }

  async checkConnection(requireModel: boolean = false): Promise<boolean> {
    try {
      const result = await this.ollama.list()
      if (!requireModel) return true
      const hasModel = result.models.some(m => m.name.startsWith(MODEL))
      if (!hasModel) return false
      return true
    } catch {
      return false
    }
  }
}

export { VECTOR_DIM }
