import { QdrantClient } from '@qdrant/js-client-rest'
import type { EmbeddedPoint } from '../embeddings/ollama'
import type { PointPayload, SearchResult, CollectionStats } from './types'
import { VECTOR_DIM } from '../embeddings/ollama'

const COLLECTION_NAME = 'reddit_trends'
const BATCH_SIZE = 100

export class QdrantStorage {
  private client: QdrantClient
  private collectionName: string

  constructor(url?: string, apiKey?: string, collectionName?: string) {
    const qdrantUrl = url || process.env.QDRANT_URL || 'http://localhost:6333'
    const parsedUrl = new URL(qdrantUrl)

    this.client = new QdrantClient({
      host: parsedUrl.hostname,
      port: parsedUrl.port ? parseInt(parsedUrl.port) : (parsedUrl.protocol === 'https:' ? 443 : 6333),
      https: parsedUrl.protocol === 'https:',
      apiKey: apiKey || process.env.QDRANT_API_KEY,
    })
    this.collectionName = collectionName || COLLECTION_NAME
  }

  async ensureCollection(): Promise<void> {
    const collections = await this.client.getCollections()
    const exists = collections.collections.some(c => c.name === this.collectionName)

    if (!exists) {
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: VECTOR_DIM,
          distance: 'Cosine',
        },
      })

      await this.client.createPayloadIndex(this.collectionName, {
        field_name: 'subreddit',
        field_schema: 'keyword',
      })

      await this.client.createPayloadIndex(this.collectionName, {
        field_name: 'type',
        field_schema: 'keyword',
      })

      await this.client.createPayloadIndex(this.collectionName, {
        field_name: 'created',
        field_schema: 'integer',
      })

      await this.client.createPayloadIndex(this.collectionName, {
        field_name: 'score',
        field_schema: 'integer',
      })
    }
  }

  async upsertPoints(points: EmbeddedPoint[]): Promise<void> {
    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE)

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: batch.map((point, idx) => ({
          id: i + idx,
          vector: point.vector,
          payload: point.payload as unknown as Record<string, unknown>,
        })),
      })
    }
  }

  async search(
    vector: number[],
    limit: number = 10,
    filters?: {
      subreddit?: string
      type?: 'post' | 'comment'
      minScore?: number
      afterDate?: number
    }
  ): Promise<SearchResult[]> {
    const must: any[] = []

    if (filters?.subreddit) {
      must.push({
        key: 'subreddit',
        match: { value: filters.subreddit },
      })
    }

    if (filters?.type) {
      must.push({
        key: 'type',
        match: { value: filters.type },
      })
    }

    if (filters?.minScore !== undefined) {
      must.push({
        key: 'score',
        range: { gte: filters.minScore },
      })
    }

    if (filters?.afterDate !== undefined) {
      must.push({
        key: 'created',
        range: { gte: filters.afterDate },
      })
    }

    const results = await this.client.search(this.collectionName, {
      vector,
      limit,
      with_payload: true,
      filter: must.length > 0 ? { must } : undefined,
    })

    return results.map(r => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload as unknown as PointPayload,
    }))
  }

  async getStats(): Promise<CollectionStats> {
    try {
      const info = await this.client.getCollection(this.collectionName)
      const pointCount = info.points_count || 0

      const postCount = await this.client.count(this.collectionName, {
        filter: { must: [{ key: 'type', match: { value: 'post' } }] },
      })

      const commentCount = await this.client.count(this.collectionName, {
        filter: { must: [{ key: 'type', match: { value: 'comment' } }] },
      })

      const scroll = await this.client.scroll(this.collectionName, {
        limit: 1000,
        with_payload: { include: ['subreddit'] },
      })

      const subreddits = new Set<string>()
      for (const point of scroll.points) {
        const payload = point.payload as { subreddit?: string }
        if (payload?.subreddit) {
          subreddits.add(payload.subreddit)
        }
      }

      return {
        posts: postCount.count,
        comments: commentCount.count,
        subreddits: Array.from(subreddits),
      }
    } catch {
      return { posts: 0, comments: 0, subreddits: [] }
    }
  }

  async deleteCollection(): Promise<void> {
    try {
      await this.client.deleteCollection(this.collectionName)
    } catch {
      // collection might not exist
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.client.getCollections()
      return true
    } catch {
      return false
    }
  }
}

export { COLLECTION_NAME }
