import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  InputRenderableEvents,
  type RenderContext,
} from '@opentui/core'
import type { SearchResult } from '../../storage/types'

export interface SearchConfig {
  onSearch: (query: string) => Promise<void>
}

export function createSearchPanel(
  renderer: RenderContext,
  config: SearchConfig
): BoxRenderable {
  const container = new BoxRenderable(renderer, {
    id: 'search-panel',
    border: true,
    title: ' search ',
    flexDirection: 'column',
    padding: 1,
    gap: 1,
    height: 12,
  })

  const queryRow = new BoxRenderable(renderer, {
    id: 'query-row',
    flexDirection: 'row',
    gap: 1,
  })

  queryRow.add(new TextRenderable(renderer, {
    id: 'query-label',
    content: 'query:',
    width: 7,
  }))

  const queryInput = new InputRenderable(renderer, {
    id: 'search-input',
    width: 45,
    placeholder: 'semantic search...',
    cursorColor: '#00FF00',
    focusedBackgroundColor: '#1a1a1a',
  })

  queryInput.on(InputRenderableEvents.CHANGE, async (value: string) => {
    if (value.trim()) {
      await config.onSearch(value)
    }
  })

  queryRow.add(queryInput)
  container.add(queryRow)

  container.add(new TextRenderable(renderer, {
    id: 'results-label',
    content: 'results:',
  }))

  container.add(new TextRenderable(renderer, {
    id: 'results-content',
    content: '',
  }))

  return container
}

export function updateSearchResults(
  container: BoxRenderable,
  results: SearchResult[]
): void {
  const resultsContent = container.getRenderable('results-content') as TextRenderable
  if (!resultsContent) return

  if (results.length === 0) {
    resultsContent.content = 'no results'
    return
  }

  const lines = results.slice(0, 5).map(result => {
    const preview = (result.payload.title || result.payload.body || '')
      .slice(0, 50)
      .replace(/\n/g, ' ')
    return `> "${preview}..." (${result.score.toFixed(2)})`
  }).join('\n')

  resultsContent.content = lines
}

export function focusSearch(container: BoxRenderable): void {
  container.getRenderable('search-input')?.focus()
}
