'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useToast } from '@/components/ui/toast'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface Problem {
  clusterId: number
  problem: string
  description: string
  size: number
  totalEngagement: number
  lastActive: number
  subreddits: string[]
  sampleQuestions: string[]
  impactScore?: number
}

interface DiscussionSample {
  id: string
  type: 'post' | 'comment'
  subreddit: string
  title?: string
  author: string
  body: string
  score: number
  created: number
  permalink: string
  parent_id?: string
}

function DiscussionSamples({ clusterId }: { clusterId: number }) {
  const [samples, setSamples] = useState<DiscussionSample[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBodies, setExpandedBodies] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`/api/clusters/${clusterId}`)
      .then(res => res.json())
      .then(data => {
        setSamples(data.samples || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [clusterId])

  const toggleBody = useCallback((id: string) => {
    setExpandedBodies(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        Loading discussions...
      </div>
    )
  }

  if (samples.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No discussion samples available. Re-run clustering to populate.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">
        Discussion Samples ({samples.length})
      </div>
      {samples.map(sample => {
        const isExpanded = expandedBodies.has(sample.id)
        const bodyTruncated = sample.body.length > 300
        const displayBody = isExpanded ? sample.body : sample.body.slice(0, 300)

        return (
          <div
            key={sample.id}
            className="rounded-lg border border-border bg-background p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                    sample.type === 'post'
                      ? 'bg-blue-500/10 text-blue-500'
                      : 'bg-green-500/10 text-green-500'
                  }`}
                >
                  {sample.type}
                </span>
                <span className="text-xs text-muted-foreground">
                  r/{sample.subreddit}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  u/{sample.author}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  {sample.score} pts
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(sample.created)}
                </span>
              </div>
              <a
                href={`https://reddit.com${sample.permalink}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline shrink-0"
              >
                view on reddit →
              </a>
            </div>

            {sample.title && (
              <div className="font-medium text-foreground">{sample.title}</div>
            )}

            <div className="text-sm text-foreground whitespace-pre-wrap">
              {displayBody}
              {bodyTruncated && !isExpanded && '...'}
            </div>

            {bodyTruncated && (
              <button
                onClick={() => toggleBody(sample.id)}
                className="text-xs text-primary hover:underline"
              >
                {isExpanded ? 'show less' : 'show more'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface Weights {
  engagement: number
  velocity: number
  sentiment: number
}

interface SimilarityData {
  matrix: number[][]
  labels: string[]
  clusterIds: number[]
}

function CorrelationHeatmap({
  onCellClick,
}: {
  onCellClick?: (clusterIds: [number, number]) => void
}) {
  const [data, setData] = useState<SimilarityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<{ i: number; j: number } | null>(null)

  useEffect(() => {
    fetch('/api/clusters/similarity')
      .then(res => res.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading correlation data...</div>
      </div>
    )
  }

  if (!data || data.matrix.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-sm text-muted-foreground">No clusters to compare</div>
      </div>
    )
  }

  const getColor = (value: number) => {
    // white (0) -> indigo (1)
    const intensity = Math.round(value * 255)
    return `rgb(${255 - intensity * 0.6}, ${255 - intensity * 0.62}, ${255 - intensity * 0.05})`
  }

  const n = data.matrix.length
  const cellSize = Math.max(24, Math.min(40, 400 / n))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-px bg-border"
          style={{
            gridTemplateColumns: `auto repeat(${n}, ${cellSize}px)`,
            gridTemplateRows: `auto repeat(${n}, ${cellSize}px)`,
          }}
        >
          {/* empty corner cell */}
          <div className="bg-card" />

          {/* column headers */}
          {data.labels.map((label, j) => (
            <div
              key={`col-${j}`}
              className="bg-card flex items-end justify-center pb-1 px-1"
              style={{ height: cellSize * 2 }}
            >
              <span
                className="text-[10px] text-muted-foreground origin-bottom-left whitespace-nowrap overflow-hidden text-ellipsis"
                style={{
                  transform: 'rotate(-45deg)',
                  maxWidth: cellSize * 2,
                }}
                title={label}
              >
                {label.slice(0, 15)}
              </span>
            </div>
          ))}

          {/* rows */}
          {data.matrix.map((row, i) => (
            <React.Fragment key={`row-${i}`}>
              {/* row label */}
              <div
                className="bg-card flex items-center justify-end pr-2"
                style={{ width: 100 }}
              >
                <span
                  className="text-[10px] text-muted-foreground truncate"
                  title={data.labels[i]}
                >
                  {data.labels[i].slice(0, 12)}
                </span>
              </div>

              {/* cells */}
              {row.map((value, j) => {
                const isHovered = hoveredCell?.i === i && hoveredCell?.j === j
                return (
                  <div
                    key={`cell-${i}-${j}`}
                    className="relative cursor-pointer transition-all"
                    style={{
                      backgroundColor: getColor(value),
                      width: cellSize,
                      height: cellSize,
                      outline: isHovered ? '2px solid #6366f1' : 'none',
                      outlineOffset: '-1px',
                    }}
                    onMouseEnter={() => setHoveredCell({ i, j })}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => onCellClick?.([data.clusterIds[i], data.clusterIds[j]])}
                    title={`${data.labels[i]} ↔ ${data.labels[j]}: ${(value * 100).toFixed(0)}%`}
                  >
                    {isHovered && (
                      <div className="absolute z-10 bg-card border border-border rounded px-2 py-1 text-xs shadow-lg whitespace-nowrap -translate-x-1/2 left-1/2 -top-8">
                        {(value * 100).toFixed(0)}% similar
                      </div>
                    )}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>0%</span>
        <div
          className="h-3 w-32 rounded"
          style={{
            background: 'linear-gradient(to right, white, #6366f1)',
          }}
        />
        <span>100%</span>
        <span className="ml-2">keyword overlap</span>
      </div>
    </div>
  )
}

// chart colors - recharts can't parse CSS variables at runtime
const CHART_COLORS = {
  primary: '#6366f1',      // indigo
  secondary: '#8b5cf6',    // violet
  accent: '#06b6d4',       // cyan
  muted: '#94a3b8',        // slate
  grid: '#e2e8f0',         // light grid
  text: '#64748b',         // muted text
  palette: ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16'],
}

export default function ProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [clustering, setClustering] = useState(false)
  const { addToast, updateToast } = useToast()

  const [similarityThreshold, setSimilarityThreshold] = useState(0.5)
  const [minClusterSize, setMinClusterSize] = useState(2)
  const [weights, setWeights] = useState<Weights>({
    engagement: 0.5,
    velocity: 0.3,
    sentiment: 0.2,
  })

  const fetchClusters = () => {
    fetch('/api/clusters')
      .then(res => res.json())
      .then(data => {
        setProblems(data.clusters || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchClusters()
  }, [])

  const sortedProblems = useMemo(() => {
    if (problems.length === 0) return []

    const now = Math.floor(Date.now() / 1000)
    const oneWeek = 7 * 24 * 60 * 60
    const maxEngagement = Math.max(...problems.map(p => p.totalEngagement))

    return [...problems]
      .map(p => {
        const engagementScore = maxEngagement > 0 ? p.totalEngagement / maxEngagement : 0
        const age = now - p.lastActive
        const velocityScore = Math.max(0, 1 - age / oneWeek)
        const sentimentScore = 0.5

        const impactScore =
          weights.engagement * engagementScore +
          weights.velocity * velocityScore +
          weights.sentiment * sentimentScore

        return { ...p, impactScore }
      })
      .sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0))
  }, [problems, weights])

  const chartData = useMemo(() => {
    if (sortedProblems.length === 0) return { impact: [], subreddits: [], sizes: [] }

    const impactData = sortedProblems.slice(0, 10).map(p => ({
      name: p.problem.slice(0, 30) + (p.problem.length > 30 ? '...' : ''),
      impact: Math.round((p.impactScore || 0) * 100),
      engagement: p.totalEngagement,
      discussions: p.size,
    }))

    const subredditCounts = new Map<string, number>()
    sortedProblems.forEach(p => {
      p.subreddits.forEach(sub => {
        subredditCounts.set(sub, (subredditCounts.get(sub) || 0) + 1)
      })
    })
    const subredditData = Array.from(subredditCounts.entries())
      .map(([name, value]) => ({ name: `r/${name}`, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)

    const sizeDistribution = sortedProblems.reduce((acc, p) => {
      const bucket =
        p.size < 5 ? '2-4' : p.size < 10 ? '5-9' : p.size < 20 ? '10-19' : '20+'
      acc[bucket] = (acc[bucket] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const sizeData = Object.entries(sizeDistribution).map(([name, value]) => ({
      name: `${name} discussions`,
      value,
    }))

    return { impact: impactData, subreddits: subredditData, sizes: sizeData }
  }, [sortedProblems])

  const handleRecluster = async () => {
    setClustering(true)
    const toastId = addToast('Clustering discussions...', 'loading')
    try {
      const res = await fetch('/api/clusters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ similarityThreshold, minClusterSize }),
      })
      const data = await res.json()
      if (data.success) {
        updateToast(toastId, `Found ${data.clusters?.length || 0} problem clusters`, 'success')
        fetchClusters()
      } else {
        updateToast(toastId, data.error || 'Clustering failed', 'error')
      }
    } catch (e) {
      updateToast(toastId, 'Clustering failed - check console', 'error')
    } finally {
      setClustering(false)
    }
  }

  const updateWeight = (key: keyof Weights, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }))
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const clusterControls = (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="text-sm font-medium text-foreground">Clustering Settings</div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Similarity Threshold: {similarityThreshold.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.3"
            max="0.9"
            step="0.05"
            value={similarityThreshold}
            onChange={e => setSimilarityThreshold(parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Loose (0.3)</span>
            <span>Strict (0.9)</span>
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Min Cluster Size
          </label>
          <select
            value={minClusterSize}
            onChange={e => setMinClusterSize(parseInt(e.target.value))}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
          >
            <option value={2}>2 discussions</option>
            <option value={3}>3 discussions</option>
            <option value={5}>5 discussions</option>
            <option value={10}>10 discussions</option>
          </select>
        </div>
      </div>
    </div>
  )

  const weightControls = (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="text-sm font-medium text-foreground">Impact Score Weights</div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Engagement: {(weights.engagement * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={weights.engagement}
            onChange={e => updateWeight('engagement', parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Velocity: {(weights.velocity * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={weights.velocity}
            onChange={e => updateWeight('velocity', parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Sentiment: {(weights.sentiment * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={weights.sentiment}
            onChange={e => updateWeight('sentiment', parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>
    </div>
  )

  if (problems.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Problem Explorer</h1>
          <p className="text-muted-foreground">View and analyze problem clusters</p>
        </div>
        {clusterControls}
        <div className="flex justify-end">
          <button
            onClick={handleRecluster}
            disabled={clustering}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {clustering ? 'Clustering...' : 'Run Clustering'}
          </button>
        </div>
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No problems found. Adjust settings and run clustering.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Problem Explorer</h1>
          <p className="text-muted-foreground">
            {sortedProblems.length} problem clusters identified
          </p>
        </div>
        <button
          onClick={handleRecluster}
          disabled={clustering}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {clustering ? 'Clustering...' : 'Re-cluster'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {clusterControls}
        {weightControls}
      </div>

      {sortedProblems.length > 0 && (
        <div className="space-y-4">
          <div className="text-lg font-medium text-foreground">Problem Analytics</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-sm font-medium text-foreground mb-4">
                Top Problems by Impact Score
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.impact}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: CHART_COLORS.text }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: `1px solid ${CHART_COLORS.grid}`,
                      borderRadius: '6px',
                    }}
                  />
                  <Bar dataKey="impact" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-sm font-medium text-foreground mb-4">
                Discussion Distribution by Subreddit
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.subreddits}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={80}
                    dataKey="value"
                  >
                    {chartData.subreddits.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS.palette[index % CHART_COLORS.palette.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: `1px solid ${CHART_COLORS.grid}`,
                      borderRadius: '6px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-sm font-medium text-foreground mb-4">
                Cluster Size Distribution
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData.sizes}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: CHART_COLORS.text }}
                  />
                  <YAxis tick={{ fill: CHART_COLORS.text }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: `1px solid ${CHART_COLORS.grid}`,
                      borderRadius: '6px',
                    }}
                  />
                  <Bar dataKey="value" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-sm font-medium text-foreground mb-4">Key Metrics</div>
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {sortedProblems.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Clusters</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {sortedProblems.reduce((sum, p) => sum + p.size, 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Discussions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {sortedProblems
                      .reduce((sum, p) => sum + p.totalEngagement, 0)
                      .toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Upvotes</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {new Set(sortedProblems.flatMap(p => p.subreddits)).size}
                  </div>
                  <div className="text-xs text-muted-foreground">Unique Subreddits</div>
                </div>
              </div>
            </div>
          </div>

          {/* correlation heatmap */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm font-medium text-foreground mb-4">
              Problem Cluster Correlation
            </div>
            <CorrelationHeatmap
              onCellClick={([id1, id2]) => {
                // expand first cluster that isn't already expanded
                if (expanded !== id1) {
                  setExpanded(id1)
                } else if (expanded !== id2) {
                  setExpanded(id2)
                }
              }}
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Problem
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Impact
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Discussions
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Upvotes
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Last Active
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedProblems.map(problem => (
              <React.Fragment key={problem.clusterId}>
                <tr
                  onClick={() => setExpanded(expanded === problem.clusterId ? null : problem.clusterId)}
                  className="border-t border-border hover:bg-accent/50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{problem.problem}</div>
                    <div className="text-sm text-muted-foreground">
                      {problem.subreddits.map(s => `r/${s}`).join(', ')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {((problem.impactScore || 0) * 100).toFixed(0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{problem.size}</td>
                  <td className="px-4 py-3 text-foreground">
                    {problem.totalEngagement.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-foreground">{formatDate(problem.lastActive)}</td>
                </tr>
                {expanded === problem.clusterId && (
                  <tr className="border-t border-border bg-muted/50">
                    <td colSpan={5} className="px-4 py-4">
                      <div className="space-y-4">
                        <p className="text-foreground">{problem.description}</p>

                        <DiscussionSamples clusterId={problem.clusterId} />

                        {problem.sampleQuestions.length > 0 && (
                          <div>
                            <div className="text-sm font-medium text-muted-foreground mb-1">
                              Sample Questions:
                            </div>
                            <ul className="list-disc list-inside text-sm text-foreground">
                              {problem.sampleQuestions.map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
