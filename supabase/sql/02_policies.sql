-- SportBook template RLS policies
-- Run second, after 01_schema.sql

CREATE OR REPLACE FUNCTION public.is_request_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE lower(au.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
$$;

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('services', 'resources', 'availability', 'bookings', 'admin_users')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.services TO anon, authenticated;
GRANT SELECT ON TABLE public.resources TO anon, authenticated;
GRANT SELECT ON TABLE public.availability TO anon, authenticated;
GRANT INSERT ON TABLE public.bookings TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.bookings TO authenticated;
GRANT SELECT ON TABLE public.admin_users TO authenticated;

CREATE POLICY services_public_read_active ON services
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

CREATE POLICY services_admin_manage ON services
  FOR ALL
  TO authenticated
  USING (public.is_request_admin())
  WITH CHECK (public.is_request_admin());

CREATE POLICY resources_public_read_active ON resources
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1
      FROM services s
      WHERE s.id = resources.service_id
        AND s.is_active = TRUE
    )
  );

CREATE POLICY resources_admin_manage ON resources
  FOR ALL
  TO authenticated
  USING (public.is_request_admin())
  WITH CHECK (public.is_request_admin());

CREATE POLICY availability_public_read_open ON availability
  FOR SELECT
  TO anon, authenticated
  USING (is_available = TRUE AND date >= CURRENT_DATE);

CREATE POLICY availability_admin_manage ON availability
  FOR ALL
  TO authenticated
  USING (public.is_request_admin())
  WITH CHECK (public.is_request_admin());

CREATE POLICY bookings_public_insert ON bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM services s
      WHERE s.id = bookings.service_id
        AND s.is_active = TRUE
    )
    AND EXISTS (
      SELECT 1
      FROM resources r
      WHERE r.id = bookings.resource_id
        AND r.service_id = bookings.service_id
        AND r.is_active = TRUE
    )
  );

CREATE POLICY bookings_public_no_read ON bookings
  FOR SELECT
  TO anon, authenticated
  USING (FALSE);

CREATE POLICY bookings_admin_read ON bookings
  FOR SELECT
  TO authenticated
  USING (public.is_request_admin());

CREATE POLICY bookings_admin_update ON bookings
  FOR UPDATE
  TO authenticated
  USING (public.is_request_admin())
  WITH CHECK (public.is_request_admin());

CREATE POLICY bookings_admin_delete ON bookings
  FOR DELETE
  TO authenticated
  USING (public.is_request_admin());

CREATE POLICY bookings_admin_insert ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_request_admin());

CREATE POLICY admin_users_self_select ON admin_users
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

CREATE POLICY admin_users_admin_manage ON admin_users
  FOR ALL
  TO authenticated
  USING (public.is_request_admin())
  WITH CHECK (public.is_request_admin());
