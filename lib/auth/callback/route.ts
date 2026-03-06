import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const redirect = url.searchParams.get('redirect') || '/admin'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', url.origin))
  }

  const email = data.user?.email?.toLowerCase()
  if (!email) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=no_email', url.origin))
  }

  const { data: row, error: rowErr } = await supabase
    .from('admin_users')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  if (rowErr || !row) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=not_admin', url.origin))
  }

  return NextResponse.redirect(new URL(redirect, url.origin))
}