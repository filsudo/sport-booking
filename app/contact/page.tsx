'use client'

import { Clock3, Mail, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/components/layout/LanguageProvider'
import { siteConfig } from '@/lib/config/site'

export default function ContactPage() {
  const { tr } = useI18n()

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="animate-section-in rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50 p-8 shadow-sm">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">{tr('contactPage.title')}</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-600">
          {tr('contactPage.subtitle')}
        </p>
      </header>

      <section className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <article className="card card-hover animate-section-in p-6">
          <h2 className="text-xl font-bold text-slate-900">{tr('contactPage.contactDetails')}</h2>
          <div className="mt-5 grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><span className="flex items-center gap-2"><Phone className="h-4 w-4 text-blue-700" /> {siteConfig.contact.phone}</span></p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><span className="flex items-center gap-2"><Mail className="h-4 w-4 text-blue-700" /> {siteConfig.contact.email}</span></p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:col-span-2"><span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-700" /> {siteConfig.contact.address}</span></p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:col-span-2"><span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-700" /> {tr('infoPage.dailyHours')}</span></p>
          </div>
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {tr('contactPage.directions')}
          </div>
        </article>

        <article className="card card-hover animate-section-in p-6 [animation-delay:80ms]">
          <h2 className="text-xl font-bold text-slate-900">{tr('contactPage.writeUs')}</h2>
          <form className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{tr('common.name')}</label>
              <input className="control-soft w-full rounded-xl px-4 py-2.5" placeholder={tr('bookingDetails.fullNamePlaceholder')} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{tr('common.email')}</label>
              <input type="email" className="control-soft w-full rounded-xl px-4 py-2.5" placeholder={tr('bookingDetails.emailPlaceholder')} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">{tr('contactPage.message')}</label>
              <textarea rows={4} className="control-soft w-full rounded-xl px-4 py-2.5" placeholder={tr('contactPage.messagePlaceholder')} />
            </div>
            <Button className="w-full">{tr('contactPage.send')}</Button>
          </form>
        </article>
      </section>
    </div>
  )
}
