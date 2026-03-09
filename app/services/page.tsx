'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Dumbbell, Star, Table2, Trophy, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/components/layout/LanguageProvider'
import { getSupabaseErrorMessage, isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import { type Service, type ServiceCategory } from '@/lib/types'
import { normalizeCategory } from '@/lib/utils/validation'

type FilterKey = 'all' | ServiceCategory

function getServiceIcon(category: ServiceCategory) {
  if (category === 'courts') return Trophy
  if (category === 'tables') return Table2
  if (category === 'trainings') return Users
  return Dumbbell
}

export default function ServicesPage() {
  const { lang, tr } = useI18n()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])

  const filters: Array<{ key: FilterKey; label: string }> = [
    { key: 'all', label: tr('servicesPage.filter.all') },
    { key: 'courts', label: tr('servicesPage.filter.courts') },
    { key: 'tables', label: tr('servicesPage.filter.tables') },
    { key: 'trainings', label: tr('servicesPage.filter.trainings') },
  ]

  useEffect(() => {
    let active = true

    async function loadServices() {
      try {
        setLoading(true)
        if (!isSupabaseConfigured) {
          setServices([])
          return
        }

        const { data, error } = await supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
          .order('price', { ascending: true })

        if (error) throw error
        if (!active) return
        setServices((data || []) as Service[])
      } catch (error) {
        console.error('Services load error:', getSupabaseErrorMessage(error, 'Failed to load services'))
        toast.error(tr('servicesPage.loadError'))
      } finally {
        if (active) setLoading(false)
      }
    }

    loadServices()
    return () => {
      active = false
    }
  }, [tr])

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('sportbook:favorites') || '[]') as string[]
      setFavoriteIds(stored)
    } catch {
      setFavoriteIds([])
    }
  }, [])

  function toggleFavorite(serviceId: string) {
    setFavoriteIds((prev) => {
      const next = prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
      try {
        window.localStorage.setItem('sportbook:favorites', JSON.stringify(next))
        window.dispatchEvent(new CustomEvent('favorites-changed'))
      } catch {
      }
      return next
    })
  }

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (filter === 'all') return true
      return normalizeCategory(service.name, service.category) === filter
    })
  }, [services, filter])

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <section className="reveal is-visible">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">{tr('servicesPage.title')}</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-600">
          {tr('servicesPage.subtitle')}
        </p>
      </section>

      <section className="mt-8 flex flex-wrap gap-2 reveal is-visible">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            data-active={filter === item.key}
            className={
              'choice-pill rounded-xl border px-4 py-2 text-sm font-semibold ' +
              (filter === item.key
                ? 'border-blue-600 bg-blue-600 text-white shadow-[0_8px_16px_rgba(37,99,235,0.24)]'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700')
            }
          >
            {item.label}
          </button>
        ))}
      </section>

      {loading ? (
        <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="card p-6">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200" />
              <div className="mt-4 h-6 w-40 animate-pulse rounded-lg bg-slate-200" />
              <div className="mt-3 h-4 w-56 animate-pulse rounded-lg bg-slate-200" />
              <div className="mt-2 h-4 w-44 animate-pulse rounded-lg bg-slate-200" />
              <div className="mt-8 h-11 w-full animate-pulse rounded-xl bg-slate-200" />
            </div>
          ))}
        </section>
      ) : filteredServices.length === 0 ? (
        <section className="mt-10 card p-8 text-center">
          <h2 className="text-xl font-bold text-slate-900">{tr('servicesPage.emptyTitle')}</h2>
          <p className="mt-2 text-slate-600">{tr('servicesPage.emptyText')}</p>
          <p className="mt-2 text-sm text-slate-500">
            {tr('servicesPage.emptyHint')}
          </p>
          <div className="mt-6">
            <Button variant="secondary" onClick={() => setFilter('all')}>
              {tr('servicesPage.showAll')}
            </Button>
          </div>
        </section>
      ) : (
        <section key={filter} className="animate-filter-swap mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service, index) => {
            const category = normalizeCategory(service.name, service.category)
            const Icon = getServiceIcon(category)
            const shortDescription =
              service.description ||
              (category === 'trainings'
                ? '1:1 training with coach'
                : category === 'tables'
                  ? 'Table rental (60 min)'
                  : 'Court rental (60 min)')

            return (
              <article
                key={service.id}
                className="card card-hover reveal is-visible flex h-full flex-col p-5"
                style={{ animationDelay: `${Math.min(index * 40, 180)}ms` }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
                    <Icon className="h-5 w-5 text-blue-700" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleFavorite(service.id)}
                      aria-pressed={favoriteIds.includes(service.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:border-blue-300 hover:text-blue-700"
                      title={
                        favoriteIds.includes(service.id)
                          ? lang === 'sk'
                            ? 'Odobrat z oblubenych'
                            : 'Remove from favorites'
                          : lang === 'sk'
                            ? 'Pridat do oblubenych'
                            : 'Add to favorites'
                      }
                    >
                      <Star className={favoriteIds.includes(service.id) ? 'h-4 w-4 fill-blue-600 text-blue-600' : 'h-4 w-4'} />
                    </button>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
                      60 min
                    </span>
                  </div>
                </div>

                <h3 className="text-xl leading-tight font-bold text-slate-900">{service.name}</h3>
                <p className="mt-2 text-sm text-slate-600">
                  {shortDescription}
                </p>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tr('servicesPage.fromPrice')}</p>
                  <p className="text-3xl font-extrabold tracking-tight text-blue-700">{service.price.toFixed(2)} EUR</p>
                </div>

                <div className="mt-4">
                  <Link href={`/booking?serviceId=${service.id}`}>
                    <Button className="w-full">{tr('servicesPage.book')}</Button>
                  </Link>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
