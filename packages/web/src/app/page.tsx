'use client'

import { useEffect, useState } from 'react'

interface Stats {
  posts: number
  comments: number
  subreddits: string[]
  clusters: number
  questions: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your Reddit trend analysis</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">Posts</div>
          <div className="text-2xl font-semibold text-foreground">
            {stats?.posts.toLocaleString() ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">Comments</div>
          <div className="text-2xl font-semibold text-foreground">
            {stats?.comments.toLocaleString() ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">Subreddits</div>
          <div className="text-2xl font-semibold text-foreground">
            {stats?.subreddits.length ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">Clusters</div>
          <div className="text-2xl font-semibold text-foreground">
            {stats?.clusters ?? 0}
          </div>
        </div>
      </div>

      {stats && stats.subreddits.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="text-sm text-muted-foreground mb-2">Tracked Subreddits</div>
          <div className="flex flex-wrap gap-2">
            {stats.subreddits.map(sub => (
              <span
                key={sub}
                className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
              >
                r/{sub}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
