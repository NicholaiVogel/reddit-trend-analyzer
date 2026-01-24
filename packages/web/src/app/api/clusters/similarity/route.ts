import { NextResponse } from 'next/server'
import { SQLiteStorage, computeKeywordSimilarity } from '@rta/core'

export async function GET() {
  try {
    const sqlite = new SQLiteStorage()
    const clusters = sqlite.getClusters()
    sqlite.close()

    if (clusters.length === 0) {
      return NextResponse.json({ matrix: [], labels: [], clusterIds: [] })
    }

    const similarity = computeKeywordSimilarity(clusters)
    return NextResponse.json(similarity)
  } catch (error) {
    console.error('Similarity computation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
