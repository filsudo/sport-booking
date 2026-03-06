import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Resource, ServiceCategory, SlotsApiResponse, SlotReason } from '@/lib/types'

const OPEN_TIME = '09:00:00'
const CLOSE_TIME = '21:00:00'
const GRANULARITY = 60

type AvailabilityRow = {
  resource_id: string
  start_time: string
  end_time: string
  is_available: boolean
  date?: string
}

type BookedRow = {
  resource_id: string
  start_time: string
  end_time: string
}

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

function toTime(value: string) {
  if (value.length === 5) return `${value}:00`
  return value.slice(0, 8)
}

function minutesOf(value: string) {
  const [h, m] = value.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function timeFromMinutes(minutes: number) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}:00`
}

function makeTimes(open: string, close: string) {
  const result: string[] = []
  const start = minutesOf(open)
  const end = minutesOf(close)
  for (let m = start; m < end; m += GRANULARITY) {
    result.push(timeFromMinutes(m))
  }
  return result
}

function categoryFromValue(value?: string | null): ServiceCategory {
  const normalized = (value || '').trim().toLowerCase()
  if (['courts', 'court', 'kurt', 'kurty', 'tenis', 'bedminton', 'badminton'].includes(normalized)) return 'courts'
  if (['tables', 'table', 'stol', 'stoly', 'stolny', 'stolný'].includes(normalized)) return 'tables'
  if (['trainings', 'training', 'tréning', 'trening'].includes(normalized)) return 'trainings'
  return 'other'
}

function buildBaseSlotsResponse(
  service: { id: string; name: string; category?: string | null; duration_minutes?: number | null },
  resources: Resource[],
  day: string
): SlotsApiResponse {
  return {
    service: {
      id: service.id,
      name: service.name,
      category: categoryFromValue(service.category),
      duration_minutes: service.duration_minutes ?? undefined,
    },
    resources,
    day,
    granularity_minutes: GRANULARITY,
    open_time: OPEN_TIME,
    close_time: CLOSE_TIME,
    slots: [],
  }
}

async function getMonthAvailability(
  supabase: SupabaseClient,
  serviceId: string,
  month: string
) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return jsonError(400, 'Neplatný formát mesiaca')
  }

  const start = `${month}-01`
  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(
    endDate.getDate()
  ).padStart(2, '0')}`

  const { data: availability, error } = await supabase
    .from('availability')
    .select('date, resource_id, start_time, is_available')
    .eq('service_id', serviceId)
    .eq('is_available', true)
    .gte('date', start)
    .lte('date', end)

  if (error) {
    console.error('Month availability error:', error)
    return jsonError(500, 'Nepodarilo sa načítať mesačnú dostupnosť')
  }

  const perDay = new Map<string, Set<string>>()
  ;(availability || []).forEach((row: { date: string; resource_id: string; start_time: string }) => {
    if (!perDay.has(row.date)) perDay.set(row.date, new Set())
    perDay.get(row.date)?.add(`${row.resource_id}_${toTime(row.start_time)}`)
  })

  const days: Array<{ date: string; availableCount: number }> = []
  for (let day = 1; day <= endDate.getDate(); day += 1) {
    const iso = `${month}-${String(day).padStart(2, '0')}`
    days.push({
      date: iso,
      availableCount: perDay.get(iso)?.size || 0,
    })
  }

  return NextResponse.json({ serviceId, month, days })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const serviceId = searchParams.get('serviceId')
  const date = searchParams.get('date')
  const month = searchParams.get('month')

  if (!serviceId) {
    return jsonError(400, 'Chýba serviceId')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return jsonError(500, 'Chýbajú Supabase premenné')
  }

  const supabase = createClient(supabaseUrl, anonKey)

  if (month) {
    return getMonthAvailability(supabase, serviceId, month)
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonError(400, 'Chýba dátum alebo má zlý formát')
  }

  try {
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id,name,category,duration_minutes')
      .eq('id', serviceId)
      .maybeSingle()

    if (serviceError) throw serviceError
    if (!service) return jsonError(404, 'Služba neexistuje')

    const { data: resources, error: resourcesError } = await supabase
      .from('resources')
      .select('id,name,kind,sort_order')
      .eq('service_id', serviceId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (resourcesError) throw resourcesError

    const typedResources = (resources || []) as Resource[]
    const base = buildBaseSlotsResponse(service, typedResources, date)

    if (!typedResources.length) {
      return NextResponse.json(base)
    }

    const resourceIds = typedResources.map((resource) => resource.id)

    const { data: availabilityRows, error: availabilityError } = await supabase
      .from('availability')
      .select('resource_id,start_time,end_time,is_available')
      .eq('service_id', serviceId)
      .eq('date', date)
      .in('resource_id', resourceIds)

    if (availabilityError) throw availabilityError

    const availability = (availabilityRows || []) as AvailabilityRow[]
    const hasAnyAvailability = availability.length > 0

    const { data: bookedRows, error: bookedError } = await supabase.rpc('get_booked_times_by_resource', {
      p_service_id: serviceId,
      p_date: date,
    })

    if (bookedError) {
      console.warn('Booked RPC warning:', bookedError.message)
    }

    const booked = (bookedRows || []) as BookedRow[]

    const availabilityMap = new Map<string, AvailabilityRow>()
    availability.forEach((row) => {
      availabilityMap.set(`${row.resource_id}_${toTime(row.start_time)}`, {
        ...row,
        start_time: toTime(row.start_time),
        end_time: toTime(row.end_time),
      })
    })

    const bookedSet = new Set(
      booked.map((row) => `${row.resource_id}_${toTime(row.start_time)}_${toTime(row.end_time)}`)
    )

    const times = makeTimes(OPEN_TIME, CLOSE_TIME)
    const now = new Date()
    const isToday = date === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    const slots: SlotsApiResponse['slots'] = []

    typedResources.forEach((resource) => {
      times.forEach((start) => {
        const startMinutes = minutesOf(start)
        const end = timeFromMinutes(startMinutes + GRANULARITY)
        const fromAvailability = availabilityMap.get(`${resource.id}_${start}`)
        const isBooked = bookedSet.has(`${resource.id}_${start}_${end}`)
        const isPast = isToday && startMinutes <= nowMinutes

        let available = false
        let reason: SlotReason | undefined

        if (!hasAnyAvailability) {
          available = false
          reason = 'not_generated'
        } else if (!fromAvailability || fromAvailability.is_available === false) {
          available = false
          reason = 'closed'
        } else if (isBooked || isPast) {
          available = false
          reason = isBooked ? 'booked' : 'closed'
        } else {
          available = true
        }

        slots.push({
          resource_id: resource.id,
          start_time: start,
          end_time: end,
          available,
          reason,
        })
      })
    })

    return NextResponse.json({ ...base, slots })
  } catch (error) {
    console.error('Slots API error:', error)
    return jsonError(500, 'Nepodarilo sa načítať dostupné sloty')
  }
}


