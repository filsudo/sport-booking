-- Create services table
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create availability table (windows approach)
CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, date, start_time)
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, date, start_time)
);

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_availability_service_date ON availability(service_id, date);
CREATE INDEX idx_bookings_service_date ON bookings(service_id, date);
CREATE INDEX idx_bookings_status_date ON bookings(status, date);
CREATE INDEX idx_bookings_email ON bookings(customer_email);

-- Enable RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Services: public read only active services
CREATE POLICY "public_read_active_services" ON services
  FOR SELECT USING (is_active = TRUE);

-- Availability: public read only available
CREATE POLICY "public_read_available" ON availability
  FOR SELECT USING (is_available = TRUE);

-- Bookings: public can insert
CREATE POLICY "public_insert_bookings" ON bookings
  FOR INSERT WITH CHECK (TRUE);

-- Bookings: public cannot select
CREATE POLICY "public_no_select_bookings" ON bookings
  FOR SELECT USING (FALSE);

-- Admin users: public read (used to check if email is admin)
CREATE POLICY "public_check_admin" ON admin_users
  FOR SELECT USING (TRUE);

-- Insert sample data
INSERT INTO services (name, description, duration_minutes, price, is_active) VALUES
  ('Prenájom tenisového kurtu', 'Moderný tenisový kurt s profesionálnym povrchom', 60, 35.00, TRUE),
  ('Osobný tréning', 'Individuálny tréning s certifikovaným trénérom', 60, 50.00, TRUE),
  ('Skupinový tréning', 'Skupinové tréning, maximálne 6 osôb', 60, 25.00, TRUE),
  ('Detský odsúť', 'Tréning pre deti vo veku 6-12 rokov', 45, 18.00, TRUE),
  ('Raketový klub', 'Pronájom rakiet a obuvi, 1 hodina', 60, 10.00, TRUE)
ON CONFLICT DO NOTHING;

-- Insert admin users
INSERT INTO admin_users (email) VALUES
  ('admin@demo.com'),
  ('coach@demo.com')
ON CONFLICT DO NOTHING;

-- Insert sample availability for next 7 days
INSERT INTO availability (service_id, date, start_time, end_time, is_available)
SELECT 
  s.id,
  CURRENT_DATE + (n || ' days')::INTERVAL,
  t.start_time,
  t.end_time,
  TRUE
FROM services s
CROSS JOIN generate_series(0, 6) AS n
CROSS JOIN (
  VALUES 
    ('09:00'::TIME, '10:00'::TIME),
    ('10:00'::TIME, '11:00'::TIME),
    ('11:00'::TIME, '12:00'::TIME),
    ('13:00'::TIME, '14:00'::TIME),
    ('14:00'::TIME, '15:00'::TIME),
    ('15:00'::TIME, '16:00'::TIME),
    ('16:00'::TIME, '17:00'::TIME),
    ('17:00'::TIME, '18:00'::TIME)
) AS t(start_time, end_time)
WHERE s.is_active = TRUE
ON CONFLICT DO NOTHING;
