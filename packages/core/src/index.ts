// scraper
export {
  RedditScraper,
  CommentFetcher,
  normalizeRedditUrl,
  parseSubredditFromUrl,
} from './scraper'
export type {
  RedditPost,
  RedditComment,
  RedditListing,
  ScrapeOptions,
  ScrapeProgress,
} from './scraper'

// embeddings
export { EmbeddingPipeline, VECTOR_DIM } from './embeddings'
export type { EmbeddedPoint, EmbeddingProgress } from './embeddings'

// storage
export { SQLiteVecStorage, COLLECTION_NAME, SQLiteStorage } from './storage'
export type { PointPayload, SearchResult, CollectionStats, ScrapeHistoryRecord } from './storage'

// clustering
export { ClusteringPipeline } from './clustering'
export type { Cluster, ClusterPoint, ClusteringOptions, ClusteringResult } from './clustering'

// analysis
export {
  ProblemSummarizer,
  QuestionExtractor,
  EngagementScorer,
  SentimentAnalyzer,
  computeKeywordSimilarity,
} from './analysis'
export type {
  ProblemSummary,
  ExtractedQuestion,
  ScoringWeights,
  ScoredCluster,
  SimilarityMatrix,
} from './analysis'

// utils
export { delay, RateLimiter, fetchWithRetry } from './utils'
export { cleanText, prepareForEmbedding } from './utils'
