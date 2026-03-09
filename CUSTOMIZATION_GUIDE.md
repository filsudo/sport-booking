# Customization Guide (White-Label)

## 1. Brand Identity
Edit `lib/config/site.ts`:
- `brand.name`
- `brand.shortName`
- `brand.title`
- `brand.description`
- `contact.email`
- `contact.phone`
- `contact.address`

## 2. Services, Resources, Pricing
Option A (no code):
- Use admin panel:
  - `/admin/services`
  - `/admin/resources`
  - `/admin/availability`

Option B (initial package defaults):
- Edit SQL seed:
  - `supabase/sql/03_seed.sql`

## 3. Texts and Page Content
- Main EN/SK dictionary: `lib/i18n.ts`
- Language persistence + switch behavior: `components/layout/LanguageProvider.tsx`
- Home page specific content blocks: `app/page.tsx`
- Services page specific content blocks: `app/services/page.tsx`
- Header/footer labels and pricing modal: `components/layout/Navigation.tsx`

## 4. Colors and UI Style
- Global styles and design tokens:
  - `app/globals.css`
- Shared button component:
  - `components/ui/Button.tsx`

## 5. Admin Access
- Add/remove admins in `admin_users` table
- Keep `ADMIN_EMAILS` synced with real allowed users

## 6. Demo Links and Support
Update placeholders in `lib/config/site.ts`:
- `links.demoUrl`
- `links.videoUrl`
- `links.supportEmail`

## 7. Phone Field Behavior
- Booking details form: `app/booking/details/page.tsx`
- EN mode placeholder/helper is international
- SK mode keeps local demo tone while still allowing international format
