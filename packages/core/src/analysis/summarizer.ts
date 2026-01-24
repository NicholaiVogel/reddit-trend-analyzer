import { Ollama } from 'ollama'
import type { Cluster } from '../clustering/types'
import type { ProblemSummary, SummarizationProgress } from './types'
import { delay } from '../utils/rate-limit'

const DEFAULT_MODEL = 'llama3.2'
const RATE_LIMIT_DELAY = 500

const SYSTEM_PROMPT = `You are an expert at identifying recurring problems from online discussions.
Given a cluster of related discussions from Reddit, extract the common problem pattern.

Respond ONLY with valid JSON in this exact format:
{
  "problem": "concise one-line problem statement (max 100 chars)",
  "description": "2-3 sentences explaining the problem",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "sampleQuestions": ["question 1?", "question 2?", "question 3?"],
  "actionableInsight": "brief suggestion for content/tool opportunity"
}`

interface SummaryResponse {
  problem: string
  description: string
  keywords: string[]
  sampleQuestions: string[]
  actionableInsight: string
}

export class ProblemSummarizer {
  private ollama: Ollama
  private model: string
  private onProgress?: (progress: SummarizationProgress) => void

  constructor(options?: { host?: string; model?: string }) {
    this.ollama = new Ollama({
      host: options?.host || process.env.OLLAMA_HOST || 'http://localhost:11434',
    })
    this.model = options?.model || DEFAULT_MODEL
  }

  setProgressCallback(callback: (progress: SummarizationProgress) => void): void {
    this.onProgress = callback
  }

  private emitProgress(progress: SummarizationProgress): void {
    this.onProgress?.(progress)
  }

  async summarizeCluster(cluster: Cluster): Promise<ProblemSummary> {
    const sampleTexts = cluster.samples
      .slice(0, 5)
      .map((sample, i) => {
        const title = sample.payload.title || ''
        const body = sample.payload.body.slice(0, 300)
        const score = sample.payload.score
        return `[${score} upvotes] ${title}\n${body}`
      })
      .join('\n\n')

    const prompt = `${SYSTEM_PROMPT}

Analyze these ${cluster.size} related discussions from r/${cluster.subreddits.join(', r/')}:

${sampleTexts}

JSON response:`

    const response = await this.ollama.generate({
      model: this.model,
      prompt,
      stream: false,
    })

    let parsed: SummaryResponse
    try {
      const jsonMatch = response.response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      parsed = JSON.parse(jsonMatch[0])
    } catch (e) {
      parsed = {
        problem: `Cluster ${cluster.id} discussion pattern`,
        description: 'Unable to extract summary from cluster.',
        keywords: cluster.subreddits,
        sampleQuestions: [],
        actionableInsight: 'Review cluster manually.',
      }
    }

    return {
      clusterId: cluster.id,
      problem: parsed.problem || `Cluster ${cluster.id}`,
      description: parsed.description || '',
      keywords: parsed.keywords || [],
      sampleQuestions: parsed.sampleQuestions || [],
      actionableInsight: parsed.actionableInsight || '',
      size: cluster.size,
      totalEngagement: cluster.totalEngagement,
      lastActive: cluster.lastActive,
      subreddits: cluster.subreddits,
      samplePointIds: cluster.samples.map(s => s.id),
    }
  }

  async summarizeClusters(clusters: Cluster[]): Promise<ProblemSummary[]> {
    const summaries: ProblemSummary[] = []

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]
      if (!cluster) continue

      this.emitProgress({
        current: i + 1,
        total: clusters.length,
        message: `Summarizing cluster ${i + 1}/${clusters.length}`,
      })

      try {
        const summary = await this.summarizeCluster(cluster)
        summaries.push(summary)
      } catch (error) {
        console.error(`Failed to summarize cluster ${cluster.id}:`, error)
        summaries.push({
          clusterId: cluster.id,
          problem: `Cluster ${cluster.id} (summary failed)`,
          description: 'Failed to generate summary for this cluster.',
          keywords: [],
          sampleQuestions: [],
          actionableInsight: '',
          size: cluster.size,
          totalEngagement: cluster.totalEngagement,
          lastActive: cluster.lastActive,
          subreddits: cluster.subreddits,
          samplePointIds: cluster.samples.map(s => s.id),
        })
      }

      if (i < clusters.length - 1) {
        await delay(RATE_LIMIT_DELAY)
      }
    }

    return summaries
  }
}
