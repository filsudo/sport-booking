BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS availability CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS services CASCADE;

DROP FUNCTION IF EXISTS get_booked_times_by_resource(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS is_request_admin() CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('courts', 'tables', 'trainings', 'other')),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_id, name)
);

CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_time < end_time),
  UNIQUE(resource_id, date, start_time)
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_time < end_time),
  CHECK (customer_email IS NOT NULL OR customer_phone IS NOT NULL)
);

CREATE TABLE admin_users (
  email TEXT PRIMARY KEY,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_active_category ON services(is_active, category);
CREATE INDEX idx_resources_service_active_sort ON resources(service_id, is_active, sort_order);
CREATE INDEX idx_availability_service_date ON availability(service_id, date);
CREATE INDEX idx_availability_resource_date ON availability(resource_id, date);
CREATE INDEX idx_bookings_service_date_status ON bookings(service_id, date, status);
CREATE INDEX idx_bookings_resource_date ON bookings(resource_id, date, start_time);
CREATE INDEX idx_bookings_customer_email ON bookings(customer_email);

ALTER TABLE bookings
ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING gist (
  resource_id WITH =,
  tsrange((date + start_time), (date + end_time), '[)') WITH &&
)
WHERE (status IN ('pending', 'confirmed'));

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_services_updated
BEFORE UPDATE ON services
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_resources_updated
BEFORE UPDATE ON resources
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_availability_updated
BEFORE UPDATE ON availability
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bookings_updated
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION is_request_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_users au
    WHERE lower(au.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
$$;

CREATE OR REPLACE FUNCTION get_booked_times_by_resource(
  p_service_id UUID,
  p_date DATE
)
RETURNS TABLE (
  resource_id UUID,
  start_time TIME,
  end_time TIME
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.resource_id, b.start_time, b.end_time
  FROM bookings b
  WHERE b.service_id = p_service_id
    AND b.date = p_date
    AND b.status IN ('pending', 'confirmed');
$$;

GRANT EXECUTE ON FUNCTION get_booked_times_by_resource(UUID, DATE) TO anon, authenticated;

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY services_public_read_active ON services
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

CREATE POLICY services_admin_manage ON services
  FOR ALL
  TO authenticated
  USING (is_request_admin())
  WITH CHECK (is_request_admin());

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
  USING (is_request_admin())
  WITH CHECK (is_request_admin());

CREATE POLICY availability_public_read_open ON availability
  FOR SELECT
  TO anon, authenticated
  USING (is_available = TRUE AND date >= CURRENT_DATE);

CREATE POLICY availability_admin_manage ON availability
  FOR ALL
  TO authenticated
  USING (is_request_admin())
  WITH CHECK (is_request_admin());

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
  USING (is_request_admin());

CREATE POLICY bookings_admin_update ON bookings
  FOR UPDATE
  TO authenticated
  USING (is_request_admin())
  WITH CHECK (is_request_admin());

CREATE POLICY bookings_admin_delete ON bookings
  FOR DELETE
  TO authenticated
  USING (is_request_admin());

CREATE POLICY bookings_admin_insert ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_request_admin());

CREATE POLICY admin_users_self_select ON admin_users
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

INSERT INTO services (id, name, description, category, duration_minutes, price, currency, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'Table Tennis - Open Play', 'Book one of our indoor ping-pong tables.', 'tables', 60, 14.00, 'EUR', TRUE),
  ('00000000-0000-0000-0000-000000000102', 'Tennis Court Rental', 'Full-size hard courts for singles or doubles.', 'courts', 60, 32.00, 'EUR', TRUE),
  ('00000000-0000-0000-0000-000000000103', 'Badminton Court Rental', 'Indoor badminton courts with pro lighting.', 'courts', 60, 22.00, 'EUR', TRUE),
  ('00000000-0000-0000-0000-000000000104', 'Personal Training Session', 'One-on-one coaching with certified trainers.', 'trainings', 60, 45.00, 'EUR', TRUE),
  ('00000000-0000-0000-0000-000000000105', 'Group Training Class', 'Coach-led group session with fixed evening slots.', 'trainings', 60, 18.00, 'EUR', TRUE);

INSERT INTO resources (id, service_id, name, kind, capacity, sort_order, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'Table 1', 'table', 2, 1, TRUE),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 'Table 2', 'table', 2, 2, TRUE),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000101', 'Table 3', 'table', 2, 3, TRUE),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000102', 'Court 1', 'court', 4, 1, TRUE),
  ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000102', 'Court 2', 'court', 4, 2, TRUE),
  ('00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000103', 'Court A', 'court', 4, 1, TRUE),
  ('00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000103', 'Court B', 'court', 4, 2, TRUE),
  ('00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000104', 'Trainer Martin', 'trainer', 1, 1, TRUE),
  ('00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000104', 'Trainer Adrian', 'trainer', 1, 2, TRUE),
  ('00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000105', 'Group Class Studio', 'group', 12, 1, TRUE);

