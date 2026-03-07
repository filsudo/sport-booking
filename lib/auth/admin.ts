import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function isAdminEmail(email: string): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking admin email:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking admin email:', error);
    return false;
  }
}

export async function validateAdminSession(email: string): Promise<boolean> {
  return isAdminEmail(email);
}
