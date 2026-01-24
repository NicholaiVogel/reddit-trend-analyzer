import { NextRequest, NextResponse } from 'next/server'
import { SQLiteStorage } from '@rta/core'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { addressed } = body

    const sqlite = new SQLiteStorage()
    sqlite.markQuestionAddressed(id, addressed)
    sqlite.close()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update question error:', error)
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 })
  }
}
