import { format } from 'date-fns'
import { z } from 'zod'
import type { ServiceCategory } from '@/lib/types'

export function formatDateLocale(date: Date | string): string {
  if (typeof date === 'string') {
    date = new Date(date)
  }
  return format(date, 'dd.MM.yyyy')
}

export function formatTimeLocale(time: string): string {
  return time
}

export function formatDateTimeLocale(date: string, time: string): string {
  return `${formatDateLocale(date)} ${formatTimeLocale(time)}`
}

function normalizeCategoryValue(input: string): ServiceCategory {
  const value = input.trim().toLowerCase()

  if (['courts', 'court', 'kurt', 'kurty', 'tenis', 'bedminton', 'badminton'].includes(value)) {
    return 'courts'
  }
  if (['tables', 'table', 'stol', 'stoly', 'stolny', 'stolný', 'pingpong'].includes(value)) {
    return 'tables'
  }
  if (
    ['trainings', 'training', 'tréning', 'trening', 'tréninky', 'treningy', 'group', 'individual'].includes(value)
  ) {
    return 'trainings'
  }
  return 'other'
}

export function normalizeCategory(
  serviceName: string,
  serviceCategory?: string | null
): ServiceCategory {
  if (serviceCategory && serviceCategory.trim().length > 0) {
    const normalized = normalizeCategoryValue(serviceCategory)
    if (normalized !== 'other') return normalized
  }

  const name = serviceName.toLowerCase()
  if (name.includes('stol') || name.includes('stolný') || name.includes('table')) return 'tables'
  if (name.includes('tréning') || name.includes('trening') || name.includes('training')) return 'trainings'
  if (name.includes('tenis') || name.includes('bedminton') || name.includes('badminton')) return 'courts'
  return 'other'
}

export const bookingFormSchema = z.object({
  customer_name: z.string().min(2, 'Name must contain at least 2 characters').max(100),
  customer_email: z.string().email('Invalid email'),
  customer_phone: z.string().min(6, 'Invalid phone number').max(24),
  note: z.string().max(500).optional(),
})

export const serviceSchema = z.object({
  name: z.string().min(2, 'Service name must contain at least 2 characters').max(200),
  description: z.string().max(1000).optional(),
  duration_minutes: z.number().int().min(15).max(480),
  price: z.number().min(0).max(99999.99),
  is_active: z.boolean().default(true),
})

export const createSlotSchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
})

export type BookingFormInput = z.infer<typeof bookingFormSchema>
export type ServiceInput = z.infer<typeof serviceSchema>
export type CreateSlotInput = z.infer<typeof createSlotSchema>
