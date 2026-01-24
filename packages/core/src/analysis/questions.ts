import type { ClusterPoint, Cluster } from '../clustering/types'
import type { ExtractedQuestion } from './types'
import type { EmbeddingPipeline } from '../embeddings/ollama'

const QUESTION_PATTERNS = [
  /how (?:do|can|should|would) (?:i|we|you)/i,
  /why (?:does|is|are|do|did)/i,
  /what (?:is|are|should|would|does)/i,
  /is there (?:a|any|an) way/i,
  /can (?:i|you|we|someone)/i,
  /should (?:i|we)/i,
  /what's the (?:best|easiest|fastest)/i,
  /does anyone (?:know|have)/i,
  /has anyone (?:tried|used|done)/i,
  /any (?:suggestions|recommendations|ideas|tips)/i,
  /help (?:with|me)/i,
  /\?$/,
]

const DEDUP_SIMILARITY_THRESHOLD = 0.9

export class QuestionExtractor {
  private embeddings?: EmbeddingPipeline

  constructor(embeddings?: EmbeddingPipeline) {
    this.embeddings = embeddings
  }

  extractQuestionsFromText(text: string): string[] {
    const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 10)
    const questions: string[] = []

    for (const sentence of sentences) {
      for (const pattern of QUESTION_PATTERNS) {
        if (pattern.test(sentence)) {
          const cleaned = sentence.replace(/^\s*[-*•]\s*/, '').trim()
          if (cleaned.length > 15 && cleaned.length < 500) {
            questions.push(cleaned)
          }
          break
        }
      }
    }

    return questions
  }

  extractFromClusterPoints(points: ClusterPoint[], clusterId: number): ExtractedQuestion[] {
    const questions: ExtractedQuestion[] = []
    let questionId = 0

    for (const point of points) {
      const text = point.payload.title
        ? `${point.payload.title} ${point.payload.body}`
        : point.payload.body

      const extracted = this.extractQuestionsFromText(text)

      for (const q of extracted) {
        questions.push({
          id: `q-${clusterId}-${questionId++}`,
          text: q,
          clusterId,
          sourcePointId: point.id,
          engagement: point.payload.score,
          addressed: false,
        })
      }
    }

    return questions.sort((a, b) => b.engagement - a.engagement)
  }

  extractFromClusters(clusters: Cluster[]): Map<number, ExtractedQuestion[]> {
    const questionsByCluster = new Map<number, ExtractedQuestion[]>()

    for (const cluster of clusters) {
      const questions = this.extractFromClusterPoints(cluster.samples, cluster.id)
      questionsByCluster.set(cluster.id, questions)
    }

    return questionsByCluster
  }

  async deduplicateQuestions(questions: ExtractedQuestion[]): Promise<ExtractedQuestion[]> {
    if (!this.embeddings || questions.length <= 1) {
      return questions
    }

    const texts = questions.map(q => q.text)
    const embeddings = await this.embeddings.embedBatch(texts)

    const deduped: ExtractedQuestion[] = []
    const used = new Set<number>()

    for (let i = 0; i < questions.length; i++) {
      if (used.has(i)) continue

      const question = questions[i]
      const embedding = embeddings[i]
      if (!question || !embedding) continue

      deduped.push(question)
      used.add(i)

      for (let j = i + 1; j < questions.length; j++) {
        if (used.has(j)) continue

        const otherEmbedding = embeddings[j]
        if (!otherEmbedding) continue

        const similarity = this.cosineSimilarity(embedding, otherEmbedding)
        if (similarity >= DEDUP_SIMILARITY_THRESHOLD) {
          used.add(j)
        }
      }
    }

    return deduped
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0
      const bVal = b[i] ?? 0
      dotProduct += aVal * bVal
      normA += aVal * aVal
      normB += bVal * bVal
    }

    if (normA === 0 || normB === 0) return 0
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}
