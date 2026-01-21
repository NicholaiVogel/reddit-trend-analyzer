import {
  BoxRenderable,
  TextRenderable,
  type RenderContext,
} from '@opentui/core'
import type { SearchResult } from '../../storage/types'

export function createExportBar(renderer: RenderContext): BoxRenderable {
  const container = new BoxRenderable(renderer, {
    id: 'export-bar',
    flexDirection: 'row',
    gap: 2,
    padding: 1,
  })

  container.add(new TextRenderable(renderer, {
    id: 'export-json',
    content: '[e]xport json',
  }))

  container.add(new TextRenderable(renderer, {
    id: 'export-csv',
    content: '[c]sv',
  }))

  container.add(new TextRenderable(renderer, {
    id: 'refresh-stats',
    content: '[r]efresh stats',
  }))

  container.add(new TextRenderable(renderer, {
    id: 'quit-hint',
    content: '[q]uit',
  }))

  return container
}

export async function exportToJson(
  results: SearchResult[],
  filename: string = 'reddit-trends.json'
): Promise<void> {
  const data = results.map(r => ({
    id: r.payload.id,
    type: r.payload.type,
    subreddit: r.payload.subreddit,
    title: r.payload.title,
    body: r.payload.body,
    author: r.payload.author,
    score: r.payload.score,
    created: new Date(r.payload.created * 1000).toISOString(),
    permalink: r.payload.permalink,
    similarity: r.score,
  }))

  await Bun.write(filename, JSON.stringify(data, null, 2))
}

export async function exportToCsv(
  results: SearchResult[],
  filename: string = 'reddit-trends.csv'
): Promise<void> {
  const headers = [
    'id', 'type', 'subreddit', 'title', 'body', 'author',
    'score', 'created', 'permalink', 'similarity'
  ]

  const escape = (val: string | number | undefined): string => {
    if (val === undefined) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows = results.map(r => [
    r.payload.id,
    r.payload.type,
    r.payload.subreddit,
    r.payload.title || '',
    r.payload.body,
    r.payload.author,
    r.payload.score,
    new Date(r.payload.created * 1000).toISOString(),
    r.payload.permalink,
    r.score.toFixed(4),
  ].map(escape).join(','))

  const csv = [headers.join(','), ...rows].join('\n')
  await Bun.write(filename, csv)
}
