'use client'

import { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/toast'
import { CommandPalette } from '@/components/controls/command-palette'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <CommandPalette />
    </ToastProvider>
  )
}
