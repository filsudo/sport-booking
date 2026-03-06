'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { validateAdminSession } from '@/lib/auth/admin';
import toast from 'react-hot-toast';

export default function ConfirmPage() {
  const router = useRouter();
  // no local loading state required; we navigate immediately

  useEffect(() => {
    const handleConfirmation = async () => {
      try {
        // Get the session from the URL
        const hash = window.location.hash;

        if (!hash) {
          throw new Error('No session hash found');
        }

        // Parse the hash to get the session
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: hash,
          type: 'magiclink',
        });

        if (error) throw error;

        if (data.user) {
          // Check if user is admin
          const isAdmin = await validateAdminSession(data.user.email!);

          if (!isAdmin) {
            // Not an admin, deny access
            await supabase.auth.signOut();
            toast.error('Nemáš prístup. Kontaktuj administrátora.');
            router.push('/login');
            return;
          }

          // Store session
          if (data.session) {
            localStorage.setItem('sb-session', JSON.stringify(data.session));
          }

          toast.success('Úspešne si sa prihlásal!');
          router.push('/admin');
        }
      } catch (error: unknown) {
        console.error('Confirmation error:', error);
        if (error instanceof Error) {
          toast.error(error.message || 'Niečo sa pokazilo pri potvrdzovaní loginu');
        } else {
          toast.error('Niečo sa pokazilo pri potvrdzovaní loginu');
        }
        router.push('/login');
      }
    };

    handleConfirmation();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Potvrdzujem prihlásenie...</h1>
        <div className="animate-spin inline-block">⏳</div>
      </div>
    </div>
  );
}
