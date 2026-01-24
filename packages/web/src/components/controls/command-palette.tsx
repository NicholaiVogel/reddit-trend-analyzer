'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { useToast } from '@/components/ui/toast'

interface CommandPaletteProps {
  onSearch?: (query: string) => void
}

export function CommandPalette({ onSearch }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const router = useRouter()
  const { addToast, updateToast, removeToast } = useToast()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(open => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)}>
      <div
        className="fixed left-1/2 top-1/4 w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-popover p-0 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <Command className="flex flex-col">
          <div className="flex items-center border-b border-border px-4">
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent py-3 text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-xs text-muted-foreground mb-2">
              <Command.Item
                onSelect={() => runCommand(() => router.push('/'))}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                Go to Dashboard
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/problems'))}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                Go to Problems
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/questions'))}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                Go to Questions
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/scrape'))}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                Go to Scrape Manager
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Actions" className="text-xs text-muted-foreground mb-2 mt-4">
              <Command.Item
                onSelect={() => runCommand(async () => {
                  const toastId = addToast('Clustering discussions...', 'loading')
                  try {
                    const res = await fetch('/api/clusters', { method: 'POST' })
                    const data = await res.json()
                    if (data.success) {
                      updateToast(toastId, `Found ${data.clusters?.length || 0} problem clusters`, 'success')
                      router.refresh()
                    } else {
                      updateToast(toastId, data.error || 'Clustering failed', 'error')
                    }
                  } catch (e) {
                    updateToast(toastId, 'Clustering failed - check console', 'error')
                  }
                })}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                Re-cluster discussions
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(async () => {
                  const toastId = addToast('Exporting CSV...', 'loading')
                  try {
                    const res = await fetch('/api/export', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ format: 'csv' }),
                    })
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'clusters.csv'
                    a.click()
                    updateToast(toastId, 'CSV downloaded', 'success')
                  } catch (e) {
                    updateToast(toastId, 'Export failed', 'error')
                  }
                })}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                Export clusters as CSV
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(async () => {
                  const toastId = addToast('Exporting FAQ schema...', 'loading')
                  try {
                    const res = await fetch('/api/export', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ format: 'json', type: 'faq-schema' }),
                    })
                    const data = await res.json()
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'faq-schema.json'
                    a.click()
                    updateToast(toastId, 'FAQ schema downloaded', 'success')
                  } catch (e) {
                    updateToast(toastId, 'Export failed', 'error')
                  }
                })}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                Export FAQ schema (JSON-LD)
              </Command.Item>
            </Command.Group>

            {search && onSearch && (
              <Command.Group heading="Search" className="text-xs text-muted-foreground mb-2 mt-4">
                <Command.Item
                  onSelect={() => runCommand(() => onSearch(search))}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                >
                  Semantic search: "{search}"
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            Press <kbd className="rounded bg-muted px-1 py-0.5">Esc</kbd> to close
          </div>
        </Command>
      </div>
    </div>
  )
}
