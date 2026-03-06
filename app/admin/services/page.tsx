'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Edit, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'
import { Service } from '@/lib/types'
import { Button } from '@/components/ui/Button'

type FormState = {
  name: string
  description: string
  category: 'courts' | 'tables' | 'trainings' | 'other'
  duration_minutes: number
  price: number
  is_active: boolean
}

const initialForm: FormState = {
  name: '',
  description: '',
  category: 'courts',
  duration_minutes: 60,
  price: 0,
  is_active: true,
}

export default function AdminServicesPage() {
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormState>(initialForm)

  const activeCount = useMemo(() => services.filter((s) => s.is_active).length, [services])

  useEffect(() => {
    ;(async () => {
      const ok = await checkAdminSession()
      if (!ok) return
      await loadServices()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkAdminSession(): Promise<boolean> {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.user) {
      router.replace('/login?redirect=/admin/services')
      return false
    }
    return true
  }

  async function loadServices() {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('services').select('*').order('name', { ascending: true })
      if (error) throw error
      setServices((data || []) as Service[])
    } catch (error) {
      console.error('Services load error:', error)
      toast.error('Nepodarilo sa načítať služby')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditId(null)
    setFormData(initialForm)
    setIsFormOpen(true)
  }

  function openEdit(service: Service) {
    setEditId(service.id)
    setFormData({
      name: service.name,
      description: service.description || '',
      category: (service.category as FormState['category']) || 'other',
      duration_minutes: Number(service.duration_minutes || 60),
      price: Number(service.price || 0),
      is_active: Boolean(service.is_active),
    })
    setIsFormOpen(true)
  }

  async function saveService(event: React.FormEvent) {
    event.preventDefault()

    const name = formData.name.trim()
    if (name.length < 2) {
      toast.error('Názov služby je príliš krátky')
      return
    }

    try {
      setSaving(true)
      const payload = {
        name,
        description: formData.description.trim() || null,
        category: formData.category,
        duration_minutes: Number(formData.duration_minutes),
        price: Number(formData.price),
        is_active: formData.is_active,
      }

      if (editId) {
        const { error } = await supabase.from('services').update(payload).eq('id', editId)
        if (error) throw error
        toast.success('Služba bola upravená')
      } else {
        const { error } = await supabase.from('services').insert([payload])
        if (error) throw error
        toast.success('Služba bola vytvorená')
      }

      setIsFormOpen(false)
      setEditId(null)
      await loadServices()
    } catch (error) {
      console.error('Save service error:', error)
      toast.error('Nepodarilo sa uložiť službu')
    } finally {
      setSaving(false)
    }
  }

  async function removeService(serviceId: string) {
    const ok = window.confirm('Naozaj chcete vymazať službu?')
    if (!ok) return

    try {
      setDeletingId(serviceId)
      const { error } = await supabase.from('services').delete().eq('id', serviceId)
      if (error) throw error
      toast.success('Služba bola vymazaná')
      await loadServices()
    } catch (error) {
      console.error('Delete service error:', error)
      toast.error('Nepodarilo sa vymazať službu')
    } finally {
      setDeletingId(null)
    }
  }

  async function toggleActive(service: Service) {
    try {
      const { error } = await supabase.from('services').update({ is_active: !service.is_active }).eq('id', service.id)
      if (error) throw error
      toast.success(service.is_active ? 'Služba deaktivovaná' : 'Služba aktivovaná')
      await loadServices()
    } catch (error) {
      console.error('Toggle service error:', error)
      toast.error('Nepodarilo sa zmeniť stav služby')
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Správa služieb</h1>
          <p className="mt-1 text-sm text-slate-600">Aktívne služby: {activeCount} / {services.length}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nová služba
        </Button>
      </header>

      <div className="mb-4">
        <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:text-blue-800">← Späť na dashboard</Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <article key={service.id} className="card card-hover animate-section-in p-5">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{service.name}</h2>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{(service.category || 'other').toUpperCase()}</p>
                </div>
                <span className={
                  'rounded-full px-2.5 py-1 text-xs font-semibold ' +
                  (service.is_active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600')
                }>
                  {service.is_active ? 'Aktívna' : 'Neaktívna'}
                </span>
              </div>

              <p className="min-h-[42px] text-sm text-slate-600">{service.description || 'Bez popisu služby.'}</p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Trvanie</p>
                  <p className="font-semibold text-slate-900">{service.duration_minutes} min</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Cena</p>
                  <p className="font-semibold text-slate-900">{Number(service.price || 0).toFixed(2)} €</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(service)}>
                  <Edit className="h-4 w-4" /> Upraviť
                </Button>
                <Button size="sm" variant="secondary" onClick={() => toggleActive(service)}>
                  {service.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {service.is_active ? 'Deaktivovať' : 'Aktivovať'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => removeService(service.id)} isLoading={deletingId === service.id}>
                  <Trash2 className="h-4 w-4" /> Vymazať
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => !saving && setIsFormOpen(false)}>
          <div className="w-full max-w-lg animate-section-in rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-slate-900">{editId ? 'Upraviť službu' : 'Nová služba'}</h2>
            <form onSubmit={saveService} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Názov</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Názov služby"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Opis</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Krátky popis služby"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Kategória</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value as FormState['category'] }))}
                    className="control-soft select-soft w-full rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="courts">Kurty</option>
                    <option value="tables">Stoly</option>
                    <option value="trainings">Tréningy</option>
                    <option value="other">Iné</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Trvanie (min)</label>
                  <input
                    type="number"
                    min={30}
                    step={15}
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, duration_minutes: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Cena (€)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={formData.price}
                    onChange={(e) => setFormData((prev) => ({ ...prev, price: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Aktívna služba
              </label>

              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsFormOpen(false)} disabled={saving}>
                  Zavrieť
                </Button>
                <Button type="submit" className="flex-1" isLoading={saving}>
                  {editId ? 'Uložiť' : 'Vytvoriť'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}
