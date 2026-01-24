import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { ProblemSummary, ExtractedQuestion } from '../analysis/types'

function getDefaultDbPath(): string {
  // use env var if set, otherwise use hardcoded path relative to monorepo
  if (process.env.SQLITE_DB_PATH) {
    return process.env.SQLITE_DB_PATH
  }

  // hardcode the path for this project
  const projectRoot = '/mnt/work/dev/personal-projects/reddit-trend-analyzer'
  const dataDir = join(projectRoot, 'data')

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  return join(dataDir, 'reddit-trends.db')
}

export interface ScrapeHistoryRecord {
  id: number
  subreddit: string
  url: string
  postsScraped: number
  commentsScraped: number
  startedAt: number
  completedAt: number | null
}

export interface ClusterRecord {
  id: number
  problem: string
  description: string
  keywords: string
  sampleQuestions: string
  actionableInsight: string
  size: number
  totalEngagement: number
  lastActive: number
  subreddits: string
  samplePointIds: string
  createdAt: number
}

export class SQLiteStorage {
  private db: Database.Database

  constructor(dbPath?: string) {
    this.db = new Database(dbPath || getDefaultDbPath())
    this.initialize()
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clusters (
        id INTEGER PRIMARY KEY,
        problem TEXT NOT NULL,
        description TEXT,
        keywords TEXT,
        sample_questions TEXT,
        actionable_insight TEXT,
        size INTEGER NOT NULL,
        total_engagement INTEGER NOT NULL,
        last_active INTEGER NOT NULL,
        subreddits TEXT,
        sample_point_ids TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        cluster_id INTEGER,
        source_point_id TEXT,
        engagement INTEGER NOT NULL DEFAULT 0,
        addressed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (cluster_id) REFERENCES clusters(id)
      );

      CREATE TABLE IF NOT EXISTS scrape_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subreddit TEXT NOT NULL,
        url TEXT NOT NULL,
        posts_scraped INTEGER NOT NULL DEFAULT 0,
        comments_scraped INTEGER NOT NULL DEFAULT 0,
        started_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_questions_cluster ON questions(cluster_id);
      CREATE INDEX IF NOT EXISTS idx_questions_addressed ON questions(addressed);
      CREATE INDEX IF NOT EXISTS idx_scrape_history_subreddit ON scrape_history(subreddit);
    `)

    // migration: add sample_point_ids column if missing (for existing databases)
    try {
      const columns = this.db.pragma('table_info(clusters)') as { name: string }[]
      const hasSamplePointIds = columns.some(c => c.name === 'sample_point_ids')
      if (!hasSamplePointIds) {
        this.db.exec('ALTER TABLE clusters ADD COLUMN sample_point_ids TEXT')
      }
    } catch {
      // table might not exist yet, that's fine
    }
  }

  saveClusters(summaries: ProblemSummary[]): void {
    this.db.exec('DELETE FROM clusters')

    const insert = this.db.prepare(`
      INSERT INTO clusters (id, problem, description, keywords, sample_questions,
        actionable_insight, size, total_engagement, last_active, subreddits, sample_point_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertMany = this.db.transaction((items: ProblemSummary[]) => {
      for (const s of items) {
        insert.run(
          s.clusterId,
          s.problem,
          s.description,
          JSON.stringify(s.keywords),
          JSON.stringify(s.sampleQuestions),
          s.actionableInsight,
          s.size,
          s.totalEngagement,
          s.lastActive,
          JSON.stringify(s.subreddits),
          JSON.stringify(s.samplePointIds || [])
        )
      }
    })

    insertMany(summaries)
  }

  getClusters(): ProblemSummary[] {
    const rows = this.db.prepare(`
      SELECT * FROM clusters ORDER BY total_engagement DESC
    `).all() as any[]

    return rows.map(row => ({
      clusterId: row.id,
      problem: row.problem,
      description: row.description,
      keywords: JSON.parse(row.keywords || '[]'),
      sampleQuestions: JSON.parse(row.sample_questions || '[]'),
      actionableInsight: row.actionable_insight,
      size: row.size,
      totalEngagement: row.total_engagement,
      lastActive: row.last_active,
      subreddits: JSON.parse(row.subreddits || '[]'),
      samplePointIds: JSON.parse(row.sample_point_ids || '[]'),
    }))
  }

  getCluster(id: number): ProblemSummary | null {
    const row = this.db.prepare(`
      SELECT * FROM clusters WHERE id = ?
    `).get(id) as any | undefined

    if (!row) return null

    return {
      clusterId: row.id,
      problem: row.problem,
      description: row.description,
      keywords: JSON.parse(row.keywords || '[]'),
      sampleQuestions: JSON.parse(row.sample_questions || '[]'),
      actionableInsight: row.actionable_insight,
      size: row.size,
      totalEngagement: row.total_engagement,
      lastActive: row.last_active,
      subreddits: JSON.parse(row.subreddits || '[]'),
      samplePointIds: JSON.parse(row.sample_point_ids || '[]'),
    }
  }

  saveQuestions(questions: ExtractedQuestion[]): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO questions (id, text, cluster_id, source_point_id, engagement, addressed)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const insertMany = this.db.transaction((items: ExtractedQuestion[]) => {
      for (const q of items) {
        insert.run(q.id, q.text, q.clusterId, q.sourcePointId, q.engagement, q.addressed ? 1 : 0)
      }
    })

    insertMany(questions)
  }

