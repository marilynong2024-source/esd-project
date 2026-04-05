-- Align `bookings` with booking/app.py (Booking model).
-- New Docker volumes: use init_db.sql (includes these columns).
-- Existing volumes: run each statement; ignore ERROR 1060 "Duplicate column" if already applied.
--
--   docker compose exec -T booking-db mysql -utravel_user -ptravel_pass travel_booking < scripts/migrate_booking_json_columns.sql

USE travel_booking;

ALTER TABLE bookings ADD COLUMN hotelRoomMixJson TEXT NULL AFTER hotelRoomType;
ALTER TABLE bookings ADD COLUMN seatNumbersJson TEXT NULL AFTER seatNumber;

-- If you use PackageBookings (init_db.sql), add the same columns there after it exists.
