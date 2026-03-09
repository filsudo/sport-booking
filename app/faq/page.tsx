'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/components/layout/LanguageProvider'

const FAQ_ITEMS_SK = [
  {
    q: 'Ako funguje rezervácia?',
    a: 'Vyberiete službu, dátum, termín a následne vyplníte kontaktné údaje. Rezervácia sa odošle okamžite.',
  },
  {
    q: 'Môžem si vybrať konkrétny kurt alebo stôl?',
    a: 'Áno. Pri výbere termínu vidíte grid so zdrojmi a vyberáte konkrétny dostupný slot.',
  },
  {
    q: 'Môžem rezervovať 2 alebo 3 hodiny v kuse?',
    a: 'Áno. V kroku výberu termínu si nastavíte dĺžku 1 h, 2 h alebo 3 h. Systém overí kontinuitu slotov.',
  },
  {
    q: 'Ako funguje storno rezervácie?',
    a: 'Bezplatné zrušenie rezervácie je možné najneskôr 12 hodín pred začiatkom termínu.',
  },
  {
    q: 'Čo ak je vybraný deň bez dostupnosti?',
    a: 'Kalendár zobrazí stav dostupnosti. Pri nedostupnom dni dostanete upozornenie a vyberiete iný termín.',
  },
  {
    q: 'Je potrebné mať vlastné vybavenie?',
    a: 'Nie. Na mieste si môžete zapožičať rakety a ďalšie športové vybavenie podľa platného cenníka.',
  },
  {
    q: 'Kedy mám prísť na rezerváciu?',
    a: 'Odporúčame príchod 5 až 10 minút pred začiatkom rezervácie.',
  },
  {
    q: 'Môžem si vybrať trénera?',
    a: 'Áno. Pri individuálnom tréningu sa tréner vyberá ako zdroj rovnakým spôsobom ako kurt alebo stôl.',
  },
  {
    q: 'Ako dostanem potvrdenie rezervácie?',
    a: 'Po odoslaní sa zobrazí potvrdenie rezervácie so všetkými detailmi a možnosťou exportu do kalendára.',
  },
  {
    q: 'Kde nájdem pravidlá a podmienky?',
    a: 'V menu nájdete stránky Informácie, Obchodné podmienky a Ochrana osobných údajov.',
  },
]

const FAQ_ITEMS_EN = [
  {
    q: 'How does booking work?',
    a: 'Pick a service, date, slot, then fill in contact details. Booking is submitted instantly.',
  },
  {
    q: 'Can I choose a specific court or table?',
    a: 'Yes. In slot selection you see a resource grid and choose an exact available slot.',
  },
  {
    q: 'Can I book 2 or 3 hours continuously?',
    a: 'Yes. In slot selection choose 1h, 2h, or 3h. The system validates slot continuity.',
  },
  {
    q: 'How does cancellation work?',
    a: 'Free cancellation is available no later than 12 hours before start time.',
  },
  {
    q: 'What if selected day has no availability?',
    a: 'Calendar shows availability state. If day is unavailable, you get a warning and pick another date.',
  },
  {
    q: 'Do I need my own equipment?',
    a: 'No. You can rent rackets and other sports equipment on site based on pricing.',
  },
  {
    q: 'When should I arrive?',
    a: 'We recommend arriving 5 to 10 minutes before your booking starts.',
  },
  {
    q: 'Can I choose a trainer?',
    a: 'Yes. For personal training, trainer is selected as a resource like court or table.',
  },
  {
    q: 'How do I get booking confirmation?',
    a: 'After submit, you will see a success page with details and calendar export.',
  },
  {
    q: 'Where can I find rules and terms?',
    a: 'In menu you can find Info, Terms and Conditions, and Privacy Policy pages.',
  },
]

export default function FAQPage() {
  const { lang, tr } = useI18n()
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const faqItems = lang === 'sk' ? FAQ_ITEMS_SK : FAQ_ITEMS_EN

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="animate-section-in rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50 p-8 shadow-sm">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
          <HelpCircle className="h-5 w-5 text-blue-700" />
        </div>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">{tr('faqPage.title')}</h1>
        <p className="mt-3 text-slate-600">
          {tr('faqPage.subtitle')}
        </p>
      </header>

      <section className="card mt-8 overflow-hidden">
        {faqItems.map((item, idx) => {
          const open = openIndex === idx
          return (
            <div key={item.q} className={idx === 0 ? '' : 'border-t border-slate-200'}>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : idx)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
              >
                <span className="font-semibold text-slate-900">{item.q}</span>
                <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              <div className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600">{item.a}</p>
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/booking">
          <Button>{tr('faqPage.goBooking')}</Button>
        </Link>
        <Link href="/contact">
          <Button variant="secondary">{tr('faqPage.contactUs')}</Button>
        </Link>
      </div>
    </div>
  )
}
