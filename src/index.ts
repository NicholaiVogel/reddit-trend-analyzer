import { createApp } from './tui/app'

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
    const { Ollama } = await import('ollama')
    const client = new Ollama({
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    })
    const models = await client.list()
    return models.models.some(m => m.name.includes('nomic-embed-text'))
  } catch {
    return false
  }
}

async function checkQdrant(): Promise<boolean> {
  try {
    const { QdrantClient } = await import('@qdrant/js-client-rest')
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333'
    const parsedUrl = new URL(qdrantUrl)

    const client = new QdrantClient({
      host: parsedUrl.hostname,
      port: parsedUrl.port ? parseInt(parsedUrl.port) : (parsedUrl.protocol === 'https:' ? 443 : 6333),
      https: parsedUrl.protocol === 'https:',
      apiKey: process.env.QDRANT_API_KEY,
    })
    await client.getCollections()
    return true
  } catch {
    return false
  }
}

main().catch(err => {
  console.error('fatal error:', err)
  process.exit(1)
})
