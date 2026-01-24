import { NextResponse } from 'next/server'
import { Ollama } from 'ollama'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const PROJECT_ROOT = '/mnt/work/dev/personal-projects/reddit-trend-analyzer'
const SETTINGS_FILE = join(PROJECT_ROOT, 'data', 'settings.json')

interface Settings {
  summarizationModel: string
  sentimentModel: string
  embeddingModel: string
}

const DEFAULT_SETTINGS: Settings = {
  summarizationModel: 'llama3.2',
  sentimentModel: 'llama3.2',
  embeddingModel: 'nomic-embed-text',
}

function getSettings(): Settings {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'))
      return { ...DEFAULT_SETTINGS, ...data }
    }
  } catch {}
  return DEFAULT_SETTINGS
}

function saveSettings(settings: Settings): void {
  const dataDir = join(PROJECT_ROOT, 'data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
}

export async function GET() {
  try {
    const ollama = new Ollama({
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    })

    const models = await ollama.list()
    const settings = getSettings()

    const availableModels = models.models.map(m => ({
      name: m.name,
      size: m.size,
      modified: m.modified_at,
    }))

    return NextResponse.json({
      settings,
      availableModels,
    })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({
      settings: DEFAULT_SETTINGS,
      availableModels: [],
      error: 'Failed to connect to Ollama',
    })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const currentSettings = getSettings()

    const newSettings: Settings = {
      summarizationModel: body.summarizationModel ?? currentSettings.summarizationModel,
      sentimentModel: body.sentimentModel ?? currentSettings.sentimentModel,
      embeddingModel: body.embeddingModel ?? currentSettings.embeddingModel,
    }

    saveSettings(newSettings)

    return NextResponse.json({
      success: true,
      settings: newSettings,
    })
  } catch (error) {
    console.error('Settings POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}
