'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MouseEvent, useEffect, useState } from 'react'
import { Mail, MapPin, Menu, Phone, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabaseClient'
import type { Service } from '@/lib/types'

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ')
}

const navItems = [
  { href: '/', label: 'Domov' },
  { href: '/#o-nas', label: 'O nás' },
  { href: '/services', label: 'Služby' },
  { href: '/cennik', label: 'Cenník', isPricing: true },
  { href: '/informacie', label: 'Informácie' },
  { href: '/contact', label: 'Kontakt' },
]

function openPricingModal(event?: MouseEvent<HTMLElement>) {
  event?.preventDefault()
  window.dispatchEvent(new CustomEvent('open-pricing-modal'))
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [adminHref, setAdminHref] = useState('/login?redirect=/admin')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [services, setServices] = useState<Service[]>([])

  function handlePricingClick(event?: MouseEvent<HTMLElement>) {
    openPricingModal(event)
    setMobileOpen(false)
  }

  function handleAboutClick(event?: MouseEvent<HTMLElement>) {
    event?.preventDefault()
    const sectionId = 'o-nas'
    const headerOffset = 88

    if (pathname !== '/') {
      try {
        window.sessionStorage.setItem('sportbook:scrollToAbout', '1')
      } catch {
      }
      router.push(`/#${sectionId}`)
      setMobileOpen(false)
      return
    }

    const target = document.getElementById(sectionId)
    if (!target) return

    const top = target.getBoundingClientRect().top + window.scrollY - headerOffset
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    window.history.replaceState(null, '', `/#${sectionId}`)
    setMobileOpen(false)
  }

  useEffect(() => {
    if (pathname !== '/') return

    const hasHash = window.location.hash === '#o-nas'
    let shouldScrollFromFlag = false
    try {
      shouldScrollFromFlag = window.sessionStorage.getItem('sportbook:scrollToAbout') === '1'
    } catch {
      shouldScrollFromFlag = false
    }

    if (!hasHash && !shouldScrollFromFlag) return

    const scrollToAbout = () => {
      const target = document.getElementById('o-nas')
      if (!target) return false
      const headerOffset = 88
      const top = target.getBoundingClientRect().top + window.scrollY - headerOffset
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      window.history.replaceState(null, '', '/#o-nas')
      try {
        window.sessionStorage.removeItem('sportbook:scrollToAbout')
      } catch {
      }
      return true
    }

    const immediateDone = scrollToAbout()
    if (immediateDone) return

    const timer = window.setTimeout(() => {
      scrollToAbout()
    }, 120)

    return () => window.clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAdminHref(data.session ? '/admin' : '/login?redirect=/admin')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdminHref(session ? '/admin' : '/login?redirect=/admin')
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true

    supabase
      .from('services')
      .select('name,price,is_active')
      .eq('is_active', true)
      .order('price', { ascending: true })
      .then(({ data }) => {
        if (!active || !data) return
        setServices((data as unknown as Service[]) || [])
      })

    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      active = false
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    const onOpenPricing = () => setPricingOpen(true)
    window.addEventListener('open-pricing-modal', onOpenPricing)
    return () => window.removeEventListener('open-pricing-modal', onOpenPricing)
  }, [])

  return (
    <>
      <header
        className={cx(
          'sticky top-0 z-50 border-b transition-all duration-200',
          scrolled
            ? 'border-slate-200/90 bg-white/85 backdrop-blur-xl shadow-sm'
            : 'border-slate-100 bg-white/95'
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-18 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-sm shadow-blue-800/30 transition-transform duration-200 group-hover:scale-105">
              <span className="text-sm font-black text-white">SB</span>
            </div>
            <span className="text-base font-bold text-slate-900 sm:text-lg">SportBook</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              if (item.isPricing) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={handlePricingClick}
                    className="relative rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 after:absolute after:bottom-1 after:left-3 after:right-3 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-blue-500 after:transition-transform after:duration-200 hover:bg-slate-100 hover:text-slate-900 hover:after:scale-x-100"
                  >
                    {item.label}
                  </button>
                )
              }

              if (item.href === '/#o-nas') {
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={(event) => handleAboutClick(event)}
                    className="relative rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 after:absolute after:bottom-1 after:left-3 after:right-3 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-blue-500 after:transition-transform after:duration-200 hover:bg-slate-100 hover:text-slate-900 hover:after:scale-x-100"
                  >
                    {item.label}
                  </button>
                )
              }

              const isHashLink = item.href.includes('#')
              const isActive = isHashLink
                ? false
                : item.href === '/'
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    'relative rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 after:absolute after:bottom-1 after:left-3 after:right-3 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-blue-500 after:transition-transform after:duration-200',
                    isActive
                      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 after:scale-x-100'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:after:scale-x-100'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}

            <Link href={adminHref} className="ml-2">
              <Button size="sm">Spravovať</Button>
            </Link>
          </nav>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-100 md:hidden"
            aria-label={mobileOpen ? 'Zatvoriť menu' : 'Otvoriť menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <div
          className={cx(
            'overflow-hidden border-t border-slate-200 bg-white transition-all duration-200 md:hidden',
            mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <nav className="mx-auto max-w-7xl space-y-1 px-4 py-4 sm:px-6">
            {navItems.map((item) => {
              if (item.isPricing) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={handlePricingClick}
                    className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-all duration-200 hover:translate-x-1 hover:bg-slate-100"
                  >
                    {item.label}
                  </button>
                )
              }

              if (item.href === '/#o-nas') {
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={(event) => handleAboutClick(event)}
                    className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-all duration-200 hover:translate-x-1 hover:bg-slate-100"
                  >
                    {item.label}
                  </button>
                )
              }

              const isHashLink = item.href.includes('#')
              const isActive = isHashLink
                ? false
                : item.href === '/'
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cx(
                    'block rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                    isActive
                      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                      : 'text-slate-700 hover:translate-x-1 hover:bg-slate-100'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
            <Link href={adminHref} className="block pt-2">
              <Button className="w-full" onClick={() => setMobileOpen(false)}>
                Spravovať
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <Modal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} title="Cenník">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-slate-900 px-5 py-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">SportBook centrum</p>
            <h3 className="mt-2 text-3xl font-extrabold">Cenník</h3>
            <p className="mt-1 text-sm text-blue-100">Platné od 1. marca 2026 do odvolania</p>
          </div>

          <div className="space-y-5 p-5 text-sm">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="font-bold text-slate-900">Jednorazový vstup</h4>
              <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                {(services.length
                  ? services.map((service) => ({ name: service.name, price: service.price }))
                  : [
                      { name: 'Tenis', price: 30 },
                      { name: 'Bedminton', price: 12 },
                      { name: 'Stolný tenis', price: 10 },
                      { name: 'Individuálny tréning', price: 35 },
                    ]
                ).map((service) => (
                  <div key={service.name} className="flex items-center justify-between px-3 py-2.5">
                    <span className="font-medium text-slate-700">{service.name}</span>
                    <span className="font-bold text-blue-700">{Number(service.price).toFixed(2)} € / hod.</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="font-bold text-slate-900">Permanentky</h4>
                <div className="mt-3 space-y-2 text-slate-700">
                  <p className="rounded-lg border border-slate-200 bg-white px-3 py-2">10 vstupov – kurty: <span className="font-semibold text-blue-700">180.00 €</span></p>
                  <p className="rounded-lg border border-slate-200 bg-white px-3 py-2">10 vstupov – stoly: <span className="font-semibold text-blue-700">70.00 €</span></p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="font-bold text-slate-900">Prenájom vybavenia</h4>
                <div className="mt-3 space-y-2 text-slate-700">
                  <p className="rounded-lg border border-slate-200 bg-white px-3 py-2">Tenisová raketa: <span className="font-semibold text-blue-700">3.00 €</span></p>
                  <p className="rounded-lg border border-slate-200 bg-white px-3 py-2">Bedmintonová raketa: <span className="font-semibold text-blue-700">2.50 €</span></p>
                  <p className="rounded-lg border border-slate-200 bg-white px-3 py-2">Stolnotenisová raketa: <span className="font-semibold text-blue-700">2.00 €</span></p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-slate-700">
              <h4 className="font-bold text-slate-900">Storno podmienky</h4>
              <p className="mt-2 text-sm">
                Bezplatné zrušenie rezervácie je možné najneskôr 12 hodín pred plánovaným začiatkom
                (telefonicky alebo emailom). Neospravedlnená neúčasť je spoplatnená podľa platného cenníka.
              </p>
            </section>
          </div>
        </div>
      </Modal>

    </>
  )
}

export function Footer() {
  function handlePricingClick(event?: MouseEvent<HTMLElement>) {
    openPricingModal(event)
  }

  return (
    <footer className="mt-20 border-t border-slate-200 bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-4 text-lg font-bold">Kontakt</h3>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-300" />
                <span>+421 2 xxxx xxxx</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-300" />
                <span>info@sportbook.sk</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-300" />
                <span>Športová 12, Bratislava</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold">Navigácia</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li><Link href="/" className="transition-colors hover:text-blue-300">Domov</Link></li>
              <li><Link href="/#o-nas" className="transition-colors hover:text-blue-300">O nás</Link></li>
              <li><Link href="/services" className="transition-colors hover:text-blue-300">Služby</Link></li>
              <li>
                <button type="button" onClick={handlePricingClick} className="bg-transparent p-0 text-left transition-colors hover:text-blue-300">
                  Cenník
                </button>
              </li>
              <li><Link href="/booking" className="transition-colors hover:text-blue-300">Rezervácia</Link></li>
              <li><Link href="/faq" className="transition-colors hover:text-blue-300">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold">Podmienky</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li><Link href="/informacie" className="transition-colors hover:text-blue-300">Informácie</Link></li>
              <li><Link href="/obchodne-podmienky" className="transition-colors hover:text-blue-300">Obchodné podmienky</Link></li>
              <li><Link href="/ochrana-osobnych-udajov" className="transition-colors hover:text-blue-300">Ochrana osobných údajov</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-800 pt-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 SportBook. Všetky práva vyhradené.</p>
          <p className="text-xs">Demo verzia produktu</p>
        </div>
      </div>
    </footer>
  )
}
