import { NextRequest, NextResponse } from 'next/server'
import { EmbeddingPipeline, QdrantStorage } from '@rta/core'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, limit = 10, threshold = 0.5 } = body

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const embeddings = new EmbeddingPipeline()
    const storage = new QdrantStorage()

    const vector = await embeddings.embed(query)
    const results = await storage.search(vector, limit)

    const filtered = results.filter(r => r.score >= threshold)

    return NextResponse.json({ results: filtered })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}
