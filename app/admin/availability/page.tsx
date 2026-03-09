'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'
import { Availability, Resource, Service } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { AnimatedSelect } from '@/components/ui/AnimatedSelect'
import { useI18n } from '@/components/layout/LanguageProvider'

function toISODate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type FormState = {
  serviceId: string
  resourceMode: 'all' | 'single'
  resourceId: string
  startDate: string
  daysAhead: number
  startTime: string
  endTime: string
  slotDuration: number
}

const initialForm: FormState = {
  serviceId: '',
  resourceMode: 'all',
  resourceId: '',
  startDate: '',
  daysAhead: 14,
  startTime: '09:00',
  endTime: '21:00',
  slotDuration: 60,
}

export default function AdminAvailabilityPage() {
  const router = useRouter()
  const { lang } = useI18n()

  const [services, setServices] = useState<Service[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toggleId, setToggleId] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormState>(initialForm)
  const L = (skText: string, enText: string) => (lang === 'sk' ? skText : enText)

  const resourceById = useMemo(() => new Map(resources.map((resource) => [resource.id, resource])), [resources])
  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services])

  const filteredResources = useMemo(
    () => resources.filter((resource) => resource.service_id === formData.serviceId && resource.is_active !== false),
    [resources, formData.serviceId]
  )

  useEffect(() => {
    ;(async () => {
      const ok = await checkAdminSession()
      if (!ok) return
      await loadData()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkAdminSession(): Promise<boolean> {
    const { data: authData } = await supabase.auth.getSession()
    const email = authData.session?.user?.email?.toLowerCase()

    if (!email) {
      router.replace('/login?redirect=/admin/availability')
      return false
    }

    const { data: adminRow } = await supabase.from('admin_users').select('email').eq('email', email).maybeSingle()
    if (!adminRow) {
      await supabase.auth.signOut()
      router.replace('/login?error=not_admin')
      return false
    }

    return true
  }

  async function loadData() {
    try {
      setLoading(true)
      const [servicesRes, resourcesRes, availabilityRes] = await Promise.all([
        supabase.from('services').select('*').order('name', { ascending: true }),
        supabase.from('resources').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
        supabase
          .from('availability')
          .select('*')
          .order('date', { ascending: false })
          .order('start_time', { ascending: true })
          .limit(300),
      ])

      if (servicesRes.error) throw servicesRes.error
      if (resourcesRes.error) throw resourcesRes.error
      if (availabilityRes.error) throw availabilityRes.error

      setServices((servicesRes.data || []) as Service[])
      setResources((resourcesRes.data || []) as Resource[])
      setAvailability((availabilityRes.data || []) as Availability[])
    } catch (error) {
      console.error('Availability load error:', error)
      toast.error(L('Nepodarilo sa nacitat dostupnost', 'Failed to load availability'))
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateSlots(event: React.FormEvent) {
    event.preventDefault()

    if (!formData.serviceId || !formData.startDate) {
      toast.error(L('Vyberte sluzbu a datum zaciatku', 'Select service and start date'))
      return
    }

    if (formData.resourceMode === 'single' && !formData.resourceId) {
      toast.error(L('Vyberte konkretny zdroj alebo prepnite na vsetky', 'Select a resource or switch to all resources'))
      return
    }

    const days = Number(formData.daysAhead)
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      toast.error(L('Pocet dni musi byt 1 az 365', 'Days count must be between 1 and 365'))
      return
    }

    const [startH, startM] = formData.startTime.split(':').map(Number)
    const [endH, endM] = formData.endTime.split(':').map(Number)
    const startTotal = startH * 60 + startM
    const endTotal = endH * 60 + endM

    if (startTotal >= endTotal) {
      toast.error(L('Cas Od musi byt mensi ako cas Do', 'Start time must be earlier than end time'))
      return
    }

    const targetResources =
      formData.resourceMode === 'all'
        ? filteredResources
        : filteredResources.filter((resource) => resource.id === formData.resourceId)

    if (targetResources.length === 0) {
      toast.error(L('Pre tuto sluzbu nie su aktivne zdroje', 'No active resources for this service'))
      return
    }

    try {
      setSubmitting(true)
      const slots: Array<{
        service_id: string
        resource_id: string
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

        for (const resource of targetResources) {
          let pointer = startTotal
          while (pointer < endTotal) {
            const next = pointer + Number(formData.slotDuration)
            if (next > endTotal) break

            slots.push({
              service_id: formData.serviceId,
              resource_id: resource.id,
              date,
              start_time: `${String(Math.floor(pointer / 60)).padStart(2, '0')}:${String(pointer % 60).padStart(2, '0')}:00`,
              end_time: `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}:00`,
              is_available: true,
            })

            pointer = next
          }
        }
      }

      if (slots.length === 0) {
        toast.error(L('Nevznikli ziadne sloty, skontrolujte casy', 'No slots generated. Check selected times.'))
        return
      }

      const { error } = await supabase.from('availability').upsert(slots, {
        onConflict: 'resource_id,date,start_time',
        ignoreDuplicates: false,
      })

      if (error) {
        console.error('Availability upsert error:', error)
        toast.error(error.message || L('Nepodarilo sa vytvorit sloty', 'Failed to generate slots'))
        return
      }

      toast.success(
        lang === 'sk'
          ? `Vytvorenych alebo aktualizovanych ${slots.length} slotov`
          : `Created or updated ${slots.length} slots`
      )
      setIsFormOpen(false)
      setFormData(initialForm)
      await loadData()
    } catch (error) {
      console.error('Generate slots error:', error)
      toast.error(L('Nepodarilo sa vygenerovat sloty', 'Failed to generate slots'))
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleSlotAvailability(slot: Availability) {
    try {
      setToggleId(slot.id)
      const { error } = await supabase
        .from('availability')
        .update({ is_available: !slot.is_available })
        .eq('id', slot.id)

      if (error) throw error
      toast.success(
        slot.is_available
          ? L('Slot bol oznaceny ako nedostupny', 'Slot marked as unavailable')
          : L('Slot bol oznaceny ako dostupny', 'Slot marked as available')
      )
      await loadData()
    } catch (error) {
      console.error('Toggle slot error:', error)
      toast.error(L('Nepodarilo sa zmenit dostupnost slotu', 'Failed to update slot availability'))
    } finally {
      setToggleId(null)
    }
  }

  async function deleteSlot(id: string) {
    const ok = window.confirm(L('Naozaj chcete vymazat tento slot?', 'Do you really want to delete this slot?'))
    if (!ok) return

    try {
      setDeletingId(id)
      const { error } = await supabase.from('availability').delete().eq('id', id)
      if (error) throw error
      toast.success(L('Slot bol vymazany', 'Slot deleted'))
      await loadData()
    } catch (error) {
      console.error('Delete slot error:', error)
      toast.error(L('Nepodarilo sa vymazat slot', 'Failed to delete slot'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">{L('Sprava dostupnosti', 'Availability management')}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {L('Nacitane sloty', 'Loaded slots')}: {availability.length}
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4" /> {L('Generovat sloty', 'Generate slots')}
        </Button>
      </header>

      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-blue-700">
          <Link href="/admin" className="hover:text-blue-800">
            {L('Dashboard', 'Dashboard')}
          </Link>
          <Link href="/admin/services" className="hover:text-blue-800">
            {L('Sluzby', 'Services')}
          </Link>
          <Link href="/admin/resources" className="hover:text-blue-800">
            {L('Zdroje', 'Resources')}
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-14 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
        </div>
      ) : (
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{L('Sluzba', 'Service')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{L('Zdroj', 'Resource')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{L('Datum', 'Date')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{L('Cas', 'Time')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{L('Status', 'Status')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{L('Akcia', 'Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {availability.slice(0, 150).map((slot) => (
                  <tr key={slot.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-800">{serviceById.get(slot.service_id)?.name || L('Sluzba', 'Service')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{resourceById.get(slot.resource_id)?.name || slot.resource_id}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {new Date(`${slot.date}T00:00:00`).toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-US')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={
                          'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ' +
                          (slot.is_available ? 'badge-success' : 'badge-neutral')
                        }
                      >
                        {slot.is_available ? L('Dostupny', 'Available') : L('Nedostupny', 'Unavailable')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => toggleSlotAvailability(slot)}
                          isLoading={toggleId === slot.id}
                        >
                          {slot.is_available ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {slot.is_available ? L('Znepristupnit', 'Disable') : L('Spristupnit', 'Enable')}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => deleteSlot(slot.id)}
                          isLoading={deletingId === slot.id}
                        >
                          <Trash2 className="h-4 w-4" /> {L('Vymazat', 'Delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {availability.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={6}>
                      {L('Zatial nie su vytvorene ziadne sloty.', 'No slots generated yet.')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => !submitting && setIsFormOpen(false)}
        >
          <div
            className="w-full max-w-lg animate-section-in rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-slate-900">{L('Generovat sloty', 'Generate slots')}</h2>
            <form onSubmit={handleGenerateSlots} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">{L('Sluzba', 'Service')}</label>
                <AnimatedSelect
                  value={formData.serviceId}
                  onChange={(nextValue) =>
                    setFormData((prev) => ({
                      ...prev,
                      serviceId: nextValue,
                      resourceId: '',
                    }))
                  }
                  options={[
                    { value: '', label: `-- ${L('Vyberte sluzbu', 'Select service')} --` },
                    ...services.map((service) => ({ value: service.id, label: service.name })),
                  ]}
                  buttonClassName="w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <input
                    type="radio"
                    checked={formData.resourceMode === 'all'}
                    onChange={() => setFormData((prev) => ({ ...prev, resourceMode: 'all', resourceId: '' }))}
                  />
                  {L('Vsetky zdroje', 'All resources')}
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <input
                    type="radio"
                    checked={formData.resourceMode === 'single'}
                    onChange={() => setFormData((prev) => ({ ...prev, resourceMode: 'single' }))}
                  />
                  {L('Konkretny zdroj', 'Single resource')}
                </label>
              </div>

              {formData.resourceMode === 'single' ? (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">{L('Zdroj', 'Resource')}</label>
                  <AnimatedSelect
                    value={formData.resourceId}
                    onChange={(nextValue) => setFormData((prev) => ({ ...prev, resourceId: nextValue }))}
                    options={[
                      { value: '', label: `-- ${L('Vyberte zdroj', 'Select resource')} --` },
                      ...filteredResources.map((resource) => ({ value: resource.id, label: resource.name })),
                    ]}
                    buttonClassName="w-full rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">{L('Datum od', 'Date from')}</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    min={toISODate(new Date())}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="control-soft w-full rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">{L('Pocet dni', 'Days')}</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={formData.daysAhead}
                    onChange={(e) => setFormData((prev) => ({ ...prev, daysAhead: Number(e.target.value) }))}
                    className="control-soft w-full rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">{L('Od', 'From')}</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
                    className="control-soft w-full rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">{L('Do', 'To')}</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
                    className="control-soft w-full rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">{L('Slot', 'Slot')}</label>
                  <AnimatedSelect
                    value={String(formData.slotDuration)}
                    onChange={(nextValue) => setFormData((prev) => ({ ...prev, slotDuration: Number(nextValue) }))}
                    options={[
                      { value: '30', label: '30 min' },
                      { value: '45', label: '45 min' },
                      { value: '60', label: '60 min' },
                      { value: '90', label: '90 min' },
                    ]}
                    buttonClassName="w-full rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setIsFormOpen(false)}
                  disabled={submitting}
                >
                  {L('Zavriet', 'Close')}
                </Button>
                <Button type="submit" className="flex-1" isLoading={submitting}>
                  {L('Generovat', 'Generate')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}
