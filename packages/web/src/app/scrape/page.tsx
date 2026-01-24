'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/toast'

interface ScrapeHistory {
  id: number
  subreddit: string
  url: string
  postsScraped: number
  commentsScraped: number
  startedAt: number
  completedAt: number | null
}

export default function ScrapePage() {
  const [url, setUrl] = useState('')
  const [pages, setPages] = useState(5)
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<ScrapeHistory[]>([])
  const { addToast, updateToast } = useToast()

  useEffect(() => {
    fetch('/api/scrape/history')
      .then(res => res.json())
      .then(data => setHistory(data.history || []))
  }, [])

  const handleScrape = async () => {
    if (!url) return
    setIsLoading(true)
    const toastId = addToast('Scraping subreddit... this may take a while', 'loading')

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, pages }),
      })

      const data = await res.json()
      if (data.success) {
        updateToast(toastId, `Scraped ${data.posts} posts and ${data.comments} comments`, 'success')
        const historyRes = await fetch('/api/scrape/history')
        const historyData = await historyRes.json()
        setHistory(historyData.history || [])
      } else {
        updateToast(toastId, data.error || 'Scrape failed', 'error')
      }
    } catch (err) {
      updateToast(toastId, 'Scrape failed - check console', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Scrape Manager</h1>
        <p className="text-muted-foreground">Scrape subreddits and manage data collection</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Subreddit URL
          </label>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://reddit.com/r/programming/best"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Pages to Scrape
          </label>
          <input
            type="number"
            value={pages}
            onChange={e => setPages(parseInt(e.target.value) || 1)}
            min={1}
            max={20}
            className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isLoading}
          />
        </div>
        <button
          onClick={handleScrape}
          disabled={isLoading || !url}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? 'Scraping...' : 'Start Scrape'}
        </button>
      </div>

      {history.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="bg-muted px-4 py-3 font-medium text-foreground">
            Scrape History
          </div>
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">
                  Subreddit
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">
                  Posts
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">
                  Comments
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">
                  Started
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="border-t border-border">
                  <td className="px-4 py-2 text-foreground">r/{h.subreddit}</td>
                  <td className="px-4 py-2 text-foreground">{h.postsScraped}</td>
                  <td className="px-4 py-2 text-foreground">{h.commentsScraped}</td>
                  <td className="px-4 py-2 text-foreground">{formatDate(h.startedAt)}</td>
                  <td className="px-4 py-2">
                    {h.completedAt ? (
                      <span className="text-green-600">Complete</span>
                    ) : (
                      <span className="text-yellow-600">In Progress</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
