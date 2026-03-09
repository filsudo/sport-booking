'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

type Option = {
  value: string
  label: string
}

type AnimatedSelectProps = {
  value: string
  options: Option[]
  onChange: (value: string) => void
  className?: string
  buttonClassName?: string
}

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ')
}

export function AnimatedSelect({
  value,
  options,
  onChange,
  className,
  buttonClassName,
}: AnimatedSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const selected = useMemo(
    () => options.find((option) => option.value === value) || options[0],
    [options, value]
  )

  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', onOutsideClick)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('mousedown', onOutsideClick)
      window.removeEventListener('keydown', onEscape)
    }
  }, [])

  return (
    <div ref={rootRef} className={cx('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cx(
          'control-soft inline-flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-slate-700',
          buttonClassName
        )}
      >
        <span className="truncate pr-2 text-left">{selected?.label || ''}</span>
        <ChevronDown
          className={cx(
            'h-4 w-4 shrink-0 text-blue-700 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="animate-select-in absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-blue-200 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.14)]"
        >
          <div className="max-h-60 overflow-y-auto p-1.5">
            {options.map((option) => {
              const active = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={cx(
                    'group mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-all duration-200 last:mb-0',
                    active
                      ? 'bg-blue-600 text-white shadow-[0_8px_16px_rgba(37,99,235,0.25)]'
                      : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                  )}
                >
                  <span className="truncate text-left">{option.label}</span>
                  <Check
                    className={cx(
                      'h-4 w-4 shrink-0',
                      active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                    )}
                  />
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
