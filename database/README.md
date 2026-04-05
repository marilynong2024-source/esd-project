# Database folder

This directory holds **documentation only**. The canonical SQL that matches the course **ERD / multi-database diagram** is the project root file **`init_db.sql`**.

**Authoritative narrative** (where each store lives at runtime vs in SQL, OutSystems keys, account JSON path, cross-cutting IDs): **`DATABASE_GUIDE.txt`** in this folder.

## How to use `init_db.sql`

1. Run it against a MySQL server (local or cloud) with a user that can `CREATE DATABASE`.
2. It creates logical databases: **FlightDB**, **HotelDB**, **CustomerDB**, **travel_booking**, **LoyaltyDB**, **TravellerDB** (with cross-DB FK from TravellerProfiles to CustomerDB).
3. **Docker Compose** does **not** execute `init_db.sql` automatically. Compose starts **one** MySQL container (`booking-db`) and creates only the **`travel_booking`** schema via `MYSQL_DATABASE`. The booking service then runs SQLAlchemy `create_all()` plus `ensure_booking_columns()` for the `bookings` table.

For a summary table of diagram vs Docker, see the project root **`README.md`** → “Databases (diagram vs Docker runtime)”. For full detail, use **`DATABASE_GUIDE.txt`** above.

**Large hotel catalog (SQL + hotel service):** after changing `hotel/extra_hotels_data.py`, run `python scripts/emit_extra_hotels_sql.py` and merge the output into `init_db.sql` (see `DATABASE_GUIDE.txt` §2.2).

## Removed duplicates

Per-file extracts under `database/*.sql` were removed; they duplicated or drifted from `init_db.sql`. Use **`init_db.sql`** as the single reference for slides and reports.
