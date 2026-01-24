import type { PointPayload } from '../storage/types'

export interface ClusterPoint {
  id: string
  vector: number[]
  payload: PointPayload
}

export interface Cluster {
  id: number
  size: number
  centroid: number[]
  totalEngagement: number
  lastActive: number
  subreddits: string[]
  samples: ClusterPoint[]
}

export interface ClusteringOptions {
  minClusterSize?: number
  similarityThreshold?: number
  samplesPerCluster?: number
}

export interface ClusteringResult {
  clusters: Cluster[]
  noise: ClusterPoint[]
  stats: {
    totalPoints: number
    clusteredPoints: number
    noisePoints: number
    clusterCount: number
  }
}
