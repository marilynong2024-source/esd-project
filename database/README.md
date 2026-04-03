# Database folder

This directory holds **documentation only**. The canonical SQL that matches the course **ERD / multi-database diagram** is the project root file **`init_db.sql`**.

## How to use `init_db.sql`

1. Run it against a MySQL server (local or cloud) with a user that can `CREATE DATABASE`.
2. It creates logical databases: **FlightDB**, **HotelDB**, **CustomerDB**, **travel_booking**, **LoyaltyDB**, **TravellerDB** (with cross-DB FK from TravellerProfiles to CustomerDB).
3. **Docker Compose** does **not** execute `init_db.sql` automatically. Compose starts **one** MySQL container (`booking-db`) and creates only the **`travel_booking`** schema via `MYSQL_DATABASE`. The booking service then runs SQLAlchemy `create_all()` plus `ensure_booking_columns()` for the `bookings` table.

For table and column lists aligned with the diagram, see **`README.md`** → “Databases (diagram vs Docker runtime)”.

## Removed duplicates

Per-file extracts under `database/*.sql` were removed; they duplicated or drifted from `init_db.sql`. Use **`init_db.sql`** as the single reference for slides and reports.
