import {
  BoxRenderable,
  TextRenderable,
  type RenderContext,
} from '@opentui/core'

export interface ProgressState {
  phase: string
  current: number
  total: number
  message: string
}

function createProgressBar(percent: number, width: number = 20): string {
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

export function createProgressPanel(renderer: RenderContext): BoxRenderable {
  const container = new BoxRenderable(renderer, {
    id: 'progress-panel',
    border: true,
    title: ' progress ',
    flexDirection: 'column',
    padding: 1,
    gap: 0,
    height: 5,
  })

  const fetchLine = new TextRenderable(renderer, {
    id: 'fetch-progress',
    content: 'waiting...',
  })
  container.add(fetchLine)

  const embedLine = new TextRenderable(renderer, {
    id: 'embed-progress',
    content: '',
  })
  container.add(embedLine)

  return container
}

export function updateProgress(
  container: BoxRenderable,
  state: ProgressState
): void {
  const percent = state.total > 0 ? Math.round((state.current / state.total) * 100) : 0
  const bar = createProgressBar(percent)
  const text = `${state.message} ${state.current}/${state.total} ${bar} ${percent}%`

  if (state.phase === 'posts' || state.phase === 'comments') {
    const fetchText = container.getRenderable('fetch-progress') as TextRenderable
    if (fetchText) {
      fetchText.content = text
    }
  } else if (state.phase === 'embedding') {
    const embedText = container.getRenderable('embed-progress') as TextRenderable
    if (embedText) {
      embedText.content = text
    }
  }
}

export function resetProgress(container: BoxRenderable): void {
  const fetchText = container.getRenderable('fetch-progress') as TextRenderable
  const embedText = container.getRenderable('embed-progress') as TextRenderable

  if (fetchText) {
    fetchText.content = 'waiting...'
  }
  if (embedText) {
    embedText.content = ''
  }
}
