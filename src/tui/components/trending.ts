import {
  BoxRenderable,
  TextRenderable,
  type RenderContext,
} from '@opentui/core'

export interface TrendingTopic {
  title: string
  count: number
  avgScore: number
}

export function createTrendingPanel(renderer: RenderContext): BoxRenderable {
  const container = new BoxRenderable(renderer, {
    id: 'trending-panel',
    border: true,
    title: ' trending / status ',
    flexDirection: 'column',
    padding: 1,
    height: 10,
  })

  container.add(new TextRenderable(renderer, {
    id: 'trending-content',
    content: 'scrape data to see trends',
  }))

  return container
}

export function updateTrending(
  container: BoxRenderable,
  topics: TrendingTopic[]
): void {
  const contentText = container.getRenderable('trending-content') as TextRenderable
  if (!contentText) return

  if (topics.length === 0) {
    contentText.content = 'no trends found'
    return
  }

  const lines = topics
    .slice(0, 8)
    .map((topic, i) => `${i + 1}. ${topic.title}`)
    .join('\n')

  contentText.content = lines
}
