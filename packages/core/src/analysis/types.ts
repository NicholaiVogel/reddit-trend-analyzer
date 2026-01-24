import type { Cluster } from '../clustering/types'

export interface ProblemSummary {
  clusterId: number
  problem: string
  description: string
  keywords: string[]
  sampleQuestions: string[]
  actionableInsight: string
  size: number
  totalEngagement: number
  lastActive: number
  subreddits: string[]
  samplePointIds?: string[]
}

export interface ExtractedQuestion {
  id: string
  text: string
  clusterId: number
  sourcePointId: string
  engagement: number
  addressed: boolean
}

export interface ScoringWeights {
  engagement: number
  sentiment: number
  velocity: number
}

export interface ScoredCluster extends Cluster {
  impactScore: number
}

export interface SummarizationProgress {
  current: number
  total: number
  message: string
}
