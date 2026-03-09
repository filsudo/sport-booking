'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/components/layout/LanguageProvider'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/admin'
  const { lang } = useI18n()
  const isSk = lang === 'sk'

  useEffect(() => {
    ;(async () => {
      try {
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash

        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (!accessToken || !refreshToken) {
          throw new Error(isSk ? 'V callback URL chybaju tokeny' : 'Missing tokens in callback URL')
        }

        const { error: setErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (setErr) throw setErr

        const { data: userData, error: userErr } = await supabase.auth.getUser()
        if (userErr || !userData.user?.email) {
          throw new Error(isSk ? 'Nepodarilo sa nacitat pouzivatela' : 'Failed to load user')
        }

        const email = userData.user.email.toLowerCase()
        const { data: row, error: rowErr } = await supabase
          .from('admin_users')
          .select('email')
          .eq('email', email)
          .maybeSingle()

        if (rowErr || !row) {
          await supabase.auth.signOut()
          toast.error(isSk ? 'Nemate pristup. Kontaktujte admina.' : 'You do not have access. Contact admin.')
          router.replace('/login?error=not_admin')
          return
        }

        toast.success(isSk ? 'Prihlasenie uspesne' : 'Signed in successfully')
        router.replace(redirect)
      } catch (error: unknown) {
        console.error('Auth callback error:', error)
        const message = error instanceof Error ? error.message : isSk ? 'Chyba pri prihlaseni' : 'Sign-in error'
        toast.error(message)
        router.replace('/login?error=callback_failed')
      }
    })()
  }, [isSk, redirect, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-3 text-2xl font-bold">{isSk ? 'Prihlasovanie' : 'Signing in'}</h1>
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-sm font-semibold text-slate-600">Loading...</div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
