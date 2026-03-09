# Deployment Checklist (Vercel + Supabase)

## Pre-Deploy
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `.env.local` is not shipped
- [ ] no real secrets in repository

## Supabase Production Setup
- [ ] create production Supabase project
- [ ] run SQL in order:
  - [ ] `supabase/sql/01_schema.sql`
  - [ ] `supabase/sql/02_policies.sql`
  - [ ] `supabase/sql/03_seed.sql` (optional for demo-like onboarding)
- [ ] add real admin emails to `admin_users`
- [ ] configure Auth redirect URLs:
  - [ ] `https://your-domain.com/auth/callback`
  - [ ] `https://your-domain.com/login`

## Vercel Setup
- [ ] import repo to Vercel
- [ ] configure env vars:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `ADMIN_EMAILS`
  - [ ] `NEXT_PUBLIC_APP_URL=https://your-domain.com`
- [ ] deploy

## Post-Deploy Validation
- [ ] home page works
- [ ] booking flow works end-to-end
- [ ] double-booking returns conflict
- [ ] admin login is protected
- [ ] language switcher works (EN default, SK demo)
- [ ] phone field accepts international format in EN/SK
- [ ] admin CRUD works for:
  - [ ] bookings statuses
  - [ ] services
  - [ ] resources
  - [ ] availability
- [ ] mobile booking flow sanity-check done

## Packaging Checklist (for sale)
- [ ] source code included
- [ ] SQL schema, policies, seed included
- [ ] `.env.example` included
- [ ] README + setup + customization docs included
- [ ] screenshots included
- [ ] license included
- [ ] changelog included
- [ ] support contact/process included
