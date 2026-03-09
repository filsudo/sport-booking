'use client'

import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { addDays, startOfToday } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Grid, Info, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useI18n } from '@/components/layout/LanguageProvider'
import { type Resource, type Service, type SlotReason } from '@/lib/types'

interface StepProps {
  number: number
  title: string
  isComplete: boolean
  isActive: boolean
}

function BookingStep({ number, title, isComplete, isActive }: StepProps) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        className={
          'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-200 ' +
          (isComplete
            ? 'bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.26)]'
            : isActive
              ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
              : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200')
        }
      >
        {isComplete ? <Check className="h-4 w-4" /> : number}
      </div>
      <span className={isActive ? 'font-semibold text-slate-900' : 'text-slate-600'}>{title}</span>
    </div>
  )
}

interface BookingStepperProps {
  currentStep: number
}

export function BookingStepper({ currentStep }: BookingStepperProps) {
  const { tr } = useI18n()
  const steps = [
    tr('bookingSteps.step1'),
    tr('bookingSteps.step2'),
    tr('bookingSteps.step3'),
    tr('bookingSteps.step4'),
  ]

  return (
    <div className="card p-6">
      <h3 className="mb-6 text-lg font-bold text-slate-900">{tr('bookingSteps.title')}</h3>
      {steps.map((title, i) => (
        <BookingStep
          key={title}
          number={i + 1}
          title={title}
          isComplete={i < currentStep - 1}
          isActive={i === currentStep - 1}
        />
      ))}
    </div>
  )
}

interface ServiceSelectorProps {
  services: Service[]
  selectedServiceId: string | null
  onSelect: (serviceId: string) => void
}

