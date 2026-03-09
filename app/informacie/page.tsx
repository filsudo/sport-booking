'use client'

import { useI18n } from '@/components/layout/LanguageProvider'
import { siteConfig } from '@/lib/config/site'

export default function InformaciePage() {
  const { lang, tr } = useI18n()

  const rules =
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
          'Bookings can be cancelled no later than 12 hours in advance (phone or email).',
          'If equipment is damaged, customer must report it immediately.',
          'Food and glass bottles are not allowed on the playing area.',
        ]

  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="animate-section-in rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50 p-8 shadow-sm">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">{tr('infoPage.title')}</h1>
        <p className="mt-3 text-slate-600">{tr('infoPage.subtitle')}</p>
      </header>

      <section className="card mt-8 p-6">
        <h2 className="text-xl font-bold text-slate-900">{tr('infoPage.about')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          {lang === 'sk'
            ? 'Sme sportove centrum zamerane na tenis, bedminton, stolny tenis a treningove programy. Nasim cielom je jednoduchy a transparentny rezervacny system.'
            : 'We are a sports center focused on tennis, badminton, table tennis, and training programs. Our goal is a simple and transparent booking system.'}
        </p>
      </section>

      <section className="mt-6 card p-6">
        <h2 className="text-xl font-bold text-slate-900">{tr('infoPage.rules')}</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-700">
          {rules.map((rule) => (
            <li key={rule} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              {rule}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="card card-hover animate-section-in p-5">
          <h3 className="font-bold text-slate-900">{tr('infoPage.openingHours')}</h3>
          <p className="mt-2 text-sm text-slate-700">{tr('infoPage.dailyHours')}</p>
        </article>
        <article className="card card-hover animate-section-in p-5 [animation-delay:80ms]">
          <h3 className="font-bold text-slate-900">{tr('infoPage.contact')}</h3>
          <p className="mt-2 text-sm text-slate-700">
            {siteConfig.contact.email} - {siteConfig.contact.phone}
          </p>
        </article>
      </section>
    </main>
  )
}

