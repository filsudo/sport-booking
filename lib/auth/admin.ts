import { getSupabaseAdmin } from '@/lib/supabaseServer';

// Check if email is in admin allowlist
export async function isAdminEmail(email: string): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is expected for non-admins
      console.error('Error checking admin email:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking admin email:', error);
    return false;
  }
}

// Validate if user session is admin
export async function validateAdminSession(email: string): Promise<boolean> {
  return isAdminEmail(email);
}
