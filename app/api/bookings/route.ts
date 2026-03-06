import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ZodError, z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const bookingBodySchema = z.object({
  service_id: z.string().uuid(),
  resource_id: z.string().uuid().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  customer_name: z.string().min(2).max(100),
  customer_email: z.string().email().optional().or(z.literal('')),
  customer_phone: z.string().min(6).max(30).optional().or(z.literal('')),
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
    return { ok: false as const, response: jsonError(401, 'Neplatná admin session') }
  }

  const allowlist = getAdminAllowlist()
  if (allowlist.length > 0 && !allowlist.includes(effectiveEmail)) {
    return { ok: false as const, response: jsonError(403, 'Nemáte oprávnenie na admin akciu') }
  }

  return { ok: true as const, supabase }
}

async function getAdminWriteClient(request: NextRequest) {
  const admin = getAdminClient()
  if (admin) {
    return admin
  }

  const session = await requireAdminSession(request)
  if (!session.ok) {
    return session.response
  }

  return session.supabase
}

export async function POST(request: NextRequest) {
  const supabase = getPublicClient()
  if (!supabase) {
    return jsonError(500, 'Chýbajú Supabase premenné pre verejné API')
  }

  try {
    const body = bookingBodySchema.parse(await request.json())

    const hasEmail = Boolean(body.customer_email && body.customer_email.trim().length > 0)
    const hasPhone = Boolean(body.customer_phone && body.customer_phone.trim().length > 0)
    if (!hasEmail && !hasPhone) {
      return jsonError(400, 'Zadajte aspoň email alebo telefón')
    }

    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id, duration_minutes, is_active')
      .eq('id', body.service_id)
      .maybeSingle()

    if (serviceError) {
      return jsonError(500, 'Nepodarilo sa načítať službu', { details: serviceError.message })
    }
    if (!service || service.is_active === false) {
      return jsonError(404, 'Služba nie je dostupná')
    }

    const startTime = normalizeTime(body.start_time)
    const endTime = body.end_time ? normalizeTime(body.end_time) : addMinutes(startTime, Number(service.duration_minutes || 60))

    const bookingId = crypto.randomUUID()

    const { error: insertError } = await supabase.from('bookings').insert([
      {
        id: bookingId,
        service_id: body.service_id,
        resource_id: body.resource_id || null,
        date: body.date,
        start_time: startTime,
        end_time: endTime,
        customer_name: body.customer_name,
        customer_email: body.customer_email || null,
        customer_phone: body.customer_phone || null,
        note: body.note || null,
        status: 'pending',
      },
    ])

    if (insertError) {
      if (insertError.code === '23505') {
        return jsonError(409, 'Slot už nie je dostupný, vyberte iný.')
      }
      return jsonError(500, 'Nepodarilo sa vytvoriť rezerváciu', { details: insertError.message })
    }

    return NextResponse.json({ id: bookingId }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return jsonError(400, error.errors[0]?.message || 'Neplatné údaje')
    }
    return jsonError(500, 'Neočakávaná chyba pri vytváraní rezervácie')
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
        return jsonError(403, 'Nemáte oprávnenie meniť rezervácie', { details: error.message })
      }
      return jsonError(500, 'Nepodarilo sa zmeniť status rezervácie', { details: error.message })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return jsonError(400, error.errors[0]?.message || 'Neplatné údaje')
    }
    return jsonError(500, 'Neočakávaná chyba pri aktualizácii rezervácie')
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
        return jsonError(403, 'Nemáte oprávnenie mazať rezervácie', { details: error.message })
      }
      return jsonError(500, 'Nepodarilo sa vymazať rezerváciu', { details: error.message })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return jsonError(400, error.errors[0]?.message || 'Neplatné údaje')
    }
    return jsonError(500, 'Neočakávaná chyba pri mazaní rezervácie')
  }
}
