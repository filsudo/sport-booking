'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Check, Eye, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabaseClient'
import { type Booking, type Service } from '@/lib/types'
import { formatDateLocale, normalizeCategory } from '@/lib/utils/validation'

interface AdminBookingsTableProps {
  bookings: Booking[]
  services: Service[]
  onRefresh: () => void
}

type QuickFilter = 'all' | 'today' | 'tomorrow' | 'week' | 'trainings' | 'courts'

function statusBadge(status: Booking['status']) {
  if (status === 'confirmed') return 'bg-blue-100 text-blue-800 ring-1 ring-blue-200'
  if (status === 'pending') return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
  return 'bg-black/10 text-slate-700 ring-1 ring-slate-200'
}

function isoDateOffset(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function AdminBookingsTable({ bookings, services, onRefresh }: AdminBookingsTableProps) {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Booking['status']>('all')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [resourceFilter, setResourceFilter] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [noteDraft, setNoteDraft] = useState('')

  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services])

  const filtered = useMemo(() => {
    const todayIso = isoDateOffset(0)
    const tomorrowIso = isoDateOffset(1)
    const weekLimit = isoDateOffset(7)

    return bookings.filter((booking) => {
      const matchesStatus = statusFilter === 'all' ? true : booking.status === statusFilter
      const q = query.trim().toLowerCase()
      const matchesQuery =
        q.length === 0 ||
        booking.customer_name.toLowerCase().includes(q) ||
        (booking.customer_email || '').toLowerCase().includes(q) ||
        (booking.customer_phone || '').toLowerCase().includes(q)

      const matchesService = serviceFilter === 'all' ? true : booking.service_id === serviceFilter
      const matchesResource = resourceFilter === 'all' ? true : (booking.resource_id || '') === resourceFilter

      const service = serviceById.get(booking.service_id)
      const normalizedCategory = normalizeCategory(service?.name || '', service?.category)
      const matchesQuick =
        quickFilter === 'all'
          ? true
          : quickFilter === 'today'
            ? booking.date === todayIso
            : quickFilter === 'tomorrow'
              ? booking.date === tomorrowIso
              : quickFilter === 'week'
                ? booking.date >= todayIso && booking.date <= weekLimit
                : quickFilter === 'trainings'
                  ? normalizedCategory === 'trainings'
                  : normalizedCategory === 'courts'

      return matchesStatus && matchesQuery && matchesQuick && matchesService && matchesResource
    })
  }, [bookings, query, statusFilter, quickFilter, serviceById, serviceFilter, resourceFilter])

  const uniqueResources = useMemo(() => {
    const set = new Set<string>()
    bookings.forEach((booking) => {
      if (booking.resource_id) set.add(booking.resource_id)
    })
    return Array.from(set)
  }, [bookings])

  const conflictIds = useMemo(() => {
    const byKey = new Map<string, Booking[]>()
    bookings
      .filter((booking) => booking.status !== 'cancelled')
      .forEach((booking) => {
        const key = `${booking.date}_${booking.start_time}_${booking.end_time}_${booking.resource_id || 'none'}`
        const list = byKey.get(key) || []
        list.push(booking)
        byKey.set(key, list)
      })

    const conflicts = new Set<string>()
    byKey.forEach((list) => {
      if (list.length > 1) {
        list.forEach((item) => conflicts.add(item.id))
      }
    })
    return conflicts
  }, [bookings])

  const allFilteredSelected = filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id))

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('sportbook:adminNotes') || '{}') as Record<string, string>
      setAdminNotes(stored)
    } catch {
      setAdminNotes({})
    }
  }, [])

  useEffect(() => {
    if (!selectedBooking) return
    setNoteDraft(adminNotes[selectedBooking.id] || '')
  }, [selectedBooking, adminNotes])

  useEffect(() => {
    if (!selectedBooking) return
    function onEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedBooking(null)
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [selectedBooking])

  function saveAdminNote(bookingId: string, note: string) {
    const next = { ...adminNotes, [bookingId]: note }
    setAdminNotes(next)
    try {
      window.localStorage.setItem('sportbook:adminNotes', JSON.stringify(next))
    } catch {
      // ignore storage errors
    }
  }

  function logActivity(message: string) {
    try {
      const list = JSON.parse(window.localStorage.getItem('sportbook:adminActivity') || '[]') as string[]
      list.unshift(`${new Date().toISOString()} • ${message}`)
      window.localStorage.setItem('sportbook:adminActivity', JSON.stringify(list.slice(0, 20)))
    } catch {
      // ignore storage errors
    }
  }

  async function readJsonSafe(res: Response) {
    try {
      return await res.json()
    } catch {
      return null
    }
  }

  async function getApiHeaders() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    return headers
  }

  function exportCsv() {
    const header = ['id', 'meno', 'email', 'telefon', 'sluzba', 'zdroj', 'datum', 'start', 'end', 'status']
    const rows = filtered.map((booking) => {
      const service = serviceById.get(booking.service_id)?.name || 'Služba'
      return [
        booking.id,
        booking.customer_name,
        booking.customer_email || '',
        booking.customer_phone || '',
        service,
        booking.resource_id || '',
        booking.date,
        booking.start_time,
        booking.end_time,
        booking.status,
      ]
    })

    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rezervacie-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function updateStatus(bookingId: string, status: Booking['status']) {
    try {
      setActionLoading(bookingId)
      const headers = await getApiHeaders()
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: bookingId, status }),
      })
      const payload = await readJsonSafe(res)
      if (!res.ok) {
        toast.error(payload?.error || 'Nepodarilo sa zmeniť status')
        return
      }
      toast.success(status === 'confirmed' ? 'Rezervácia potvrdená' : 'Rezervácia zrušená')
      logActivity(`Status rezervácie ${bookingId}: ${status}`)
      onRefresh()
    } catch (error) {
      console.error('Status update error:', error)
      toast.error('Nepodarilo sa zmeniť status rezervácie')
    } finally {
      setActionLoading(null)
    }
  }

  async function bulkUpdateStatus(status: Booking['status']) {
    if (selectedIds.length === 0) return

    try {
      setActionLoading('bulk')
      const headers = await getApiHeaders()
      const results = await Promise.all(
        selectedIds.map(async (id) => {
          const response = await fetch('/api/bookings', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ id, status }),
          })
          return response.ok
        })
      )

      const successCount = results.filter(Boolean).length
      if (successCount === selectedIds.length) {
        toast.success(`Aktualizovaných rezervácií: ${successCount}`)
      } else {
        toast.error(`Aktualizovaných ${successCount} z ${selectedIds.length} rezervácií`)
      }

      logActivity(`Hromadná akcia: ${status} (${successCount})`)
      setSelectedIds([])
      onRefresh()
    } catch (error) {
      console.error('Bulk status update error:', error)
      toast.error('Nepodarilo sa vykonať hromadnú akciu')
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteBooking(bookingId: string) {
    if (!window.confirm('Naozaj chcete vymazať rezerváciu?')) return

    try {
      setActionLoading(bookingId)
      const headers = await getApiHeaders()
      const res = await fetch('/api/bookings', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ id: bookingId }),
      })
      const payload = await readJsonSafe(res)
      if (!res.ok) {
        toast.error(payload?.error || 'Nepodarilo sa vymazať rezerváciu')
        return
      }
      toast.success('Rezervácia bola vymazaná')
      logActivity(`Vymazaná rezervácia ${bookingId}`)
      onRefresh()
    } catch (error) {
      console.error('Delete booking error:', error)
      toast.error('Nepodarilo sa vymazať rezerváciu')
    } finally {
      setActionLoading(null)
    }
  }

  function openBookingDetail(booking: Booking) {
    setSelectedBooking((prev) => (prev?.id === booking.id ? null : booking))
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Vyhľadať podľa mena, emailu alebo telefónu"
              className="control-soft w-full rounded-xl py-2 pl-9 pr-3 text-sm"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | Booking['status'])}
            className="control-soft select-soft rounded-xl px-3 py-2 text-sm"
          >
            <option value="all">Všetky statusy</option>
            <option value="pending">Čakajúce</option>
            <option value="confirmed">Potvrdené</option>
            <option value="cancelled">Zrušené</option>
          </select>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="control-soft select-soft rounded-xl px-3 py-2 text-sm"
          >
            <option value="all">Všetky služby</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>

          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="control-soft select-soft rounded-xl px-3 py-2 text-sm"
          >
            <option value="all">Všetky zdroje</option>
            {uniqueResources.map((resourceId) => (
              <option key={resourceId} value={resourceId}>{resourceId}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Všetko' },
            { key: 'today', label: 'Dnes' },
            { key: 'tomorrow', label: 'Zajtra' },
            { key: 'week', label: 'Tento týždeň' },
            { key: 'trainings', label: 'Iba tréningy' },
            { key: 'courts', label: 'Iba kurty' },
          ].map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setQuickFilter(chip.key as QuickFilter)}
              data-active={quickFilter === chip.key}
              className={
                'choice-pill rounded-full border px-3 py-1.5 text-xs font-semibold ' +
                (quickFilter === chip.key
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700')
              }
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">Zobrazených rezervácií: {filtered.length}</span>
          <Button size="sm" variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>

        {selectedIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2.5">
            <span className="text-xs font-semibold text-blue-700">Vybraných rezervácií: {selectedIds.length}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkUpdateStatus('confirmed')}
              isLoading={actionLoading === 'bulk'}
            >
              Potvrdiť vybrané
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkUpdateStatus('cancelled')}
              isLoading={actionLoading === 'bulk'}
            >
              Zrušiť vybrané
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setSelectedIds([])}>
              Zrušiť výber
            </Button>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead className="border-b border-slate-200 bg-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedIds(filtered.map((item) => item.id))
                    } else {
                      setSelectedIds([])
                    }
                  }}
                  aria-label="Vybrať všetky"
                />
              </th>
              {['Meno', 'Služba', 'Zdroj', 'Dátum', 'Čas', 'Status', 'Akcie'].map((col) => (
                <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.map((booking) => {
              const service = serviceById.get(booking.service_id)
              return (
                <Fragment key={booking.id}>
                  <tr
                    id={`booking-row-${booking.id}`}
                    className="transition-colors duration-150 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(booking.id)}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedIds((prev) => [...prev, booking.id])
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== booking.id))
                          }
                        }}
                        aria-label={`Vybrať rezerváciu ${booking.customer_name}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{booking.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{service?.name || 'Služba'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{booking.resource_id || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatDateLocale(booking.date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {booking.start_time.slice(0, 5)} – {booking.end_time.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(booking.status)}`}>
                        {booking.status === 'pending' ? 'Čakajúca' : booking.status === 'confirmed' ? 'Potvrdená' : 'Zrušená'}
                      </span>
                      {conflictIds.has(booking.id) ? (
                        <span className="ml-2 inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">
                          Vyžaduje kontrolu
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {booking.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateStatus(booking.id, 'confirmed')}
                              isLoading={actionLoading === booking.id}
                              disabled={actionLoading !== null}
                              title="Potvrdiť"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateStatus(booking.id, 'cancelled')}
                              isLoading={actionLoading === booking.id}
                              disabled={actionLoading !== null}
                              title="Zrušiť"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openBookingDetail(booking)}
                          disabled={actionLoading !== null}
                          title="Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => deleteBooking(booking.id)}
                          isLoading={actionLoading === booking.id}
                          disabled={actionLoading !== null}
                          title="Vymazať"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {selectedBooking?.id === booking.id ? (
                    <tr className="bg-slate-50/60">
                      <td colSpan={8} className="px-4 pb-5">
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-bold text-slate-900">Detail rezervácie</h3>
                              <p className="mt-1 text-sm text-slate-600">Zobrazené pri vybranom zázname.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedBooking(null)}
                              className="rounded-full border border-slate-200 p-1.5 text-slate-600 transition-all duration-200 hover:bg-slate-100"
                              aria-label="Zavrieť"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                            <p className="font-semibold text-slate-900">{selectedBooking.customer_name}</p>
                            <p className="mt-1">{serviceById.get(selectedBooking.service_id)?.name || 'Služba'}</p>
                            <p className="mt-1">
                              {formatDateLocale(selectedBooking.date)} • {selectedBooking.start_time.slice(0, 5)} –{' '}
                              {selectedBooking.end_time.slice(0, 5)}
                            </p>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
                            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <span className="font-semibold">Email:</span> {selectedBooking.customer_email || '—'}
                            </p>
                            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <span className="font-semibold">Telefón:</span> {selectedBooking.customer_phone || '—'}
                            </p>
                          </div>

                          {selectedBooking.note ? (
                            <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                              <span className="font-semibold">Poznámka:</span> {selectedBooking.note}
                            </p>
                          ) : null}

                          <div className="mt-4">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Admin poznámka</label>
                            <textarea
                              value={noteDraft}
                              onChange={(e) => {
                                setNoteDraft(e.target.value)
                                saveAdminNote(selectedBooking.id, e.target.value)
                              }}
                              rows={3}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="VIP klient, špeciálne požiadavky…"
                            />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {selectedBooking.status === 'pending' ? (
                              <>
                                <Button onClick={() => updateStatus(selectedBooking.id, 'confirmed')}>
                                  Potvrdiť rezerváciu
                                </Button>
                                <Button variant="secondary" onClick={() => updateStatus(selectedBooking.id, 'cancelled')}>
                                  Zrušiť rezerváciu
                                </Button>
                              </>
                            ) : null}
                            <Button variant="secondary" onClick={() => setSelectedBooking(null)}>
                              Zavrieť panel
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="p-8 text-center text-sm text-slate-600">Žiadne rezervácie pre aktuálny filter.</div>
      )}

    </section>
  )
}
