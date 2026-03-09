# Changelog

## 2026-03-09
- rebuilt DB contract for resource-based booking
- added `resources` management admin page
- updated availability admin to support per-resource generation and status toggling
- hardened admin API authorization in `/api/bookings`
- added schema/policies/seed split SQL files
- added white-label config in `lib/config/site.ts`
- replaced deprecated `middleware.ts` with `proxy.ts`
- added `.env.example` and refreshed project documentation
- normalized admin/login/callback UI copy for EN default + SK demo
- updated booking and slots API error messages to EN-first wording
- added marketplace-ready product description source (`PRODUCT_DESCRIPTION.md`)
