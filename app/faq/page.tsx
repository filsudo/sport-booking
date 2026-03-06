'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const FAQ_ITEMS = [
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

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="animate-section-in rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50 p-8 shadow-sm">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
          <HelpCircle className="h-5 w-5 text-blue-700" />
        </div>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">Časté otázky</h1>
        <p className="mt-3 text-slate-600">
          Prehľad najdôležitejších informácií k rezervácii a fungovaniu centra.
        </p>
      </header>

      <section className="card mt-8 overflow-hidden">
        {FAQ_ITEMS.map((item, idx) => {
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
          <Button>Prejsť na rezerváciu</Button>
        </Link>
        <Link href="/contact">
          <Button variant="secondary">Kontaktovať nás</Button>
        </Link>
      </div>
    </div>
  )
}
