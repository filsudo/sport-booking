# 🚀 SportBook - Deployment Checklist

Tento dokument ti pomôže s nasadením aplikácie do produkcie (Vercel + Supabase).

## ✅ Local Development Checklist

Pred deployment skontroluj, že všetko funguje lokálne:

### 1. Setup
- [ ] Node.js 18+ nainštalovaný
- [ ] Dependencies nainštalované (`npm install`)
- [ ] `.env.local` vytvorený s Supabase klíčmi

### 2. Database
- [ ] Supabase projekt vytvorený
- [ ] Migracia `0001_init.sql` spustená
- [ ] Dáta viditeľné v Supabase dashboard

### 3. Application
- [ ] `npm run dev` spúšťa bez chýb
- [ ] Home page: http://localhost:3000
- [ ] Services page: http://localhost:3000/services
- [ ] Booking works: `/booking` → `/booking/success`

### 4. Admin
- [ ] Login: http://localhost:3000/login
- [ ] Magic link funguje (alebo test v Supabase Auth log)
- [ ] Dashboard: http://localhost:3000/admin

### 5. Testing
- [ ] [ ] Vypln formulár (booking) → vied chyba?
- [ ] [ ] Double-booking test → error 409?
- [ ] [ ] Database: booking viditeľný v `bookings` table?

---

## 🌐 Vercel Deployment Checklist

### 1. Prepare Source Code

```bash
# Pridat README, config files
git add .
git commit -m "SportBook - ready for deployment"
git push origin main
```

- [ ] Všetky súbory committed
- [ ] .gitignore existuje (excludes `.env.local`, `node_modules/`)

### 2. Create Vercel Account

- [ ] Account na [vercel.com](https://vercel.com)
- [ ] GitHub connected
- [ ] Email verified

### 3. Import Project

1. Vercel dashboard → "Add New..." → "Project"
2. Vyber GitHub repo
3. Klikni "Import"
4. Vercel auto-detekuje Next.js
5. Necháj všetko na default (build commands, etc.)

### 4. Environment Variables

V Vercel dashboard → Project Settings → Environment Variables

Pridaj:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... ⚠️ SECRET
ADMIN_EMAILS=admin@demo.com,coach@demo.com
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

- [ ] Všetky keys skopírované
- [ ] Bez prázdnych línií alebo extra Space

### 5. Deploy

1. Klikni "Deploy"
2. Čakaj 2-3 minúty
3. Production domain: `https://sport-booking-xxx.vercel.app`

- [ ] Build úspešný (zelená čeština)
- [ ] No build errors
- [ ] Domain accessible

### 6. Test Production

1. Otvor Vercel domain: `https://sport-booking-xxx.vercel.app`
2. Testuj:
   - [ ] Home page loads
   - [ ] Services visible
   - [ ] Booking flow works
   - [ ] Admin login accessible

---

## 🔑 Supabase Configuration Checklist

### 1. Auth Settings

V Supabase dashboard → Authentication → URL Configuration

Set:
- **Site URL**: `https://sport-booking-xxx.vercel.app`
- **Redirect URLs**:
  ```
  https://sport-booking-xxx.vercel.app/confirm
  https://sport-booking-xxx.vercel.app/admin
  ```

- [ ] URLs configured
- [ ] Saved

### 2. Email Provider

Supabase → Auth → Providers → Email

Options:
1. **Default (slow in dev, works in prod)**: Supabase SMTP
2. **Recommended**: Resend.com integration
3. **Alternative**: SendGrid, Mailgun

**For DEMO, default is OK.**

### 3. Database Security

Verify RLS is enabled:

```sql
-- Supabase SQL editor
SELECT * FROM pg_class WHERE relname = 'bookings';
-- Should show: rls flag = on
```

- [ ] RLS enabled on all tables
- [ ] Policies in place

### 4. Backups

Supabase → Backups

- [ ] Automatic backups enabled (check Project Settings)
- [ ] Point-in-time recovery available

---

## 🔐 Security Checklist

Before going LIVE:

### Code
- [ ] No hardcoded secrets (all in .env)
- [ ] .gitignore blocks `.env.local`
- [ ] SERVICE_ROLE_KEY never in client code

### Database
- [ ] RLS policies are tight (bookings read-blocked)
- [ ] Admin_users table has email whitelist
- [ ] Unique constraint on (service_id, date, start_time)

### Auth
- [ ] Magic links only (no passwords)
- [ ] Email allowlist for admins
- [ ] Session properly validated

### API
- [ ] All inputs validated with Zod
- [ ] Error messages don't leak sensitiv info
- [ ] Rate limiting added (if traffic high)

---

## 📊 Monitoring & Maintenance

### Week 1 After Launch

- [ ] Check Vercel logs for errors
- [ ] Monitor Supabase performance
- [ ] Confirm emails being sent (check Auth logs)
- [ ] Test a few real bookings manually

### Ongoing

- [ ] Weekly backup verification
- [ ] Monthly usage analysis
- [ ] Add custom domain (optional):
  1. Buy domain (namecheap, godaddy, etc.)
  2. Vercel → Domains → "Add" → Point DNS
  3. Update `NEXT_PUBLIC_APP_URL` in env

### Performance Optimization

If > 100 users/day:
- [ ] Enable Vercel Analytics
- [ ] Add Cloudflare CDN (free tier)
- [ ] Optimize images (next/image)
- [ ] Add Redis caching (optional)

---

## 🆘 Troubleshooting Deployment

### "Build failed"

1. Check Vercel build logs
2. Common issues:
   - Missing env variable → Add in Vercel dashboard
   - TS error → `npm run build` locally to debug
   - Module not found → `npm install` locally again

### "Magic link email not sent"

1. Supabase → Auth → Email Configuration
2. Check: Email provider set correctly
3. Test: Try with @gmail.com (always works)

### "Admin can't login"

1. Check `.env.local` on Vercel → `ADMIN_EMAILS`
2. Email must be exact match (case-insensitive)
3. Verify email in Supabase `admin_users` table

### "Slots not generating"

1. Check availability table has data
2. SQL: `SELECT * FROM availability LIMIT 5;`
3. If empty, run seed from migration again

---

## 📈 Next Steps After Deployment

1. **Share link** with testers / portfolio
2. **Get feedback** on UX/performance
3. **Iterate**: Fix bugs, improve features
4. **Add features** (payments, SMS, etc.)
5. **Scale up**: Monitor usage, optimize DB

---

## 🎉 Success Criteria

Your SportBook is LIVE when:

✅ **Public can:**
- View home page
- Browse services
- Create bookings
- See "Success" confirmation

✅ **Admin can:**
- Login with magic link
- View bookings dashboard
- See statistics

✅ **Database:**
- Bookings appear in Supabase
- RLS blocks unauthorized reads

✅ **Performance:**
- Page load < 3 seconds
- No console errors

---

**Congrats! You're deployed! 🚀**

---

For issues: Check README.md, SETUP_GUIDE.md, or ARCHITECTURE.md

Last Updated: March 2024
