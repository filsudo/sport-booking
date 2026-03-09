import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ZodError, z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const bookingBodySchema = z.object({
  service_id: z.string().uuid(),
  resource_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  customer_name: z.string().min(2).max(100),
  customer_email: z.string().email().optional().or(z.literal('')),
  customer_phone: z.string().min(6).max(24).optional().or(z.literal('')),
  note: z.string().max(500).optional(),
})

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'confirmed', 'cancelled']),
})

const deleteSchema = z.object({ id: z.string().uuid() })

function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...(extra || {}) }, { status })
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value.slice(0, 8)
}

function addMinutes(startTime: string, minutes: number) {
  const [h, m] = startTime.slice(0, 5).split(':').map(Number)
  const total = h * 60 + m + minutes
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}:00`
}

function minutesOf(value: string) {
  const [h, m] = value.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return null
  }
  return createClient(url, anon)
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return null
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getAdminAllowlist() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

async function getEmailFromBearer(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null
  }

  const token = authHeader.slice(7).trim()
  if (!token) {
    return null
  }

  const publicClient = getPublicClient()
  if (!publicClient) {
    return null
  }

  const {
    data: { user },
    error,
  } = await publicClient.auth.getUser(token)

  if (error || !user?.email) {
    return null
  }

  return user.email.toLowerCase()
}

async function requireAdminSession(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  const cookieEmail = !error && user?.email ? user.email.toLowerCase() : null
  const bearerEmail = cookieEmail ? null : await getEmailFromBearer(request)
  const effectiveEmail = cookieEmail || bearerEmail

  if (!effectiveEmail) {
    return { ok: false as const, response: jsonError(401, 'Invalid admin session') }
  }

  const allowlist = getAdminAllowlist()
  if (allowlist.length > 0 && !allowlist.includes(effectiveEmail)) {
    return { ok: false as const, response: jsonError(403, 'You are not allowed to perform this admin action') }
  }

  const adminClient = getAdminClient()
  if (!adminClient && !cookieEmail) {
    if (allowlist.length > 0) {
      return { ok: true as const, supabase }
    }
    return {
      ok: false as const,
      response: jsonError(500, 'For bearer admin actions set SUPABASE_SERVICE_ROLE_KEY or ADMIN_EMAILS'),
    }
  }

  const adminLookupClient = adminClient || supabase
  const { data: adminRow, error: adminLookupError } = await adminLookupClient
    .from('admin_users')
    .select('email')
    .eq('email', effectiveEmail)
    .maybeSingle()

  if (adminLookupError) {
    return { ok: false as const, response: jsonError(500, 'Failed to verify admin access') }
  }
  if (!adminRow) {
    return { ok: false as const, response: jsonError(403, 'You are not allowed to perform this admin action') }
  }

  return { ok: true as const, supabase }
}

async function getAdminWriteClient(request: NextRequest) {
  const session = await requireAdminSession(request)
  if (!session.ok) {
    return session.response
  }

  const admin = getAdminClient()
  if (admin) {
    return admin
  }

  return session.supabase
}

export async function POST(request: NextRequest) {
  const supabase = getPublicClient()
  if (!supabase) {
    return jsonError(500, 'Missing Supabase environment variables for public API')
  }

  try {
    const body = bookingBodySchema.parse(await request.json())

    const hasEmail = Boolean(body.customer_email && body.customer_email.trim().length > 0)
    const hasPhone = Boolean(body.customer_phone && body.customer_phone.trim().length > 0)
    if (!hasEmail && !hasPhone) {
      return jsonError(400, 'Enter email or phone number')
    }

    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id, duration_minutes, is_active')
      .eq('id', body.service_id)
      .maybeSingle()

    if (serviceError) {
      return jsonError(500, 'Failed to load service', { details: serviceError.message })
    }
    if (!service || service.is_active === false) {
      return jsonError(404, 'Service is not available')
    }

    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('id, service_id, is_active')
      .eq('id', body.resource_id)
      .maybeSingle()

    if (resourceError) {
      return jsonError(500, 'Failed to load resource', { details: resourceError.message })
    }
    if (!resource || resource.service_id !== body.service_id || resource.is_active === false) {
      return jsonError(404, 'Selected resource is not available for this service')
    }

    const startTime = normalizeTime(body.start_time)
    const endTime = body.end_time ? normalizeTime(body.end_time) : addMinutes(startTime, Number(service.duration_minutes || 60))
    if (minutesOf(endTime) <= minutesOf(startTime)) {
      return jsonError(400, 'End time must be after start time')
    }

    const now = new Date()
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`
    if (body.date < todayIso) {
      return jsonError(400, 'Cannot book a past date')
    }
    if (body.date === todayIso && minutesOf(startTime) <= now.getHours() * 60 + now.getMinutes()) {
      return jsonError(400, 'Selected time has already passed')
    }

    const { data: availabilityRow, error: availabilityError } = await supabase
      .from('availability')
      .select('id, is_available')
      .eq('service_id', body.service_id)
      .eq('resource_id', body.resource_id)
      .eq('date', body.date)
      .eq('start_time', startTime)
      .maybeSingle()

    if (availabilityError) {
      return jsonError(500, 'Failed to load availability', { details: availabilityError.message })
    }
    if (!availabilityRow || availabilityRow.is_available === false) {
      return jsonError(409, 'Selected slot is no longer available')
    }

    const { data: existingBooking, error: conflictError } = await supabase
      .from('bookings')
      .select('id')
      .eq('resource_id', body.resource_id)
      .eq('date', body.date)
      .lt('start_time', endTime)
      .gt('end_time', startTime)
      .in('status', ['pending', 'confirmed'])
      .limit(1)
      .maybeSingle()

    if (conflictError) {
      return jsonError(500, 'Failed to validate booking conflict', { details: conflictError.message })
    }
    if (existingBooking) {
      return jsonError(409, 'Slot is no longer available, choose another one.')
    }

    const bookingId = crypto.randomUUID()

    const { error: insertError } = await supabase.from('bookings').insert([
      {
        id: bookingId,
        service_id: body.service_id,
        resource_id: body.resource_id,
        date: body.date,
        start_time: startTime,
        end_time: endTime,
        customer_name: body.customer_name,
        customer_email: body.customer_email?.trim() || null,
        customer_phone: body.customer_phone?.trim() || null,
        note: body.note || null,
        status: 'pending',
      },
    ])

    if (insertError) {
      if (insertError.code === '23505' || insertError.code === '23P01') {
        return jsonError(409, 'Slot is no longer available, choose another one.')
      }
      return jsonError(500, 'Failed to create booking', { details: insertError.message })
    }

    return NextResponse.json({ id: bookingId }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return jsonError(400, error.errors[0]?.message || 'Invalid input')
    }
    return jsonError(500, 'Unexpected error while creating booking')
  }
}

