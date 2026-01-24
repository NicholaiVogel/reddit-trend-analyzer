'use client'

import { useEffect, useState } from 'react'

interface Question {
  id: string
  text: string
  clusterId: number
  engagement: number
  addressed: boolean
}

interface GroupedQuestions {
  [clusterId: string]: {
    problem: string
    questions: Question[]
  }
}

export default function QuestionsPage() {
  const [grouped, setGrouped] = useState<GroupedQuestions>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unanswered'>('all')

  useEffect(() => {
    fetch('/api/questions')
      .then(res => res.json())
      .then(data => {
        setGrouped(data.grouped || {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleToggleAddressed = async (id: string, addressed: boolean) => {
    await fetch(`/api/questions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressed: !addressed }),
    })

    setGrouped(prev => {
      const updated = { ...prev }
      for (const clusterId of Object.keys(updated)) {
        const cluster = updated[clusterId]
        if (cluster) {
          cluster.questions = cluster.questions.map(q =>
            q.id === id ? { ...q, addressed: !addressed } : q
          )
        }
      }
      return updated
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const clusterIds = Object.keys(grouped)
  const totalQuestions = clusterIds.reduce((sum, id) => {
    return sum + (grouped[id]?.questions.length ?? 0)
  }, 0)

  if (totalQuestions === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Question Bank</h1>
          <p className="text-muted-foreground">Extracted questions from discussions</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No questions found. Run clustering first.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Question Bank</h1>
          <p className="text-muted-foreground">{totalQuestions} questions extracted</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              filter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unanswered')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              filter === 'unanswered'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            Unanswered
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {clusterIds.map(clusterId => {
          const cluster = grouped[clusterId]
          if (!cluster) return null

          const filteredQuestions =
            filter === 'unanswered'
              ? cluster.questions.filter(q => !q.addressed)
              : cluster.questions

          if (filteredQuestions.length === 0) return null

          return (
            <div
              key={clusterId}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              <div className="bg-muted px-4 py-3 font-medium text-foreground">
                {cluster.problem}
              </div>
              <ul className="divide-y divide-border">
                {filteredQuestions.map(q => (
                  <li key={q.id} className="flex items-start gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={q.addressed}
                      onChange={() => handleToggleAddressed(q.id, q.addressed)}
                      className="mt-1 h-4 w-4 rounded border-border"
                    />
                    <div className="flex-1">
                      <p
                        className={`text-foreground ${
                          q.addressed ? 'line-through text-muted-foreground' : ''
                        }`}
                      >
                        {q.text}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {q.engagement} upvotes
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
