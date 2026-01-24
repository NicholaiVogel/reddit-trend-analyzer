import { Ollama } from 'ollama'
import { RateLimiter } from '../utils/rate-limit'

const DEFAULT_MODEL = 'llama3.2'
const BATCH_SIZE = 5

type Sentiment = 'positive' | 'neutral' | 'negative'

export class SentimentAnalyzer {
  private ollama: Ollama
  private model: string
  private rateLimiter: RateLimiter
  private cache: Map<string, number>

  constructor(options?: { host?: string; model?: string }) {
    this.ollama = new Ollama({
      host: options?.host || process.env.OLLAMA_HOST || 'http://localhost:11434',
    })
    this.model = options?.model || DEFAULT_MODEL
    this.rateLimiter = new RateLimiter(500)
    this.cache = new Map()
  }

  private sentimentToScore(sentiment: Sentiment): number {
    switch (sentiment) {
      case 'positive': return 1.0
      case 'neutral': return 0.5
      case 'negative': return 0.0
      default: return 0.5
    }
  }

  private parseSentiment(response: string): Sentiment {
    const lower = response.toLowerCase().trim()
    if (lower.includes('positive')) return 'positive'
    if (lower.includes('negative')) return 'negative'
    return 'neutral'
  }

  private textKey(text: string): string {
    return text.slice(0, 200)
  }

  async analyzeSingle(text: string): Promise<number> {
    const key = this.textKey(text)
    const cached = this.cache.get(key)
    if (cached !== undefined) return cached

    await this.rateLimiter.wait()

    try {
      const response = await this.ollama.generate({
        model: this.model,
        prompt: `Analyze the sentiment of this text. Return only one word: positive, negative, or neutral.\n\nText: "${text.slice(0, 500)}"`,
        stream: false,
      })

      const sentiment = this.parseSentiment(response.response)
      const score = this.sentimentToScore(sentiment)
      this.cache.set(key, score)
      return score
    } catch (err) {
      return 0.5
    }
  }

  async analyzeBatch(texts: string[]): Promise<number[]> {
    const results: number[] = []

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(text => this.analyzeSingle(text))
      )
      results.push(...batchResults)
    }

    return results
  }

  async analyzeClusterSentiment(sampleTexts: string[]): Promise<number> {
    if (sampleTexts.length === 0) return 0.5

    const scores = await this.analyzeBatch(sampleTexts)
    const sum = scores.reduce((a, b) => a + b, 0)
    return sum / scores.length
  }

  async checkConnection(): Promise<boolean> {
    try {
      const result = await this.ollama.list()
      return result.models.some(m => m.name.startsWith(this.model))
    } catch {
      return false
    }
  }
}
