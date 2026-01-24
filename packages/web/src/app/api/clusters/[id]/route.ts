import { NextRequest, NextResponse } from 'next/server'
import { SQLiteStorage, QdrantStorage } from '@rta/core'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const clusterId = parseInt(id, 10)

    const sqlite = new SQLiteStorage()
    const cluster = sqlite.getCluster(clusterId)
    const questions = sqlite.getQuestions(clusterId)
    sqlite.close()

    if (!cluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
    }

    // fetch actual discussions from qdrant if we have sample point IDs
    let samples: any[] = []
    if (cluster.samplePointIds && cluster.samplePointIds.length > 0) {
      try {
        const qdrant = new QdrantStorage()
        samples = await qdrant.getPointsByIds(cluster.samplePointIds)
      } catch (e) {
        console.error('Failed to fetch samples from qdrant:', e)
      }
    }

    return NextResponse.json({ cluster, questions, samples })
  } catch (error) {
    console.error('Get cluster error:', error)
    return NextResponse.json({ error: 'Failed to get cluster' }, { status: 500 })
  }
}
