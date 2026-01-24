import type { Metadata } from 'next'
import '@/styles/globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Reddit Trend Analyzer',
  description: 'Discover common problems and questions in Reddit communities',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <Providers>
          <div className="flex min-h-screen">
            <aside className="w-64 border-r border-border bg-sidebar p-4">
              <div className="mb-6">
                <h1 className="text-lg font-semibold text-sidebar-foreground">
                  Reddit Trends
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Press <kbd className="rounded bg-muted px-1 py-0.5">Ctrl+K</kbd> for commands
                </p>
              </div>
              <nav className="space-y-2">
                <a
                  href="/"
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  Dashboard
                </a>
                <a
                  href="/problems"
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  Problems
                </a>
                <a
                  href="/questions"
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  Questions
                </a>
                <a
                  href="/scrape"
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  Scrape
                </a>
                <a
                  href="/settings"
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  Settings
                </a>
              </nav>
            </aside>
            <main className="flex-1 p-6">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
