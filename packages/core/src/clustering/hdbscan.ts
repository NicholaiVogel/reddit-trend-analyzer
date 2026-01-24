import type { QdrantStorage } from '../storage/qdrant'
import type {
  Cluster,
  ClusterPoint,
  ClusteringOptions,
  ClusteringResult,
} from './types'

const DEFAULT_MIN_CLUSTER_SIZE = 2
const DEFAULT_SIMILARITY_THRESHOLD = 0.5
const DEFAULT_SAMPLES_PER_CLUSTER = 10

export class ClusteringPipeline {
  private storage: QdrantStorage

  constructor(storage: QdrantStorage) {
    this.storage = storage
  }

  async runClustering(options: ClusteringOptions = {}): Promise<ClusteringResult> {
    const minClusterSize = options.minClusterSize ?? DEFAULT_MIN_CLUSTER_SIZE
    const similarityThreshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD
    const samplesPerCluster = options.samplesPerCluster ?? DEFAULT_SAMPLES_PER_CLUSTER

    const points = await this.storage.scrollWithVectors()
    if (points.length === 0) {
      return {
        clusters: [],
        noise: [],
        stats: {
          totalPoints: 0,
          clusteredPoints: 0,
          noisePoints: 0,
          clusterCount: 0,
        },
      }
    }

    const labels = this.densityClustering(points, similarityThreshold, minClusterSize)

    const clusterMap = new Map<number, ClusterPoint[]>()
    const noise: ClusterPoint[] = []

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i]
      const point = points[i]
      if (!point) continue

      if (label === -1) {
        noise.push(point)
      } else {
        const existing = clusterMap.get(label) || []
        existing.push(point)
        clusterMap.set(label, existing)
      }
    }

    const clusters: Cluster[] = []
    let clusterId = 0

    for (const [, clusterPoints] of clusterMap) {
      if (clusterPoints.length < minClusterSize) {
        noise.push(...clusterPoints)
        continue
      }

      const centroid = this.calculateCentroid(clusterPoints)
      const totalEngagement = clusterPoints.reduce((sum, p) => sum + p.payload.score, 0)
      const lastActive = Math.max(...clusterPoints.map(p => p.payload.created))
      const subreddits = [...new Set(clusterPoints.map(p => p.payload.subreddit))]

      const sortedByEngagement = [...clusterPoints].sort(
        (a, b) => b.payload.score - a.payload.score
      )
      const samples = sortedByEngagement.slice(0, samplesPerCluster)

      clusters.push({
        id: clusterId++,
        size: clusterPoints.length,
        centroid,
        totalEngagement,
        lastActive,
        subreddits,
        samples,
      })
    }

    clusters.sort((a, b) => b.totalEngagement - a.totalEngagement)

    return {
      clusters,
      noise,
      stats: {
        totalPoints: points.length,
        clusteredPoints: points.length - noise.length,
        noisePoints: noise.length,
        clusterCount: clusters.length,
      },
    }
  }

  private densityClustering(
    points: ClusterPoint[],
    similarityThreshold: number,
    minSize: number
  ): number[] {
    const n = points.length
    const labels = new Array(n).fill(-1)
    const visited = new Set<number>()
    let currentCluster = 0

    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue

      const neighbors = this.findNeighbors(points, i, similarityThreshold)

      if (neighbors.length < minSize) {
        visited.add(i)
        continue
      }

      labels[i] = currentCluster
      visited.add(i)

      const queue = [...neighbors]
      while (queue.length > 0) {
        const j = queue.shift()!
        if (visited.has(j)) continue

        visited.add(j)
        labels[j] = currentCluster

        const jNeighbors = this.findNeighbors(points, j, similarityThreshold)
        if (jNeighbors.length >= minSize) {
          for (const k of jNeighbors) {
            if (!visited.has(k)) {
              queue.push(k)
            }
          }
        }
      }

      currentCluster++
    }

    return labels
  }

  private findNeighbors(
    points: ClusterPoint[],
    idx: number,
    threshold: number
  ): number[] {
    const neighbors: number[] = []
    const point = points[idx]
    if (!point) return neighbors

    for (let i = 0; i < points.length; i++) {
      if (i === idx) continue
      const other = points[i]
      if (!other) continue

      const sim = this.cosineSimilarity(point.vector, other.vector)
      if (sim >= threshold) {
        neighbors.push(i)
      }
    }

    return neighbors
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0
      const bVal = b[i] ?? 0
      dot += aVal * bVal
      normA += aVal * aVal
      normB += bVal * bVal
    }

    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  private calculateCentroid(points: ClusterPoint[]): number[] {
    if (points.length === 0) return []

    const dim = points[0]?.vector.length ?? 0
    const centroid = new Array(dim).fill(0)

    for (const point of points) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += point.vector[i] ?? 0
      }
    }

    for (let i = 0; i < dim; i++) {
      centroid[i] /= points.length
    }

    const magnitude = Math.sqrt(centroid.reduce((sum, v) => sum + v * v, 0))
    if (magnitude > 0) {
      for (let i = 0; i < dim; i++) {
        centroid[i] /= magnitude
      }
    }

    return centroid
  }
}
