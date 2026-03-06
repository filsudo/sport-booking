import { createClient } from '@supabase/supabase-js';

// read environment variables with defaults
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl) {
  throw new Error('Missing Supabase environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseServiceKey) {
  // service key is optional for most client-side operations; warn so the
  // developer knows admin routes will fail without it.
  console.warn(
    'Warning: SUPABASE_SERVICE_ROLE_KEY is not set. Admin server operations may not work.'
  );
}

// create a server-only admin client when a service key exists
export function getSupabaseAdmin() {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
  }
  return createClient(supabaseUrl as string, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Helper to read session from cookies (server-side)
export async function getServerSession() {
  // dynamically import next/headers so this module can be imported in client code
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('sb-session');

  if (!sessionCookie) {
    return null;
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in environment');
  }

  // supabaseUrl is guaranteed to exist from top-level check; cast to string for type safety
  const supabaseServer = createClient(supabaseUrl as string, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabaseServer.auth.getSession();

  if (error || !data.session) {
    return null;
  }

  return data.session;
} 
