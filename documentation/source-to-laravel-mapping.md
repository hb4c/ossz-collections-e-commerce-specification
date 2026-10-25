# Source-to-Laravel mapping

The source repository is already a conventional Laravel 11 application. The conversion is therefore a verified isolated Laravel copy, not a framework rewrite or approximation.

| Source area | Laravel destination | Status |
|---|---|---|
| `routes/web.php` | `laravel-conversion/routes/web.php` | Preserved |
| `app/Http/Controllers/**` | `laravel-conversion/app/Http/Controllers/**` | Preserved |
| `app/Http/Middleware/**` | `laravel-conversion/app/Http/Middleware/**` | Preserved |
| `app/Models/**` | `laravel-conversion/app/Models/**` | Preserved |
| `app/Support/**` | `laravel-conversion/app/Support/**` | Preserved |
| `resources/views/**` | `laravel-conversion/resources/views/**` | Preserved |
| `public/css`, `public/js` | `laravel-conversion/public/css`, `public/js` | Preserved |
| `database/migrations/**` | `laravel-conversion/database/migrations/**` | Preserved |
| `database/seeders/**` | `laravel-conversion/database/seeders/**` | Preserved |
| `config/**`, `bootstrap/**`, `artisan` | Same paths under conversion | Preserved |

No features were removed, redesigned, or replaced with mock pages. The original repository remains separate and untouched.

## Parity checklist

- [x] Storefront routes and Blade views copied
- [x] Authentication and role middleware copied
- [x] Customer account workflows copied
- [x] Cart and checkout workflows copied
- [x] Admin backoffice routes/controllers/views copied
- [x] Models, support services, migrations and seeders copied
- [x] Public CSS/JavaScript copied
- [x] MySQL configuration template retained
- [ ] Runtime execution verification (blocked: PHP/Composer unavailable in the environment)
- [ ] Database migration execution (blocked: PHP/Composer/MySQL unavailable)
- [ ] Browser and responsive comparison (blocked: PHP application cannot start)
