'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'

type SlotState = 'free' | 'busy'

const resources = ['Kurt 1', 'Kurt 2', 'Stôl 1']
const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30']

function keyFor(resource: string, time: string) {
  return `${resource}_${time}`
}

function createInitialSlots() {
  const initial = new Map<string, SlotState>()
  resources.forEach((resource, rIndex) => {
    times.forEach((time, tIndex) => {
      const busy =
        (rIndex === 0 && (tIndex === 0 || tIndex === 4)) ||
        (rIndex === 1 && (tIndex === 1 || tIndex === 5)) ||
        (rIndex === 2 && (tIndex === 2 || tIndex === 3))
      initial.set(keyFor(resource, time), busy ? 'busy' : 'free')
    })
  })
  return initial
}

export function ReservationGridPreview() {
  const [slots, setSlots] = useState<Map<string, SlotState>>(createInitialSlots)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timeout = window.setTimeout(() => setLoading(false), 520)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (loading) return
    const interval = window.setInterval(() => {
      setSlots((prev) => {
        const next = new Map(prev)
        const allKeys = Array.from(next.keys())
        if (!allKeys.length) return prev

        const first = allKeys[Math.floor(Math.random() * allKeys.length)]
        const second = allKeys[Math.floor(Math.random() * allKeys.length)]

        ;[first, second].forEach((slotKey) => {
          if (!slotKey || slotKey === selectedKey) return
          const current = next.get(slotKey)
          if (!current) return
          next.set(slotKey, current === 'busy' ? 'free' : 'busy')
        })

        return next
      })
    }, 5200)

    return () => window.clearInterval(interval)
  }, [loading, selectedKey])

  const legend = useMemo(
    () => [
      { label: 'Voľné', className: 'border border-blue-300 bg-blue-50' },
      { label: 'Vybrané', className: 'border border-blue-600 bg-blue-600' },
      { label: 'Obsadené', className: 'border border-slate-300 bg-slate-200' },
    ],
    []
  )

  return (
    <div className="space-y-4 p-4">
      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-4 w-56 animate-pulse rounded bg-slate-200" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      ) : null}

      <div className={loading ? 'hidden' : 'animate-section-in space-y-4'}>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
          {legend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-full ${item.className}`} />
              {item.label}
            </span>
          ))}
          <span className="text-blue-600">• Live</span>
        </div>

        <div className="space-y-3">
          {resources.map((resource) => (
            <div key={resource} className="rounded-2xl border border-slate-200 p-3">
              <div className="mb-2 text-sm font-bold text-slate-900">{resource}</div>
              <div className="grid grid-cols-8 gap-1.5">
                {times.map((time) => {
                  const slotKey = keyFor(resource, time)
                  const state = slots.get(slotKey) ?? 'free'
                  const selected = selectedKey === slotKey
                  const disabled = state === 'busy'

                  return (
                    <button
                      key={slotKey}
                      type="button"
                      onClick={() => {
                        if (disabled) return
                        setSelectedKey(slotKey)
                      }}
                      className={
                        'h-7 rounded-lg border text-[10px] font-semibold transition-all duration-200 ' +
                        (selected
                          ? 'scale-[1.02] border-blue-600 bg-blue-600 text-white shadow-md'
                          : disabled
                            ? 'cursor-not-allowed border-slate-300 bg-slate-200 text-slate-400'
                            : 'border-blue-200 bg-blue-50/40 text-blue-700 hover:border-blue-400 hover:bg-blue-100/70')
                      }
                      aria-label={`${resource} ${time}`}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <Link href="/booking" className="block">
          <Button className="w-full">Otvoriť rezerváciu</Button>
        </Link>
      </div>
    </div>
  )
}
