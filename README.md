# SportBook Template

Production-ready sports booking template built with Next.js + Supabase.

## Who This Is For
- Sports centers
- Tennis clubs
- Badminton halls
- Table tennis venues
- Personal and group training studios

## Core Features
- End-to-end booking flow:
  service -> date -> resource -> time -> customer form -> confirmation -> success page
- Resource-based booking:
  tables, courts, trainers, or any custom resource
- Availability engine:
  open slots, booked slots, unavailable slots, and past-time blocking
- Double-booking protection:
  server checks + database unique index on active bookings
- Protected admin panel:
  bookings, services, resources, availability
- Responsive UI:
  booking and admin flows are mobile-friendly

## Tech Stack
- Next.js 16 (App Router, TypeScript)
- Supabase (Postgres, Auth, RLS)
- Tailwind CSS
- Zod validation

## Included In The Package
- Source code
- SQL schema: `supabase/sql/01_schema.sql`
- SQL RLS policies: `supabase/sql/02_policies.sql`
- SQL seed/demo data: `supabase/sql/03_seed.sql`
- Migration reset script: `supabase/migrations/0002_resource_rebuild.sql`
- `.env.example`
- Setup and deployment docs
- Customization guide
- Screenshots placeholders (`screenshots/`)
- License, changelog, support info

## Not Included
- Payment integration (Stripe, etc.)
- SMS notifications
- Native mobile app
- Hosted production Supabase/Vercel accounts

## Quick Start
1. Create a Supabase project.
2. Run SQL in this order:
   `supabase/sql/01_schema.sql`
   `supabase/sql/02_policies.sql`
   `supabase/sql/03_seed.sql`
3. Copy `.env.example` to `.env.local` and fill values.
4. Install and run:
   `npm install`
   `npm run dev`
5. Open `http://localhost:3000`.

Full details: [SETUP_GUIDE.md](./SETUP_GUIDE.md)

## Deployment
Use [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for Vercel + Supabase production setup.

## White-Label Customization
Start with:
- [CUSTOMIZATION_GUIDE.md](./CUSTOMIZATION_GUIDE.md)
- `lib/config/site.ts` for brand/contact metadata
- `lib/i18n.ts` for EN/SK template texts
- SQL seed files for service/resource names and pricing

## Demo, Video, Support
- Demo URL placeholder: set in `lib/config/site.ts`
- Walkthrough video placeholder: set in `lib/config/site.ts`
- Support process: [SUPPORT.md](./SUPPORT.md)
- Marketplace copy blocks: [PRODUCT_DESCRIPTION.md](./PRODUCT_DESCRIPTION.md)

## Security Checklist Before Sale
- Remove `.env.local` from package
- Never include real service role keys
- Verify redirect URLs and callbacks are template-safe
- Replace demo admin emails with sample-only values
