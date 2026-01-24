'use client'

import React, { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/toast'

interface Model {
  name: string
  size: number
  modified: string
}

interface Settings {
  summarizationModel: string
  sentimentModel: string
  embeddingModel: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSettings(data.settings)
        setModels(data.availableModels || [])
        if (data.error) setError(data.error)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load settings')
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()

      if (data.success) {
        addToast('Settings saved', 'success')
      } else {
        addToast(data.error || 'Failed to save', 'error')
      }
    } catch {
      addToast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: keyof Settings, value: string) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : null)
  }

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024)
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Configure models and preferences</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <div>
          <h2 className="text-lg font-medium text-foreground mb-4">Ollama Models</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {models.length} models available locally
          </p>
        </div>

        {settings && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Summarization Model
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Used for generating problem summaries and extracting questions from clusters
              </p>
              <select
                value={settings.summarizationModel}
                onChange={e => updateSetting('summarizationModel', e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              >
                {models.map(m => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({formatSize(m.size)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Sentiment Model
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Used for analyzing sentiment of discussions (positive/negative/neutral)
              </p>
              <select
                value={settings.sentimentModel}
                onChange={e => updateSetting('sentimentModel', e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              >
                {models.map(m => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({formatSize(m.size)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Embedding Model
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Used for converting text to vectors for semantic search and clustering
              </p>
              <select
                value={settings.embeddingModel}
                onChange={e => updateSetting('embeddingModel', e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              >
                {models.filter(m => m.name.includes('embed') || m.name.includes('nomic')).length > 0
                  ? models.filter(m => m.name.includes('embed') || m.name.includes('nomic')).map(m => (
                      <option key={m.name} value={m.name}>
                        {m.name} ({formatSize(m.size)})
                      </option>
                    ))
                  : models.map(m => (
                      <option key={m.name} value={m.name}>
                        {m.name} ({formatSize(m.size)})
                      </option>
                    ))
                }
              </select>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-medium text-foreground mb-4">Available Models</h2>
        <div className="space-y-2">
          {models.map(m => (
            <div key={m.name} className="flex justify-between items-center text-sm">
              <span className="text-foreground font-mono">{m.name}</span>
              <span className="text-muted-foreground">{formatSize(m.size)}</span>
            </div>
          ))}
          {models.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No models found. Make sure Ollama is running and has models installed.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
