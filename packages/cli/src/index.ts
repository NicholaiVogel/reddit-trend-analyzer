import { createApp } from './tui/app'
import { EmbeddingPipeline, QdrantStorage } from '@rta/core'

async function main() {
  console.clear()

  const ollamaOk = await checkOllama()
  if (!ollamaOk) {
    console.error('error: cannot connect to ollama at', process.env.OLLAMA_HOST || 'http://localhost:11434')
    console.error('make sure ollama is running and nomic-embed-text model is available')
    console.error('run: ollama pull nomic-embed-text')
    process.exit(1)
  }

  const qdrantOk = await checkQdrant()
  if (!qdrantOk) {
    console.error('error: cannot connect to qdrant at', process.env.QDRANT_URL || 'http://localhost:6333')
    console.error('make sure qdrant is running and QDRANT_API_KEY is set if required')
    process.exit(1)
  }

  await createApp()
}

async function checkOllama(): Promise<boolean> {
  try {
    const embeddings = new EmbeddingPipeline()
    return await embeddings.checkConnection()
  } catch {
    return false
  }
}

async function checkQdrant(): Promise<boolean> {
  try {
    const storage = new QdrantStorage()
    return await storage.checkConnection()
  } catch {
    return false
  }
}

main().catch(err => {
  console.error('fatal error:', err)
  process.exit(1)
})
