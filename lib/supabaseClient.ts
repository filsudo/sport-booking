import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || ''

const placeholderUrl = 'https://your-project-id.supabase.co'
const placeholderAnon = 'your_public_anon_key'

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseUrl.includes('placeholder.supabase.co') &&
  !supabaseAnonKey.includes('placeholder-anon-key') &&
  !supabaseUrl.includes(placeholderUrl) &&
  !supabaseAnonKey.includes(placeholderAnon)

export const supabaseConfigErrorMessage =
  'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.'

export function getSupabaseErrorMessage(error: unknown, fallback = 'Unknown Supabase error') {
  if (!error) return fallback
  if (typeof error === 'string') return error

  if (typeof error === 'object') {
    const candidate = error as Record<string, unknown>
    if (typeof candidate.message === 'string' && candidate.message.trim().length > 0) {
      return candidate.message
    }
    if (typeof candidate.error_description === 'string' && candidate.error_description.trim().length > 0) {
      return candidate.error_description
    }
    if (typeof candidate.details === 'string' && candidate.details.trim().length > 0) {
      return candidate.details
    }
    try {
      const serialized = JSON.stringify(candidate)
      if (serialized && serialized !== '{}') return serialized
    } catch {
    }
  }

  return fallback
}

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  // Startup hint once instead of a noisy error object per request.
  console.warn(supabaseConfigErrorMessage)
}

export const supabase = createClient(
  supabaseUrl || 'https://invalid.localhost',
  supabaseAnonKey || 'invalid-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'sb-auth',
    },
  }
)

