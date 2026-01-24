import {
  BoxRenderable,
  TextRenderable,
  type RenderContext,
} from '@opentui/core'
import type { CollectionStats } from '@rta/core'

export function createStatsPanel(renderer: RenderContext): BoxRenderable {
  const container = new BoxRenderable(renderer, {
    id: 'stats-panel',
    border: true,
    title: ' stats ',
    flexDirection: 'column',
    padding: 1,
    width: 20,
    height: 7,
  })

  container.add(new TextRenderable(renderer, {
    id: 'posts-count',
    content: 'posts: 0',
  }))

  container.add(new TextRenderable(renderer, {
    id: 'comments-count',
    content: 'comments: 0',
  }))

  container.add(new TextRenderable(renderer, {
    id: 'subreddits-count',
    content: 'subreddits: 0',
  }))

  return container
}

export function updateStats(container: BoxRenderable, stats: CollectionStats): void {
  const posts = container.getRenderable('posts-count') as TextRenderable
  const comments = container.getRenderable('comments-count') as TextRenderable
  const subreddits = container.getRenderable('subreddits-count') as TextRenderable

  if (posts) {
    posts.content = `posts: ${stats.posts.toLocaleString()}`
  }
  if (comments) {
    comments.content = `comments: ${stats.comments.toLocaleString()}`
  }
  if (subreddits) {
    subreddits.content = `subreddits: ${stats.subreddits.length}`
  }
}
