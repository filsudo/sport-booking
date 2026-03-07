'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabaseClient'

function formatSKPhone(raw: string) {
  let v = raw.replace(/[^\d+]/g, '')

  if (v.startsWith('00')) v = '+' + v.slice(2)
  if (v.startsWith('0')) v = '+421' + v.slice(1)

  const digitsOnly = v.replace(/\D/g, '')
  const hasPlus = v.startsWith('+')

  if (!hasPlus) {
    if (digitsOnly.length === 9) {
      v = '+421' + digitsOnly
    } else {
      v = digitsOnly
    }
  }

  const d = v.replace(/\D/g, '')
  if (!d.startsWith('421')) return raw

  const rest = d.slice(3, 12)
  const p1 = rest.slice(0, 3)
  const p2 = rest.slice(3, 6)
  const p3 = rest.slice(6, 9)

  let out = '+421'
  if (p1) out += ` ${p1}`
  if (p2) out += ` ${p2}`
  if (p3) out += ` ${p3}`
  return out
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
  resourceId: string | null
  date: string
  startTime: string
  endTime: string
}

export default function BookingDetailsPage() {
  const router = useRouter()

  const [summary, setSummary] = useState<Summary | null>(null)
  const [serviceName, setServiceName] = useState('Služba')
  const [resourceName, setResourceName] = useState('Zdroj')
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

    if (!serviceId || !date || !startTime) {
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
        localSummary.resourceId
          ? supabase.from('resources').select('name').eq('id', localSummary.resourceId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
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
      nextErrors.customer_name = 'Meno je povinné'
    }

    if (!formData.customer_email.trim() && !formData.customer_phone.trim()) {
      nextErrors.contact = 'Zadajte aspoň email alebo telefón'
    }

    if (formData.customer_email.trim() && !/^\S+@\S+\.\S+$/.test(formData.customer_email.trim())) {
      nextErrors.customer_email = 'Neplatný email'
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
        throw new Error(payload?.error || 'Nepodarilo sa dokončiť rezerváciu')
      }

      router.push(
        `/booking/success?id=${payload.id}&service=${encodeURIComponent(serviceName)}&serviceId=${encodeURIComponent(
          summary.serviceId
        )}&resource=${encodeURIComponent(resourceName)}&resourceId=${encodeURIComponent(
          summary.resourceId || ''
        )}&date=${encodeURIComponent(summary.date)}&start=${encodeURIComponent(
          summary.startTime
        )}&end=${encodeURIComponent(summary.endTime)}`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nepodarilo sa dokončiť rezerváciu'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (!summary) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-slate-900">Chýbajú údaje rezervácie</h1>
        <p className="mt-2 text-slate-600">Vráťte sa na výber termínu a skúste to znova.</p>
        <div className="mt-6">
          <Button onClick={() => router.push('/booking')}>Späť na rezerváciu</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card animate-section-in p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-slate-900">Dokončenie rezervácie</h1>
          <p className="mt-2 text-slate-600">Skontrolujte zhrnutie a doplňte kontaktné údaje.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Meno *</label>
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
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Meno a priezvisko"
              />
              {errors.customer_name && <p className="mt-1 text-xs text-red-600">{errors.customer_name}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, customer_email: e.target.value }))
                    setErrors((prev) => ({ ...prev, customer_email: '', contact: '' }))
                  }}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="meno@email.sk"
                />
                <p className="mt-1 text-xs text-slate-500">Email použijeme na potvrdenie rezervácie.</p>
                {errors.customer_email && <p className="mt-1 text-xs text-red-600">{errors.customer_email}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Telefón</label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={formData.customer_phone}
                  onChange={(e) => {
                    const formatted = formatSKPhone(e.target.value)
                    setFormData((prev) => ({ ...prev, customer_phone: formatted }))
                    setErrors((prev) => ({ ...prev, contact: '' }))
                  }}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+421 951 226 498"
                />
                <p className="mt-1 text-xs text-slate-500">Telefón sa automaticky formátuje.</p>
              </div>
            </div>

            {errors.contact && <p className="text-xs text-red-600">{errors.contact}</p>}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Poznámka (voliteľné)</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Doplňujúce informácie k rezervácii"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" type="button" onClick={() => router.push('/booking')}>
                Späť
              </Button>
              <Button type="submit" isLoading={loading} disabled={!isValid}>
                Potvrdiť rezerváciu
              </Button>
            </div>
          </form>
        </div>

        <aside className="animate-section-in space-y-4 [animation-delay:80ms]">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Zhrnutie rezervácie</p>
            <p className="mt-3"><span className="font-semibold">Služba:</span> {serviceName}</p>
            <p><span className="font-semibold">Zdroj:</span> {resourceName}</p>
            <p><span className="font-semibold">Dátum:</span> {summary.date}</p>
            <p>
              <span className="font-semibold">Čas:</span> {summary.startTime.slice(0, 5)} – {summary.endTime.slice(0, 5)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm">
            Potvrdenie rezervácie odošleme na email alebo telefón. Ak potrebujete zmenu termínu, kontaktujte nás.
          </div>
        </aside>
      </div>
    </div>
  )
}
