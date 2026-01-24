import { NextResponse } from 'next/server'
import {
  QdrantStorage,
  SQLiteStorage,
  ClusteringPipeline,
  ProblemSummarizer,
  QuestionExtractor,
} from '@rta/core'

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const PROJECT_ROOT = '/mnt/work/dev/personal-projects/reddit-trend-analyzer'
const SETTINGS_FILE = join(PROJECT_ROOT, 'data', 'settings.json')

function getSettings() {
  try {
    if (existsSync(SETTINGS_FILE)) {
      return JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'))
    }
  } catch {}
  return { summarizationModel: 'llama3.2' }
}

export async function GET() {
  try {
    const sqlite = new SQLiteStorage()
    const clusters = sqlite.getClusters()
    sqlite.close()

    return NextResponse.json({ clusters })
  } catch (error) {
    console.error('Get clusters error:', error)
    return NextResponse.json({ clusters: [] })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const minClusterSize = body.minClusterSize ?? 2
    const similarityThreshold = body.similarityThreshold ?? 0.5

    const qdrant = new QdrantStorage()
    const sqlite = new SQLiteStorage()

    const clustering = new ClusteringPipeline(qdrant)
    const result = await clustering.runClustering({
      minClusterSize,
      similarityThreshold,
      samplesPerCluster: 10,
    })

    if (result.clusters.length === 0) {
      sqlite.close()
      return NextResponse.json({
        success: true,
        message: 'No clusters found',
        clusters: [],
      })
    }

    const settings = getSettings()
    const summarizer = new ProblemSummarizer({ model: settings.summarizationModel })
    const summaries = await summarizer.summarizeClusters(result.clusters)

    sqlite.saveClusters(summaries)

    const extractor = new QuestionExtractor()

    // save questions from both Claude summaries and regex extraction
    for (const summary of summaries) {
      const regexQuestions = extractor.extractFromClusterPoints(
        result.clusters.find(c => c.id === summary.clusterId)?.samples || [],
        summary.clusterId
      )

      // add Claude's sample questions if available
      const claudeQuestions = summary.sampleQuestions.map((q, i) => ({
        id: `claude-${summary.clusterId}-${i}`,
        text: q,
        clusterId: summary.clusterId,
        sourcePointId: 'claude-generated',
        engagement: summary.totalEngagement,
        addressed: false,
      }))

      const allQuestions = [...claudeQuestions, ...regexQuestions]
      if (allQuestions.length > 0) {
        sqlite.saveQuestions(allQuestions)
      }
    }

    sqlite.close()

    return NextResponse.json({
      success: true,
      clusters: summaries,
      stats: result.stats,
    })
  } catch (error) {
    console.error('Clustering error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
