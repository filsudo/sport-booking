# SportBook - Project Files Overview

Tento dokument opisuje všetky vytvorené súbory a ich účel.

## 📁 Štruktúra projektu

### Root súbory

| Súbor | Účel |
|-------|------|
| `.env.local` | ⚠️ **VYTVOR SÁM**: Environment variables (Supabase keys) |
| `.env.local.example` | Template pre `.env.local` |
| `package.json` | Dependencies + scripts |
| `tsconfig.json` | TypeScript config (nextjs) |
| `next.config.ts` | Next.js config |
| `tailwind.config.ts` | TailwindCSS config |
| `postcss.config.mjs` | PostCSS config (Tailwind) |
| `eslint.config.mjs` | ESLint rules |
| `middleware.ts` | Request middleware (admin protection) |
| `README.md` | Quick start guide |
| `SETUP_GUIDE.md` | Detailed setup instructions |
| `ARCHITECTURE.md` | Technical architecture & decisions |
| `public/` | Static files (images, etc.) |

## 📂 `/app` - Next.js Pages & API Routes

### Public Pages

| Soubor | Route | Účel |
|--------|-------|------|
| `app/layout.tsx` | - | Root layout (Header, Footer, Toast) |
| `app/globals.css` | - | Global styles (Tailwind import) |
| `app/page.tsx` | `/` | Domovská stránka (Hero, Features, CTA) |
| `app/services/page.tsx` | `/services` | Katalog služeb |
| `app/contact/page.tsx` | `/contact` | Kontaktný formulár |

### Booking Flow

| Soubor | Route | Účel |
|--------|-------|------|
| `app/booking/page.tsx` | `/booking` | Kroki 1-3 (služba, dátum, čas) |
| `app/booking/details/page.tsx` | `/booking/details` | Krok 4 (formulár s menom, emailom) |
| `app/booking/success/page.tsx` | `/booking/success` | Krok 5 (potvrdenie) |

### Admin Pages

| Soubor | Route | Účel |
|--------|-------|------|
| `app/admin/page.tsx` | `/admin` | Dashboard (štatistiky, tabuľka) |
| `app/admin/services/page.tsx` | `/admin/services` | CRUD služieb |
| `app/admin/availability/page.tsx` | `/admin/availability` | Generovanie slotov |

### Admin Auth

| Soubor | Route | Účel |
|--------|-------|------|
| `app/login/page.tsx` | `/login` | Form na magic link |
| `app/confirm/page.tsx` | `/confirm` | OAuth callback (potvrdenie) |

### API Routes

| Soubor | Method | Route | Účel |
|--------|--------|-------|------|
| `app/api/slots/route.ts` | GET | `/api/slots` | Vracia dostupné sloty |
| `app/api/bookings/route.ts` | POST | `/api/bookings` | Vytvorí booking (pending) |

## 📦 `/components` - React Components

### UI Components

| Súbor | Účel |
|-------|------|
| `components/ui/Button.tsx` | Reusable button s variantami (primary, secondary, danger) |

### Layout Components

| Súbor | Účel |
|-------|------|
| `components/layout/Navigation.tsx` | Header + Footer |

### Booking Components

| Súbor | Obsah |
|-------|-------|
| `components/booking/BookingSteps.tsx` | **Reusable komponenty**: |
| | - `BookingStepper`: Progress indikátor |
| | - `ServiceSelector`: Výber služby |
| | - `DatePicker`: Výber dátumu |
| | - `TimeSlots`: Výber času |

### Admin Components

| Súbor | Obsah |
|-------|-------|
| `components/admin/BookingsTable.tsx` | Tabuľka s booking, modal detail view |

## 📚 `/lib` - Utility code

### Database

| Súbor | Obsah |
|-------|-------|
| `lib/db/client.ts` | Supabase client (browser) - anonKey |
| `lib/db/server.ts` | Supabase admin client (server) - serviceRoleKey |

### Auth

| Súbor | Obsah |
|-------|-------|
| `lib/auth/admin.ts` | `isAdminEmail()` - skontroluj admin allowlist |

### Utilities

| Súbor | Obsah |
|-------|-------|
| `lib/utils/validation.ts` | Zod schemas + formatovacia funkcií |
| `lib/types.ts` | TypeScript typy (Service, Booking, atď.) |

## 🗄️ `/supabase` - Databáza

| Súbor | Obsah |
|-------|-------|
| `supabase/migrations/0001_init.sql` | SQL migracia: tabuľky + seed data |

**Contains:**
- `CREATE TABLE services`
- `CREATE TABLE availability`
- `CREATE TABLE bookings`
- `CREATE TABLE admin_users`
- RLS polícy
- Indeksy
- Seed data (5 services, 7 dní slotov)

## 📋 Ako sa všetko spája

### Example: Vytvorenie rezervácie

