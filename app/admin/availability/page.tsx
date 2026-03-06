'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'
import { Availability, Service } from '@/lib/types'
import { Button } from '@/components/ui/Button'

function toISODate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function AdminAvailabilityPage() {
  const router = useRouter()

  const [services, setServices] = useState<Service[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    serviceId: '',
    startDate: '',
    daysAhead: 30,
    startTime: '09:00',
    endTime: '21:00',
    slotDuration: 60,
  })

  const selectedServiceName = useMemo(() => services.find((s) => s.id === formData.serviceId)?.name ?? '', [services, formData.serviceId])

  useEffect(() => {
    ;(async () => {
      const ok = await checkAdminSession()
      if (!ok) return
      await loadData()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkAdminSession(): Promise<boolean> {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.user) {
      router.replace('/login?redirect=/admin/availability')
      return false
    }
    return true
  }

  async function loadData() {
    try {
      setLoading(true)
      const [servicesRes, availRes] = await Promise.all([
        supabase.from('services').select('*').order('name', { ascending: true }),
        supabase.from('availability').select('*').order('date', { ascending: false }).order('start_time', { ascending: true }).limit(250),
      ])

      if (servicesRes.error) throw servicesRes.error
      if (availRes.error) throw availRes.error

      setServices((servicesRes.data || []) as Service[])
      setAvailability((availRes.data || []) as Availability[])
    } catch (error) {
      console.error('Availability load error:', error)
      toast.error('Nepodarilo sa načítať dostupnosť')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateSlots(event: React.FormEvent) {
    event.preventDefault()

    if (!formData.serviceId || !formData.startDate) {
      toast.error('Vyberte službu a dátum začiatku')
      return
    }

    const days = Number(formData.daysAhead)
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      toast.error('Počet dní musí byť 1 až 365')
      return
    }

    const [startH, startM] = formData.startTime.split(':').map(Number)
    const [endH, endM] = formData.endTime.split(':').map(Number)
    const startTotal = startH * 60 + startM
    const endTotal = endH * 60 + endM

    if (startTotal >= endTotal) {
      toast.error('Čas „Od“ musí byť menší ako čas „Do“')
      return
    }

    try {
      setSubmitting(true)
      const slots: Array<{
        service_id: string
        date: string
        start_time: string
        end_time: string
        is_available: boolean
      }> = []

      const base = new Date(`${formData.startDate}T00:00:00`)
      for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
        const day = new Date(base)
        day.setDate(base.getDate() + dayOffset)
        const date = toISODate(day)

        let pointer = startTotal
        while (pointer < endTotal) {
          const next = pointer + Number(formData.slotDuration)
          if (next > endTotal) break

          slots.push({
            service_id: formData.serviceId,
            date,
            start_time: `${String(Math.floor(pointer / 60)).padStart(2, '0')}:${String(pointer % 60).padStart(2, '0')}:00`,
            end_time: `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}:00`,
            is_available: true,
          })

          pointer = next
        }
      }

      if (slots.length === 0) {
        toast.error('Nevznikli žiadne sloty, skontrolujte zadané časy')
        return
      }

      const { error } = await supabase.from('availability').insert(slots)
      if (error) {
        console.error('Availability insert error:', error)
        if (error.code === '23505') toast.error('Niektoré sloty už existujú (duplicitné)')
        else toast.error(error.message || 'Nepodarilo sa vytvoriť sloty')
        return
      }

      toast.success(`Vytvorených ${slots.length} slotov pre „${selectedServiceName}“`)
      setIsFormOpen(false)
      await loadData()
    } catch (error) {
      console.error('Generate slots error:', error)
      toast.error('Nepodarilo sa vygenerovať sloty')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteSlot(id: string) {
    const ok = window.confirm('Naozaj chcete vymazať tento slot dostupnosti?')
    if (!ok) return

    try {
      setDeletingId(id)
      const { error } = await supabase.from('availability').delete().eq('id', id)
      if (error) throw error
      toast.success('Slot bol vymazaný')
      await loadData()
    } catch (error) {
      console.error('Delete slot error:', error)
      toast.error('Nepodarilo sa vymazať slot')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Správa dostupnosti</h1>
          <p className="mt-1 text-sm text-slate-600">Posledných slotov: {availability.length}</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4" /> Generovať sloty
        </Button>
      </header>

      <div className="mb-4">
        <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:text-blue-800">← Späť na dashboard</Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-14 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
        </div>
      ) : (
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Služba</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Dátum</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Čas</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Akcia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {availability.slice(0, 120).map((slot) => (
                  <tr key={slot.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-800">{services.find((s) => s.id === slot.service_id)?.name || 'Služba'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{new Date(`${slot.date}T00:00:00`).toLocaleDateString('sk-SK')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={
                        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ' +
                        (slot.is_available ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600')
                      }>
                        {slot.is_available ? 'Dostupný' : 'Nedostupný'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Button size="sm" variant="danger" onClick={() => deleteSlot(slot.id)} isLoading={deletingId === slot.id}>
                        <Trash2 className="h-4 w-4" /> Vymazať
                      </Button>
                    </td>
                  </tr>
                ))}
                {availability.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>Zatiaľ nie sú vytvorené žiadne sloty.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => !submitting && setIsFormOpen(false)}>
          <div className="w-full max-w-lg animate-section-in rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-slate-900">Generovať sloty</h2>
            <form onSubmit={handleGenerateSlots} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Služba</label>
                <select
                  value={formData.serviceId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, serviceId: e.target.value }))}
                  className="control-soft select-soft w-full rounded-xl px-3 py-2 text-sm"
                >
                  <option value="">-- Vyberte službu --</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Dátum od</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Počet dní</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={formData.daysAhead}
                    onChange={(e) => setFormData((prev) => ({ ...prev, daysAhead: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Od</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Do</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Slot</label>
                  <select
                    value={formData.slotDuration}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slotDuration: Number(e.target.value) }))}
                    className="control-soft select-soft w-full rounded-xl px-3 py-2 text-sm"
                  >
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsFormOpen(false)} disabled={submitting}>
                  Zavrieť
                </Button>
                <Button type="submit" className="flex-1" isLoading={submitting}>Generovať</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}
