# OSSZ Collections source inventory

- Repository: `https://github.com/membaherve-cyber/ossz-laravel.git`
- Original branch: `main`
- Original HEAD: `84c37d394d39102ab6c18a6308d049727a901293`
- Tracked files: 165
- Source status immediately after clone: clean
- Stack observed: Laravel 11, PHP 8.2+, Blade, vanilla JavaScript/CSS, MySQL, Eloquent-style models, session/database storage.

## Functional areas

- Storefront pages: home, shop, product, collections, search, journal, lookbook, FAQ, about, appointments, contact, size guide, offline.
- Public actions: locale switching, newsletter signup, contact submission, appointment booking, order lookup/tracking.
- Cart and checkout: add/update/remove items, coupon application, checkout, payment-proof upload.
- Authentication: login, registration, logout, password recovery/reset.
- Customer account: dashboard, orders, appointments/cancellation, addresses, profile, wishlist.
- Concierge/API: `/api/concierge` and `/api/product/{slug}`.
- Admin: dashboard, orders, catalogue/inventory/collections, homepage/journal/lookbook/FAQ content, appointments, customers, staff, contacts, coupons, media, notifications, AI gaps, settings, CSV export.
- Media: authenticated-safe file/media route for uploaded assets.

## Data entities

Users, addresses, categories, collections, products, product variants/images, media, carts/cart items, orders/order items, appointments, wishlists, coupons, journal posts, home blocks, lookbook items, FAQs, delivery zones, settings, AI conversations, audit log, newsletter signups, contact messages, AI gaps, notifications, password resets, sessions, cache and cache locks.

The authoritative schema is `original-clone/database/migrations/2026_01_01_000001_create_ossz_tables.php`; the conversion retains it unchanged in `laravel-conversion/database/migrations/`.
