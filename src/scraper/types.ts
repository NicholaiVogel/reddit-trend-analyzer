export interface RedditPost {
  id: string
  name: string
  title: string
  selftext: string
  author: string
  score: number
  upvote_ratio: number
  num_comments: number
  created_utc: number
  permalink: string
  subreddit: string
  url: string
  is_self: boolean
}

export interface RedditComment {
  id: string
  name: string
  body: string
  author: string
  score: number
  created_utc: number
  permalink: string
  parent_id: string
  subreddit: string
  depth: number
}

export interface RedditListingData<T> {
  after: string | null
  before: string | null
  children: Array<{ kind: string; data: T }>
  dist: number
}

export interface RedditListing<T> {
  kind: string
  data: RedditListingData<T>
}

export interface RedditPostData {
  id: string
  name: string
  title: string
  selftext: string
  selftext_html: string | null
  author: string
  score: number
  upvote_ratio: number
  num_comments: number
  created_utc: number
  permalink: string
  subreddit: string
  url: string
  is_self: boolean
}

export interface RedditCommentData {
  id: string
  name: string
  body: string
  body_html: string
  author: string
  score: number
  created_utc: number
  permalink: string
  parent_id: string
  subreddit: string
  depth: number
  replies?: RedditListing<RedditCommentData> | ''
}

export interface ScrapeOptions {
  url: string
  pages: number
  postsPerPage: number
  fetchComments: boolean
  delayMs: number
}

export interface ScrapeProgress {
  phase: 'posts' | 'comments' | 'done'
  current: number
  total: number
  message: string
}
