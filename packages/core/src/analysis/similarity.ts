import type { ProblemSummary } from './types'

export interface SimilarityMatrix {
  matrix: number[][]
  labels: string[]
  clusterIds: number[]
}

/**
 * compute jaccard similarity between clusters based on keywords
 * jaccard = |A ∩ B| / |A ∪ B|
 */
export function computeKeywordSimilarity(clusters: ProblemSummary[]): SimilarityMatrix {
  const n = clusters.length
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1
        continue
      }

      const setA = new Set(clusters[i].keywords.map(k => k.toLowerCase()))
      const setB = new Set(clusters[j].keywords.map(k => k.toLowerCase()))

      const intersection = [...setA].filter(k => setB.has(k)).length
      const union = new Set([...setA, ...setB]).size
      const similarity = union > 0 ? intersection / union : 0

      matrix[i][j] = similarity
      matrix[j][i] = similarity
    }
  }

  return {
    matrix,
    labels: clusters.map(c => c.problem.slice(0, 25) + (c.problem.length > 25 ? '...' : '')),
    clusterIds: clusters.map(c => c.clusterId),
  }
}
