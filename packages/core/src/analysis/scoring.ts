import type { Cluster } from '../clustering/types'
import type { ScoringWeights, ScoredCluster } from './types'
import { SentimentAnalyzer } from './sentiment'

const DEFAULT_WEIGHTS: ScoringWeights = {
  engagement: 0.5,
  sentiment: 0.2,
  velocity: 0.3,
}

export class EngagementScorer {
  private weights: ScoringWeights
  private sentimentAnalyzer: SentimentAnalyzer | null = null

  constructor(weights?: Partial<ScoringWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights }
  }

  setWeights(weights: Partial<ScoringWeights>): void {
    this.weights = { ...this.weights, ...weights }
  }

  enableSentiment(): void {
    this.sentimentAnalyzer = new SentimentAnalyzer()
  }

  async scoreClustersAsync(clusters: Cluster[]): Promise<ScoredCluster[]> {
    if (clusters.length === 0) return []

    const maxEngagement = Math.max(...clusters.map(c => c.totalEngagement))
    const now = Math.floor(Date.now() / 1000)
    const oneWeek = 7 * 24 * 60 * 60

    const scored: ScoredCluster[] = []

    for (const cluster of clusters) {
      const engagementScore = maxEngagement > 0
        ? cluster.totalEngagement / maxEngagement
        : 0

      const age = now - cluster.lastActive
      const velocityScore = Math.max(0, 1 - (age / oneWeek))

      let sentimentScore = 0.5
      if (this.sentimentAnalyzer && cluster.samples.length > 0) {
        const sampleTexts = cluster.samples
          .slice(0, 5)
          .map(s => s.payload.title || s.payload.body)
          .filter(Boolean)
        sentimentScore = await this.sentimentAnalyzer.analyzeClusterSentiment(sampleTexts)
      }

      const impactScore =
        this.weights.engagement * engagementScore +
        this.weights.sentiment * sentimentScore +
        this.weights.velocity * velocityScore

      scored.push({
        ...cluster,
        impactScore,
      })
    }

    return scored.sort((a, b) => b.impactScore - a.impactScore)
  }

  scoreClusters(clusters: Cluster[]): ScoredCluster[] {
    if (clusters.length === 0) return []

    const maxEngagement = Math.max(...clusters.map(c => c.totalEngagement))
    const now = Math.floor(Date.now() / 1000)
    const oneWeek = 7 * 24 * 60 * 60

    return clusters.map(cluster => {
      const engagementScore = maxEngagement > 0
        ? cluster.totalEngagement / maxEngagement
        : 0

      const age = now - cluster.lastActive
      const velocityScore = Math.max(0, 1 - (age / oneWeek))

      const sentimentScore = 0.5

      const impactScore =
        this.weights.engagement * engagementScore +
        this.weights.sentiment * sentimentScore +
        this.weights.velocity * velocityScore

      return {
        ...cluster,
        impactScore,
      }
    }).sort((a, b) => b.impactScore - a.impactScore)
  }

  rankByEngagement(clusters: Cluster[]): Cluster[] {
    return [...clusters].sort((a, b) => b.totalEngagement - a.totalEngagement)
  }

  rankByRecency(clusters: Cluster[]): Cluster[] {
    return [...clusters].sort((a, b) => b.lastActive - a.lastActive)
  }

  rankBySize(clusters: Cluster[]): Cluster[] {
    return [...clusters].sort((a, b) => b.size - a.size)
  }
}
