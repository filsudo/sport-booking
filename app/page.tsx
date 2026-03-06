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
import { ReservationGridPreview } from '@/components/home/ReservationGridPreview'
import { supabase } from '@/lib/supabaseClient'
import { Service } from '@/lib/types'
import { normalizeCategory } from '@/lib/utils/validation'

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/15">
      <div className="text-2xl font-extrabold leading-tight">{value}</div>
      <div className="text-xs text-blue-100">{label}</div>
    </div>
  )
}

const houseRules = [
  'Vstup na hraciu plochu len v čistej športovej obuvi s nefarbiacou podrážkou.',
  'Prosíme prísť 5-10 minút pred začiatkom rezervácie.',
  'Rezerváciu je možné zrušiť najneskôr 12 hodín vopred (telefonicky/emailom).',
  'Pri poškodení vybavenia je používateľ povinný okamžite nahlásiť škodu.',
  'Na hracej ploche je zákaz jedla a sklenených fliaš.',
]

const faqPreview = [
  {
    q: 'Ako rýchlo viem vytvoriť rezerváciu?',
    a: 'Do pár kliknutí: služba, dátum, čas a potvrdenie údajov.',
  },
  {
    q: 'Môžem si vybrať trénera?',
    a: 'Áno, pri individuálnom tréningu sa tréner vyberá ako zdroj.',
  },
  {
    q: 'Ako funguje storno?',
    a: 'Bezplatné storno je možné najneskôr 12 hodín pred termínom.',
  },
]

