# SportBook - Online Booking Platform DEMO

Moderná, produkčne-připravená platforma pro online rezervaci služeb sportovního centra. Vytvořena s Next.js, TypeScript, TailwindCSS a Supabase.

## 📋 Přehled

SportBook je DEMO aplikace pro portfolio, která demonstruje:

- **Veřejné stránky**: Home, Služby, Kontakt
- **Booking flow**: 5-krokový proces rezervace bez nutnosti registrace
- **Admin panel**: Správa rezervací, služeb a dostupnosti slots
- **Bezpečnost**: Row-level security (RLS), magic link auth, allowlist pro adminy
- **Server-side logika**: Ochrana před double-booking, validace na serveru

## 🚀 Quick Start

### 1. Klonuj repozitář a nainstaluj závislosti

```bash
git clone <repo-url>
cd sport-booking
npm install
```

### 2. Supabase projekt

1. Přejdi na [supabase.com](https://supabase.com) a vytvoř nový projekt
2. V SQL editoru spusť migraci z `supabase/migrations/0001_init.sql`
3. To vytvoří tabulky: `services`, `availability`, `bookings`, `admin_users`

### 3. Konfiguruj env proměnné

Vytvoř `.env.local` v root adresáři (kopíruj `.env.local.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_EMAILS=admin@demo.com,coach@demo.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Spusť lokálně

```bash
npm run dev
```

Aplikace běží na `http://localhost:3000`

## 📦 Klíčové soubory

- `supabase/migrations/0001_init.sql` - DB schéma
- `lib/db/client.ts` - Supabase client pro browser
- `lib/db/server.ts` - Supabase admin client  
- `lib/auth/admin.ts` - Admin allowlist check
- `app/booking/page.tsx` - Booking flow UI
- `app/api/slots/route.ts` - Slot generation
- `app/api/bookings/route.ts` - Booking creation
- `app/admin/page.tsx` - Admin dashboard

## 🔐 Bezpečnost

- Magic link auth (OTP)
- Admin emails allowlist
- Row-level security (RLS) v DB
- Double-booking protection (unique constraint)
- Server-side validation (Zod)

## 🚀 Deployment

1. Push na GitHub
2. Vercel: Connect repo, add env vars
3. Supabase: Configure redirect URLs

---

**SportBook Demo 2024** - Built for portfolio
