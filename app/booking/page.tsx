'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { CalendarDays, Clock3, Filter, LayoutGrid, List, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AnimatedSelect } from '@/components/ui/AnimatedSelect'
import { useI18n } from '@/components/layout/LanguageProvider'
import { getSupabaseErrorMessage, isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import {
  BookingStepper,
  DatePicker,
  type DayAvailabilityMap,
  ResourceGrid,
  ServiceSelector,
} from '@/components/booking/BookingSteps'
import { type Service, type SlotsApiResponse } from '@/lib/types'

type ApiSlot = SlotsApiResponse['slots'][number]
type SlotView = 'grid' | 'list'
type TimeFilter = 'all' | 'morning' | 'afternoon' | 'evening'
type ResourceSort = 'name' | 'nearest' | 'availability'
type DateViewMode = 'calendar' | 'closest'
type BookingProgress = {
  serviceId: string
  date: string | null
  durationHours: 1 | 2 | 3
  step: number
}
type ResourcePreview = {
  id: string
  name: string
  nearestFree: string | null
  freeSlotsToday: number
  status: string
  recommended: boolean
}
type SelectionResult =
  | { ok: true; starts: string[]; endTime: string }
  | { ok: false; reason: string }

const OPEN_TIME = '09:00:00'
const CLOSE_TIME = '21:00:00'

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function minutesOf(time: string) {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function makeTimes(open: string, close: string, step = 60) {
  const start = minutesOf(open)
  const end = minutesOf(close)
  const result: string[] = []
  for (let m = start; m < end; m += step) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    result.push(`${hh}:${mm}:00`)
  }
  return result
}

function segmentForTime(time: string) {
  const minutes = minutesOf(time)
  if (minutes < 12 * 60) return 'morning'
  if (minutes < 17 * 60) return 'afternoon'
  return 'evening'
}

function toDurationHours(value: unknown): 1 | 2 | 3 {
  return value === 2 || value === 3 ? value : 1
}

function blockedReasonText(reason: ApiSlot['reason'] | undefined, lang: 'en' | 'sk') {
  if (reason === 'booked') return lang === 'sk' ? 'Obsadene' : 'Booked'
  if (reason === 'closed') return lang === 'sk' ? 'Cas uz uplynul alebo je mimo prevadzkovych hodin' : 'Time has already passed or is outside opening hours'
  if (reason === 'not_generated') return lang === 'sk' ? 'Terminy pre tento den zatial neboli vygenerovane' : 'Slots for this day have not been generated yet'
  return lang === 'sk' ? 'Nie je dostupne' : 'Not available'
}

export default function BookingFlowPage() {
  const { lang } = useI18n()
  const router = useRouter()
  const contentRef = useRef<HTMLDivElement | null>(null)
  const slotGridRef = useRef<HTMLDivElement | null>(null)

  const [step, setStep] = useState(1)
  const [services, setServices] = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(true)

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedDateDraft, setSelectedDateDraft] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const [slotsData, setSlotsData] = useState<SlotsApiResponse | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [slotError, setSlotError] = useState<string | null>(null)
  const [availabilityByDay, setAvailabilityByDay] = useState<DayAvailabilityMap>({})

  const [durationHours, setDurationHours] = useState<1 | 2 | 3>(1)
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null)
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null)
  const [selectedStarts, setSelectedStarts] = useState<string[]>([])
  const [nearestFreeTerm, setNearestFreeTerm] = useState<string | null>(null)
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null)
  const [holdSecondsLeft, setHoldSecondsLeft] = useState<number>(0)
  const [blockedSlot, setBlockedSlot] = useState<{ resourceId: string; time: string; reason?: ApiSlot['reason'] } | null>(null)
  const [suggestedTimes, setSuggestedTimes] = useState<string[]>([])
  const [waitlistAdded, setWaitlistAdded] = useState(false)
  const [slotView, setSlotView] = useState<SlotView>('grid')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [onlyFreeSlots, setOnlyFreeSlots] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const [resourceSort, setResourceSort] = useState<ResourceSort>('nearest')
  const [dateViewMode, setDateViewMode] = useState<DateViewMode>('calendar')
  const [resumeMessage, setResumeMessage] = useState<string | null>(null)
  const [resourcePreview, setResourcePreview] = useState<ResourcePreview[]>([])
  const [bestTimeSuggestion, setBestTimeSuggestion] = useState<string | null>(null)

  const L = useCallback(
    (skText: string, enText: string) => (lang === 'sk' ? skText : enText),
    [lang]
  )

  const resetSelection = useCallback(() => {
    setSelectedResourceId(null)
    setSelectedStartTime(null)
    setSelectedEndTime(null)
    setSelectedStarts([])
    setHoldExpiresAt(null)
    setHoldSecondsLeft(0)
    setBlockedSlot(null)
    setSuggestedTimes([])
    setWaitlistAdded(false)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const presetServiceId = params.get('serviceId')
    const presetDate = params.get('date')

    let active = true

    async function loadServices() {
      try {
        setLoadingServices(true)
        if (!isSupabaseConfigured) {
          if (active) {
            setServices([])
            setLoadingServices(false)
          }
          return
        }

        const { data, error } = await supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true })

        if (error) throw error
        if (!active) return

        const nextServices = (data || []) as Service[]
        setServices(nextServices)

        if (presetServiceId && nextServices.some((service) => service.id === presetServiceId)) {
          setSelectedServiceId(presetServiceId)
          if (presetDate) {
            setSelectedDateDraft(presetDate)
            setSelectedDate(presetDate)
          }
          setStep(2)
          setResumeMessage(null)
          return
        }

        try {
          const stored = window.localStorage.getItem('sportbook:bookingProgress')
          if (!stored) return

          const parsed = JSON.parse(stored) as Partial<BookingProgress>
          if (!parsed.serviceId || !nextServices.some((service) => service.id === parsed.serviceId)) return

          const restoredDate = typeof parsed.date === 'string' ? parsed.date : null
          const restoredDuration = toDurationHours(parsed.durationHours)
          const restoredStep = 2

          setSelectedServiceId(parsed.serviceId)
          setSelectedDateDraft(restoredDate)
          setSelectedDate(restoredDate)
          setDurationHours(restoredDuration)
          setStep(restoredStep)
          setResumeMessage(L('Pokracujete tam, kde ste skoncili.', 'Continuing where you left off.'))
          toast.success(L('Obnovili sme vasu poslednu rozpracovanu rezervaciu', 'We restored your last in-progress booking'))
        } catch {
        }
      } catch (error) {
        console.error('Booking services load error:', getSupabaseErrorMessage(error, 'Failed to load services'))
        toast.error(L('Nepodarilo sa nacitat sluzby', 'Failed to load services'))
      } finally {
        if (active) setLoadingServices(false)
      }
    }

    loadServices()
    return () => {
      active = false
    }
  }, [L])

  useEffect(() => {
    if (!selectedServiceId) return
    try {
      const payload: BookingProgress = {
        serviceId: selectedServiceId,
        date: selectedDateDraft || selectedDate,
        durationHours,
        step,
      }
      window.localStorage.setItem('sportbook:bookingProgress', JSON.stringify(payload))
    } catch {
    }
  }, [durationHours, selectedDate, selectedDateDraft, selectedServiceId, step])

  useEffect(() => {
    if (!selectedServiceId) return

    let active = true

    async function loadMonthAvailability() {
      try {
        setLoadingMonth(true)
        const month = toMonthKey(selectedDateDraft ? new Date(`${selectedDateDraft}T00:00:00`) : new Date())
        const response = await fetch(`/api/slots?serviceId=${selectedServiceId}&month=${month}`)
        if (!response.ok) return

        const payload = await response.json()
        const map: DayAvailabilityMap = {}
        if (Array.isArray(payload?.days)) {
          payload.days.forEach((item: { date: string; availableCount: number }) => {
            map[item.date] = item.availableCount
          })
        }

        if (!active) return
        setAvailabilityByDay(map)
      } catch (error) {
        console.error('Month availability error:', error)
      } finally {
        if (active) setLoadingMonth(false)
      }
    }

    loadMonthAvailability()
    return () => {
      active = false
    }
  }, [selectedServiceId, selectedDateDraft])

  useEffect(() => {
    if (!selectedServiceId) {
      setResourcePreview([])
      setBestTimeSuggestion(null)
      return
    }

    let active = true

    async function loadResourcePreview() {
      try {
        const today = toISODate(new Date())
        const response = await fetch(`/api/slots?serviceId=${selectedServiceId}&date=${today}`)
        if (!response.ok) return
        const payload = (await response.json()) as SlotsApiResponse
        if (!active) return

        const byResource = payload.resources.map((resource) => {
          const items = payload.slots
            .filter((slot) => slot.resource_id === resource.id)
            .sort((a, b) => (a.start_time > b.start_time ? 1 : -1))
          const availableItems = items.filter((slot) => slot.available)
          const nearest = availableItems[0]?.start_time || null
          const freeCount = availableItems.length
          const status =
            freeCount === 0
              ? L('Bez volnych slotov', 'No free slots')
              : nearest && minutesOf(nearest) >= 17 * 60
                ? L('Volny vecer', 'Free evening slots')
                : freeCount >= 6
                  ? L('Vela volnych slotov', 'Many free slots')
                  : L('Obmedzena dostupnost', 'Limited availability')

          return {
            id: resource.id,
            name: resource.name,
            nearestFree: nearest,
            freeSlotsToday: freeCount,
            status,
            recommended: false,
          }
        })

        const recommendedId = byResource.sort((a, b) => b.freeSlotsToday - a.freeSlotsToday)[0]?.id
        const nextPreview = payload.resources.map((resource) => {
          const current = byResource.find((item) => item.id === resource.id)
          if (!current) {
            return {
              id: resource.id,
              name: resource.name,
              nearestFree: null,
              freeSlotsToday: 0,
              status: L('Bez volnych slotov', 'No free slots'),
              recommended: false,
            }
          }
          return { ...current, recommended: current.id === recommendedId && current.freeSlotsToday > 0 }
        })

        setResourcePreview(nextPreview)

        const segmentStats = {
          morning: { available: 0, total: 0 },
          afternoon: { available: 0, total: 0 },
          evening: { available: 0, total: 0 },
        }

        payload.slots.forEach((slot) => {
          const segment = segmentForTime(slot.start_time)
          segmentStats[segment].total += 1
          if (slot.available) segmentStats[segment].available += 1
        })

        const entries = Object.entries(segmentStats) as Array<
          ['morning' | 'afternoon' | 'evening', { available: number; total: number }]
        >
        const leastBusy = [...entries].sort((a, b) => b[1].available - a[1].available)[0]
        const mostBusy = [...entries].sort(
          (a, b) => b[1].total - b[1].available - (a[1].total - a[1].available)
        )[0]

        const segmentLabel = (segment: 'morning' | 'afternoon' | 'evening') =>
          segment === 'morning' ? L('dopoludnie', 'morning') : segment === 'afternoon' ? L('popoludnie', 'afternoon') : L('vecer', 'evening')

        const suggestedRange =
          leastBusy?.[0] === 'morning'
            ? '09:00 – 12:00'
            : leastBusy?.[0] === 'afternoon'
              ? '12:00 – 17:00'
              : '17:00 – 20:00'

        setBestTimeSuggestion(
          `${L('Odporucany cas', 'Recommended time')}: ${suggestedRange} • ${L('Najmenej obsadene', 'Least busy')}: ${segmentLabel(
            leastBusy?.[0] || 'afternoon'
          )} • ${L('Najvacsi zaujem', 'Most demand')}: ${segmentLabel(mostBusy?.[0] || 'evening')}`
        )
      } catch (error) {
        console.error('Resource preview load error:', error)
      }
    }

    loadResourcePreview()
    return () => {
      active = false
    }
  }, [L, selectedServiceId])

  useEffect(() => {
    if (!contentRef.current) return
    contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  useEffect(() => {
    if (!selectedServiceId) {
      setNearestFreeTerm(null)
      return
    }

    let active = true

    async function getFirstAvailable(date: string) {
      const response = await fetch(`/api/slots?serviceId=${selectedServiceId}&date=${date}`)
      if (!response.ok) return null
      const payload = (await response.json()) as SlotsApiResponse
      const nearest = payload.slots.find((slot) => slot.available)
      return nearest?.start_time || null
    }

    async function loadNearestTerm() {
      try {
        const today = toISODate(new Date())
        const tomorrow = toISODate(new Date(Date.now() + 24 * 60 * 60 * 1000))
        const todayTime = await getFirstAvailable(today)
        if (!active) return

        if (todayTime) {
          setNearestFreeTerm(`${L('Najblizsi volny termin', 'Nearest free slot')}: ${L('dnes', 'today')} ${todayTime.slice(0, 5)}`)
          return
        }

        const tomorrowTime = await getFirstAvailable(tomorrow)
        if (!active) return

        if (tomorrowTime) {
          setNearestFreeTerm(`${L('Dnes uz nie su volne sloty', 'No free slots left today')}. ${L('Najblizsi termin', 'Nearest slot')}: ${L('zajtra', 'tomorrow')} ${tomorrowTime.slice(0, 5)}`)
          return
        }

        const nextAvailable = Object.entries(availabilityByDay)
          .filter(([, count]) => count > 0)
          .sort(([a], [b]) => (a > b ? 1 : -1))[0]?.[0]

        if (nextAvailable) {
          const nextTime = await getFirstAvailable(nextAvailable)
          if (!active) return
          setNearestFreeTerm(
            nextTime
              ? `${L('Najblizsi volny termin', 'Nearest free slot')}: ${nextAvailable} ${nextTime.slice(0, 5)}`
              : L('Dnes uz nie su volne sloty.', 'No free slots left today.')
          )
          return
        }

        setNearestFreeTerm(L('Dnes uz nie su volne sloty.', 'No free slots left today.'))
      } catch (error) {
        console.error('Nearest term load error:', error)
        if (active) setNearestFreeTerm(L('Dnes uz nie su volne sloty.', 'No free slots left today.'))
      }
    }

    loadNearestTerm()
    return () => {
      active = false
    }
  }, [L, selectedServiceId, availabilityByDay])

  useEffect(() => {
    if (step !== 3 || !selectedResourceId || !selectedStartTime || !selectedEndTime) {
      setHoldExpiresAt(null)
      setHoldSecondsLeft(0)
      return
    }

    const now = Date.now()
    const nextExpiry = now + 5 * 60 * 1000
    setHoldExpiresAt(nextExpiry)
    setHoldSecondsLeft(5 * 60)
  }, [step, selectedResourceId, selectedStartTime, selectedEndTime])

  useEffect(() => {
    if (!holdExpiresAt || step !== 3) return

    const timer = window.setInterval(() => {
      const diffSeconds = Math.max(0, Math.ceil((holdExpiresAt - Date.now()) / 1000))
      setHoldSecondsLeft(diffSeconds)

      if (diffSeconds === 0) {
        window.clearInterval(timer)
        resetSelection()
        setHoldExpiresAt(null)
        toast.error(L('Cas drzania terminu vyprsal. Vyberte prosim novy termin.', 'Slot hold expired. Please pick a new time.'))
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [L, holdExpiresAt, step, resetSelection])

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) || null,
    [services, selectedServiceId]
  )

  const times = useMemo(() => {
    const open = slotsData?.open_time || OPEN_TIME
    const close = slotsData?.close_time || CLOSE_TIME
    return makeTimes(open, close)
  }, [slotsData])

  const slotMap = useMemo(() => {
    const map = new Map<string, ApiSlot>()
    slotsData?.slots.forEach((slot) => {
      map.set(`${slot.resource_id}_${slot.start_time}`, slot)
    })
    return map
  }, [slotsData])

  function handleServiceSelect(serviceId: string) {
    const service = services.find((item) => item.id === serviceId)
    try {
      const raw = window.localStorage.getItem('sportbook:recentServices')
      const list = raw ? (JSON.parse(raw) as string[]) : []
      const deduped = [serviceId, ...list.filter((id) => id !== serviceId)].slice(0, 6)
      window.localStorage.setItem('sportbook:recentServices', JSON.stringify(deduped))
      if (service) {
        window.localStorage.setItem(
          'sportbook:lastViewedService',
          JSON.stringify({ id: service.id, name: service.name, price: service.price })
        )
      }
    } catch {
    }

    setSelectedServiceId(serviceId)
    setSelectedDateDraft(null)
    setSelectedDate(null)
    setSlotsData(null)
    setSlotError(null)
    setTimeFilter('all')
    setResourceSort('nearest')
    setOnlyFreeSlots(false)
    setSlotView('grid')
    setDateViewMode('calendar')
    resetSelection()
    setStep(2)
  }

  const loadSlots = useCallback(async (serviceId: string, date: string) => {
    try {
      setLoadingSlots(true)
      setSlotError(null)
      resetSelection()

      const response = await fetch(`/api/slots?serviceId=${serviceId}&date=${date}`)
      const payload = await response.json()

      if (!response.ok) {
        setSlotsData(null)
        setSlotError(payload?.error || L('Nepodarilo sa nacitat sloty', 'Failed to load slots'))
        return
      }

      if (Array.isArray(payload)) {
        const fallback: SlotsApiResponse = {
          service: {
            id: serviceId,
            name: selectedService?.name || L('Sluzba', 'Service'),
            category: 'other',
            duration_minutes: selectedService?.duration_minutes,
          },
          resources: [],
          day: date,
          granularity_minutes: 60,
          open_time: OPEN_TIME,
          close_time: CLOSE_TIME,
          slots: payload,
        }
        setSlotsData(fallback)
        return
      }

      setSlotsData(payload as SlotsApiResponse)
    } catch (error) {
      console.error('Slots load error:', error)
      setSlotsData(null)
      setSlotError(L('Nepodarilo sa nacitat sloty', 'Failed to load slots'))
    } finally {
      setLoadingSlots(false)
    }
  }, [L, selectedService, resetSelection])

  const handleDateContinue = useCallback(() => {
    if (!selectedServiceId || !selectedDateDraft) return
    setSelectedDate(selectedDateDraft)
    setStep(3)
    loadSlots(selectedServiceId, selectedDateDraft)
  }, [loadSlots, selectedDateDraft, selectedServiceId])

  function resetFiltersAndSelection() {
    setTimeFilter('all')
    setOnlyFreeSlots(false)
    setResourceSort('nearest')
    setDurationHours(1)
    setSlotView('grid')
    setCompactMode(false)
    setDateViewMode('calendar')
    resetSelection()
    setBlockedSlot(null)
    setSuggestedTimes([])
  }

  function findContinuousSelection(resourceId: string, startTime: string): SelectionResult {
    const startIndex = times.indexOf(startTime)
    if (startIndex < 0) return { ok: false, reason: L('Neplatny zaciatok slotu', 'Invalid slot start time') }

    const starts: string[] = []
    let endTime = startTime

    for (let offset = 0; offset < durationHours; offset += 1) {
      const currentStart = times[startIndex + offset]
      if (!currentStart) {
        return {
          ok: false,
          reason: L(
            `Nie je mozne rezervovat ${durationHours} h od ${startTime.slice(0, 5)}`,
            `Cannot book ${durationHours}h from ${startTime.slice(0, 5)}`
          ),
        }
      }

      const slot = slotMap.get(`${resourceId}_${currentStart}`)
      if (!slot || !slot.available) {
        return {
          ok: false,
          reason: L(
            `Nie je mozne rezervovat ${durationHours} h od ${startTime.slice(0, 5)}`,
            `Cannot book ${durationHours}h from ${startTime.slice(0, 5)}`
          ),
        }
      }

      starts.push(currentStart)
      endTime = slot.end_time
    }

    return { ok: true, starts, endTime }
  }

  function handleSlotClick(resourceId: string, startTime: string) {
    const selection = findContinuousSelection(resourceId, startTime)
    if (!selection.ok) {
      toast.error(selection.reason)
      return
    }

    setBlockedSlot(null)
    setSuggestedTimes([])
    setWaitlistAdded(false)
    setSelectedResourceId(resourceId)
    setSelectedStartTime(startTime)
    setSelectedEndTime(selection.endTime)
    setSelectedStarts(selection.starts)
    setResumeMessage(null)

    try {
      const resourceName = slotsData?.resources.find((resource) => resource.id === resourceId)?.name || L('Zdroj', 'Resource')
      const payload = {
        serviceId: selectedServiceId,
        serviceName: selectedService?.name || L('Sluzba', 'Service'),
        resourceId,
        resourceName,
        date: selectedDateDraft || selectedDate || '',
        startTime,
      }
      window.localStorage.setItem('sportbook:lastSelection', JSON.stringify(payload))
    } catch {
    }
  }

  function handleBlockedSlot(resourceId: string, startTime: string, reason?: ApiSlot['reason']) {
    if (!slotsData) return
    setBlockedSlot({ resourceId, time: startTime, reason })
    setWaitlistAdded(false)

    const startIndex = times.indexOf(startTime)
    const suggestions: string[] = []
    for (let i = startIndex + 1; i < times.length; i += 1) {
      const candidate = times[i]
      const slot = slotMap.get(`${resourceId}_${candidate}`)
      if (slot?.available) {
        suggestions.push(candidate)
      }
      if (suggestions.length >= 3) break
    }
    setSuggestedTimes(suggestions)
  }

  function addToWaitlist() {
    if (!blockedSlot || !selectedServiceId || !selectedDateDraft) return
    try {
      const list = JSON.parse(window.localStorage.getItem('sportbook:waitlist') || '[]') as Array<{
        serviceId: string
        date: string
        resourceId: string
        time: string
      }>
      list.push({
        serviceId: selectedServiceId,
        date: selectedDateDraft,
        resourceId: blockedSlot.resourceId,
        time: blockedSlot.time,
      })
      window.localStorage.setItem('sportbook:waitlist', JSON.stringify(list))
      setWaitlistAdded(true)
      toast.success(L('Ak sa slot uvolni, budeme vas informovat.', 'If a slot becomes free, we will notify you.'))
    } catch (error) {
      console.error('Waitlist error:', error)
      toast.error(L('Nepodarilo sa pridat na cakaciu listinu', 'Failed to add to waitlist'))
    }
  }

  const handleProceedToDetails = useCallback(() => {
    if (!selectedServiceId || !selectedDate || !selectedResourceId || !selectedStartTime || !selectedEndTime) {
      return
    }

    const params = new URLSearchParams({
      serviceId: selectedServiceId,
      date: selectedDate,
      resourceId: selectedResourceId,
      startTime: selectedStartTime,
      endTime: selectedEndTime,
    })

    router.push(`/booking/details?${params.toString()}`)
  }, [router, selectedDate, selectedEndTime, selectedResourceId, selectedServiceId, selectedStartTime])

  const selectedResource = useMemo(() => {
    if (!selectedResourceId || !slotsData) return null
    return slotsData.resources.find((resource) => resource.id === selectedResourceId) || null
  }, [selectedResourceId, slotsData])

  const quickDates = useMemo(() => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    const weekend = new Date(today)
    const day = weekend.getDay()
    const toSaturday = day === 6 ? 0 : (6 - day + 7) % 7
    weekend.setDate(today.getDate() + toSaturday)

    const nextAvailable = Object.entries(availabilityByDay)
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => (a > b ? 1 : -1))[0]?.[0]

    return [
      { label: L('Dnes', 'Today'), value: toISODate(today) },
      { label: L('Zajtra', 'Tomorrow'), value: toISODate(tomorrow) },
      { label: L('Tento vikend', 'This weekend'), value: toISODate(weekend) },
      { label: L('Najblizsi volny den', 'Nearest available day'), value: nextAvailable || null },
    ]
  }, [L, availabilityByDay])

  const nearestAvailableDays = useMemo(() => {
    return Object.entries(availabilityByDay)
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .slice(0, 8)
      .map(([date, count]) => ({ date, count }))
  }, [availabilityByDay])

  const resourceStats = useMemo(() => {
    if (!slotsData) return new Map<string, { nearestFree: string | null; availableCount: number; totalCount: number }>()

    const map = new Map<string, { nearestFree: string | null; availableCount: number; totalCount: number }>()
    slotsData.resources.forEach((resource) => {
      const items = slotsData.slots
        .filter((slot) => slot.resource_id === resource.id)
        .sort((a, b) => (a.start_time > b.start_time ? 1 : -1))
      const availableItems = items.filter((slot) => slot.available)
      map.set(resource.id, {
        nearestFree: availableItems[0]?.start_time || null,
        availableCount: availableItems.length,
        totalCount: items.length,
      })
    })
    return map
  }, [slotsData])

  const visibleTimes = useMemo(() => {
    const bySegment = times.filter((time) => (timeFilter === 'all' ? true : segmentForTime(time) === timeFilter))
    if (!onlyFreeSlots || !slotsData) return bySegment
    return bySegment.filter((time) =>
      slotsData.slots.some((slot) => slot.start_time === time && slot.available)
    )
  }, [onlyFreeSlots, slotsData, timeFilter, times])

  const sortedResources = useMemo(() => {
    if (!slotsData) return []
    const items = [...slotsData.resources]
    items.sort((a, b) => {
      const aStats = resourceStats.get(a.id)
      const bStats = resourceStats.get(b.id)
      if (resourceSort === 'name') return a.name.localeCompare(b.name, lang === 'sk' ? 'sk' : 'en')
      if (resourceSort === 'availability') {
        return (bStats?.availableCount || 0) - (aStats?.availableCount || 0)
      }
      const aNearest = aStats?.nearestFree || '99:99:99'
      const bNearest = bStats?.nearestFree || '99:99:99'
      return aNearest.localeCompare(bNearest)
    })
    return items
  }, [lang, resourceSort, resourceStats, slotsData])

  const selectedDateAvailability = selectedDateDraft ? availabilityByDay[selectedDateDraft] || 0 : 0
  const dayTotalSlots = Math.max(resourcePreview.length * 12, 1)
  const dayOccupancyPercent = selectedDateDraft
    ? Math.max(0, Math.min(100, Math.round(((dayTotalSlots - selectedDateAvailability) / dayTotalSlots) * 100)))
    : 0

  const currentTimeMarker = useMemo(() => {
    if (!selectedDateDraft) return null
    if (selectedDateDraft !== toISODate(new Date())) return null
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    return `${hh}:00:00`
  }, [selectedDateDraft])

  const canContinueSlot = Boolean(selectedResourceId && selectedStartTime && selectedEndTime)
  const primaryButtonText =
    step === 1
      ? L('Vyberte sluzbu', 'Select service')
      : step === 2
        ? selectedDateDraft
          ? L('Pokracovat', 'Continue')
          : L('Vyberte datum', 'Select date')
        : canContinueSlot
          ? L('Pokracovat', 'Continue')
          : L('Vyberte cas', 'Select time')
  const holdMinutes = String(Math.floor(holdSecondsLeft / 60)).padStart(2, '0')
  const holdSeconds = String(holdSecondsLeft % 60).padStart(2, '0')
  const summaryDate = selectedDateDraft || selectedDate || L('nevybrany', 'not selected')
  const summaryTime = selectedStartTime && selectedEndTime
    ? `${selectedStartTime.slice(0, 5)} - ${selectedEndTime.slice(0, 5)}`
    : L('nevybrany', 'not selected')
  const summaryDuration = selectedStarts.length ? `${selectedStarts.length} h` : `${durationHours} h`
  const selectedHours = selectedStarts.length || durationHours
  const summaryTotalPrice = selectedService ? selectedService.price * selectedHours : 0

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      if (step === 2 && selectedDateDraft) {
        handleDateContinue()
      } else if (step === 3 && canContinueSlot) {
        handleProceedToDetails()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, selectedDateDraft, canContinueSlot, handleDateContinue, handleProceedToDetails])

  return (
    <div className="mx-auto max-w-7xl overflow-x-hidden px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-8 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 xl:gap-8">
        <aside className="space-y-4 lg:col-span-3 lg:sticky lg:top-24 lg:self-start">
          <BookingStepper currentStep={step} />
          <div className="card space-y-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{L('Rezervacny prehlad', 'Booking summary')}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">{L('Sluzba', 'Service')}:</span> {selectedService?.name || L('nevybrana', 'not selected')}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">{L('Zdroj', 'Resource')}:</span> {selectedResource?.name || L('nevybrany', 'not selected')}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">{L('Datum', 'Date')}:</span> {summaryDate}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">{L('Cas', 'Time')}:</span> {summaryTime}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">{L('Dlzka', 'Duration')}:</span> {summaryDuration}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">{L('Cena', 'Price')}:</span> {selectedService ? `${selectedService.price.toFixed(2)} EUR / h` : '-'}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">{L('Spolu', 'Total')}:</span> {selectedService ? `${summaryTotalPrice.toFixed(2)} EUR` : '-'}</p>
            {step === 3 ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/75 p-2 text-xs text-blue-700">
                {canContinueSlot
                  ? `${L('Vybrany termin drzime', 'Holding selected slot for')} ${holdMinutes}:${holdSeconds} min`
                  : L('Vyberte slot, potom pokracujte do detailu rezervacie.', 'Select a slot and continue to booking details.')}
              </div>
            ) : null}
          </div>
        </aside>

        <section ref={contentRef} className="card p-5 sm:p-7 lg:col-span-9">
          {step === 1 &&
            (loadingServices ? (
              <div className="space-y-3" aria-hidden="true">
                <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
                <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
                <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
              </div>
            ) : (
              <ServiceSelector
                services={services}
                selectedServiceId={selectedServiceId}
                onSelect={handleServiceSelect}
              />
            ))}

          {step === 2 && (
            <div className="animate-section-in max-w-[920px]">
              {resumeMessage ? (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-800">
                  <span>{resumeMessage}</span>
                  <button
                    type="button"
                    onClick={() => setResumeMessage(null)}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                  >
                    {L('Zavriet', 'Close')}
                  </button>
                </div>
              ) : null}

              <div className="mb-4 flex flex-wrap gap-2">
                {quickDates.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (!item.value) {
                        toast.error(L('Zatial nemame dostupny volny den', 'No available day found yet'))
                        return
                      }
                      if ((availabilityByDay[item.value] || 0) === 0) {
                        toast.error(L('V tento den nie su dostupne ziadne terminy. Prosim vyberte iny datum.', 'No available slots for this day. Please pick another date.'))
                        return
                      }
                      setSelectedDateDraft(item.value)
                    }}
                    data-active={selectedDateDraft === item.value}
                    className="choice-pill rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDateViewMode('calendar')}
                  data-active={dateViewMode === 'calendar'}
                  className={
                    'choice-pill inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ' +
                    (dateViewMode === 'calendar'
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700')
                  }
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {L('Kalendar', 'Calendar')}
                </button>
                <button
                  type="button"
                  onClick={() => setDateViewMode('closest')}
                  data-active={dateViewMode === 'closest'}
                  className={
                    'choice-pill inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ' +
                    (dateViewMode === 'closest'
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700')
                  }
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  {L('Najblizsie dni', 'Closest days')}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  {dateViewMode === 'calendar' ? (
                    <DatePicker
                      selectedDate={selectedDateDraft}
                      onSelect={setSelectedDateDraft}
                      availabilityByDay={availabilityByDay}
                      loadingMonth={loadingMonth}
                    />
                  ) : (
                    <div className="card p-5">
                      <h2 className="text-2xl font-bold text-slate-900">{L('Najblizsie dostupne dni', 'Closest available days')}</h2>
                      <p className="mt-2 text-sm text-slate-600">{L('Rychly vyber bez kalendara.', 'Quick selection without calendar.')}</p>
                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {nearestAvailableDays.length > 0 ? (
                          nearestAvailableDays.map((day) => (
                            <button
                              key={day.date}
                              type="button"
                              onClick={() => setSelectedDateDraft(day.date)}
                              data-active={selectedDateDraft === day.date}
                              className={
                                'choice-pill rounded-xl border px-3 py-3 text-left text-sm ' +
                                (selectedDateDraft === day.date
                                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/60')
                              }
                            >
                              <p className="font-semibold">{day.date}</p>
                              <p className="mt-1 text-xs text-slate-500">{L('Dostupne sloty', 'Available slots')}: {day.count}</p>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                            {L('Zatial nemame dostupne dni v horizonte 90 dni.', 'No available days in the next 90 days yet.')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <aside className="space-y-3 xl:pt-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{L('Dostupnost', 'Availability')}</p>
                    <p className="mt-1.5 text-sm text-slate-700">
                      {quickDates[3]?.value
                        ? `${L('Najblizsi volny den', 'Nearest available day')}: ${quickDates[3].value}`
                        : L('Zatial nemame dostupny volny den v aktualnom horizonte.', 'No available day found in the current horizon.')}
                    </p>
                    {nearestFreeTerm ? <p className="mt-1.5 text-xs text-slate-500">{nearestFreeTerm}</p> : null}
                    <div className="my-3 h-px w-full bg-slate-200/70" />
                    <div className="rounded-xl border border-blue-200 bg-blue-50/75 p-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">{L('Vybrany datum', 'Selected date')}</p>
                      <p className="mt-1.5">{selectedDateDraft || L('Zatial nevybrany', 'Not selected yet')}</p>
                      {selectedDateDraft ? (
                        <p className="mt-1 text-xs text-blue-700">{L('Dostupne sloty', 'Available slots')}: {availabilityByDay[selectedDateDraft] || 0}</p>
                      ) : null}
                    </div>
                    {selectedDateDraft ? (
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                          <span>{L('Obsadenost dna', 'Day occupancy')}</span>
                          <span className="font-semibold text-slate-900">{dayOccupancyPercent}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-blue-600" style={{ width: `${dayOccupancyPercent}%` }} />
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{L('Dostupne sloty', 'Available slots')}: {selectedDateAvailability}</div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{L('Prehlad zdrojov', 'Resource overview')}</p>
                    <div className="mt-2 space-y-2">
                      {resourcePreview.length > 0 ? (
                        resourcePreview.slice(0, 1).map((item) => (
                            <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-slate-900">{item.name}</p>
                              {item.recommended ? (
                                <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                                  {L('Odporucane', 'Recommended')}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-600">
                              {L('Najblizsi volny', 'Nearest free')}: {item.nearestFree ? item.nearestFree.slice(0, 5) : '-'}
                            </p>
                              <p className="text-[11px] text-slate-600">{L('Volne sloty dnes', 'Free slots today')}: {item.freeSlotsToday}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-500">{L('Prehlad bude dostupny po vybere sluzby.', 'Preview becomes available after selecting service.')}</p>
                        )}
                    </div>
                    {resourcePreview.length > 1 ? (
                      <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                        <summary className="cursor-pointer list-none text-[11px] font-semibold text-blue-700">
                          {L('Zobrazit dalsie zdroje', 'Show more resources')}
                        </summary>
                        <div className="mt-2 space-y-2">
                          {resourcePreview.slice(1, 3).map((item) => (
                            <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-2">
                              <p className="font-semibold text-slate-900">{item.name}</p>
                              <p className="text-[11px] text-slate-600">
                                {L('Najblizsi volny', 'Nearest free')}: {item.nearestFree ? item.nearestFree.slice(0, 5) : '-'}
                              </p>
                              <p className="text-[11px] text-slate-600">{L('Volne sloty dnes', 'Free slots today')}: {item.freeSlotsToday}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{L('Rezervacne pravidla', 'Booking rules')}</p>
                      <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                        <li>{L('• minimalne 1 hodina', '• minimum 1 hour')}</li>
                        <li>{L('• maximalne 3 hodiny', '• maximum 3 hours')}</li>
                        <li>{L('• rezervacia mozna 90 dni dopredu', '• booking up to 90 days in advance')}</li>
                        <li>{L('• zrusenie najneskor 24h pred terminom', '• cancellation no later than 24h before start')}</li>
                      </ul>
                    </div>
                  </div>
                </aside>
              </div>

              <div className="mt-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">{L('Odporucanie', 'Suggestion')}:</span>{' '}
                  {bestTimeSuggestion || L('Cakame na data dostupnosti.', 'Waiting for availability data.')}
                </div>
              </div>

              <div id="booking-step-actions" className="mt-6 flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  {L('Spat', 'Back')}
                </Button>
                <Button onClick={handleDateContinue} disabled={!selectedDateDraft}>
                  {primaryButtonText}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div ref={slotGridRef} className="animate-section-in">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold text-slate-900">{L('Vyber terminu', 'Select time slot')}</h2>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
                    {[1, 2, 3].map((hours) => (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => {
                          setDurationHours(hours as 1 | 2 | 3)
                          resetSelection()
                        }}
                        data-active={durationHours === hours}
                        className={
                          'choice-pill rounded-lg px-3 py-1.5 text-xs font-semibold ' +
                          (durationHours === hours ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100')
                        }
                      >
                        {hours} h
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSlotView('grid')}
                        data-active={slotView === 'grid'}
                        className={
                          'choice-pill inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ' +
                          (slotView === 'grid'
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700')
                        }
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Grid
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlotView('list')}
                        data-active={slotView === 'list'}
                        className={
                          'choice-pill inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ' +
                          (slotView === 'list'
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700')
                        }
                      >
                        <List className="h-3.5 w-3.5" />
                        List
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnlyFreeSlots((prev) => !prev)}
                        data-active={onlyFreeSlots}
                        className={
                          'choice-pill inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ' +
                          (onlyFreeSlots
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700')
                        }
                      >
                        <Filter className="h-3.5 w-3.5" />
                        {L('Iba volne sloty', 'Only free slots')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompactMode((prev) => !prev)}
                        data-active={compactMode}
                        className={
                          'choice-pill inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ' +
                          (compactMode
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700')
                        }
                      >
                        {L('Kompaktne zobrazenie', 'Compact view')}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                        {L('Zoradit zdroje', 'Sort resources')}
                        <AnimatedSelect
                          value={resourceSort}
                          onChange={(nextValue) => setResourceSort(nextValue as ResourceSort)}
                          options={[
                            { value: 'name', label: L('Nazov', 'Name') },
                            { value: 'nearest', label: L('Najblizsi volny', 'Nearest free') },
                            { value: 'availability', label: L('Dostupnost dnes', 'Availability today') },
                          ]}
                          buttonClassName="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                        {L('Cas dna', 'Time of day')}
                        <AnimatedSelect
                          value={timeFilter}
                          onChange={(nextValue) => setTimeFilter(nextValue as TimeFilter)}
                          options={[
                            { value: 'all', label: L('Vsetko', 'All') },
                            { value: 'morning', label: L('Rano (09:00-12:00)', 'Morning (09:00-12:00)') },
                            { value: 'afternoon', label: L('Popoludnie (12:00-17:00)', 'Afternoon (12:00-17:00)') },
                            { value: 'evening', label: L('Vecer (17:00-21:00)', 'Evening (17:00-21:00)') },
                          ]}
                          buttonClassName="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700"
                        />
                      </label>
                    </div>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={resetFiltersAndSelection}
                        className="choice-pill inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {L('Resetovat vyber', 'Reset selection')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {slotError ? (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">{slotError}</div>
              ) : null}

              <div className="mt-5">
                {slotView === 'grid' ? (
                  <ResourceGrid
                    resources={sortedResources}
                    times={visibleTimes}
                    slots={slotsData?.slots || []}
                    selectedResourceId={selectedResourceId}
                    selectedStarts={selectedStarts}
                    onSlotClick={handleSlotClick}
                    onSlotBlockedClick={handleBlockedSlot}
                    loading={loadingSlots}
                    onlyFreeSlots={onlyFreeSlots}
                    compactMode={compactMode}
                    currentTimeMarker={currentTimeMarker}
                  />
                ) : (
                  <div className="space-y-3">
                    {loadingSlots ? (
                      <div className="space-y-2" aria-hidden="true">
                        <div className="h-16 animate-pulse rounded-xl bg-slate-200" />
                        <div className="h-16 animate-pulse rounded-xl bg-slate-200" />
                      </div>
                    ) : null}
                    {!loadingSlots && sortedResources.map((resource) => {
                      const resourceSlots = visibleTimes
                        .map((time) => ({
                          time,
                          slot: slotMap.get(`${resource.id}_${time}`),
                        }))
                        .filter((item) => !onlyFreeSlots || item.slot?.available)

                      return (
                        <div key={resource.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="font-semibold text-slate-900">{resource.name}</p>
                            <p className="text-xs text-slate-500">
                              {L('Najblizsi volny', 'Nearest free')}:{' '}
                              {resourceStats.get(resource.id)?.nearestFree?.slice(0, 5) || '-'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {resourceSlots.length > 0 ? (
                              resourceSlots.map(({ time, slot }) => {
                                const selected = selectedResourceId === resource.id && selectedStarts.includes(time)
                                const disabled = !slot?.available
                                return (
                                  <button
                                    key={`${resource.id}_${time}`}
                                    type="button"
                                    title={blockedReasonText(slot?.reason, lang)}
                                    onClick={() => {
                                      if (slot?.available) {
                                        handleSlotClick(resource.id, time)
                                      } else {
                                        handleBlockedSlot(resource.id, time, slot?.reason)
                                      }
                                    }}
                                    className={
                                      'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 ' +
                                      (selected
                                        ? 'border-blue-700 bg-blue-600 text-white'
                                        : disabled
                                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                          : 'border-blue-200 bg-blue-50/80 text-blue-700 hover:border-blue-400 hover:bg-blue-100')
                                    }
                                  >
                                    {time.slice(0, 5)}
                                  </button>
                                )
                              })
                            ) : (
                              <p className="text-xs text-slate-500">{L('Ziadne sloty pre aktualny filter.', 'No slots for current filter.')}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {currentTimeMarker ? (
                <p className="mt-3 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  {L('Teraz', 'Now')}: {currentTimeMarker.slice(0, 5)}
                </p>
              ) : null}

              {blockedSlot ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                  <p className="font-semibold text-slate-900">{L('Obsadene', 'Booked')}</p>
                  <p className="mt-1 text-xs text-slate-500">{blockedReasonText(blockedSlot.reason, lang)}.</p>
                  {suggestedTimes.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {suggestedTimes.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => handleSlotClick(blockedSlot.resourceId, time)}
                          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-all duration-200 hover:border-blue-400 hover:bg-blue-100/90"
                        >
                          {time.slice(0, 5)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">{L('Najblizsie volne casy sa nenasli.', 'No nearby free times found.')}</p>
                  )}

                  <div className="mt-4">
                    <Button size="sm" variant="secondary" onClick={addToWaitlist} disabled={waitlistAdded}>
                      {waitlistAdded ? L('Ste na cakacej listine', 'You are on the waitlist') : L('Pridat na cakaciu listinu', 'Add to waitlist')}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-slate-700">
                {canContinueSlot ? (
                  <div className="space-y-1">
                    <p>
                      <span className="font-semibold">{L('Vybrany termin', 'Selected slot')}:</span>{' '}
                      {selectedResource?.name || L('Zdroj', 'Resource')} - {selectedDate} - {selectedStartTime?.slice(0, 5)} -{' '}
                      {selectedEndTime?.slice(0, 5)} ({durationHours} h)
                    </p>
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                    >
                      {L('Resetovat vyber', 'Reset selection')}
                    </button>
                    <p className="text-xs text-slate-700">
                      {L('Rozpis ceny', 'Price breakdown')}: {selectedHours} h x {selectedService?.price.toFixed(2) || '0.00'} EUR ={' '}
                      <span className="font-semibold text-slate-900">{summaryTotalPrice.toFixed(2)} EUR</span>
                    </p>
                    <p className="pt-1 text-xs text-blue-700">
                      {L('Vybrany termin drzime', 'Holding selected slot for')} {holdMinutes}:{holdSeconds} min
                    </p>
                  </div>
                ) : (
                  <p>{L('Vyberte slot v gride. Presmerovanie nastane az po kliknuti na Pokracovat.', 'Select a slot in grid. Redirect happens only after pressing Continue.')}</p>
                )}
              </div>

              <div className="mt-8 flex flex-wrap justify-between gap-3">
                <Button variant="secondary" onClick={() => setStep(2)}>
                  {L('Spat', 'Back')}
                </Button>
                <Button onClick={handleProceedToDetails} disabled={!canContinueSlot}>
                  {primaryButtonText}
                </Button>
              </div>
            </div>
          )}
        </section>

        <aside className="hidden lg:block lg:col-span-0" />
      </div>

      {canContinueSlot && step === 3 ? (
        <div className="fixed bottom-4 left-4 right-4 z-40 rounded-2xl border border-blue-200 bg-white/95 p-3 shadow-[0_18px_38px_rgba(15,23,42,0.16)] backdrop-blur md:hidden">
          <p className="text-xs font-semibold text-slate-900">{selectedService?.name || L('Sluzba', 'Service')}</p>
          <p className="text-xs text-slate-600">
            {summaryDate} • {selectedResource?.name || L('Zdroj', 'Resource')} • {selectedStartTime?.slice(0, 5)} - {selectedEndTime?.slice(0, 5)}
          </p>
          <p className="mt-1 text-xs text-blue-700">{L('Cena spolu', 'Total price')} {summaryTotalPrice.toFixed(2)} EUR</p>
          <Button className="mt-2 w-full" onClick={handleProceedToDetails}>
            {primaryButtonText}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
