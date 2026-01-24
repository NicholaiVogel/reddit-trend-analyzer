import { NextResponse } from 'next/server'
import { SQLiteStorage } from '@rta/core'

export async function GET() {
  try {
    const sqlite = new SQLiteStorage()
    const history = sqlite.getScrapeHistory()
    sqlite.close()

    return NextResponse.json({ history })
  } catch (error) {
    console.error('Scrape history error:', error)
    return NextResponse.json({ history: [] })
  }
}
