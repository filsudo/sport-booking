'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import toast from 'react-hot-toast'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/admin'

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
          throw new Error('V callback URL chýbajú tokeny')
        }

        const { error: setErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (setErr) throw setErr

        const { data: userData, error: userErr } = await supabase.auth.getUser()
        if (userErr || !userData.user?.email) {
          throw new Error('Nepodarilo sa načítať používateľa')
        }

        const email = userData.user.email.toLowerCase()
        const { data: row, error: rowErr } = await supabase
          .from('admin_users')
          .select('email')
          .eq('email', email)
          .maybeSingle()

        if (rowErr || !row) {
          await supabase.auth.signOut()
          toast.error('Nemáš prístup. Kontaktuj administrátora.')
          router.replace('/login?error=not_admin')
          return
        }

        toast.success('Úspešne prihlásené')
        router.replace(redirect)
      } catch (error: unknown) {
        console.error('Auth callback error:', error)
        const message = error instanceof Error ? error.message : 'Chyba pri prihlásení'
        toast.error(message)
        router.replace('/login?error=callback_failed')
      }
    })()
  }, [redirect, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-3 text-2xl font-bold">Prihlasujem...</h1>
        <div className="inline-block animate-spin">⏳</div>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="mb-3 text-2xl font-bold">Prihlasujem...</h1>
            <div className="inline-block animate-spin">⏳</div>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
