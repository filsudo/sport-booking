# SportBook - Setup Guide

Tento dokument vede ťa krok-za-krokom ako nastaviť SportBook DEMO aplikáciu.

## 📋 Predpoklady

- Node.js 18+ (skontroluj: `node --version`)
- Git (skontroluj: `git --version`)
- Účet na [Supabase.com](https://supabase.com)
- Nejaký text editor (VS Code, etc.)

## 🔧 Krok 1: Skopírovať projekt

```bash
# Ak je projekt na GitHub:
git clone <repo-url>
cd sport-booking

# Alebo ak je na počítači:
cd sport-booking
```

## 📦 Krok 2: Inštaluj dependencies

```bash
npm install
# alebo: yarn install / pnpm install
```

To stiahne všetky potrebné balíčky (Next.js, Supabase, Zod, TailwindCSS, atď).

## 🗄️ Krok 3: Vytvor Supabase projekt

### 3a) Vytvorenie projektu

1. Prejdi na [supabase.com/dashboard](https://supabase.com/dashboard)
2. Klikni "New project"
3. Vyplň:
   - Organization: vytvor novu alebo vyber existujúcu
   - Project name: `sport-booking-demo`
   - Database password: nejaký silný password (ulož si ho!)
   - Region: Vyber najbližší (EU recommended)
4. Čakaj kým sa projekt vytvorí (5-15 minút)

### 3b) Spusť SQL migraci

1. Otvor svoj Supabase projekt
2. Naľavo: "SQL Editor" → "New query"
3. Skopíruj obsah **`supabase/migrations/0001_init.sql`**
4. Vlož do editoru
5. Klikni "Run" (alebo Ctrl+Enter)
6. Čakaj na potvrdenie "Query successful"

To vytvorí všetky tabuľky a seed data:
- `services` (5 služieb: tenisové kurty, tréningy, atď.)
- `availability` (sloty na ďalších 7 dní)
- `bookings` (prázdna tabuľka)
- `admin_users` (admin@demo.com, coach@demo.com)

## 🔑 Krok 4: Skopíruj API klúče

1. V Supabase dashborde: naľavo "Settings" → "API"
2. Skopíruj tieto hodnoty:

   ```
   Project URL      → NEXT_PUBLIC_SUPABASE_URL
   Anon Key         → NEXT_PUBLIC_SUPABASE_ANON_KEY
   Service Role Key → SUPABASE_SERVICE_ROLE_KEY (SECRET!)
   ```

3. V tvom projektu vytvor súbor `.env.local` na root:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...
   ADMIN_EMAILS=admin@demo.com,coach@demo.com
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. Ulož súbor (`.env.local` by NIE je commitnutý na git!)

⚠️ **VAROVÁNÍ**: NIKDY nedávaj `SUPABASE_SERVICE_ROLE_KEY` do Git, GitHubu, apod!

## 🚀 Krok 5: Spusť aplikáciu lokálne

```bash
npm run dev
```

Výstup:
```
  ▲ Next.js 16.1.6
  - Local:        http://localhost:3000
```

Otvor [http://localhost:3000](http://localhost:3000) v prehliadači. Mali by si vidieť domovskú stránku!

## ✅ Krok 6: Testuj základný flow

### Test 1: Zákazník - Vytvorenie rezervácie

1. Na home page: klikni "Rezervovať" (alebo naviguj na `/booking`)
2. Vyber službu "Tenisový kurt" (alebo inú)
3. Vyber dátum z budúcnosti (sú dostupné príštích 7 dní)
4. Vyber čas (napr. 09:00)
5. Vyplň údaje:
   - Meno: Jan Novák
   - Email: test@example.com
   - Telefón: +421 123 456 789
   - Poznámka: (voliteľné)
6. Klikni "Potvrdiť rezerváciu"
7. Mal by si vidieť success stránku s ID rezervácie

✅ **Ak to funguje**: Klikni "Skontroluj Supabase"

### Test 2: Overenie v Supabase

1. V Supabase dashborde: "Table Editor" (naľavo)
2. Vyber table `bookings`
3. Mali by si vidieť nový riadok s:
   - `customer_name`: Jan Novák
   - `status`: pending
   - `date`: dnesný dátum

✅ **VÝBORNĚ!** Booking bol vytvorený.

### Test 3: Admin přístup

1. Na home page: klikni "Spravovať" (v headeru)
2. Zadaj email: `admin@demo.com`
3. Klikni "Poslať Magic Link"
4. Otvor email (check spam folder!)
5. Klikni na link v emailu
6. Měl by si vidieť admin dashboard (`/admin`)

❌ **Problém?** Email nechodí? To je normálne v development móde - Supabase vyžaduje OAuth setup. Vidíš chybové hlášky? Pokračuj...

## 📝 Krok 7: Email konfigurace (production)

V development móde (localhost) sú emaily "caught" a vidíš ich v Supabase -> Auth -> Email log.

Aby emaily fungovali v production (Vercel):

1. Supabase dashboard: "Auth" → "Providers" → "Email"
2. Uprav:
   - Enable email confirmations: ON
   - Email templates: customize (optional)
3. Ulož zmeny

Alebo použi Resend.com / SendGrid integraci (advanced).

## 🌐 Krok 8: Deploy na Vercel (Optional)

### 8a) Push na GitHub

```bash
git add .
git commit -m "SportBook demo - initial commit"
git push origin main
```

### 8b) Vercel deploy

1. Prejdi na [vercel.com](https://vercel.com)
2. **Import project** → vyber GitHub repo
3. Klikni **Deploy**
4. Čakaj (1-2 minúty)
5. Production URL: `https://sport-booking-xxx.vercel.app`

### 8c) Env variables na Vercel

1. Project Settings → Environment Variables
2. Pridaj (z `.env.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ADMIN_EMAILS=...
   NEXT_PUBLIC_APP_URL=https://sport-booking-xxx.vercel.app
   ```
3. Redeploy

### 8d) Supabase OAuth redirect

1. Supabase dashboard: "Auth" → "URL Configuration"
2. Pridaj "Redirect URL":
   ```
   https://sport-booking-xxx.vercel.app/confirm
   ```
3. Ulož

✅ **HOTOVO!** Tvoja aplikácia je live!

## 🧪 Admin features

Po login ako admin:

- **/admin**: Dashboard s počtom pending/confirmed bookings
- **/admin/services**: Spravovať služby (CRUD)
- **/admin/availability**: Generovať sloty na konkrétny deň

## 🐛 Troubleshooting

### "NEXT_PUBLIC_SUPABASE_URL chýba"
- Skontroluj `.env.local` - musí existovať v root priečinku
- Obsah musí byť správny (bez medzer, bez hranic)
- Restartni dev server: `npm run dev`

### "Slot není dostupný" (double-booking error)
- To je normálne! Twin reservation na rovnaký čas.
- Vyber iný čas.

### Email magic link nefunguje (development)
- Je to OK, v dev móde Supabase nedovoľuje email
- Keď deployeš na Vercel, bude fungovat
- Alebo uprav Supabase Auth → Email (enable confirmations)

### Chyba "Row-level security violation"
- Možno špatná RLS policy v DB
- Skontroluj tabulky: `bookings`, `services`, `availability`
- Spusť migráciu znovu

### Chyba "Admin nema prisup"
- Email neni v `admin_users` table
- Pridaj ho: SQL Editor → `INSERT INTO admin_users (email) VALUES ('new@admin.com')`

## 📚 Ďalšie čítanie

- [Next.js docs](https://nextjs.org/docs)
- [Supabase docs](https://supabase.com/docs)
- [TailwindCSS](https://tailwindcss.com)

## ✨ Čo bolo vytvorené

✅ Maerketing pages (Home, Services, Contact)
✅ Booking flow (5 krokov)
✅ Admin dashboard (štatistiky, tabuľka)
✅ Admin services management
✅ Admin availability management
✅ Magic link auth (OTP)
✅ Double-booking protection
✅ Row-level security (RLS)
✅ API routes (slots, bookings)
✅ Responsive design (mobile/tablet/desktop)
✅ Validators (Zod)
✅ Error handling

## 🎉 Hotovo!

Teraz máš funkčnú booking platformu. Môžeš ju:
- Testovať lokálne
- Deployovať na Vercel
- Pridať ďalšie features (payments, SMS, atď.)
- Ukazovať ako portfolio projekt

Viac otázok? Skontroluj README.md alebo source code comments.

---

**Happy coding! 🚀**
