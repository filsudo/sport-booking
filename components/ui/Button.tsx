import * as React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ')
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex transform-gpu items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 select-none ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]'

  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:
      'bg-gradient-to-r from-blue-600 to-blue-700 text-white ring-1 ring-blue-500/70 shadow-[0_10px_26px_rgba(37,99,235,0.35)] hover:from-blue-500 hover:to-blue-700 hover:shadow-[0_14px_32px_rgba(37,99,235,0.42)]',
    secondary:
      'bg-gradient-to-r from-white to-blue-50 text-slate-800 ring-1 ring-blue-200 shadow-[0_8px_20px_rgba(15,23,42,0.1)] hover:from-blue-50 hover:to-blue-100 hover:text-blue-700 hover:ring-blue-300 hover:shadow-[0_12px_28px_rgba(37,99,235,0.2)]',
    danger:
      'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-[0_10px_24px_rgba(220,38,38,0.28)] hover:from-red-500 hover:to-red-700 hover:shadow-[0_14px_30px_rgba(220,38,38,0.35)]',
    ghost:
      'bg-transparent text-gray-900 hover:bg-slate-100',
  }

  const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-5 text-base',
  }

  return (
    <button
      className={cx(base, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="inline-flex items-center" aria-hidden="true">
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              d="M22 12a10 10 0 0 1-10 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )}
      <span className={cx(isLoading && 'opacity-90')}>{children}</span>
    </button>
  )
}
