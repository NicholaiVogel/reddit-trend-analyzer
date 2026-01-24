import { NextResponse } from 'next/server'
import { QdrantStorage, SQLiteStorage } from '@rta/core'

export async function GET() {
  try {
    const qdrant = new QdrantStorage()
    const sqlite = new SQLiteStorage()

    const qdrantStats = await qdrant.getStats()
    const sqliteStats = sqlite.getStats()
    sqlite.close()

    return NextResponse.json({
      posts: qdrantStats.posts,
      comments: qdrantStats.comments,
      subreddits: qdrantStats.subreddits,
      clusters: sqliteStats.clusterCount,
      questions: sqliteStats.questionCount,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({
      posts: 0,
      comments: 0,
      subreddits: [],
      clusters: 0,
      questions: 0,
    })
  }
}
