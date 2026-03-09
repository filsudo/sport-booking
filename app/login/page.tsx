'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/components/layout/LanguageProvider'

function LoginContent() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/admin'
  const { lang } = useI18n()
  const L = (skText: string, enText: string) => (lang === 'sk' ? skText : enText)

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!email) {
      toast.error(L('Prosim zadajte email', 'Please enter an email'))
      return
    }

    try {
      setLoading(true)

      const emailRedirectTo = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
        redirect
      )}`

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      })

      if (error) throw error

      setSubmitted(true)
      toast.success(L('Skontrolujte email pre magic link', 'Check your email for a magic link'))
    } catch (error: unknown) {
      console.error('Login error:', error)
      const message = error instanceof Error ? error.message : L('Chyba pri prihlaseni', 'Login error')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {!submitted ? (
          <>
            <div className="mb-10 text-center">
              <h1 className="mb-2 text-3xl font-bold">{L('Admin pristup', 'Admin access')}</h1>
              <p className="text-gray-600">{L('Prihlaste sa pomocou emailu', 'Sign in with your email')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="admin@example.com"
                    disabled={loading}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {L('Pristup maju iba admini v povolenom zozname.', 'Only allowlisted admins can access this area.')}
                </p>
              </div>

              <Button size="lg" className="w-full" isLoading={loading} type="submit">
                {L('Poslat magic link', 'Send magic link')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/" className="text-sm text-blue-600 hover:text-blue-700">
                {L('Spat na domov', 'Back to home')}
              </Link>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-8 text-center">
            <Mail className="mx-auto mb-4 h-12 w-12 text-blue-600" />
            <h2 className="mb-2 text-2xl font-bold">{L('Skontrolujte email', 'Check your email')}</h2>
            <p className="mb-4 text-gray-600">
              {L('Poslali sme magic link na', 'Magic link was sent to')} <span className="font-bold">{email}</span>
            </p>
            <p className="mb-6 text-sm text-gray-600">
              {L(
                'Kliknite na odkaz v emaile. Ak ho nevidite, skontrolujte spam.',
                "Open the link in your email. If you do not see it, check the spam folder."
              )}
            </p>
            <Button variant="secondary" onClick={() => setSubmitted(false)}>
              {L('Skusit iny email', 'Try another email')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-sm font-semibold text-slate-600">Loading...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