export function ServiceSelector({ services, selectedServiceId, onSelect }: ServiceSelectorProps) {
  const { tr } = useI18n()

  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-900">{tr('bookingSteps.chooseService')}</h2>
      <p className="mt-2 text-slate-600">{tr('bookingSteps.chooseServiceHint')}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {services.map((service) => {
          const selected = selectedServiceId === service.id
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelect(service.id)}
              className={
                'card card-hover p-5 text-left transition-all duration-200 ' +
                (selected ? 'border-blue-500 ring-2 ring-blue-200' : 'hover:border-blue-300')
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{service.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {service.description || tr('bookingSteps.serviceDescriptionFallback')}
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
                  {service.duration_minutes} min
                </span>
              </div>
              <p className="mt-4 text-xl font-extrabold text-blue-700">
                {tr('bookingSteps.fromPrice', { price: service.price.toFixed(2) })}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export interface DayAvailabilityMap {
  [isoDate: string]: number
}

interface DatePickerProps {
  selectedDate: string | null
  onSelect: (date: string) => void
  availabilityByDay?: DayAvailabilityMap
  loadingMonth?: boolean
}

function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function DatePicker({
  selectedDate,
  onSelect,
  availabilityByDay = {},
  loadingMonth = false,
}: DatePickerProps) {
  const { tr, locale } = useI18n()
  const today = startOfToday()
  const maxDate = addDays(today, 90)

  const getCount = (d: Date) => availabilityByDay[toISODate(d)] ?? 0

  const modifiers = {
    high: (d: Date) => getCount(d) >= 4,
    low: (d: Date) => getCount(d) > 0 && getCount(d) < 4,
    unavailable: (d: Date) => d >= today && getCount(d) === 0,
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-900">{tr('bookingSteps.chooseDate')}</h2>
      <p className="mt-2 text-slate-600">{tr('bookingSteps.chooseDateHint')}</p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> {tr('bookingSteps.dayAvailable')}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50/70 px-2 py-1 text-blue-700">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-300" /> {tr('bookingSteps.dayLow')}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> {tr('bookingSteps.dayUnavailable')}
        </span>
      </div>

      <div className="calendar-shell mt-5 w-full max-w-[500px] p-3 sm:p-4">
        <DayPicker
          locale={locale}
          mode="single"
          weekStartsOn={1}
          selected={selectedDate ? new Date(`${selectedDate}T00:00:00`) : undefined}
          onSelect={(date) => {
            if (!date) return
            if (getCount(date) === 0) {
              toast.error(tr('bookingSteps.noSlotsInDay'))
              return
            }
            onSelect(toISODate(date))
          }}
          fromDate={today}
          toDate={maxDate}
          showOutsideDays={false}
          captionLayout="label"
          modifiers={modifiers}
          modifiersClassNames={{
            selected: '!bg-blue-600 !text-white !border-blue-600',
            today: 'ring-2 ring-blue-300',
            high: 'bg-blue-50 text-blue-800',
            low: 'bg-blue-50/60 text-blue-700',
            unavailable: 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-75',
          }}
          classNames={{
            root: 'w-full',
            months: 'rdp-months',
            month: 'w-full',
            caption: 'mb-2 flex items-center justify-between',
            caption_label: 'text-base font-bold text-slate-900',
            nav: 'flex items-center gap-1',
            button_previous:
              'inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-all duration-200 hover:bg-blue-50 hover:text-blue-700',
            button_next:
              'inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-all duration-200 hover:bg-blue-50 hover:text-blue-700',
            month_grid: 'w-full border-separate border-spacing-x-1 border-spacing-y-1',
            weekdays: 'w-full',
            week: 'w-full',
            weekday: 'h-10 w-10 text-xs font-semibold text-slate-500',
            day: 'h-10 w-10 rounded-lg border border-transparent text-sm font-medium transition-all duration-200',
            day_button:
              'h-10 w-10 rounded-lg border border-transparent transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          }}
          components={{
            Chevron: ({ orientation }) =>
              orientation === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
          }}
        />

        {loadingMonth && <div className="mt-3 h-2 w-full animate-pulse rounded-full bg-slate-200" />}
      </div>
    </section>
  )
}

export interface GridSlot {
  resource_id: string
  start_time: string
  end_time: string
  available: boolean
  reason?: SlotReason
}

interface ResourceGridProps {
  resources: Resource[]
  times: string[]
  slots: GridSlot[]
  selectedResourceId: string | null
  selectedStarts: string[]
  onSlotClick: (resourceId: string, startTime: string) => void
  onSlotBlockedClick?: (resourceId: string, startTime: string, reason?: SlotReason) => void
  loading?: boolean
  onlyFreeSlots?: boolean
  compactMode?: boolean
  currentTimeMarker?: string | null
}

function slotKey(resourceId: string, time: string) {
  return `${resourceId}_${time}`
}

export function ResourceGrid({
  resources,
  times,
  slots,
  selectedResourceId,
  selectedStarts,
  onSlotClick,
  onSlotBlockedClick,
  loading = false,
  onlyFreeSlots = false,
  compactMode = false,
  currentTimeMarker = null,
}: ResourceGridProps) {
  const { tr } = useI18n()
  const slotMap = new Map(slots.map((slot) => [slotKey(slot.resource_id, slot.start_time), slot]))
  const availabilityByTime = new Map<string, { total: number; available: number }>()

  times.forEach((time) => {
    availabilityByTime.set(time, { total: resources.length, available: 0 })
  })

  slots.forEach((slot) => {
    const stats = availabilityByTime.get(slot.start_time)
    if (!stats) return
    if (slot.available) stats.available += 1
  })

  if (loading) {
    return (
      <div className="mt-4 space-y-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="h-20 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
    )
  }

  if (!resources.length || !times.length) {
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
        <Grid className="mx-auto h-6 w-6 text-slate-400" />
        <p className="mt-2 text-sm text-slate-600">{tr('bookingSteps.noGeneratedSlots')}</p>
      </div>
    )
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-100 ring-1 ring-blue-300" /> {tr('bookingSteps.free')}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> {tr('bookingSteps.selected')}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> {tr('bookingSteps.booked')}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> {tr('bookingSteps.unavailable')}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        <div className="min-w-[760px] p-4">
          <div className="mb-3 grid" style={{ gridTemplateColumns: `180px repeat(${times.length}, minmax(48px, 1fr))` }}>
            <div className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr('bookingSteps.resource')}</div>
            {times.map((time) => (
            <div key={time} className="px-1 text-center text-xs font-semibold text-slate-500">
                <span className={currentTimeMarker === time ? 'rounded-md bg-blue-600 px-1.5 py-0.5 text-white' : ''}>
                  {time.slice(0, 5)}
                </span>
            </div>
          ))}
          </div>

          <div className="space-y-2">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="grid items-center gap-1"
                style={{ gridTemplateColumns: `180px repeat(${times.length}, minmax(48px, 1fr))` }}
              >
                <div className="sticky left-0 z-10 rounded-lg bg-white px-2 py-2 text-sm font-semibold text-slate-900">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-blue-700" />
                    {resource.name}
                  </span>
                </div>
                {times.map((time) => {
                  const key = slotKey(resource.id, time)
                  const slot = slotMap.get(key)
                  const selected = selectedResourceId === resource.id && selectedStarts.includes(time)
                  const disabled = !slot?.available
                  const hiddenByFreeFilter = onlyFreeSlots && disabled
                  const stats = availabilityByTime.get(time)
                  const ratio = stats && stats.total ? stats.available / stats.total : 0
                  const heatClass =
                    ratio >= 0.66
                      ? 'border-blue-200 bg-blue-50/45'
                      : ratio >= 0.33
                        ? 'border-blue-200 bg-blue-50/70'
                        : 'border-blue-300 bg-blue-100/75'

                  const slotLabel = slot
                    ? slot.reason === 'booked'
                      ? tr('bookingSteps.booked')
                      : slot.reason === 'closed'
                        ? tr('bookingSteps.unavailable')
                        : slot.reason === 'not_generated'
                          ? tr('bookingSteps.notGenerated')
                          : tr('bookingSteps.free')
                    : tr('bookingSteps.unavailable')

                  return (
                    hiddenByFreeFilter ? (
                      <div
                        key={key}
                        className={
                          'rounded-lg border border-dashed border-slate-200 bg-slate-50/40 ' +
                          (compactMode ? 'h-9 min-h-[36px]' : 'h-11 min-h-[44px]')
                        }
                        aria-hidden="true"
                      />
                    ) : (
                      <button
                        key={key}
                        type="button"
                        title={`${resource.name} - ${time.slice(0, 5)} - ${slotLabel}`}
                        onClick={() => {
                          if (slot?.available) {
                            onSlotClick(resource.id, time)
                          } else {
                            onSlotBlockedClick?.(resource.id, time, slot?.reason)
                          }
                        }}
                        aria-disabled={disabled}
                        className={
                          'group relative rounded-lg border transition-all duration-200 ' +
                          (compactMode ? 'h-9 min-h-[36px]' : 'h-11 min-h-[44px]') +
                          ' ' +
                          (selected
                            ? 'border-blue-700 bg-blue-600 shadow-[0_8px_16px_rgba(37,99,235,0.25)]'
                            : disabled
                              ? slot?.reason === 'booked'
                                ? 'cursor-not-allowed border-slate-300 bg-slate-300/80 opacity-80'
                                : 'cursor-not-allowed border-slate-200 bg-slate-200 opacity-70'
                              : `${heatClass} hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-100/75 hover:shadow-sm`)
                        }
                      >
                        {!selected && slot?.reason === 'booked' ? (
                          <span className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-slate-500/70" />
                        ) : null}
                        {!selected && slot?.reason === 'closed' ? (
                          <span className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-slate-400/50" />
                        ) : null}
                        {slot?.reason && (
                          <span className="pointer-events-none absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Info className="h-3 w-3 text-slate-500" />
                          </span>
                        )}
                      </button>
                    )
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
