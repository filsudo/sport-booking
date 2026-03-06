'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle2, Clock3, LogOut, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { type User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/Button'
import { AdminBookingsTable } from '@/components/admin/BookingsTable'
import { supabase } from '@/lib/supabaseClient'
import { type Booking, type Service } from '@/lib/types'

function toIsoToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [activityLog, setActivityLog] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'table' | 'calendar' | 'timeline'>('table')

  const refreshData = useCallback(async () => {
    try {
      setLoading(true)
      const [servicesRes, bookingsRes] = await Promise.all([
        supabase.from('services').select('*').order('name', { ascending: true }),
        supabase.from('bookings').select('*').order('date', { ascending: false }).order('start_time', { ascending: true }),
      ])

      if (servicesRes.error) throw servicesRes.error
      if (bookingsRes.error) throw bookingsRes.error

      setServices((servicesRes.data || []) as Service[])
      setBookings((bookingsRes.data || []) as Booking[])
    } catch (error) {
      console.error('Admin refresh error:', error)
      toast.error('Nepodarilo sa načítať admin údaje')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function init() {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        router.replace('/login?redirect=/admin')
        return
      }

      const email = data.user.email?.toLowerCase() || ''
      const { data: row } = await supabase.from('admin_users').select('email').eq('email', email).maybeSingle()

      if (!row) {
        await supabase.auth.signOut()
        router.replace('/login?error=not_admin')
        return
      }

      if (!active) return
      setUser(data.user)
      await refreshData()
    }

    init()
    return () => {
      active = false
    }
  }, [refreshData, router])

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('sportbook:adminActivity') || '[]') as string[]
      setActivityLog(stored.slice(0, 6))
    } catch {
      setActivityLog([])
    }
  }, [bookings.length])


  const stats = useMemo(() => {
    const today = toIsoToday()
    const todayBookings = bookings.filter((booking) => booking.date === today)

    const nextBooking = bookings
      .filter((booking) => `${booking.date}T${booking.start_time}` >= new Date().toISOString().slice(0, 19))
      .sort((a, b) => (`${a.date}T${a.start_time}` > `${b.date}T${b.start_time}` ? 1 : -1))[0]

    const hourlyCount = new Map<string, number>()
    todayBookings.forEach((booking) => {
      const hour = booking.start_time.slice(0, 2)
      hourlyCount.set(hour, (hourlyCount.get(hour) || 0) + 1)
    })

    const busiest = Array.from(hourlyCount.entries()).sort((a, b) => b[1] - a[1])[0]

    return {
      today: todayBookings.length,
      pending: bookings.filter((booking) => booking.status === 'pending').length,
      confirmed: bookings.filter((booking) => booking.status === 'confirmed').length,
      cancelled: bookings.filter((booking) => booking.status === 'cancelled').length,
      nextBooking,
      busiest: busiest ? `${busiest[0]}:00 - ${String(Number(busiest[0]) + 1).padStart(2, '0')}:00` : '—',
    }
  }, [bookings])

  const weeklyStats = useMemo(() => {
    const days: Array<{ date: string; count: number }> = []
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const count = bookings.filter((booking) => booking.date === iso).length
      days.push({ date: iso, count })
    }
    return days
  }, [bookings])

  const todayTimeline = useMemo(() => {
    const today = toIsoToday()
    return bookings
      .filter((booking) => booking.date === today)
      .sort((a, b) => (a.start_time > b.start_time ? 1 : -1))
  }, [bookings])

  const hourlyHeatmap = useMemo(() => {
    const map = new Map<string, number>()
    bookings.forEach((booking) => {
      const hour = booking.start_time.slice(0, 2)
      map.set(hour, (map.get(hour) || 0) + 1)
    })
    return Array.from({ length: 12 }).map((_, index) => {
      const hour = String(9 + index).padStart(2, '0')
      return { hour, count: map.get(hour) || 0 }
    })
  }, [bookings])


  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function printDailyPlan() {
    window.print()
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Spravovať</h1>
          <p className="mt-1 text-sm text-slate-600">Prihlásený používateľ: {user?.email || 'admin'}</p>
        </div>
        <Button variant="secondary" onClick={handleLogout}>
          <LogOut className="h-4 w-4" /> Odhlásiť sa
        </Button>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="card card-hover animate-section-in p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">Rezervácie dnes</p>
            <CalendarDays className="h-5 w-5 text-blue-700" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">{stats.today}</p>
        </article>
        <article className="card card-hover animate-section-in p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">Čakajúce</p>
            <Clock3 className="h-5 w-5 text-slate-700" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">{stats.pending}</p>
        </article>
        <article className="card card-hover animate-section-in p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">Potvrdené</p>
            <CheckCircle2 className="h-5 w-5 text-blue-700" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">{stats.confirmed}</p>
        </article>
        <article className="card card-hover animate-section-in p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">Zrušené</p>
            <XCircle className="h-5 w-5 text-slate-700" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">{stats.cancelled}</p>
        </article>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="card card-hover animate-section-in p-5">
          <p className="text-sm font-semibold text-slate-600">Najbližšia rezervácia</p>
          <p className="mt-2 text-sm text-slate-800">
            {stats.nextBooking
              ? `${stats.nextBooking.date} • ${stats.nextBooking.start_time.slice(0, 5)} – ${stats.nextBooking.end_time.slice(0, 5)}`
              : 'Žiadna nadchádzajúca rezervácia'}
          </p>
        </article>
        <article className="card card-hover animate-section-in p-5">
          <p className="text-sm font-semibold text-slate-600">Najvyťaženejší čas dnes</p>
          <p className="mt-2 text-sm text-slate-800">{stats.busiest}</p>
        </article>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className="card card-hover animate-section-in p-5 lg:col-span-2">
          <p className="text-sm font-semibold text-slate-600">Rezervácie za posledných 7 dní</p>
          <div className="mt-4 space-y-2">
            {weeklyStats.map((item) => (
              <div key={item.date} className="flex items-center gap-3 text-sm text-slate-600">
                <span className="w-24 text-xs">{item.date}</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(100, item.count * 15)}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-semibold text-slate-900">{item.count}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card card-hover animate-section-in p-5">
          <p className="text-sm font-semibold text-slate-600">Heatmap obsadenosti</p>
          <div className="mt-4 grid grid-cols-4 gap-2 text-xs text-slate-600">
            {hourlyHeatmap.map((slot) => (
              <div key={slot.hour} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
                <div className="text-xs font-semibold text-slate-900">{slot.hour}:00</div>
                <div className={slot.count >= 3 ? 'text-blue-700' : slot.count >= 1 ? 'text-blue-500' : 'text-slate-400'}>
                  {slot.count}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className="card card-hover animate-section-in p-5 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-900">Aktivita</h2>
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            {activityLog.length === 0 ? (
              <p>Žiadne recentné akcie.</p>
            ) : (
              activityLog.map((line) => (
                <p key={line} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">{line}</p>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'table', label: 'Tabuľka' },
              { key: 'calendar', label: 'Kalendár' },
              { key: 'timeline', label: 'Timeline' },
            ].map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => setViewMode(mode.key as 'table' | 'calendar' | 'timeline')}
                data-active={viewMode === mode.key}
                className={
                  'choice-pill rounded-full border px-3 py-1.5 text-xs font-semibold ' +
                  (viewMode === mode.key
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700')
                }
              >
                {mode.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={printDailyPlan}>
            Tlačiť dnešný plán
          </Button>
        </div>

        {viewMode === 'table' ? (
          loading ? (
            <div className="space-y-3">
              <div className="h-14 animate-pulse rounded-xl bg-slate-200" />
              <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
            </div>
          ) : (
            <AdminBookingsTable bookings={bookings} services={services} onRefresh={refreshData} />
          )
        ) : null}

        {viewMode === 'calendar' ? (
          <div className="card p-5">
            <h2 className="text-lg font-bold text-slate-900">Kalendár rezervácií</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from(
                bookings.reduce((map, booking) => {
                  const list = map.get(booking.date) || []
                  list.push(booking)
                  map.set(booking.date, list)
                  return map
                }, new Map<string, Booking[]>())
              )
                .sort(([a], [b]) => (a > b ? 1 : -1))
                .slice(0, 9)
                .map(([date, items]) => (
                  <div key={date} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">{date}</p>
                    <p className="mt-1 text-xs text-slate-600">Rezervácií: {items.length}</p>
                    <div className="mt-2 space-y-1.5">
                      {items.slice(0, 4).map((item) => (
                        <p key={item.id} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                          {item.start_time.slice(0, 5)} • {item.customer_name}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        {viewMode === 'timeline' ? (
          <div className="card p-5">
            <h2 className="text-lg font-bold text-slate-900">Timeline rezervácií dnes</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              {todayTimeline.length === 0 ? (
                <p>Žiadne rezervácie na dnes.</p>
              ) : (
                todayTimeline.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="font-semibold text-slate-900">{booking.start_time.slice(0, 5)}</span>
                    <span className="text-slate-600">{booking.customer_name}</span>
                    <span className="text-slate-500">{booking.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </section>

      <nav className="mt-6 flex flex-wrap gap-2">
        <Link href="/admin">
          <Button>Rezervácie</Button>
        </Link>
        <Link href="/admin/services">
          <Button variant="secondary">Služby</Button>
        </Link>
        <Link href="/admin/availability">
          <Button variant="secondary">Dostupnosť</Button>
        </Link>
      </nav>
    </div>
  )
}