INSERT INTO admin_users (email, display_name)
VALUES
  ('admin@demo.com', 'Demo Admin'),
  ('coach@demo.com', 'Head Coach');

WITH day_series AS (
  SELECT (CURRENT_DATE + n)::date AS day
  FROM generate_series(0, 13) AS n
),
standard_resources AS (
  SELECT id, service_id
  FROM resources
  WHERE id <> '00000000-0000-0000-0000-000000000210'
),
standard_times AS (
  SELECT *
  FROM (
    VALUES
      ('09:00'::time, '10:00'::time),
      ('10:00'::time, '11:00'::time),
      ('11:00'::time, '12:00'::time),
      ('13:00'::time, '14:00'::time),
      ('14:00'::time, '15:00'::time),
      ('15:00'::time, '16:00'::time),
      ('16:00'::time, '17:00'::time),
      ('17:00'::time, '18:00'::time),
      ('18:00'::time, '19:00'::time),
      ('19:00'::time, '20:00'::time)
  ) AS t(start_time, end_time)
)
INSERT INTO availability (service_id, resource_id, date, start_time, end_time, is_available)
SELECT sr.service_id, sr.id, ds.day, st.start_time, st.end_time, TRUE
FROM standard_resources sr
CROSS JOIN day_series ds
CROSS JOIN standard_times st
ON CONFLICT (resource_id, date, start_time) DO NOTHING;

WITH day_series AS (
  SELECT (CURRENT_DATE + n)::date AS day
  FROM generate_series(0, 13) AS n
),
group_times AS (
  SELECT *
  FROM (
    VALUES
      ('17:00'::time, '18:00'::time),
      ('18:00'::time, '19:00'::time),
      ('19:00'::time, '20:00'::time)
  ) AS t(start_time, end_time)
)
INSERT INTO availability (service_id, resource_id, date, start_time, end_time, is_available)
SELECT
  '00000000-0000-0000-0000-000000000105',
  '00000000-0000-0000-0000-000000000210',
  ds.day,
  gt.start_time,
  gt.end_time,
  TRUE
FROM day_series ds
CROSS JOIN group_times gt
WHERE extract(isodow FROM ds.day) <= 5
ON CONFLICT (resource_id, date, start_time) DO NOTHING;

INSERT INTO bookings (
  id,
  service_id,
  resource_id,
  date,
  start_time,
  end_time,
  customer_name,
  customer_email,
  customer_phone,
  note,
  status
)
VALUES
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000201',
    CURRENT_DATE + 1,
    '10:00'::time,
    '11:00'::time,
    'Alex Novak',
    'alex@example.com',
    '+421900111222',
    'Wants rental paddles',
    'pending'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000204',
    CURRENT_DATE + 2,
    '18:00'::time,
    '19:00'::time,
    'Mia Kolar',
    'mia@example.com',
    '+421900333444',
    NULL,
    'confirmed'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000206',
    CURRENT_DATE + 3,
    '19:00'::time,
    '20:00'::time,
    'Lukas Hruby',
    'lukas@example.com',
    '+421900555666',
    'Brings own rackets',
    'confirmed'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000209',
    CURRENT_DATE + 4,
    '14:00'::time,
    '15:00'::time,
    'Eva Smrek',
    'eva@example.com',
    '+421900777888',
    NULL,
    'cancelled'
  );

COMMIT;

