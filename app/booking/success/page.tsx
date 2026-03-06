'use client'

import Link from 'next/link'
import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Copy, Download, ExternalLink, Printer, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'

function toCalendarDate(date: string, time: string) {
  return `${date}T${time.length === 5 ? `${time}:00` : time}`
}

function toICSDate(value: Date) {
  const yyyy = value.getUTCFullYear()
  const mm = String(value.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(value.getUTCDate()).padStart(2, '0')
  const hh = String(value.getUTCHours()).padStart(2, '0')
  const mi = String(value.getUTCMinutes()).padStart(2, '0')
  const ss = String(value.getUTCSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`
}

function SuccessContent() {
  const params = useSearchParams()
  const id = params.get('id') || 'N/A'
  const service = params.get('service') || 'Služba'
  const serviceId = params.get('serviceId') || ''
  const resource = params.get('resource') || 'Zdroj'
  const resourceId = params.get('resourceId') || ''
  const date = params.get('date') || ''
  const start = params.get('start') || ''
  const end = params.get('end') || ''

  const detailsText = useMemo(
    () => `Rezervácia ${id}\nSlužba: ${service}\nZdroj: ${resource}\nDátum: ${date}\nČas: ${start.slice(0, 5)} - ${end.slice(0, 5)}`,
    [id, service, resource, date, start, end]
  )

  function handleCopy() {
    navigator.clipboard
      .writeText(detailsText)
      .then(() => toast.success('Detaily rezervácie boli skopírované'))
      .catch(() => toast.error('Nepodarilo sa skopírovať rezerváciu'))
  }

  function handleDownloadIcs() {
    if (!date || !start || !end) {
      toast.error('Chýbajú údaje pre kalendár')
      return
    }

    const startDate = new Date(toCalendarDate(date, start))
    const endDate = new Date(toCalendarDate(date, end))

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SportBook//Booking//SK',
      'BEGIN:VEVENT',
      `UID:${id}@sportbook.sk`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(startDate)}`,
      `DTEND:${toICSDate(endDate)}`,
      `SUMMARY:${service}`,
      `DESCRIPTION:Rezervácia ${service} - ${resource}`,
      'LOCATION:SportBook, Bratislava',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rezervacia-${id}.ics`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function handleShare() {
    const shareData = {
      title: 'SportBook rezervácia',
      text: `Rezervácia ${service} • ${date} ${start.slice(0, 5)} – ${end.slice(0, 5)}`,
      url: window.location.href,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch (error) {
        console.error('Share error:', error)
      }
    }

    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success('Odkaz na rezerváciu bol skopírovaný'))
      .catch(() => toast.error('Nepodarilo sa skopírovať odkaz'))
  }

  function handlePrint() {
    window.print()
  }

  const googleLink = useMemo(() => {
    if (!date || !start || !end) return '#'

    const startDate = new Date(toCalendarDate(date, start))
    const endDate = new Date(toCalendarDate(date, end))

    const from = toICSDate(startDate)
    const to = toICSDate(endDate)

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      service
    )}&dates=${from}/${to}&details=${encodeURIComponent(
      `Rezervácia ${service} - ${resource}`
    )}&location=${encodeURIComponent('SportBook, Bratislava')}`
  }, [date, start, end, resource, service])

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="card animate-section-in p-8 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-blue-600 drop-shadow-[0_6px_18px_rgba(37,99,235,0.35)]" />
        <h1 className="mt-4 text-3xl font-extrabold text-slate-900">Rezervácia bola úspešne odoslaná</h1>
        <p className="mt-2 text-slate-600">Ďakujeme, potvrdenie rezervácie prebehlo úspešne.</p>

        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left text-sm text-slate-700">
          <p><span className="font-semibold">Referenčné číslo:</span> {id}</p>
          <p><span className="font-semibold">Služba:</span> {service}</p>
          <p><span className="font-semibold">Zdroj:</span> {resource}</p>
          <p><span className="font-semibold">Dátum:</span> {date || '-'}</p>
          <p><span className="font-semibold">Čas:</span> {start.slice(0, 5)} – {end.slice(0, 5)}</p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button variant="secondary" onClick={handleCopy}>
            <Copy className="h-4 w-4" /> Skopírovať rezerváciu
          </Button>
          <Button variant="secondary" onClick={handleDownloadIcs}>
            <Download className="h-4 w-4" /> Stiahnuť .ics
          </Button>
          <Button variant="secondary" onClick={handleShare}>
            <Share2 className="h-4 w-4" /> Zdieľať rezerváciu
          </Button>
          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Vytlačiť potvrdenie
          </Button>
          <a href={googleLink} target="_blank" rel="noreferrer" className="sm:col-span-2">
            <Button className="w-full">
              <ExternalLink className="h-4 w-4" /> Pridať do Google kalendára
            </Button>
          </a>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/"><Button variant="secondary">Späť na domov</Button></Link>
          <Link href="/booking"><Button>Nová rezervácia</Button></Link>
          {serviceId ? (
            <Link
              href={`/booking?serviceId=${encodeURIComponent(serviceId)}${
                date ? `&date=${encodeURIComponent(date)}` : ''
              }${resourceId ? `&resourceId=${encodeURIComponent(resourceId)}` : ''}`}
            >
              <Button variant="secondary">Rezervovať podobný termín</Button>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function BookingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}
