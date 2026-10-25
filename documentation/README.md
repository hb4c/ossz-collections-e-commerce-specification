# OSSZ Collections deliverables

## Layout

- `original-clone/` is the untouched Git clone at commit `84c37d394d39102ab6c18a6308d049727a901293`.
- `laravel-conversion/` is the isolated Laravel application copy.
- `documentation/` contains inventory, mapping, and test notes.

## Local setup

Requirements: PHP 8.2+, Composer, MySQL 8+/MariaDB, and a web server or `php artisan serve`.

1. Copy `laravel-conversion/.env.example` to `.env` and set a development MySQL database; do not use production credentials.
2. From `laravel-conversion/`, run `composer install`.
3. Run `php artisan key:generate`.
4. Run `php artisan migrate` against the intended development database.
5. Run `php artisan storage:link` if uploaded media is used.
6. Start with `php artisan serve`.

Optional external configuration is documented in `.env.example` for Gemini concierge, Resend email, and session signing. Missing optional service credentials intentionally leave the documented fallback/queued behaviour in place.

## Verification limitation

The sandbox has Git, Node and npm, but no `php`, `composer`, or `mysql` executable. Consequently syntax, Composer, route, migration, startup, browser, and database checks could not be executed here. The original clone was checked clean immediately after cloning and must be checked again before delivery.