function HomeContent() {
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

    supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          console.error('Home services load error:', error)
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
        observer.observe(el)
      }
    })

    return () => observer.disconnect()
  }, [services.length])

  const highlightedServices = useMemo(() => {
    if (!services.length) {
      return [
        { name: 'Tenisový kurt', price: 20, category: 'courts' as const },
        { name: 'Stolný tenis', price: 8, category: 'tables' as const },
        { name: 'Bedminton', price: 12, category: 'courts' as const },
        { name: 'Individuálny tréning', price: 35, category: 'trainings' as const },
      ]
    }

    return services.slice(0, 4).map((service) => ({
      name: service.name,
      price: service.price,
      category: normalizeCategory(service.name, service.category),
    }))
  }, [services])

  const favoriteServices = useMemo(() => {
    if (!favoriteIds.length) return []
    return services.filter((service) => favoriteIds.includes(service.id))
  }, [services, favoriteIds])

  const recentServices = useMemo(() => {
    if (!recentServiceIds.length) return []
    const map = new Map(services.map((service) => [service.id, service]))
    return recentServiceIds.map((id) => map.get(id)).filter((service): service is Service => Boolean(service)).slice(0, 4)
  }, [services, recentServiceIds])

  return (
    <div className="w-full">
      <section className="relative overflow-hidden bg-slate-950 animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-700 to-slate-950" />
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:26px_26px]" />
        <div className="absolute -right-16 top-20 h-48 w-48 rounded-full bg-blue-300/20 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12 lg:items-center lg:px-8">
          <div className="lg:col-span-7">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm text-blue-100">
              <Sparkles className="h-4 w-4" />
              <span>Moderné rezervácie pre športové centrum</span>
            </div>

            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
              Rezervujte kurt, stôl alebo tréning bez čakania
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-blue-100/95 sm:text-xl">
              SportBook zobrazí voľné termíny okamžite. Výber služby, dátumu a času je jednoduchý
              na mobile aj desktopoch.
            </p>

            <div id="cennik" className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/booking">
                <Button size="lg" className="w-full animate-fade-in-up animate-pulse-glow sm:w-auto">
                  Rezervovať
                </Button>
              </Link>
              <Link href="/services">
                <Button size="lg" variant="secondary" className="w-full animate-fade-in-up stagger-1 sm:w-auto">
                  Pozrieť služby
                </Button>
              </Link>
              <Button
                size="lg"
                variant="secondary"
                className="w-full animate-fade-in-up stagger-1 sm:w-auto"
                onClick={() => window.dispatchEvent(new CustomEvent('open-pricing-modal'))}
              >
                Cenník
              </Button>
            </div>

            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 text-white">
              <div className="animate-float-soft">
                <Stat value="7 aktivít" label="Športové aktivity" />
              </div>
              <div className="animate-float-soft [animation-delay:300ms]">
                <Stat value="12 h" label="Denne otvorené" />
              </div>
              <div className="animate-float-soft [animation-delay:600ms]">
                <Stat value="90 dní" label="Rezervácie dopredu" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="card soft-shadow overflow-hidden">
              <div className="border-b border-slate-200 bg-gradient-to-r from-slate-100 to-white p-5">
                <h2 className="text-sm font-bold text-slate-900">Náhľad rezervačného gridu</h2>
                <p className="mt-1 text-xs text-slate-600">Riadky = zdroje, stĺpce = hodiny</p>
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
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ako to funguje</h2>
              <p className="mt-2 max-w-2xl text-slate-600">
                Vyberiete službu, dátum, termín a odošlete rezerváciu.
              </p>
            </div>
            <Link href="/booking">
              <Button variant="secondary">
                Začať rezerváciu
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 reveal-stagger">
            {[
              {
                icon: Calendar,
                title: 'Výber dátumu',
                text: 'Kalendár zobrazí dostupné termíny na najbližších 60 dní.',
              },
              {
                icon: LayoutGrid,
                title: 'Výber zdroja',
                text: 'Grid pre kurty, stoly a trénerov s jasnými stavmi dostupnosti.',
              },
              {
                icon: ShieldCheck,
                title: 'Potvrdenie',
                text: 'Vyplníte údaje, skontrolujete zhrnutie a rezervácia je hotová.',
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
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">SportBook centrum</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">O nás</h2>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-stretch reveal-stagger">
            <article className="card card-hover reveal flex h-full flex-col p-6 sm:p-7 lg:col-span-7" data-reveal>
              <h3 className="text-2xl font-extrabold leading-tight text-slate-900 sm:text-[2rem]">
                Miesto, kde je šport dostupný bez chaosu
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                SportBook je športové centrum a rezervačný systém v jednom. Spájame kvalitné zázemie, férový prístup a
                jednoduché online objednanie termínu, aby ste mohli viac času venovať hre a menej organizácii.
              </p>
              <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm leading-relaxed text-slate-700">
                Začínali sme s cieľom odstrániť zložité telefonické rezervácie. Dnes ponúkame jasný prehľad voľných
                termínov pre hráčov, trénerov aj kluby.
              </p>

              <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Naša vízia</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    Vytvárať športové prostredie, kde je rezervácia jednoduchá a tréning pravidelný.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Prečo SportBook</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    <li>• prehľadné termíny bez telefonovania</li>
                    <li>• férové podmienky a jasné storno pravidlá</li>
                    <li>• príjemné zázemie pre hráčov aj rodičov</li>
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
                  <p className="text-sm font-bold text-slate-900">Komunita a tréneri</p>
                  <p className="mt-1 text-sm text-slate-600">Priestor pre rekreačných hráčov, amatérov aj kluby.</p>
                </div>
                <div className="card-hover reveal rounded-xl border border-slate-200 bg-white p-4" data-reveal>
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-100">
                    <LayoutGrid className="h-4 w-4 text-blue-700" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">Jednoduchá rezervácia</p>
                  <p className="mt-1 text-sm text-slate-600">Služba, dátum, čas a potvrdenie za pár kliknutí.</p>
                </div>
                <div className="card-hover reveal rounded-xl border border-slate-200 bg-white p-4" data-reveal>
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-100">
                    <ShieldCheck className="h-4 w-4 text-blue-700" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">Komfort v hale</p>
                  <p className="mt-1 text-sm text-slate-600">Šatne, sprchy a zázemie pre rodičov aj oddych.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="page-section bg-white px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-end justify-between reveal" data-reveal>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Aktivity centra</h2>
            <Link href="/services" className="text-sm font-bold text-blue-700 hover:text-blue-800">
              Zobraziť všetko
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
                    60 min slot • šatne • sprchy
                  </p>
                  <p className="mt-3 text-lg font-extrabold text-blue-700">Od {service.price.toFixed(2)} €</p>
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
              Vaše obľúbené služby
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3 reveal-stagger">
              {favoriteServices.map((service) => (
                <div key={service.id} className="card card-hover reveal p-5" data-reveal>
                  <p className="text-sm font-semibold text-blue-700">⭐ Obľúbené</p>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">{service.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{service.description || 'Rezervujte si termín online.'}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Od {service.price.toFixed(2)} €</span>
                    <Link href={`/booking?serviceId=${service.id}`}>
                      <Button size="sm" variant="secondary">Rezervovať</Button>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Posledný výber</p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">{lastSelection.serviceName}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {lastSelection.resourceName ? `${lastSelection.resourceName} • ` : ''}{lastSelection.date || ''}{' '}
                {lastSelection.startTime ? `• ${lastSelection.startTime.slice(0, 5)}` : ''}
              </p>
              <div className="mt-4">
                <Link href={`/booking?serviceId=${lastSelection.serviceId}`}>
                  <Button variant="secondary">Pokračovať</Button>
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
              Nedávno prezerané
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {recentServices.map((service) => (
                <div key={service.id} className="card card-hover reveal p-4" data-reveal>
                  <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                  <p className="mt-1 text-xs text-slate-600">{service.description || 'Online rezervácia dostupná okamžite.'}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-blue-700">Od {service.price.toFixed(2)} €</span>
                    <Link href={`/booking?serviceId=${service.id}`}>
                      <Button size="sm" variant="secondary">Otvoriť</Button>
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
            Pravidlá prevádzky
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
              <Button variant="secondary">Všetky otázky a odpovede</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="page-section px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card reveal p-6" data-reveal>
            <h2 className="text-2xl font-bold text-slate-900">Kontakt a lokalita</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-700" />
                Športová 12, Bratislava
              </p>
              <p className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-700" />
                +421 2 xxxx xxxx
              </p>
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-700" />
                info@sportbook.sk
              </p>
              <p className="pt-1 text-slate-600">
                Dostanete sa k nám MHD aj autom, parkovanie je dostupné pri hale.
              </p>
            </div>
          </div>
          <div className="card reveal p-6" data-reveal>
            <h2 className="text-2xl font-bold text-slate-900">Služby centra</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm reveal-stagger">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 reveal" data-reveal>
                <p className="font-semibold text-slate-900">Bar / občerstvenie</p>
                <p className="mt-1 text-slate-600">Káva, nápoje a drobné snacky.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 reveal" data-reveal>
                <p className="font-semibold text-slate-900">Turnaje a eventy</p>
                <p className="mt-1 text-slate-600">Pravidelné amatérske turnaje.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 reveal" data-reveal>
                <p className="font-semibold text-slate-900">Firemné akcie</p>
                <p className="mt-1 text-slate-600">Prenájom priestorov pre firmy.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 reveal" data-reveal>
                <p className="font-semibold text-slate-900">Prenájom vybavenia</p>
                <p className="mt-1 text-slate-600">Rakety a loptičky na mieste.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section bg-gradient-to-r from-blue-700 to-blue-900 px-4 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center reveal" data-reveal>
          <h2 className="text-3xl font-extrabold sm:text-4xl">Pripravení rezervovať?</h2>
          <p className="mt-4 text-lg text-blue-100">
            Dostupné sloty pre kurty, stoly aj trénerov zobrazujeme okamžite.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/booking">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Rezervovať
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
