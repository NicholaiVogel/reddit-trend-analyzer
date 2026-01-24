import { NextResponse } from 'next/server'
import { SQLiteStorage } from '@rta/core'

export async function GET() {
  try {
    const sqlite = new SQLiteStorage()
    const questions = sqlite.getQuestions()
    const clusters = sqlite.getClusters()
    sqlite.close()

    const grouped: Record<string, { problem: string; questions: typeof questions }> = {}

    for (const cluster of clusters) {
      grouped[cluster.clusterId] = {
        problem: cluster.problem,
        questions: questions.filter(q => q.clusterId === cluster.clusterId),
      }
    }

    return NextResponse.json({ grouped })
  } catch (error) {
    console.error('Get questions error:', error)
    return NextResponse.json({ grouped: {} })
  }
}
