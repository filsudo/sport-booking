'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  Dumbbell,
  LayoutGrid,
  MapPin,
  ShieldCheck,
  Sparkles,
  Table2,
  Trophy,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/components/layout/LanguageProvider'
import { ReservationGridPreview } from '@/components/home/ReservationGridPreview'
import { getSupabaseErrorMessage, isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import { Service } from '@/lib/types'
import { normalizeCategory } from '@/lib/utils/validation'
import { siteConfig } from '@/lib/config/site'

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/15">
      <div className="text-2xl font-extrabold leading-tight">{value}</div>
      <div className="text-xs text-blue-50/90">{label}</div>
    </div>
  )
}

function HomeContent() {
  const { lang, tr } = useI18n()
  const [services, setServices] = useState<Service[]>([])
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [recentServiceIds, setRecentServiceIds] = useState<string[]>([])
  const [lastSelection, setLastSelection] = useState<{
    serviceId: string
    serviceName: string
    resourceName?: string
    date?: string
    startTime?: string
  } | null>(null)

  useEffect(() => {
    let active = true

    if (!isSupabaseConfigured) {
      return () => {
        active = false
      }
    }

    supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          console.error('Home services load error:', getSupabaseErrorMessage(error, 'Failed to load services'))
          return
        }
        setServices((data || []) as Service[])
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function loadFavorites() {
      try {
        const stored = JSON.parse(window.localStorage.getItem('sportbook:favorites') || '[]') as string[]
        setFavoriteIds(stored)
      } catch {
        setFavoriteIds([])
      }
    }

    function loadLastSelection() {
      try {
        const stored = window.localStorage.getItem('sportbook:lastSelection')
        setLastSelection(stored ? (JSON.parse(stored) as typeof lastSelection) : null)
      } catch {
        setLastSelection(null)
      }
    }

    function loadRecentServices() {
      try {
        const stored = JSON.parse(window.localStorage.getItem('sportbook:recentServices') || '[]') as string[]
        setRecentServiceIds(stored)
      } catch {
        setRecentServiceIds([])
      }
    }

    loadFavorites()
    loadLastSelection()
    loadRecentServices()

    const onFavChanged = () => loadFavorites()
    const onFocus = () => {
      loadLastSelection()
      loadRecentServices()
    }
    window.addEventListener('favorites-changed', onFavChanged)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('favorites-changed', onFavChanged)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!elements.length) return

    const isInViewport = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight * 0.96
    }

    if (typeof IntersectionObserver === 'undefined') {
      elements.forEach((el) => el.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          obs.unobserve(entry.target)
        })
      },
      { threshold: 0.2 }
    )

    elements.forEach((el) => {
      if (!el.classList.contains('is-visible')) {
        if (isInViewport(el)) {
          el.classList.add('is-visible')
          return
        }
        observer.observe(el)
      }
    })

    return () => observer.disconnect()
  }, [lang, services.length, favoriteIds.length, recentServiceIds.length, lastSelection])

  const highlightedServices = useMemo(() => {
    if (!services.length) {
      return [
        { name: lang === 'sk' ? 'Tenisovy kurt' : 'Tennis court', price: 20, category: 'courts' as const },
        { name: lang === 'sk' ? 'Stolny tenis' : 'Table tennis', price: 8, category: 'tables' as const },
        { name: lang === 'sk' ? 'Bedminton' : 'Badminton', price: 12, category: 'courts' as const },
        { name: lang === 'sk' ? 'Individualny trening' : 'Personal training', price: 35, category: 'trainings' as const },
      ]
    }

    return services.slice(0, 4).map((service) => ({
      name: service.name,
      price: service.price,
      category: normalizeCategory(service.name, service.category),
    }))
  }, [lang, services])

  const favoriteServices = useMemo(() => {
    if (!favoriteIds.length) return []
    return services.filter((service) => favoriteIds.includes(service.id))
  }, [services, favoriteIds])

  const recentServices = useMemo(() => {
    if (!recentServiceIds.length) return []
    const map = new Map(services.map((service) => [service.id, service]))
    return recentServiceIds.map((id) => map.get(id)).filter((service): service is Service => Boolean(service)).slice(0, 4)
  }, [services, recentServiceIds])

  const houseRules =
    lang === 'sk'
      ? [
          'Vstup na hraciu plochu len v cistej sportovej obuvi s nefarbiacou podrazkou.',
          'Prosime prist 5-10 minut pred zaciatkom rezervacie.',
          'Rezervaciu je mozne zrusit najneskor 12 hodin vopred (telefonicky alebo emailom).',
          'Pri poskodeni vybavenia je pouzivatel povinny okamzite nahlasit skodu.',
          'Na hracej ploche je zakaz jedla a sklenenych flias.',
        ]
      : [
          'Access to courts is allowed only with clean sports shoes and non-marking soles.',
          'Please arrive 5-10 minutes before your reservation starts.',
          'Booking can be cancelled no later than 12 hours in advance (phone or email).',
          'If equipment is damaged, customer must report it immediately.',
          'Food and glass bottles are not allowed on the playing area.',
        ]

  const faqPreview =
    lang === 'sk'
      ? [
          {
            q: 'Ako rychlo viem vytvorit rezervaciu?',
            a: 'Do par kliknuti: sluzba, datum, cas a potvrdenie udajov.',
          },
          {
            q: 'Mozem si vybrat trenera?',
            a: 'Ano, pri individualnom treningu sa trener vybera ako zdroj.',
          },
          {
            q: 'Ako funguje storno?',
            a: 'Bezplatne storno je mozne najneskor 12 hodin pred terminom.',
          },
        ]
      : [
          {
            q: 'How fast can I create a booking?',
            a: 'In a few clicks: service, date, time, and confirmation details.',
          },
          {
            q: 'Can I select a trainer?',
            a: 'Yes, for personal training trainer is selected as a resource.',
          },
          {
            q: 'How does cancellation work?',
            a: 'Free cancellation is possible no later than 12 hours before start time.',
          },
        ]

  return (
    <div className="w-full">
      <section className="relative overflow-hidden bg-slate-950 animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-800 via-blue-700 to-slate-950" />
        <div className="absolute inset-0 opacity-15 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:26px_26px]" />
        <div className="absolute -right-16 top-20 h-48 w-48 rounded-full bg-blue-300/20 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12 lg:items-center lg:px-8">
          <div className="lg:col-span-7">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-blue-50">
              <Sparkles className="h-4 w-4" />
              <span>{tr('home.heroTag')}</span>
            </div>

            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
              {tr('home.heroTitle')}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-blue-100/90 sm:text-xl">
              {tr('home.heroDescription')}
            </p>

            <div id="cennik" className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/booking">
                <Button size="lg" className="w-full animate-fade-in-up sm:w-auto">
                  {tr('home.ctaBook')}
                </Button>
              </Link>
              <Link href="/services">
                <Button size="lg" variant="secondary" className="w-full animate-fade-in-up stagger-1 sm:w-auto">
                  {tr('home.ctaServices')}
                </Button>
              </Link>
              <Button
                size="lg"
                variant="secondary"
                className="w-full animate-fade-in-up stagger-1 sm:w-auto"
                onClick={() => window.dispatchEvent(new CustomEvent('open-pricing-modal'))}
              >
                {tr('home.ctaPricing')}
              </Button>
            </div>

            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 text-white">
              <div className="animate-float-soft">
                <Stat value={lang === 'sk' ? '7 aktivit' : '7 activities'} label={tr('home.statActivities')} />
              </div>
              <div className="animate-float-soft [animation-delay:300ms]">
                <Stat value="12 h" label={tr('home.statHours')} />
              </div>
              <div className="animate-float-soft [animation-delay:600ms]">
                <Stat value={lang === 'sk' ? '90 dni' : '90 days'} label={tr('home.statAdvance')} />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="card soft-shadow overflow-hidden">
              <div className="border-b border-slate-200 bg-gradient-to-r from-slate-100 to-white p-5">
                <h2 className="text-sm font-bold text-slate-900">{tr('home.previewTitle')}</h2>
                <p className="mt-1 text-xs text-slate-600">{tr('home.previewSubtitle')}</p>
              </div>
              <ReservationGridPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="page-section px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between reveal" data-reveal>
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{tr('home.howItWorks')}</h2>
              <p className="mt-2 max-w-2xl text-slate-600">
                {tr('home.howItWorksSubtitle')}
              </p>
            </div>
            <Link href="/booking">
              <Button variant="secondary">
                {tr('home.startBooking')}
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 reveal-stagger">
            {[
              {
                icon: Calendar,
                title: lang === 'sk' ? 'Vyber datumu' : 'Select date',
                text:
                  lang === 'sk'
                    ? 'Kalendar zobrazi dostupne terminy na najblizsich 60 dni.'
                    : 'Calendar shows available slots for the next 60 days.',
              },
              {
                icon: LayoutGrid,
                title: lang === 'sk' ? 'Vyber zdroja' : 'Select resource',
                text:
                  lang === 'sk'
                    ? 'Grid pre kurty, stoly a trenerov s jasnymi stavmi dostupnosti.'
                    : 'Grid for courts, tables, and trainers with clear availability states.',
              },
              {
                icon: ShieldCheck,
                title: lang === 'sk' ? 'Potvrdenie' : 'Confirmation',
                text:
                  lang === 'sk'
                    ? 'Vyplnite udaje, skontrolujete zhrnutie a rezervacia je hotova.'
                    : 'Fill details, review summary, and submit booking.',
              },
            ].map((item) => (
              <div key={item.title} className="card card-hover reveal p-6" data-reveal>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
                  <item.icon className="h-5 w-5 text-blue-700" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="o-nas" className="page-section bg-slate-100 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 reveal" data-reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">{siteConfig.brand.name} center</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{tr('home.aboutTitle')}</h2>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-stretch reveal-stagger">
            <article className="card card-hover reveal flex h-full flex-col p-6 sm:p-7 lg:col-span-7" data-reveal>
              <h3 className="text-2xl font-extrabold leading-tight text-slate-900 sm:text-[2rem]">
                {lang === 'sk' ? 'Miesto, kde je sport dostupny bez chaosu' : 'A place where sport is easy to book'}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                {lang === 'sk'
                  ? 'SportBook je sportove centrum a rezervacny system v jednom. Spajame kvalitne zazemie, ferovy pristup a jednoduche online objednanie terminu.'
                  : 'SportBook is a sports center and booking system in one. We combine quality facilities, fair rules, and simple online booking.'}
              </p>
              <p className="mt-4 rounded-xl border border-blue-100/80 bg-blue-50/40 px-4 py-3 text-sm leading-relaxed text-slate-700">
                {lang === 'sk'
                  ? 'Zacinali sme s cielom odstranit zlozite telefonicke rezervacie. Dnes ponukame jasny prehlad volnych terminov.'
                  : 'We started with a goal to remove complicated phone booking. Today we provide a clear view of available terms for players and clubs.'}
              </p>

              <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{lang === 'sk' ? 'Nasa vizia' : 'Our vision'}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {lang === 'sk'
                      ? 'Vytvarat sportove prostredie, kde je rezervacia jednoducha a trening pravidelny.'
                      : 'Build a sports environment where booking is simple and training is consistent.'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{lang === 'sk' ? 'Preco SportBook' : 'Why SportBook'}</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    <li>{lang === 'sk' ? '• prehladne terminy bez telefonovania' : '• clear slots without phone calls'}</li>
                    <li>{lang === 'sk' ? '• ferove podmienky a jasne storno pravidla' : '• fair rules and clear cancellation policy'}</li>
                    <li>{lang === 'sk' ? '• prijemne zazemie pre hracov aj rodicov' : '• comfortable facility for players and families'}</li>
                  </ul>
                </div>
              </div>
            </article>

            <aside className="card card-hover reveal h-full p-4 sm:p-5 lg:col-span-5" data-reveal>
              <div className="grid gap-3">
                <div className="card-hover reveal rounded-xl border border-slate-200 bg-white p-4" data-reveal>
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-100">
                    <Users className="h-4 w-4 text-blue-700" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{lang === 'sk' ? 'Komunita a treneri' : 'Community and coaches'}</p>
                  <p className="mt-1 text-sm text-slate-600">{lang === 'sk' ? 'Priestor pre rekreacnych hracov, amaterov aj kluby.' : 'Space for casual players, amateurs, and clubs.'}</p>
                </div>
                <div className="card-hover reveal rounded-xl border border-slate-200 bg-white p-4" data-reveal>
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-100">
                    <LayoutGrid className="h-4 w-4 text-blue-700" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{lang === 'sk' ? 'Jednoducha rezervacia' : 'Simple booking'}</p>
                  <p className="mt-1 text-sm text-slate-600">{lang === 'sk' ? 'Sluzba, datum, cas a potvrdenie za par kliknuti.' : 'Service, date, time, and confirmation in a few clicks.'}</p>
                </div>
                <div className="card-hover reveal rounded-xl border border-slate-200 bg-white p-4" data-reveal>
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-100">
                    <ShieldCheck className="h-4 w-4 text-blue-700" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{lang === 'sk' ? 'Komfort v hale' : 'Comfort in venue'}</p>
                  <p className="mt-1 text-sm text-slate-600">{lang === 'sk' ? 'Satne, sprchy a zazemie pre rodicov aj oddych.' : 'Changing rooms, showers, and lounge area.'}</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="page-section bg-white px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-end justify-between reveal" data-reveal>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{tr('home.activitiesTitle')}</h2>
            <Link href="/services" className="text-sm font-bold text-blue-700 hover:text-blue-800">
              {tr('home.viewAll')}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 reveal-stagger">
            {highlightedServices.map((service) => {
              const Icon =
                service.category === 'courts'
                  ? Trophy
                  : service.category === 'tables'
                    ? Table2
                    : service.category === 'trainings'
                      ? Users
                      : Dumbbell

              return (
                <div
                  key={service.name}
                  className="card card-hover reveal p-5"
                  data-reveal
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
                    <Icon className="h-5 w-5 text-blue-700" />
                  </div>
                  <h3 className="font-bold text-slate-900">{service.name}</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {lang === 'sk' ? '60 min slot • satne • sprchy' : '60 min slot • locker rooms • showers'}
                  </p>
                  <p className="mt-3 text-lg font-extrabold text-blue-700">{tr('servicesPage.fromPrice')} {service.price.toFixed(2)} EUR</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {favoriteServices.length > 0 ? (
        <section className="page-section bg-slate-100 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="mb-8 text-3xl font-extrabold tracking-tight sm:text-4xl reveal" data-reveal>
              {tr('home.favoritesTitle')}
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3 reveal-stagger">
              {favoriteServices.map((service) => (
                <div key={service.id} className="card card-hover reveal p-5" data-reveal>
                  <p className="text-sm font-semibold text-blue-700">⭐ {tr('home.favoriteBadge')}</p>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">{service.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{service.description || (lang === 'sk' ? 'Rezervujte si termin online.' : 'Book your slot online.')}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">{tr('servicesPage.fromPrice')} {service.price.toFixed(2)} EUR</span>
                    <Link href={`/booking?serviceId=${service.id}`}>
                      <Button size="sm" variant="secondary">{tr('servicesPage.book')}</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {lastSelection ? (
        <section className="page-section px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="card reveal p-6" data-reveal>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tr('home.lastSelection')}</p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">{lastSelection.serviceName}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {lastSelection.resourceName ? `${lastSelection.resourceName} • ` : ''}{lastSelection.date || ''}{' '}
                {lastSelection.startTime ? `• ${lastSelection.startTime.slice(0, 5)}` : ''}
              </p>
              <div className="mt-4">
                <Link href={`/booking?serviceId=${lastSelection.serviceId}`}>
                  <Button variant="secondary">{tr('home.continueLast')}</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {recentServices.length > 0 ? (
        <section className="page-section bg-slate-100 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="mb-8 text-3xl font-extrabold tracking-tight sm:text-4xl reveal" data-reveal>
              {tr('home.recentlyViewed')}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {recentServices.map((service) => (
                <div key={service.id} className="card card-hover reveal p-4" data-reveal>
                  <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                  <p className="mt-1 text-xs text-slate-600">{service.description || (lang === 'sk' ? 'Online rezervacia dostupna okamzite.' : 'Online booking available instantly.')}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-blue-700">{tr('servicesPage.fromPrice')} {service.price.toFixed(2)} EUR</span>
                    <Link href={`/booking?serviceId=${service.id}`}>
                      <Button size="sm" variant="secondary">{tr('home.open')}</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="page-section px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-8 text-3xl font-extrabold tracking-tight sm:text-4xl reveal" data-reveal>
            {tr('home.houseRules')}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 reveal-stagger">
            {houseRules.map((rule) => (
              <div key={rule} className="card reveal p-4 text-sm text-slate-700" data-reveal>
                {rule}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="page-section bg-slate-100 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-8 text-3xl font-extrabold tracking-tight sm:text-4xl reveal" data-reveal>
            FAQ
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 reveal-stagger">
            {faqPreview.map((item) => (
              <div key={item.q} className="card reveal p-5" data-reveal>
                <p className="font-bold text-slate-900">{item.q}</p>
                <p className="mt-2 text-sm text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 reveal" data-reveal>
            <Link href="/faq">
              <Button variant="secondary">{tr('home.allFaq')}</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="page-section px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card reveal p-6" data-reveal>
            <h2 className="text-2xl font-bold text-slate-900">{tr('home.contactAndLocation')}</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-700" />
                {siteConfig.contact.address}
              </p>
              <p className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-700" />
                {siteConfig.contact.phone}
              </p>
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-700" />
                {siteConfig.contact.email}
              </p>
              <p className="pt-1 text-slate-600">
                {lang === 'sk'
                  ? 'Dostanete sa k nam MHD aj autom, parkovanie je dostupne pri hale.'
                  : 'You can reach us by public transport or car; parking is available near the venue.'}
              </p>
            </div>
          </div>
          <div className="card reveal p-6" data-reveal>
            <h2 className="text-2xl font-bold text-slate-900">{tr('home.centerServices')}</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm reveal-stagger">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 reveal" data-reveal>
                <p className="font-semibold text-slate-900">{lang === 'sk' ? 'Bar / obcerstvenie' : 'Bar / snacks'}</p>
                <p className="mt-1 text-slate-600">{lang === 'sk' ? 'Kava, napoje a drobne snacky.' : 'Coffee, drinks, and quick snacks.'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 reveal" data-reveal>
                <p className="font-semibold text-slate-900">{lang === 'sk' ? 'Turnaje a eventy' : 'Tournaments and events'}</p>
                <p className="mt-1 text-slate-600">{lang === 'sk' ? 'Pravidelne amaterske turnaje.' : 'Regular amateur tournaments.'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 reveal" data-reveal>
                <p className="font-semibold text-slate-900">{lang === 'sk' ? 'Firemne akcie' : 'Corporate events'}</p>
                <p className="mt-1 text-slate-600">{lang === 'sk' ? 'Prenajom priestorov pre firmy.' : 'Venue rental for companies.'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 reveal" data-reveal>
                <p className="font-semibold text-slate-900">{lang === 'sk' ? 'Prenajom vybavenia' : 'Equipment rental'}</p>
                <p className="mt-1 text-slate-600">{lang === 'sk' ? 'Rakety a lopticky na mieste.' : 'Rackets and balls available on site.'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section bg-gradient-to-r from-blue-700 to-blue-800 px-4 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center reveal" data-reveal>
          <h2 className="text-3xl font-extrabold sm:text-4xl">{tr('home.finalTitle')}</h2>
          <p className="mt-4 text-lg text-blue-100">
            {tr('home.finalSubtitle')}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/booking">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                {tr('home.ctaBook')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

function HomeFallback() {
  return (
    <div className="min-h-[60vh] w-full" aria-hidden="true">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="h-12 w-72 animate-pulse rounded-2xl bg-slate-200" />
        <div className="mt-6 h-6 w-96 animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  )
}
