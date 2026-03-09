'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Check, Eye, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { AnimatedSelect } from '@/components/ui/AnimatedSelect'
import { useI18n } from '@/components/layout/LanguageProvider'
import { supabase } from '@/lib/supabaseClient'
import { type Booking, type Resource, type Service } from '@/lib/types'
import { formatDateLocale, normalizeCategory } from '@/lib/utils/validation'

interface AdminBookingsTableProps {
  bookings: Booking[]
  services: Service[]
  resources: Resource[]
  onRefresh: () => void
}

type QuickFilter = 'all' | 'today' | 'tomorrow' | 'week' | 'trainings' | 'courts'

function statusBadge(status: Booking['status']) {
  if (status === 'confirmed') return 'badge-success'
  if (status === 'pending') return 'badge-warning'
  return 'badge-danger'
}

function isoDateOffset(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function minutesOf(time: string) {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export function AdminBookingsTable({ bookings, services, resources, onRefresh }: AdminBookingsTableProps) {
  const { tr, trList } = useI18n()
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
  const resourceById = useMemo(() => new Map(resources.map((resource) => [resource.id, resource])), [resources])

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
    return resources.filter((resource) => set.has(resource.id))
  }, [bookings, resources])

  const conflictIds = useMemo(() => {
    const conflicts = new Set<string>()

    const byResourceDay = new Map<string, Booking[]>()
    bookings
      .filter((booking) => booking.status !== 'cancelled' && booking.resource_id)
      .forEach((booking) => {
        const key = `${booking.resource_id}_${booking.date}`
        const list = byResourceDay.get(key) || []
        list.push(booking)
        byResourceDay.set(key, list)
      })

    byResourceDay.forEach((list) => {
      const sorted = [...list].sort((a, b) => (a.start_time > b.start_time ? 1 : -1))
      for (let i = 0; i < sorted.length; i += 1) {
        for (let j = i + 1; j < sorted.length; j += 1) {
          const left = sorted[i]
          const right = sorted[j]
          const overlaps =
            minutesOf(left.start_time) < minutesOf(right.end_time) &&
            minutesOf(left.end_time) > minutesOf(right.start_time)

          if (overlaps) {
            conflicts.add(left.id)
            conflicts.add(right.id)
          }
        }
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
    }
  }

  function logActivity(message: string) {
    try {
      const list = JSON.parse(window.localStorage.getItem('sportbook:adminActivity') || '[]') as string[]
      list.unshift(`${new Date().toISOString()} • ${message}`)
      window.localStorage.setItem('sportbook:adminActivity', JSON.stringify(list.slice(0, 20)))
    } catch {
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
      const service = serviceById.get(booking.service_id)?.name || tr('bookingDetails.defaultService')
      return [
        booking.id,
        booking.customer_name,
        booking.customer_email || '',
        booking.customer_phone || '',
        service,
        booking.resource_id ? resourceById.get(booking.resource_id)?.name || booking.resource_id : '',
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
    link.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`
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
        toast.error(payload?.error || 'Failed to change status')
        return
      }
      toast.success(status === 'confirmed' ? tr('adminTable.confirmedStatus') : tr('adminTable.cancelledStatus'))
      logActivity(`Status rezervácie ${bookingId}: ${status}`)
      onRefresh()
    } catch (error) {
      console.error('Status update error:', error)
      toast.error('Failed to change booking status')
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
        toast.success(`Updated bookings: ${successCount}`)
      } else {
        toast.error(`Updated ${successCount} / ${selectedIds.length} bookings`)
      }

      logActivity(`Hromadná akcia: ${status} (${successCount})`)
      setSelectedIds([])
      onRefresh()
    } catch (error) {
      console.error('Bulk status update error:', error)
      toast.error('Failed to execute bulk action')
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteBooking(bookingId: string) {
    if (!window.confirm('Delete booking permanently?')) return

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
        toast.error(payload?.error || 'Failed to delete booking')
        return
      }
      toast.success('Booking deleted')
      logActivity(`Vymazaná rezervácia ${bookingId}`)
      onRefresh()
    } catch (error) {
      console.error('Delete booking error:', error)
      toast.error('Failed to delete booking')
    } finally {
      setActionLoading(null)
    }
  }

  function openBookingDetail(booking: Booking) {
    setSelectedBooking((prev) => (prev?.id === booking.id ? null : booking))
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50/80 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('adminTable.searchPlaceholder')}
              className="control-soft w-full rounded-xl py-2 pl-9 pr-3 text-sm"
            />
          </label>

          <AnimatedSelect
            value={statusFilter}
            onChange={(nextValue) => setStatusFilter(nextValue as 'all' | Booking['status'])}
            options={[
              { value: 'all', label: tr('adminTable.allStatuses') },
              { value: 'pending', label: tr('adminTable.pendingStatus') },
              { value: 'confirmed', label: tr('adminTable.confirmedStatus') },
              { value: 'cancelled', label: tr('adminTable.cancelledStatus') },
            ]}
            buttonClassName="rounded-xl px-3 py-2 text-sm"
          />

          <AnimatedSelect
            value={serviceFilter}
            onChange={setServiceFilter}
            options={[
              { value: 'all', label: tr('adminTable.allServices') },
              ...services.map((service) => ({ value: service.id, label: service.name })),
            ]}
            buttonClassName="rounded-xl px-3 py-2 text-sm"
          />

          <AnimatedSelect
            value={resourceFilter}
            onChange={setResourceFilter}
            options={[
              { value: 'all', label: tr('adminTable.allResources') },
              ...uniqueResources.map((resource) => ({ value: resource.id, label: resource.name })),
            ]}
            buttonClassName="rounded-xl px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { key: 'all', label: tr('adminTable.chips.all') },
            { key: 'today', label: tr('adminTable.chips.today') },
            { key: 'tomorrow', label: tr('adminTable.chips.tomorrow') },
            { key: 'week', label: tr('adminTable.chips.week') },
            { key: 'trainings', label: tr('adminTable.chips.trainings') },
            { key: 'courts', label: tr('adminTable.chips.courts') },
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
          <span className="text-xs text-slate-500">{tr('adminTable.shownBookings', { count: filtered.length })}</span>
          <Button size="sm" variant="secondary" onClick={exportCsv}>
            {tr('adminTable.exportCsv')}
          </Button>
        </div>

        {selectedIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 p-2.5">
            <span className="text-xs font-semibold text-blue-700">{tr('adminTable.selectedBookings', { count: selectedIds.length })}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkUpdateStatus('confirmed')}
              isLoading={actionLoading === 'bulk'}
            >
              {tr('adminTable.confirmSelected')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkUpdateStatus('cancelled')}
              isLoading={actionLoading === 'bulk'}
            >
              {tr('adminTable.cancelSelected')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setSelectedIds([])}>
              {tr('adminTable.clearSelection')}
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
                  aria-label={tr('adminTable.selectAll')}
                />
              </th>
              {trList('adminTable.columns').map((col) => (
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
                    className="transition-colors duration-200 hover:bg-slate-50/85"
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
                        aria-label={`Select booking ${booking.customer_name}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{booking.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{service?.name || tr('bookingDetails.defaultService')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {booking.resource_id ? resourceById.get(booking.resource_id)?.name || booking.resource_id : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatDateLocale(booking.date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {booking.start_time.slice(0, 5)} – {booking.end_time.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(booking.status)}`}>
                        {booking.status === 'pending'
                          ? tr('adminTable.pendingStatus')
                          : booking.status === 'confirmed'
                            ? tr('adminTable.confirmedStatus')
                            : tr('adminTable.cancelledStatus')}
                      </span>
                      {conflictIds.has(booking.id) ? (
                        <span className="ml-2 inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">
                          {tr('adminTable.needsReview')}
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
                              title={tr('adminTable.actionConfirm')}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateStatus(booking.id, 'cancelled')}
                              isLoading={actionLoading === booking.id}
                              disabled={actionLoading !== null}
                              title={tr('adminTable.actionCancel')}
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
                          title={tr('adminTable.actionDetail')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => deleteBooking(booking.id)}
                          isLoading={actionLoading === booking.id}
                          disabled={actionLoading !== null}
                          title={tr('adminTable.actionDelete')}
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
                              <h3 className="text-lg font-bold text-slate-900">{tr('adminTable.detailTitle')}</h3>
                              <p className="mt-1 text-sm text-slate-600">{tr('adminTable.detailHint')}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedBooking(null)}
                              className="rounded-full border border-slate-200 p-1.5 text-slate-600 transition-all duration-200 hover:bg-slate-100"
                              aria-label={tr('common.close')}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                            <p className="font-semibold text-slate-900">{selectedBooking.customer_name}</p>
                            <p className="mt-1">{serviceById.get(selectedBooking.service_id)?.name || tr('bookingDetails.defaultService')}</p>
                            <p className="mt-1">
                              {selectedBooking.resource_id
                                ? resourceById.get(selectedBooking.resource_id)?.name || selectedBooking.resource_id
                                : tr('adminTable.noResource')}
                            </p>
                            <p className="mt-1">
                              {formatDateLocale(selectedBooking.date)} • {selectedBooking.start_time.slice(0, 5)} –{' '}
                              {selectedBooking.end_time.slice(0, 5)}
                            </p>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
                            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <span className="font-semibold">{tr('common.email')}:</span> {selectedBooking.customer_email || '—'}
                            </p>
                            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <span className="font-semibold">{tr('common.phone')}:</span> {selectedBooking.customer_phone || '—'}
                            </p>
                          </div>

                          {selectedBooking.note ? (
                            <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                              <span className="font-semibold">{tr('common.note')}:</span> {selectedBooking.note}
                            </p>
                          ) : null}

                          <div className="mt-4">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">{tr('adminTable.adminNote')}</label>
                            <textarea
                              value={noteDraft}
                              onChange={(e) => {
                                setNoteDraft(e.target.value)
                                saveAdminNote(selectedBooking.id, e.target.value)
                              }}
                              rows={3}
                              className="control-soft w-full rounded-xl px-3 py-2 text-sm"
                              placeholder={tr('adminTable.adminNotePlaceholder')}
                            />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {selectedBooking.status === 'pending' ? (
                              <>
                                <Button onClick={() => updateStatus(selectedBooking.id, 'confirmed')}>
                                  {tr('adminTable.confirmBooking')}
                                </Button>
                                <Button variant="secondary" onClick={() => updateStatus(selectedBooking.id, 'cancelled')}>
                                  {tr('adminTable.cancelBooking')}
                                </Button>
                              </>
                            ) : null}
                            <Button variant="secondary" onClick={() => setSelectedBooking(null)}>
                              {tr('adminTable.closePanel')}
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
        <div className="p-8 text-center">
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-600">
            {tr('adminTable.noBookings')}
          </div>
        </div>
      )}

    </section>
  )
}
