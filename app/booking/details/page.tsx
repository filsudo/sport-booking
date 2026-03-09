'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/components/layout/LanguageProvider'
import { supabase } from '@/lib/supabaseClient'

function normalizePhoneInput(raw: string) {
  const MAX_PHONE_DIGITS = 15
  const cleaned = raw.replace(/[^\d+\s()-]/g, '')
  if (!cleaned) return ''

  const withPlus = cleaned.trimStart().startsWith('+')
  let digits = 0
  let next = withPlus ? '+' : ''

  for (const char of cleaned) {
    if (char === '+') continue

    if (/\d/.test(char)) {
      if (digits >= MAX_PHONE_DIGITS) continue
      next += char
      digits += 1
      continue
    }

    if (!/[\s()-]/.test(char) || next.length === 0) continue
    const last = next[next.length - 1]
    if (last === ' ' || last === '(' || last === '-') continue
    next += char === '-' ? ' ' : char
  }

  return next
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()
}

function isValidInternationalPhone(value: string) {
  const compact = value.replace(/[\s()-]/g, '')
  if (!compact) return true
  if (compact.startsWith('+')) {
    return /^\+\d{6,15}$/.test(compact)
  }
  return /^\d{6,15}$/.test(compact)
}

function normalizeName(value: string) {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  return clean
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

type Summary = {
  serviceId: string
  resourceId: string
  date: string
  startTime: string
  endTime: string
}

export default function BookingDetailsPage() {
  const router = useRouter()
  const { lang, tr } = useI18n()

  const [summary, setSummary] = useState<Summary | null>(null)
  const [serviceName, setServiceName] = useState(tr('bookingDetails.defaultService'))
  const [resourceName, setResourceName] = useState(tr('bookingDetails.defaultResource'))
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    note: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    const serviceId = params.get('serviceId')
    const resourceId = params.get('resourceId')
    const date = params.get('date')
    const startTime = params.get('startTime') || params.get('time')
    const endTime = params.get('endTime')

    if (!serviceId || !resourceId || !date || !startTime) {
      setSummary(null)
      return
    }

    setSummary({
      serviceId,
      resourceId,
      date,
      startTime,
      endTime: endTime || startTime,
    })
  }, [])

  useEffect(() => {
    setServiceName(tr('bookingDetails.defaultService'))
    setResourceName(tr('bookingDetails.defaultResource'))
  }, [tr])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('sportbook:bookingForm')
      if (!stored) return
      const parsed = JSON.parse(stored) as Partial<typeof formData>
      setFormData((prev) => ({ ...prev, ...parsed }))
    } catch {
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('sportbook:bookingForm', JSON.stringify(formData))
    } catch {
    }
  }, [formData])

  useEffect(() => {
    if (!summary) return
    const localSummary = summary

    let active = true

    async function loadLabels() {
      const [serviceRes, resourceRes] = await Promise.all([
        supabase.from('services').select('name').eq('id', localSummary.serviceId).maybeSingle(),
        supabase.from('resources').select('name').eq('id', localSummary.resourceId).maybeSingle(),
      ])

      if (!active) return
      if (serviceRes.data?.name) setServiceName(serviceRes.data.name)
      if (resourceRes.data?.name) setResourceName(resourceRes.data.name)
    }

    loadLabels()
    return () => {
      active = false
    }
  }, [summary])

  const isValid = useMemo(() => {
    if (!formData.customer_name.trim()) return false
    if (!formData.customer_email.trim() && !formData.customer_phone.trim()) return false
    return true
  }, [formData])

  function validateForm() {
    const nextErrors: Record<string, string> = {}
    if (!formData.customer_name.trim()) {
      nextErrors.customer_name = tr('validation.requiredName')
    }

    if (!formData.customer_email.trim() && !formData.customer_phone.trim()) {
      nextErrors.contact = tr('validation.requiredContact')
    }

    if (formData.customer_email.trim() && !/^\S+@\S+\.\S+$/.test(formData.customer_email.trim())) {
      nextErrors.customer_email = tr('validation.invalidEmail')
    }

    if (formData.customer_phone.trim() && !isValidInternationalPhone(formData.customer_phone.trim())) {
      nextErrors.customer_phone = tr('validation.invalidPhone')
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!summary) return

    if (!validateForm()) return

    try {
      setLoading(true)

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: summary.serviceId,
          resource_id: summary.resourceId,
          date: summary.date,
          start_time: summary.startTime,
          end_time: summary.endTime,
          customer_name: normalizeName(formData.customer_name),
          customer_email: formData.customer_email.trim(),
          customer_phone: formData.customer_phone.trim(),
          note: formData.note.trim(),
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || tr('validation.bookingFailed'))
      }

      router.push(
        `/booking/success?id=${payload.id}&service=${encodeURIComponent(serviceName)}&serviceId=${encodeURIComponent(
          summary.serviceId
        )}&resource=${encodeURIComponent(resourceName)}&resourceId=${encodeURIComponent(
          summary.resourceId
        )}&date=${encodeURIComponent(summary.date)}&start=${encodeURIComponent(
          summary.startTime
        )}&end=${encodeURIComponent(summary.endTime)}`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : tr('validation.bookingFailed')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (!summary) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-slate-900">{tr('bookingDetails.missingTitle')}</h1>
        <p className="mt-2 text-slate-600">{tr('bookingDetails.missingText')}</p>
        <div className="mt-6">
          <Button onClick={() => router.push('/booking')}>{tr('bookingDetails.backToBooking')}</Button>
        </div>
      </div>
    )
  }

  const phonePlaceholder =
    lang === 'sk' ? tr('bookingDetails.phonePlaceholderSk') : tr('bookingDetails.phonePlaceholder')
  const phoneHelp = lang === 'sk' ? tr('bookingDetails.phoneHelpSk') : tr('bookingDetails.phoneHelp')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card animate-section-in p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-slate-900">{tr('bookingDetails.title')}</h1>
          <p className="mt-2 text-slate-600">{tr('bookingDetails.subtitle')}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{tr('bookingDetails.fullName')}</label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, customer_name: e.target.value }))
                  setErrors((prev) => ({ ...prev, customer_name: '' }))
                }}
                onBlur={() => {
                  setFormData((prev) => ({ ...prev, customer_name: normalizeName(prev.customer_name) }))
                }}
                className="control-soft w-full rounded-xl px-4 py-2.5"
                placeholder={tr('bookingDetails.fullNamePlaceholder')}
              />
              {errors.customer_name && <p className="mt-1 text-xs text-red-600">{errors.customer_name}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{tr('common.email')}</label>
                <input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, customer_email: e.target.value }))
                    setErrors((prev) => ({ ...prev, customer_email: '', contact: '' }))
                  }}
                  className="control-soft w-full rounded-xl px-4 py-2.5"
                  placeholder={tr('bookingDetails.emailPlaceholder')}
                />
                <p className="mt-1 text-xs text-slate-500">{tr('bookingDetails.emailHelp')}</p>
                {errors.customer_email && <p className="mt-1 text-xs text-red-600">{errors.customer_email}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">{tr('common.phone')}</label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={24}
                  value={formData.customer_phone}
                  onChange={(e) => {
                    const formatted = normalizePhoneInput(e.target.value)
                    setFormData((prev) => ({ ...prev, customer_phone: formatted }))
                    setErrors((prev) => ({ ...prev, contact: '', customer_phone: '' }))
                  }}
                  className="control-soft w-full rounded-xl px-4 py-2.5"
                  placeholder={phonePlaceholder}
                />
                <p className="mt-1 text-xs text-slate-500">{phoneHelp}</p>
                {errors.customer_phone && <p className="mt-1 text-xs text-red-600">{errors.customer_phone}</p>}
              </div>
            </div>

            {errors.contact && <p className="text-xs text-red-600">{errors.contact}</p>}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{tr('bookingDetails.noteLabel')}</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                rows={4}
                className="control-soft w-full rounded-xl px-4 py-2.5"
                placeholder={tr('bookingDetails.notePlaceholder')}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" type="button" onClick={() => router.push('/booking')}>
                {tr('common.back')}
              </Button>
              <Button type="submit" isLoading={loading} disabled={!isValid}>
                {tr('bookingDetails.submit')}
              </Button>
            </div>
          </form>
        </div>

        <aside className="animate-section-in space-y-4 [animation-delay:80ms]">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{tr('bookingDetails.summaryTitle')}</p>
            <p className="mt-3"><span className="font-semibold">{tr('common.service')}:</span> {serviceName}</p>
            <p><span className="font-semibold">{tr('common.resource')}:</span> {resourceName}</p>
            <p><span className="font-semibold">{tr('common.date')}:</span> {summary.date}</p>
            <p>
              <span className="font-semibold">{tr('common.time')}:</span> {summary.startTime.slice(0, 5)} - {summary.endTime.slice(0, 5)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
            {tr('bookingDetails.confirmHint')}
          </div>
        </aside>
      </div>
    </div>
  )
}
