import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  InputRenderableEvents,
  type RenderContext,
} from '@opentui/core'

export interface UrlInputConfig {
  onUrlSubmit: (url: string) => void
  onPagesChange: (pages: number) => void
  onPostsPerPageChange: (count: number) => void
  onStartScrape: () => void
}

export function createUrlInput(renderer: RenderContext, config: UrlInputConfig): BoxRenderable {
  const container = new BoxRenderable(renderer, {
    id: 'scrape-panel',
    border: true,
    title: ' scrape ',
    flexDirection: 'column',
    padding: 1,
    gap: 1,
  })

  const urlRow = new BoxRenderable(renderer, {
    id: 'url-row',
    flexDirection: 'row',
    gap: 1,
  })

  urlRow.add(new TextRenderable(renderer, {
    id: 'url-label',
    content: 'url:',
    width: 5,
  }))

  const urlInput = new InputRenderable(renderer, {
    id: 'url-input',
    width: 50,
    placeholder: 'https://reddit.com/r/________/best',
    cursorColor: '#00FF00',
    focusedBackgroundColor: '#1a1a1a',
  })

  urlInput.on(InputRenderableEvents.CHANGE, (value: string) => {
    config.onUrlSubmit(value)
  })

  urlRow.add(urlInput)
  container.add(urlRow)

  const optionsRow = new BoxRenderable(renderer, {
    id: 'options-row',
    flexDirection: 'row',
    gap: 2,
  })

  optionsRow.add(new TextRenderable(renderer, {
    id: 'pages-label',
    content: 'pages:',
  }))

  const pagesInput = new InputRenderable(renderer, {
    id: 'pages-input',
    width: 5,
    placeholder: '5',
    cursorColor: '#00FF00',
    focusedBackgroundColor: '#1a1a1a',
  })

  pagesInput.on(InputRenderableEvents.CHANGE, (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num > 0) {
      config.onPagesChange(num)
    }
  })

  optionsRow.add(pagesInput)

  optionsRow.add(new TextRenderable(renderer, {
    id: 'posts-label',
    content: 'posts/page:',
  }))

  const postsInput = new InputRenderable(renderer, {
    id: 'posts-input',
    width: 5,
    placeholder: '100',
    cursorColor: '#00FF00',
    focusedBackgroundColor: '#1a1a1a',
  })

  postsInput.on(InputRenderableEvents.CHANGE, (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num > 0) {
      config.onPostsPerPageChange(num)
    }
  })

  optionsRow.add(postsInput)

  optionsRow.add(new TextRenderable(renderer, {
    id: 'start-hint',
    content: '[enter to start]',
  }))

  container.add(optionsRow)

  return container
}

export function focusUrlInput(container: BoxRenderable): void {
  container.getRenderable('url-input')?.focus()
}
