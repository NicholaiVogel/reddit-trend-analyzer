'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'error' | 'loading'
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, type?: Toast['type']) => string
  removeToast: (id: string) => void
  updateToast: (id: string, message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])

    if (type !== 'loading') {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 4000)
    }

    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const updateToast = useCallback((id: string, message: string, type: Toast['type'] = 'info') => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, message, type } : t))

    if (type !== 'loading') {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 4000)
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg
            ${toast.type === 'error' ? 'bg-red-500 text-white' : ''}
            ${toast.type === 'success' ? 'bg-green-600 text-white' : ''}
            ${toast.type === 'loading' ? 'bg-card text-foreground border border-border' : ''}
            ${toast.type === 'info' ? 'bg-card text-foreground border border-border' : ''}
          `}
        >
          {toast.type === 'loading' && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
          )}
          <span className="text-sm">{toast.message}</span>
          {toast.type !== 'loading' && (
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-current opacity-70 hover:opacity-100"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
