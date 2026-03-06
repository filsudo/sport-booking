'use client'

import { Clock3, Mail, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="animate-section-in rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50 p-8 shadow-sm">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Kontakt</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-600">
          Máte otázky k rezerváciám alebo tréningom? Napíšte nám, radi vám pomôžeme.
        </p>
      </header>

      <section className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <article className="card card-hover animate-section-in p-6">
          <h2 className="text-xl font-bold text-slate-900">Kontaktné údaje</h2>
          <div className="mt-5 grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><span className="flex items-center gap-2"><Phone className="h-4 w-4 text-blue-700" /> +421 2 1234 5678</span></p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><span className="flex items-center gap-2"><Mail className="h-4 w-4 text-blue-700" /> info@sportbook.sk</span></p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:col-span-2"><span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-700" /> Športová 12, Bratislava</span></p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:col-span-2"><span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-700" /> Denne 09:00 – 21:00</span></p>
          </div>
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Ako sa k nám dostanete: autom z centra do 15 minút, MHD zastávka je 3 minúty pešo od haly.
          </div>
        </article>

        <article className="card card-hover animate-section-in p-6 [animation-delay:80ms]">
          <h2 className="text-xl font-bold text-slate-900">Napíšte nám</h2>
          <form className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Meno</label>
              <input className="w-full rounded-xl border border-slate-300 px-4 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Meno a priezvisko" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
              <input type="email" className="w-full rounded-xl border border-slate-300 px-4 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="vas@email.sk" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Správa</label>
              <textarea rows={4} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ako vám môžeme pomôcť?" />
            </div>
            <Button className="w-full">Odoslať správu</Button>
          </form>
        </article>
      </section>
    </div>
  )
}
