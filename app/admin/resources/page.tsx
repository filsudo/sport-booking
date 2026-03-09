'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Edit, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'
import { Resource, Service } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { AnimatedSelect } from '@/components/ui/AnimatedSelect'
import { useI18n } from '@/components/layout/LanguageProvider'

type FormState = {
  service_id: string
  name: string
  kind: string
  capacity: number
  sort_order: number
  is_active: boolean
}

const initialForm: FormState = {
  service_id: '',
  name: '',
  kind: 'resource',
  capacity: 1,
  sort_order: 0,
  is_active: true,
}

export default function AdminResourcesPage() {
  const router = useRouter()
  const { lang } = useI18n()
  const [services, setServices] = useState<Service[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormState>(initialForm)
  const [serviceFilter, setServiceFilter] = useState<string>('all')

  const L = (skText: string, enText: string) => (lang === 'sk' ? skText : enText)
  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services])
  const filteredResources = useMemo(
    () => (serviceFilter === 'all' ? resources : resources.filter((resource) => resource.service_id === serviceFilter)),
    [resources, serviceFilter]
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
      router.replace('/login?redirect=/admin/resources')
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
      const [servicesRes, resourcesRes] = await Promise.all([
        supabase.from('services').select('*').order('name', { ascending: true }),
        supabase
          .from('resources')
          .select('*')
          .order('service_id', { ascending: true })
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
      ])

      if (servicesRes.error) throw servicesRes.error
      if (resourcesRes.error) throw resourcesRes.error

      setServices((servicesRes.data || []) as Service[])
      setResources((resourcesRes.data || []) as Resource[])
    } catch (error) {
      console.error('Resources load error:', error)
      toast.error(L('Nepodarilo sa nacitat zdroje', 'Failed to load resources'))
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditId(null)
    setFormData(initialForm)
    setIsFormOpen(true)
  }

  function openEdit(resource: Resource) {
    setEditId(resource.id)
    setFormData({
      service_id: resource.service_id,
      name: resource.name,
      kind: resource.kind || 'resource',
      capacity: Number(resource.capacity || 1),
      sort_order: Number(resource.sort_order || 0),
      is_active: resource.is_active !== false,
    })
    setIsFormOpen(true)
  }

  async function saveResource(event: React.FormEvent) {
    event.preventDefault()

    if (!formData.service_id) {
      toast.error(L('Vyberte sluzbu', 'Select a service'))
      return
    }
    if (formData.name.trim().length < 2) {
      toast.error(L('Nazov zdroja je prilis kratky', 'Resource name is too short'))
      return
    }

    try {
      setSaving(true)
      const payload = {
        service_id: formData.service_id,
        name: formData.name.trim(),
        kind: formData.kind.trim() || 'resource',
        capacity: Math.max(1, Number(formData.capacity)),
        sort_order: Number(formData.sort_order),
        is_active: formData.is_active,
      }

      if (editId) {
        const { error } = await supabase.from('resources').update(payload).eq('id', editId)
        if (error) throw error
        toast.success(L('Zdroj bol upraveny', 'Resource updated'))
      } else {
        const { error } = await supabase.from('resources').insert([payload])
        if (error) throw error
        toast.success(L('Zdroj bol vytvoreny', 'Resource created'))
      }

      setIsFormOpen(false)
      setEditId(null)
      await loadData()
    } catch (error) {
      console.error('Save resource error:', error)
      toast.error(L('Nepodarilo sa ulozit zdroj', 'Failed to save resource'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleResource(resource: Resource) {
    try {
      const { error } = await supabase
        .from('resources')
        .update({ is_active: !(resource.is_active !== false) })
        .eq('id', resource.id)
      if (error) throw error
      toast.success(resource.is_active === false ? L('Zdroj aktivovany', 'Resource activated') : L('Zdroj deaktivovany', 'Resource deactivated'))
      await loadData()
    } catch (error) {
      console.error('Toggle resource error:', error)
      toast.error(L('Nepodarilo sa zmenit stav zdroja', 'Failed to change resource status'))
    }
  }

  async function removeResource(resourceId: string) {
    const ok = window.confirm(L('Naozaj chcete vymazat tento zdroj?', 'Do you really want to delete this resource?'))
    if (!ok) return

    try {
      setDeletingId(resourceId)
      const { error } = await supabase.from('resources').delete().eq('id', resourceId)
      if (error) throw error
      toast.success(L('Zdroj bol vymazany', 'Resource deleted'))
      await loadData()
    } catch (error) {
      console.error('Delete resource error:', error)
      toast.error(L('Nepodarilo sa vymazat zdroj', 'Failed to delete resource'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">{L('Sprava zdrojov', 'Resources management')}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {L('Zdroje', 'Resources')}: {resources.length}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {L('Novy zdroj', 'New resource')}
        </Button>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
          {L('Spat na dashboard', 'Back to dashboard')}
        </Link>
        <AnimatedSelect
          value={serviceFilter}
          onChange={setServiceFilter}
          options={[
            { value: 'all', label: L('Vsetky sluzby', 'All services') },
            ...services.map((service) => ({ value: service.id, label: service.name })),
          ]}
          buttonClassName="rounded-xl px-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredResources.map((resource) => (
            <article key={resource.id} className="card card-hover p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {serviceById.get(resource.service_id)?.name || L('Sluzba', 'Service')}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{resource.name}</h2>
                </div>
                <span
                  className={
                    'rounded-full px-2.5 py-1 text-xs font-semibold ' +
                    (resource.is_active === false ? 'badge-neutral' : 'badge-success')
                  }
                >
                  {resource.is_active === false ? L('Neaktivny', 'Inactive') : L('Aktivny', 'Active')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">{L('Typ', 'Type')}</p>
                  <p className="font-semibold text-slate-900">{resource.kind}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">{L('Kapacita', 'Capacity')}</p>
                  <p className="font-semibold text-slate-900">{resource.capacity || 1}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">{L('Poradie', 'Order')}</p>
                  <p className="font-semibold text-slate-900">{resource.sort_order || 0}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(resource)}>
                  <Edit className="h-4 w-4" /> {L('Upravit', 'Edit')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => toggleResource(resource)}>
                  {resource.is_active === false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {resource.is_active === false ? L('Aktivovat', 'Activate') : L('Deaktivovat', 'Deactivate')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => removeResource(resource.id)}
                  isLoading={deletingId === resource.id}
                >
                  <Trash2 className="h-4 w-4" /> {L('Vymazat', 'Delete')}
                </Button>
              </div>
            </article>
          ))}
          {filteredResources.length === 0 ? (
            <div className="card col-span-full p-8 text-center text-sm text-slate-600">
              <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-5">
                {L('Ziadne zdroje pre zvoleny filter.', 'No resources for this filter.')}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => !saving && setIsFormOpen(false)}>
          <div className="w-full max-w-lg animate-section-in rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-xl font-bold text-slate-900">{editId ? L('Upravit zdroj', 'Edit resource') : L('Novy zdroj', 'New resource')}</h2>
            <form onSubmit={saveResource} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">{L('Sluzba', 'Service')}</label>
                <AnimatedSelect
                  value={formData.service_id}
                  onChange={(nextValue) => setFormData((prev) => ({ ...prev, service_id: nextValue }))}
                  options={[
                    { value: '', label: `-- ${L('Vyberte sluzbu', 'Select service')} --` },
                    ...services.map((service) => ({ value: service.id, label: service.name })),
                  ]}
                  buttonClassName="w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">{L('Nazov', 'Name')}</label>
                  <input
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                    className="control-soft w-full rounded-xl px-3 py-2 text-sm"
                    placeholder="Court 1 / Table 2 / Trainer Martin"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">{L('Typ', 'Type')}</label>
                  <input
                    value={formData.kind}
                    onChange={(event) => setFormData((prev) => ({ ...prev, kind: event.target.value }))}
                    className="control-soft w-full rounded-xl px-3 py-2 text-sm"
                    placeholder="court / table / trainer / group"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">{L('Kapacita', 'Capacity')}</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.capacity}
                    onChange={(event) => setFormData((prev) => ({ ...prev, capacity: Number(event.target.value) }))}
                    className="control-soft w-full rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">{L('Poradie', 'Order')}</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(event) => setFormData((prev) => ({ ...prev, sort_order: Number(event.target.value) }))}
                    className="control-soft w-full rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(event) => setFormData((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
                {L('Aktivny zdroj', 'Active resource')}
              </label>

              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsFormOpen(false)} disabled={saving}>
                  {L('Zavriet', 'Close')}
                </Button>
                <Button type="submit" className="flex-1" isLoading={saving}>
                  {editId ? L('Ulozit', 'Save') : L('Vytvorit', 'Create')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}
