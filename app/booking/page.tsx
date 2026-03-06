'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { CalendarDays, Clock3, Filter, LayoutGrid, List, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabaseClient'
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

function blockedReasonText(reason?: ApiSlot['reason']) {
  if (reason === 'booked') return 'Obsadené'
  if (reason === 'closed') return 'Čas už uplynul alebo je mimo prevádzkových hodín'
  if (reason === 'not_generated') return 'Termíny pre tento deň zatiaľ neboli vygenerované'
  return 'Nie je dostupné'
}

export default function BookingFlowPage() {
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
          setResumeMessage('Pokračujete tam, kde ste skončili.')
          toast.success('Obnovili sme vašu poslednú rozpracovanú rezerváciu')
        } catch {
          // ignore invalid local storage data
        }
      } catch (error) {
        console.error('Booking services load error:', error)
        toast.error('Nepodarilo sa načítať služby')
      } finally {
        if (active) setLoadingServices(false)
      }
    }

    loadServices()
    return () => {
      active = false
    }
  }, [])

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
      // ignore storage errors
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
              ? 'Bez voľných slotov'
              : nearest && minutesOf(nearest) >= 17 * 60
                ? 'Voľný večer'
                : freeCount >= 6
                  ? 'Veľa voľných slotov'
                  : 'Obmedzená dostupnosť'

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
              status: 'Bez voľných slotov',
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
          segment === 'morning' ? 'dopoludnie' : segment === 'afternoon' ? 'popoludnie' : 'večer'

        const suggestedRange =
          leastBusy?.[0] === 'morning'
            ? '09:00 – 12:00'
            : leastBusy?.[0] === 'afternoon'
              ? '12:00 – 17:00'
              : '17:00 – 20:00'

        setBestTimeSuggestion(
          `Odporúčaný čas: ${suggestedRange} • Najmenej obsadené: ${segmentLabel(
            leastBusy?.[0] || 'afternoon'
          )} • Najväčší záujem: ${segmentLabel(mostBusy?.[0] || 'evening')}`
        )
      } catch (error) {
        console.error('Resource preview load error:', error)
      }
    }

    loadResourcePreview()
    return () => {
      active = false
    }
  }, [selectedServiceId])

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
          setNearestFreeTerm(`Najbližší voľný termín: dnes o ${todayTime.slice(0, 5)}`)
          return
        }

        const tomorrowTime = await getFirstAvailable(tomorrow)
        if (!active) return

        if (tomorrowTime) {
          setNearestFreeTerm(`Dnes už nie sú voľné sloty. Najbližší termín: zajtra o ${tomorrowTime.slice(0, 5)}`)
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
              ? `Najbližší voľný termín: ${nextAvailable} o ${nextTime.slice(0, 5)}`
              : 'Dnes už nie sú voľné sloty.'
          )
          return
        }

        setNearestFreeTerm('Dnes už nie sú voľné sloty.')
      } catch (error) {
        console.error('Nearest term load error:', error)
        if (active) setNearestFreeTerm('Dnes už nie sú voľné sloty.')
      }
    }

    loadNearestTerm()
    return () => {
      active = false
    }
  }, [selectedServiceId, availabilityByDay])

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
        toast.error('Čas držania termínu vypršal. Vyberte prosím nový termín.')
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [holdExpiresAt, step, resetSelection])

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
      // ignore storage errors
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
        setSlotError(payload?.error || 'Nepodarilo sa načítať sloty')
        return
      }

      if (Array.isArray(payload)) {
        const fallback: SlotsApiResponse = {
          service: {
            id: serviceId,
            name: selectedService?.name || 'Služba',
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
      setSlotError('Nepodarilo sa načítať sloty')
    } finally {
      setLoadingSlots(false)
    }
  }, [selectedService, resetSelection])

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
    if (startIndex < 0) return { ok: false, reason: 'Neplatný začiatok slotu' }

    const starts: string[] = []
    let endTime = startTime

    for (let offset = 0; offset < durationHours; offset += 1) {
      const currentStart = times[startIndex + offset]
      if (!currentStart) {
        return { ok: false, reason: `Nie je možné rezervovať ${durationHours} h od ${startTime.slice(0, 5)}` }
      }

      const slot = slotMap.get(`${resourceId}_${currentStart}`)
      if (!slot || !slot.available) {
        return { ok: false, reason: `Nie je možné rezervovať ${durationHours} h od ${startTime.slice(0, 5)}` }
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
      const resourceName = slotsData?.resources.find((resource) => resource.id === resourceId)?.name || 'Zdroj'
      const payload = {
        serviceId: selectedServiceId,
        serviceName: selectedService?.name || 'Služba',
        resourceId,
        resourceName,
        date: selectedDateDraft || selectedDate || '',
        startTime,
      }
      window.localStorage.setItem('sportbook:lastSelection', JSON.stringify(payload))
    } catch {
      // ignore storage errors
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
      toast.success('Ak sa slot uvoľní, budeme vás informovať.')
    } catch (error) {
      console.error('Waitlist error:', error)
      toast.error('Nepodarilo sa pridať na čakaciu listinu')
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
      { label: 'Dnes', value: toISODate(today) },
      { label: 'Zajtra', value: toISODate(tomorrow) },
      { label: 'Tento víkend', value: toISODate(weekend) },
      { label: 'Najbližší voľný deň', value: nextAvailable || null },
    ]
  }, [availabilityByDay])

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
      if (resourceSort === 'name') return a.name.localeCompare(b.name, 'sk')
      if (resourceSort === 'availability') {
        return (bStats?.availableCount || 0) - (aStats?.availableCount || 0)
      }
      const aNearest = aStats?.nearestFree || '99:99:99'
      const bNearest = bStats?.nearestFree || '99:99:99'
      return aNearest.localeCompare(bNearest)
    })
    return items
  }, [resourceSort, resourceStats, slotsData])

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
      ? 'Vyberte službu'
      : step === 2
        ? selectedDateDraft
          ? 'Pokračovať'
          : 'Vyberte dátum'
        : canContinueSlot
          ? 'Pokračovať'
          : 'Vyberte čas'
  const holdMinutes = String(Math.floor(holdSecondsLeft / 60)).padStart(2, '0')
  const holdSeconds = String(holdSecondsLeft % 60).padStart(2, '0')
  const summaryDate = selectedDateDraft || selectedDate || 'nevybraný'
  const summaryTime = selectedStartTime && selectedEndTime
    ? `${selectedStartTime.slice(0, 5)} – ${selectedEndTime.slice(0, 5)}`
    : 'nevybraný'
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <aside className="space-y-4 lg:col-span-3 lg:sticky lg:top-24 lg:self-start">
          <BookingStepper currentStep={step} />
          <div className="card space-y-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rezervačný prehľad</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Služba:</span> {selectedService?.name || 'nevybraná'}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Zdroj:</span> {selectedResource?.name || 'nevybraný'}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Dátum:</span> {summaryDate}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Čas:</span> {summaryTime}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Dĺžka:</span> {summaryDuration}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Cena:</span> {selectedService ? `${selectedService.price.toFixed(2)} € / hod.` : '—'}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Spolu:</span> {selectedService ? `${summaryTotalPrice.toFixed(2)} €` : '—'}</p>
            {step === 3 ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
                {canContinueSlot
                  ? `Vybraný termín držíme ${holdMinutes}:${holdSeconds} min`
                  : 'Vyberte slot, potom pokračujte do detailu rezervácie.'}
              </div>
            ) : null}
          </div>
        </aside>

        <section ref={contentRef} className="card p-6 sm:p-7 lg:col-span-9">
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
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <span>{resumeMessage}</span>
                  <button
                    type="button"
                    onClick={() => setResumeMessage(null)}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                  >
                    Zavrieť
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
                        toast.error('Zatiaľ nemáme dostupný voľný deň')
                        return
                      }
                      if ((availabilityByDay[item.value] || 0) === 0) {
                        toast.error('V tento deň nie sú dostupné žiadne termíny. Prosím vyberte iný dátum.')
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
                  Kalendár
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
                  Najbližšie dni
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
                      <h2 className="text-2xl font-bold text-slate-900">Najbližšie dostupné dni</h2>
                      <p className="mt-2 text-sm text-slate-600">Rýchly výber bez kalendára.</p>
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
                              <p className="mt-1 text-xs text-slate-500">Dostupné sloty: {day.count}</p>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                            Zatiaľ nemáme dostupné dni v horizonte 90 dní.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <aside className="space-y-3 xl:pt-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dostupnosť</p>
                    <p className="mt-1.5 text-sm text-slate-700">
                      {quickDates[3]?.value
                        ? `Najbližší voľný deň: ${quickDates[3].value}`
                        : 'Zatiaľ nemáme dostupný voľný deň v aktuálnom horizonte.'}
                    </p>
                    {nearestFreeTerm ? <p className="mt-1.5 text-xs text-slate-500">{nearestFreeTerm}</p> : null}
                    <div className="my-3 h-px w-full bg-slate-200/70" />
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">Vybraný dátum</p>
                      <p className="mt-1.5">{selectedDateDraft || 'Zatiaľ nevybraný'}</p>
                      {selectedDateDraft ? (
                        <p className="mt-1 text-xs text-blue-700">Dostupné sloty: {availabilityByDay[selectedDateDraft] || 0}</p>
                      ) : null}
                    </div>
                    {selectedDateDraft ? (
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                          <span>Obsadenosť dňa</span>
                          <span className="font-semibold text-slate-900">{dayOccupancyPercent}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-blue-600" style={{ width: `${dayOccupancyPercent}%` }} />
                        </div>
                        <div className="mt-1 text-xs text-slate-500">Dostupné sloty: {selectedDateAvailability}</div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prehľad zdrojov</p>
                    <div className="mt-2 space-y-2">
                      {resourcePreview.length > 0 ? (
                        resourcePreview.slice(0, 1).map((item) => (
                          <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-slate-900">{item.name}</p>
                              {item.recommended ? (
                                <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                                  Odporúčané
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-600">
                              Najbližší voľný: {item.nearestFree ? item.nearestFree.slice(0, 5) : '—'}
                            </p>
                              <p className="text-[11px] text-slate-600">Voľné sloty dnes: {item.freeSlotsToday}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-500">Prehľad bude dostupný po výbere služby.</p>
                        )}
                    </div>
                    {resourcePreview.length > 1 ? (
                      <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                        <summary className="cursor-pointer list-none text-[11px] font-semibold text-blue-700">
                          Zobraziť ďalšie zdroje
                        </summary>
                        <div className="mt-2 space-y-2">
                          {resourcePreview.slice(1, 3).map((item) => (
                            <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-2">
                              <p className="font-semibold text-slate-900">{item.name}</p>
                              <p className="text-[11px] text-slate-600">
                                Najbližší voľný: {item.nearestFree ? item.nearestFree.slice(0, 5) : '—'}
                              </p>
                              <p className="text-[11px] text-slate-600">Voľné sloty dnes: {item.freeSlotsToday}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rezervačné pravidlá</p>
                      <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                        <li>• minimálne 1 hodina</li>
                        <li>• maximálne 3 hodiny</li>
                        <li>• rezervácia možná 90 dní dopredu</li>
                        <li>• zrušenie najneskôr 24h pred termínom</li>
                      </ul>
                    </div>
                  </div>
                </aside>
              </div>

              <div className="mt-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">Odporúčanie:</span>{' '}
                  {bestTimeSuggestion || 'Čakáme na dáta dostupnosti.'}
                </div>
              </div>

              <div id="booking-step-actions" className="mt-6 flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Späť
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
                  <h2 className="text-2xl font-bold text-slate-900">Výber termínu</h2>
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
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
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
                        Iba voľné sloty
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
                        Kompaktné zobrazenie
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                        Zoradiť zdroje
                        <select
                          value={resourceSort}
                          onChange={(event) => setResourceSort(event.target.value as ResourceSort)}
                          className="control-soft select-soft rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          <option value="name">Názov</option>
                          <option value="nearest">Najbližší voľný</option>
                          <option value="availability">Dostupnosť dnes</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                        Čas dňa
                        <select
                          value={timeFilter}
                          onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
                          className="control-soft select-soft rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          <option value="all">Všetko</option>
                          <option value="morning">Ráno (09:00–12:00)</option>
                          <option value="afternoon">Popoludnie (12:00–17:00)</option>
                          <option value="evening">Večer (17:00–21:00)</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={resetFiltersAndSelection}
                        className="choice-pill inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Resetovať výber
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {slotError ? (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{slotError}</div>
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
                        <div key={resource.id} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="font-semibold text-slate-900">{resource.name}</p>
                            <p className="text-xs text-slate-500">
                              Najbližší voľný:{' '}
                              {resourceStats.get(resource.id)?.nearestFree?.slice(0, 5) || '—'}
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
                                    title={blockedReasonText(slot?.reason)}
                                    onClick={() => {
                                      if (slot?.available) {
                                        handleSlotClick(resource.id, time)
                                      } else {
                                        handleBlockedSlot(resource.id, time, slot?.reason)
                                      }
                                    }}
                                    className={
                                      'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ' +
                                      (selected
                                        ? 'border-blue-700 bg-blue-600 text-white'
                                        : disabled
                                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                          : 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400 hover:bg-blue-100')
                                    }
                                  >
                                    {time.slice(0, 5)}
                                  </button>
                                )
                              })
                            ) : (
                              <p className="text-xs text-slate-500">Žiadne sloty pre aktuálny filter.</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {currentTimeMarker ? (
                <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Teraz: {currentTimeMarker.slice(0, 5)}
                </p>
              ) : null}

              {blockedSlot ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Obsadené</p>
                  <p className="mt-1 text-xs text-slate-500">{blockedReasonText(blockedSlot.reason)}.</p>
                  {suggestedTimes.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {suggestedTimes.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => handleSlotClick(blockedSlot.resourceId, time)}
                          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-all hover:border-blue-400 hover:bg-blue-100"
                        >
                          {time.slice(0, 5)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">Najbližšie voľné časy sa nenašli.</p>
                  )}

                  <div className="mt-4">
                    <Button size="sm" variant="secondary" onClick={addToWaitlist} disabled={waitlistAdded}>
                      {waitlistAdded ? 'Ste na čakacej listine' : 'Pridať na čakaciu listinu'}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
                {canContinueSlot ? (
                  <div className="space-y-1">
                    <p>
                      <span className="font-semibold">Vybraný termín:</span>{' '}
                      {selectedResource?.name || 'Zdroj'} - {selectedDate} - {selectedStartTime?.slice(0, 5)} –{' '}
                      {selectedEndTime?.slice(0, 5)} ({durationHours} h)
                    </p>
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                    >
                      Resetovať výber
                    </button>
                    <p className="text-xs text-slate-700">
                      Rozpis ceny: {selectedHours} h × {selectedService?.price.toFixed(2) || '0.00'} € ={' '}
                      <span className="font-semibold text-slate-900">{summaryTotalPrice.toFixed(2)} €</span>
                    </p>
                    <p className="pt-1 text-xs text-blue-700">
                      Vybraný termín držíme {holdMinutes}:{holdSeconds} min
                    </p>
                  </div>
                ) : (
                  <p>Vyberte slot v gride. Presmerovanie nastane až po kliknutí na „Pokračovať“.</p>
                )}
              </div>

              <div className="mt-8 flex flex-wrap justify-between gap-3">
                <Button variant="secondary" onClick={() => setStep(2)}>
                  Späť
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
        <div className="fixed bottom-4 left-4 right-4 z-40 rounded-2xl border border-blue-200 bg-white/95 p-3 shadow-xl backdrop-blur md:hidden">
          <p className="text-xs font-semibold text-slate-900">{selectedService?.name || 'Služba'}</p>
          <p className="text-xs text-slate-600">
            {summaryDate} • {selectedResource?.name || 'Zdroj'} • {selectedStartTime?.slice(0, 5)} – {selectedEndTime?.slice(0, 5)}
          </p>
          <p className="mt-1 text-xs text-blue-700">Cena spolu {summaryTotalPrice.toFixed(2)} €</p>
          <Button className="mt-2 w-full" onClick={handleProceedToDetails}>
            {primaryButtonText}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