export async function PATCH(request: NextRequest) {
  const adminOrResponse = await getAdminWriteClient(request)
  if (adminOrResponse instanceof NextResponse) {
    return adminOrResponse
  }
  const admin = adminOrResponse

  try {
    const body = statusSchema.parse(await request.json())
    const { error } = await admin.from('bookings').update({ status: body.status }).eq('id', body.id)

    if (error) {
      if (error.code === '42501') {
        return jsonError(403, 'You are not allowed to update bookings', { details: error.message })
      }
      return jsonError(500, 'Failed to update booking status', { details: error.message })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return jsonError(400, error.errors[0]?.message || 'Invalid input')
    }
    return jsonError(500, 'Unexpected error while updating booking')
  }
}

export async function DELETE(request: NextRequest) {
  const adminOrResponse = await getAdminWriteClient(request)
  if (adminOrResponse instanceof NextResponse) {
    return adminOrResponse
  }
  const admin = adminOrResponse

  try {
    const body = deleteSchema.parse(await request.json())
    const { error } = await admin.from('bookings').delete().eq('id', body.id)

    if (error) {
      if (error.code === '42501') {
        return jsonError(403, 'You are not allowed to delete bookings', { details: error.message })
      }
      return jsonError(500, 'Failed to delete booking', { details: error.message })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return jsonError(400, error.errors[0]?.message || 'Invalid input')
    }
    return jsonError(500, 'Unexpected error while deleting booking')
  }
}
