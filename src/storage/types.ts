export interface PointPayload {
  id: string
  type: 'post' | 'comment'
  subreddit: string
  title?: string
  author: string
  body: string
  score: number
  created: number
  permalink: string
  parent_id?: string
}

export interface SearchResult {
  id: string
  score: number
  payload: PointPayload
}

export interface CollectionStats {
  posts: number
  comments: number
  subreddits: string[]
}
