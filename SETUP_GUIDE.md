# Setup Guide

This guide covers local setup from a clean machine.

## Prerequisites
- Node.js 20+ (`node -v`)
- npm 10+ (`npm -v`)
- Supabase account

## 1. Install Dependencies
```bash
npm install
```

## 2. Create Supabase Project
1. Open Supabase dashboard.
2. Create a new project.
3. Wait until database is ready.

## 3. Apply SQL
Run SQL files in **exact order** in Supabase SQL Editor:
1. `supabase/sql/01_schema.sql`
2. `supabase/sql/02_policies.sql`
3. `supabase/sql/03_seed.sql`

Alternative reset script (single file):
- `supabase/migrations/0002_resource_rebuild.sql`

## 4. Configure Environment
Create `.env.local` from `.env.example`:
```bash
cp .env.example .env.local
```
On Windows PowerShell:
```powershell
Copy-Item .env.example .env.local
```

Set values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`
- `NEXT_PUBLIC_APP_URL`

## 5. Run Project
```bash
npm run dev
```

Open `http://localhost:3000`.

## 6. Verify Demo Data
Expected demo content after seed:
- 5 services
- 10 resources
- availability for upcoming 14 days
- 2 admin users (`admin@demo.com`, `coach@demo.com`)
- sample bookings in different statuses

## 7. Verify Booking Flow
1. Open `/booking`
2. Select service
3. Select date
4. Select resource
5. Select time
6. Submit customer form
7. Confirm success page appears

## 8. Verify Admin
1. Open `/login`
2. Sign in with a demo admin email from `admin_users`
3. Check:
   - `/admin` bookings management
   - `/admin/services`
   - `/admin/resources`
   - `/admin/availability`

## Common Issues
- `RLS` errors:
  re-run `01_schema.sql` and `02_policies.sql`.
- No slots:
  re-run `03_seed.sql` or generate slots in admin availability page.
- Admin forbidden:
  ensure email exists in `admin_users` table and `ADMIN_EMAILS`.
- 409 on booking:
  this is expected when slot is already booked.
