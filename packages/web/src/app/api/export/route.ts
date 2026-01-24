import { NextRequest, NextResponse } from 'next/server'
import { SQLiteStorage } from '@rta/core'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { format, type } = body

    const sqlite = new SQLiteStorage()
    const clusters = sqlite.getClusters()
    const questions = sqlite.getQuestions()
    sqlite.close()

    if (format === 'json' && type === 'faq-schema') {
      const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: questions
          .filter(q => !q.addressed)
          .slice(0, 20)
          .map(q => ({
            '@type': 'Question',
            name: q.text,
            acceptedAnswer: {
              '@type': 'Answer',
              text: '', // To be filled in
            },
          })),
      }

      return NextResponse.json(faqSchema)
    }

    if (format === 'markdown' && type === 'content-brief') {
      let markdown = '# Content Brief\n\n'

      for (const cluster of clusters) {
        markdown += `## ${cluster.problem}\n\n`
        markdown += `${cluster.description}\n\n`
        markdown += `**Keywords:** ${cluster.keywords.join(', ')}\n\n`
        markdown += `**Actionable Insight:** ${cluster.actionableInsight}\n\n`

        const clusterQuestions = questions.filter(q => q.clusterId === cluster.clusterId)
        if (clusterQuestions.length > 0) {
          markdown += `### Questions to Address\n\n`
          for (const q of clusterQuestions.slice(0, 5)) {
            markdown += `- ${q.text}\n`
          }
          markdown += '\n'
        }

        markdown += '---\n\n'
      }

      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': 'attachment; filename="content-brief.md"',
        },
      })
    }

    if (format === 'csv') {
      const headers = ['Problem', 'Description', 'Size', 'Engagement', 'Keywords', 'Subreddits']
      const rows = clusters.map(c => [
        `"${c.problem.replace(/"/g, '""')}"`,
        `"${c.description.replace(/"/g, '""')}"`,
        c.size,
        c.totalEngagement,
        `"${c.keywords.join(', ')}"`,
        `"${c.subreddits.join(', ')}"`,
      ])

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="clusters.csv"',
        },
      })
    }

    return NextResponse.json({ clusters, questions })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    )
  }
}