  getQuestions(clusterId?: number): ExtractedQuestion[] {
    let rows
    if (clusterId !== undefined) {
      rows = this.db.prepare(`
        SELECT * FROM questions WHERE cluster_id = ? ORDER BY engagement DESC
      `).all(clusterId) as any[]
    } else {
      rows = this.db.prepare(`
        SELECT * FROM questions ORDER BY engagement DESC
      `).all() as any[]
    }

    return rows.map(row => ({
      id: row.id,
      text: row.text,
      clusterId: row.cluster_id,
      sourcePointId: row.source_point_id,
      engagement: row.engagement,
      addressed: row.addressed === 1,
    }))
  }

  markQuestionAddressed(id: string, addressed: boolean = true): void {
    this.db.prepare(`
      UPDATE questions SET addressed = ? WHERE id = ?
    `).run(addressed ? 1 : 0, id)
  }

  startScrape(subreddit: string, url: string): number {
    const result = this.db.prepare(`
      INSERT INTO scrape_history (subreddit, url, started_at)
      VALUES (?, ?, strftime('%s', 'now'))
    `).run(subreddit, url)

    return Number(result.lastInsertRowid)
  }

  completeScrape(id: number, postsScraped: number, commentsScraped: number): void {
    this.db.prepare(`
      UPDATE scrape_history
      SET posts_scraped = ?, comments_scraped = ?, completed_at = strftime('%s', 'now')
      WHERE id = ?
    `).run(postsScraped, commentsScraped, id)
  }

  getScrapeHistory(limit: number = 50): ScrapeHistoryRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM scrape_history ORDER BY started_at DESC LIMIT ?
    `).all(limit) as any[]

    return rows.map(row => ({
      id: row.id,
      subreddit: row.subreddit,
      url: row.url,
      postsScraped: row.posts_scraped,
      commentsScraped: row.comments_scraped,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }))
  }

  getStats(): { clusterCount: number; questionCount: number; addressedCount: number } {
    const clusters = this.db.prepare('SELECT COUNT(*) as count FROM clusters').get() as { count: number }
    const questions = this.db.prepare('SELECT COUNT(*) as count FROM questions').get() as { count: number }
    const addressed = this.db.prepare('SELECT COUNT(*) as count FROM questions WHERE addressed = 1').get() as { count: number }

    return {
      clusterCount: clusters.count,
      questionCount: questions.count,
      addressedCount: addressed.count,
    }
  }

  close(): void {
    this.db.close()
  }
}
