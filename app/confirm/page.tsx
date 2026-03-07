'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { validateAdminSession } from '@/lib/auth/admin'
import toast from 'react-hot-toast'

export default function ConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const handleConfirmation = async () => {
      try {
        const hash = window.location.hash

        if (!hash) {
          throw new Error('No session hash found')
        }

        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: hash,
          type: 'magiclink',
        })

        if (error) throw error

        if (data.user) {
          const isAdmin = await validateAdminSession(data.user.email!)

          if (!isAdmin) {
            await supabase.auth.signOut()
            toast.error('Nemáš prístup. Kontaktuj administrátora.')
            router.push('/login')
            return
          }

          if (data.session) {
            localStorage.setItem('sb-session', JSON.stringify(data.session))
          }

          toast.success('Úspešne si sa prihlásil!')
          router.push('/admin')
        }
      } catch (error: unknown) {
        console.error('Confirmation error:', error)
        if (error instanceof Error) {
          toast.error(error.message || 'Niečo sa pokazilo pri potvrdzovaní loginu')
        } else {
          toast.error('Niečo sa pokazilo pri potvrdzovaní loginu')
        }
        router.push('/login')
      }
    }

    handleConfirmation()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold">Potvrdzujem prihlásenie...</h1>
        <div className="inline-block animate-spin">⟳</div>
      </div>
    </div>
  )
}
