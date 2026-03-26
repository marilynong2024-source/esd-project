-- Flight DB (MySQL)

CREATE TABLE IF NOT EXISTS flights (
  id INT AUTO_INCREMENT PRIMARY KEY,
  flight_num VARCHAR(20) NOT NULL UNIQUE,
  airline_code VARCHAR(10) NOT NULL,
  airline_name VARCHAR(80) NOT NULL,
  airline_type VARCHAR(20) NOT NULL, -- Budget or BigAirline
  origin VARCHAR(10) NOT NULL,
  destination VARCHAR(10) NOT NULL,
  departure_time DATETIME NOT NULL,
  arrival_time DATETIME NOT NULL,
  fare_class VARCHAR(20) NOT NULL, -- Saver/Standard/Flexi/Elite
  refundable TINYINT(1) DEFAULT 0,
  cancellation_charge DECIMAL(10,2) DEFAULT 0,
  no_show_fee DECIMAL(10,2) DEFAULT 300,
  base_price DECIMAL(10,2) NOT NULL,
  available_seats INT DEFAULT 0
);

INSERT INTO flights
  (flight_num, airline_code, airline_name, airline_type, origin, destination, departure_time, arrival_time, fare_class, refundable, cancellation_charge, no_show_fee, base_price, available_seats)
VALUES
  ('SQ001', 'SQ', 'Singapore Airlines', 'BigAirline', 'SIN', 'NRT', '2026-05-01 10:00:00', '2026-05-01 18:10:00', 'Flexi', 1, 150.00, 300.00, 900.00, 20),
  ('SQ002', 'SQ', 'Singapore Airlines', 'BigAirline', 'SIN', 'HND', '2026-06-15 09:30:00', '2026-06-15 17:20:00', 'Standard', 1, 250.00, 300.00, 780.00, 15),
  ('AK123', 'AK', 'AirAsia', 'Budget', 'SIN', 'KUL', '2026-07-01 14:00:00', '2026-07-01 15:05:00', 'Saver', 0, 0.00, 300.00, 120.00, 35),
  ('TR789', 'TR', 'Scoot', 'Budget', 'SIN', 'BKK', '2026-08-10 08:00:00', '2026-08-10 09:35:00', 'Saver', 0, 0.00, 300.00, 160.00, 28),
  ('SQ634', 'SQ', 'Singapore Airlines', 'BigAirline', 'SIN', 'NRT', '2026-07-12 08:00:00', '2026-07-12 15:30:00', 'Flexi', 1, 150.00, 300.00, 900.00, 42),
  ('SQ312', 'SQ', 'Singapore Airlines', 'BigAirline', 'SIN', 'LHR', '2026-09-15 23:55:00', '2026-09-16 06:10:00', 'Flexi', 1, 200.00, 300.00, 1100.00, 36),
  ('TR991', 'TR', 'Scoot', 'Budget', 'SIN', 'DPS', '2026-10-01 08:00:00', '2026-10-01 09:35:00', 'Saver', 0, 0.00, 300.00, 140.00, 55);

-- Diagram-aligned seat reservation table (FlightDB)
CREATE TABLE IF NOT EXISTS FlightReservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  BookingID INT NOT NULL,
  FlightNum VARCHAR(20) NOT NULL,
  SeatNo VARCHAR(8) NOT NULL,
  Status VARCHAR(20) NOT NULL, -- HELD / CONFIRMED / RELEASED
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