```
1. User klikne "Rezervovať" → /booking (page.tsx)

2. Frontend:
   - components/booking/BookingSteps.tsx → UI componenty
   - useEffect → Fetch /api/slots
   
3. API:
   - app/api/slots/route.ts → Query availability + bookings z DB
   - Vracia array slotov (available=true/false)

4. User vyplní formulár → /booking/details (page.tsx)

5. Frontend: 
   - Pošle POST na /api/bookings (s dátami)

6. API:
   - app/api/bookings/route.ts → Validuj (Zod)
   - Insert do DB (Supabase)
   - DB: UNIQUE constraint check
   - Vrať ID booking

7. Frontend:
   - Redirect na /booking/success?id=X
   - Zobraz potvrdenie

8. Databáza:
   - supabase/migrations/0001_init.sql → Tabuľka bookings
   - lib/db/server.ts → Admin client na insert
   - RLS políka → Ochrana
```

### Example: Admin login

```
1. User klikne "Spravovať" → /login (page.tsx)

2. Frontend:
   - app/login/page.tsx → Form na email
   - Supabase.auth.signInWithOtp() → Odošli magic link

3. Backend:
   - Supabase → Generuje OTP
   - Email → Odošle link s hash

4. User: Klikne na odkaz → /confirm?hash=...

5. Frontend:
   - app/confirm/page.tsx → Verify OTP
   - lib/auth/admin.ts → isAdminEmail()?
   - Ak NIE → Signout, denied
   - Ak ÁNO → Ulož session, redirect /admin

6. Admin access:
   - middleware.ts → Check session na /admin/*
   - app/admin/* → Zobraz dashboard
```

## 🔧 Como pridať nový feature

### Príklad: Pridaj tabuľku "reviews"

1. **Vytvor migráciu:**
   ```sql
   -- supabase/migrations/0002_reviews.sql
   CREATE TABLE reviews (
     id UUID PRIMARY KEY,
     booking_id UUID REFERENCES bookings,
     rating INT,
     comment TEXT
   );
   ```

2. **Spusť v Supabase SQL editor**

3. **Pridaj typ:**
   ```typescript
   // lib/types.ts
   export interface Review { ... }
   ```

4. **Vytvor API route:**
   ```typescript
   // app/api/reviews/route.ts
   export async function POST(request) { ... }
   ```

5. **Vytvor komponent:**
   ```typescript
   // components/reviews/ReviewForm.tsx
   export function ReviewForm() { ... }
   ```

6. **Pridaj na stránku:**
   ```typescript
   // app/booking/success/page.tsx
   import { ReviewForm } from '@/components/reviews/ReviewForm'
   // ...
   <ReviewForm bookingId={bookingId} />
   ```

## 📦 Dependencies

| Package | Verzia | Účiel |
|---------|--------|------|
| `next` | 16.1.6 | Framework |
| `react` | 19.2.3 | UI library |
| `react-dom` | 19.2.3 | DOM rendering |
| `@supabase/supabase-js` | ^2.38.0 | Supabase client |
| `zod` | ^3.22.4 | Validation |
| `date-fns` | ^3.0.0 | Date utilities |
| `react-hot-toast` | ^2.4.1 | Notifications |
| `lucide-react` | ^0.263.1 | Icons |
| `@tailwindcss/postcss` | ^4 | CSS framework |
| `tailwindcss` | ^4 | CSS utilities |
| `typescript` | ^5 | Type checking |
| `eslint` | ^9 | Linting |

## ✅ Checklist: Čo urobiť

- [ ] 1. Clone repo / unzip súbory
- [ ] 2. `npm install` (stiahni dependencies)
- [ ] 3. Vytvor Supabase projekt (supabase.com)
- [ ] 4. Spusť SQL migráciu (0001_init.sql)
- [ ] 5. Skopíruj API klúče do `.env.local`
- [ ] 6. `npm run dev` → otvor http://localhost:3000
- [ ] 7. Testuj booking flow
- [ ] 8. Testuj admin login
- [ ] 9. Deploy na Vercel (optional)

## 🗺️ Tzn am doriešiť

Tieto veci si musíš dostaviť sám (na produkciu):

- [ ] Nakonfiguruj email (Resend / SendGrid)
- [ ] Pridaj payment (Stripe)
- [ ] Nastavte SMS notifikácie (Twilio)
- [ ] Pridaj HTTPS certificate (na produkcii)
- [ ] Nakonfiguruj CDN (Vercel edge)
- [ ] Pridaj monitoring (Sentry)
- [ ] Zvýšeň bezpečnosť (2FA, rate limiting)

## 📖 Súvisajúce dokumenty

- **README.md** - Quick start
- **SETUP_GUIDE.md** - Detailný setup (krok-za-krokem)
- **ARCHITECTURE.md** - Technical decisions & design patterns

---

**Version**: 1.0  
**Last Updated**: March 2024  
**Status**: Complete
