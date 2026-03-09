'use client'

import Link from 'next/link'
import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Copy, Download, ExternalLink, Printer, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/components/layout/LanguageProvider'

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
  const { tr } = useI18n()
  const params = useSearchParams()
  const id = params.get('id') || 'N/A'
  const service = params.get('service') || tr('bookingDetails.defaultService')
  const serviceId = params.get('serviceId') || ''
  const resource = params.get('resource') || tr('bookingDetails.defaultResource')
  const resourceId = params.get('resourceId') || ''
  const date = params.get('date') || ''
  const start = params.get('start') || ''
  const end = params.get('end') || ''

  const detailsText = useMemo(
    () =>
      `${tr('bookingSuccess.bookingLabel')} ${id}\n${tr('common.service')}: ${service}\n${tr('common.resource')}: ${resource}\n${tr('common.date')}: ${date}\n${tr('common.time')}: ${start.slice(0, 5)} - ${end.slice(0, 5)}`,
    [id, service, resource, date, start, end, tr]
  )

  function handleCopy() {
    navigator.clipboard
      .writeText(detailsText)
      .then(() => toast.success(tr('bookingSuccess.copySuccess')))
      .catch(() => toast.error(tr('bookingSuccess.copyError')))
  }

  function handleDownloadIcs() {
    if (!date || !start || !end) {
      toast.error(tr('bookingSuccess.missingCalendarData'))
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
      `DESCRIPTION:${tr('bookingSuccess.bookingLabel')} ${service} - ${resource}`,
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
      title: `SportBook ${tr('bookingSuccess.bookingLabel')}`,
      text: `${tr('bookingSuccess.bookingLabel')} ${service} - ${date} ${start.slice(0, 5)} - ${end.slice(0, 5)}`,
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
      .then(() => toast.success(tr('bookingSuccess.copyLinkSuccess')))
      .catch(() => toast.error(tr('bookingSuccess.copyLinkError')))
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
      `${tr('bookingSuccess.bookingLabel')} ${service} - ${resource}`
    )}&location=${encodeURIComponent('SportBook, Bratislava')}`
  }, [date, start, end, resource, service, tr])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="card animate-section-in p-8 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-blue-600 drop-shadow-[0_6px_16px_rgba(37,99,235,0.28)]" />
        <h1 className="mt-4 text-3xl font-extrabold text-slate-900">{tr('bookingSuccess.title')}</h1>
        <p className="mt-2 text-slate-600">{tr('bookingSuccess.subtitle')}</p>

        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-left text-sm text-slate-700">
          <p><span className="font-semibold">{tr('bookingSuccess.reference')}:</span> {id}</p>
          <p><span className="font-semibold">{tr('common.service')}:</span> {service}</p>
          <p><span className="font-semibold">{tr('common.resource')}:</span> {resource}</p>
          <p><span className="font-semibold">{tr('common.date')}:</span> {date || '-'}</p>
          <p><span className="font-semibold">{tr('common.time')}:</span> {start.slice(0, 5)} - {end.slice(0, 5)}</p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button variant="secondary" onClick={handleCopy}>
            <Copy className="h-4 w-4" /> {tr('bookingSuccess.copy')}
          </Button>
          <Button variant="secondary" onClick={handleDownloadIcs}>
            <Download className="h-4 w-4" /> {tr('bookingSuccess.downloadIcs')}
          </Button>
          <Button variant="secondary" onClick={handleShare}>
            <Share2 className="h-4 w-4" /> {tr('bookingSuccess.share')}
          </Button>
          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> {tr('bookingSuccess.print')}
          </Button>
          <a href={googleLink} target="_blank" rel="noreferrer" className="sm:col-span-2">
            <Button className="w-full">
              <ExternalLink className="h-4 w-4" /> {tr('bookingSuccess.addGoogle')}
            </Button>
          </a>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/"><Button variant="secondary">{tr('bookingSuccess.backHome')}</Button></Link>
          <Link href="/booking"><Button>{tr('bookingSuccess.newBooking')}</Button></Link>
          {serviceId ? (
            <Link
              href={`/booking?serviceId=${encodeURIComponent(serviceId)}${
                date ? `&date=${encodeURIComponent(date)}` : ''
              }${resourceId ? `&resourceId=${encodeURIComponent(resourceId)}` : ''}`}
            >
              <Button variant="secondary">{tr('bookingSuccess.similarBooking')}</Button>
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
