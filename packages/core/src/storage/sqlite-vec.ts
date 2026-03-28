import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { load as loadSqliteVec } from 'sqlite-vec'
import type { EmbeddedPoint } from '../embeddings/ollama'
import { VECTOR_DIM } from '../embeddings/ollama'
import type { PointPayload, SearchResult, CollectionStats } from './types'
import type { ClusterPoint } from '../clustering/types'

const COLLECTION_NAME = 'reddit_trends'

function getDefaultVectorDbPath(): string {
  if (process.env.SQLITE_VEC_DB_PATH) {
    return process.env.SQLITE_VEC_DB_PATH
  }

  const cwdDataDir = join(process.cwd(), 'data')
  if (existsSync(cwdDataDir)) {
    return join(cwdDataDir, 'reddit-vectors.db')
  }

  const projectRoot = resolve(import.meta.dir, '../../../../')
  const dataDir = join(projectRoot, 'data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  return join(dataDir, 'reddit-vectors.db')
}

type VectorRow = {
  id: string
  vector: string
  payload: string
}

type ExistingRow = {
  rowid: number
}

type VectorKnnRow = {
  id: string
  payload: string
  distance: number
}

export class SQLiteVecStorage {
  private db: Database
  private extensionLoaded: boolean

  constructor(dbPath?: string) {
    this.db = new Database(dbPath || getDefaultVectorDbPath())
    this.extensionLoaded = false
    this.tryLoadVecExtension()
    this.initialize()
  }

  private tryLoadVecExtension(): void {
    try {
      loadSqliteVec(this.db)
      this.extensionLoaded = true
    } catch {
      this.extensionLoaded = false
    }
  }

  private initialize(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS vector_points (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        subreddit TEXT NOT NULL,
        score INTEGER NOT NULL,
        created INTEGER NOT NULL,
        vector TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_vector_points_type ON vector_points(type);
      CREATE INDEX IF NOT EXISTS idx_vector_points_subreddit ON vector_points(subreddit);
      CREATE INDEX IF NOT EXISTS idx_vector_points_score ON vector_points(score);
      CREATE INDEX IF NOT EXISTS idx_vector_points_created ON vector_points(created);
    `)

    if (this.extensionLoaded) {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vector_embeddings
        USING vec0(embedding float[${VECTOR_DIM}]);
      `)
    }
  }

  async ensureCollection(): Promise<void> {
    this.initialize()
  }

  async upsertPoints(points: EmbeddedPoint[]): Promise<void> {
    const findRowById = this.db.prepare(`
      SELECT rowid as rowid FROM vector_points WHERE id = ?
    `)

    const insertPoint = this.db.prepare(`
      INSERT INTO vector_points (id, type, subreddit, score, created, vector, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const updatePoint = this.db.prepare(`
      UPDATE vector_points
      SET type = ?, subreddit = ?, score = ?, created = ?, vector = ?, payload = ?
      WHERE rowid = ?
    `)

    const deleteEmbedding = this.extensionLoaded
      ? this.db.prepare('DELETE FROM vector_embeddings WHERE rowid = ?')
      : null
    const insertEmbedding = this.extensionLoaded
      ? this.db.prepare('INSERT INTO vector_embeddings(rowid, embedding) VALUES (?, ?)')
      : null

    const tx = this.db.transaction((items: EmbeddedPoint[]) => {
      for (const point of items) {
        const storageId = `${point.payload.type}:${point.id}`
        const vectorJson = JSON.stringify(point.vector)
        const payloadJson = JSON.stringify(point.payload)

        const existing = findRowById.get(storageId) as ExistingRow | null
        let rowid: number

        if (existing && Number.isFinite(existing.rowid)) {
          rowid = Number(existing.rowid)
          updatePoint.run(
            point.payload.type,
            point.payload.subreddit,
            point.payload.score,
            point.payload.created,
            vectorJson,
            payloadJson,
            rowid
          )
        } else {
          const insertResult = insertPoint.run(
            storageId,
            point.payload.type,
            point.payload.subreddit,
            point.payload.score,
            point.payload.created,
            vectorJson,
            payloadJson
          )
          rowid = Number(insertResult.lastInsertRowid)
        }

        if (this.extensionLoaded && deleteEmbedding && insertEmbedding) {
          deleteEmbedding.run(rowid)
          insertEmbedding.run(rowid, this.toFloat32(point.vector))
        }
      }
    })

    tx(points)
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
    if (this.extensionLoaded) {
      try {
        return this.searchWithVec(vector, limit, filters)
      } catch {
        return this.searchWithFallback(vector, limit, filters)
      }
    }

    return this.searchWithFallback(vector, limit, filters)
  }

  private searchWithVec(
    vector: number[],
    limit: number,
    filters?: {
      subreddit?: string
      type?: 'post' | 'comment'
      minScore?: number
      afterDate?: number
    }
  ): SearchResult[] {
    const params: (Float32Array | string | number)[] = []
    const where: string[] = []

    params.push(this.toFloat32(vector))
    params.push(Math.max(limit * 10, 100))

    if (filters?.subreddit) {
      where.push('p.subreddit = ?')
      params.push(filters.subreddit)
    }

    if (filters?.type) {
      where.push('p.type = ?')
      params.push(filters.type)
    }

    if (filters?.minScore !== undefined) {
      where.push('p.score >= ?')
      params.push(filters.minScore)
    }

    if (filters?.afterDate !== undefined) {
      where.push('p.created >= ?')
      params.push(filters.afterDate)
    }

    const sql = `
      SELECT p.id, p.payload, v.distance
      FROM vector_embeddings v
      JOIN vector_points p ON p.rowid = v.rowid
      WHERE v.embedding MATCH ? AND k = ?
      ${where.length > 0 ? `AND ${where.join(' AND ')}` : ''}
      ORDER BY v.distance ASC
      LIMIT ?
    `

    params.push(limit)
    const rows = this.db.prepare(sql).all(...params) as VectorKnnRow[]

    return rows.map((row) => ({
      id: row.id,
      score: 1 / (1 + row.distance),
      payload: JSON.parse(row.payload) as PointPayload,
    }))
  }

  private searchWithFallback(
    vector: number[],
    limit: number,
    filters?: {
      subreddit?: string
      type?: 'post' | 'comment'
      minScore?: number
      afterDate?: number
    }
  ): SearchResult[] {
    const params: (string | number)[] = []
    const where: string[] = []

    if (filters?.subreddit) {
      where.push('subreddit = ?')
      params.push(filters.subreddit)
    }

    if (filters?.type) {
      where.push('type = ?')
      params.push(filters.type)
    }

    if (filters?.minScore !== undefined) {
      where.push('score >= ?')
      params.push(filters.minScore)
    }

    if (filters?.afterDate !== undefined) {
      where.push('created >= ?')
      params.push(filters.afterDate)
    }

    const sql = `
      SELECT id, vector, payload
      FROM vector_points
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    `

    const rows = this.db.prepare(sql).all(...params) as VectorRow[]
    const scored = rows.map((row) => {
      const candidate = JSON.parse(row.vector) as number[]
      const payload = JSON.parse(row.payload) as PointPayload
      return {
        id: row.id,
        score: this.cosineSimilarity(vector, candidate),
        payload,
      }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, limit)
  }

  async getStats(): Promise<CollectionStats> {
    const postCount = this.db.prepare('SELECT COUNT(*) as count FROM vector_points WHERE type = ?').get('post') as { count: number }
    const commentCount = this.db.prepare('SELECT COUNT(*) as count FROM vector_points WHERE type = ?').get('comment') as { count: number }
    const subredditRows = this.db.prepare('SELECT DISTINCT subreddit FROM vector_points ORDER BY subreddit').all() as { subreddit: string }[]

    return {
      posts: postCount.count,
      comments: commentCount.count,
      subreddits: subredditRows.map((row) => row.subreddit),
    }
  }

  async deleteCollection(): Promise<void> {
    this.db.exec('DELETE FROM vector_points')
    if (this.extensionLoaded) {
      this.db.exec('DELETE FROM vector_embeddings')
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      if (!this.extensionLoaded) return false
      this.db.query('SELECT vec_version() as version').get()
      return true
    } catch {
      return false
    }
  }

  async getPointsByIds(ids: (string | number)[]): Promise<PointPayload[]> {
    if (ids.length === 0) return []

    const normalizedIds = ids.map((id) => String(id))
    const placeholders = normalizedIds.map(() => '?').join(', ')
    const rows = this.db.prepare(`
      SELECT payload FROM vector_points WHERE id IN (${placeholders})
    `).all(...normalizedIds) as { payload: string }[]

    return rows.map((row) => JSON.parse(row.payload) as PointPayload)
  }

  async scrollWithVectors(batchSize: number = 100): Promise<ClusterPoint[]> {
    const points: ClusterPoint[] = []
    let offset = 0

    while (true) {
      const rows = this.db.prepare(`
        SELECT id, vector, payload
        FROM vector_points
        ORDER BY rowid
        LIMIT ?
        OFFSET ?
      `).all(batchSize, offset) as VectorRow[]

      if (rows.length === 0) break

      for (const row of rows) {
        points.push({
          id: row.id,
          vector: JSON.parse(row.vector) as number[],
          payload: JSON.parse(row.payload) as PointPayload,
        })
      }

      offset += rows.length
      if (rows.length < batchSize) break
    }

    return points
  }

  close(): void {
    this.db.close()
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      const av = a[i] ?? 0
      const bv = b[i] ?? 0
      dot += av * bv
      normA += av * av
      normB += bv * bv
    }

    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  private toFloat32(vector: number[]): Float32Array {
    const typed = new Float32Array(VECTOR_DIM)
    for (let i = 0; i < VECTOR_DIM; i++) {
      typed[i] = vector[i] ?? 0
    }
    return typed
  }
}

export { COLLECTION_NAME }
