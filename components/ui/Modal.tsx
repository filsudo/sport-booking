'use client'

import { X } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const [mounted, setMounted] = useState(false)
  const canUseDom = typeof window !== 'undefined' && typeof document !== 'undefined'

  useEffect(() => {
    // Hydration-safe mount gate for portal rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!canUseDom || !isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    const body = document.body
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      body.style.overflow = ''
      body.style.paddingRight = ''
    }
  }, [isOpen, onClose, canUseDom])

  if (!canUseDom || !mounted) return null

  return createPortal(
    <div
      className={
        'fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm transition-opacity duration-300 ' +
        (isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0')
      }
      onMouseDown={(event) => {
        if (!isOpen) return
        if (event.target === event.currentTarget) onClose()
      }}
      aria-hidden={!isOpen}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          'max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-2xl transition-all duration-300 ' +
          (isOpen ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.98] opacity-0')
        }
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100"
            aria-label="Zavrieť cenník"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(100vh-8.5rem)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}
