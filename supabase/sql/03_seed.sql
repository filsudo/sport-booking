-- SportBook template demo seed
-- Run third, after 01_schema.sql and 02_policies.sql

INSERT INTO services (id, name, description, category, duration_minutes, price, currency, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'Table Tennis - Open Play', 'Book one of our indoor ping-pong tables.', 'tables', 60, 14.00, 'EUR', TRUE),
  ('00000000-0000-0000-0000-000000000102', 'Tennis Court Rental', 'Full-size hard courts for singles or doubles.', 'courts', 60, 32.00, 'EUR', TRUE),
  ('00000000-0000-0000-0000-000000000103', 'Badminton Court Rental', 'Indoor badminton courts with pro lighting.', 'courts', 60, 22.00, 'EUR', TRUE),
  ('00000000-0000-0000-0000-000000000104', 'Personal Training Session', 'One-on-one coaching with certified trainers.', 'trainings', 60, 45.00, 'EUR', TRUE),
  ('00000000-0000-0000-0000-000000000105', 'Group Training Class', 'Coach-led group session with fixed evening slots.', 'trainings', 60, 18.00, 'EUR', TRUE)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  duration_minutes = EXCLUDED.duration_minutes,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

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
  ('00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000105', 'Group Class Studio', 'group', 12, 1, TRUE)
ON CONFLICT (id) DO UPDATE
SET
  service_id = EXCLUDED.service_id,
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  capacity = EXCLUDED.capacity,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO admin_users (email, display_name)
VALUES
  ('admin@demo.com', 'Demo Admin'),
  ('coach@demo.com', 'Head Coach')
ON CONFLICT (email) DO UPDATE
SET display_name = EXCLUDED.display_name;

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
ON CONFLICT (resource_id, date, start_time) DO UPDATE
SET end_time = EXCLUDED.end_time,
    is_available = TRUE,
    updated_at = NOW();

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
ON CONFLICT (resource_id, date, start_time) DO UPDATE
SET end_time = EXCLUDED.end_time,
    is_available = TRUE,
    updated_at = NOW();

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
    '00000000-0000-0000-0000-000000000301',
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
    '00000000-0000-0000-0000-000000000302',
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
    '00000000-0000-0000-0000-000000000303',
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
    '00000000-0000-0000-0000-000000000304',
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
  )
ON CONFLICT (id) DO UPDATE
SET
  service_id = EXCLUDED.service_id,
  resource_id = EXCLUDED.resource_id,
  date = EXCLUDED.date,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  customer_name = EXCLUDED.customer_name,
  customer_email = EXCLUDED.customer_email,
  customer_phone = EXCLUDED.customer_phone,
  note = EXCLUDED.note,
  status = EXCLUDED.status,
  updated_at = NOW();

