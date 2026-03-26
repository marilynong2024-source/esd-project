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
  ('TR991', 'TR', 'Scoot', 'Budget', 'SIN', 'DPS', '2026-10-01 08:00:00', '2026-10-01 09:35:00', 'Saver', 0, 0.00, 300.00, 140.00, 55),
  ('SQ210', 'SQ', 'Singapore Airlines', 'BigAirline', 'SIN', 'MNL', '2026-07-02 08:40:00', '2026-07-02 12:55:00', 'Standard', 1, 120.00, 300.00, 240.00, 25),
  ('PR501', 'PR', 'Philippine Airlines', 'BigAirline', 'MNL', 'SIN', '2026-07-09 18:20:00', '2026-07-09 22:10:00', 'Standard', 1, 100.00, 300.00, 230.00, 22),
  ('KE658', 'KE', 'Korean Air', 'BigAirline', 'ICN', 'BKK', '2026-07-03 10:00:00', '2026-07-03 14:30:00', 'Flexi', 1, 180.00, 300.00, 410.00, 30),
  ('OZ752', 'OZ', 'Asiana Airlines', 'BigAirline', 'ICN', 'NRT', '2026-07-04 19:00:00', '2026-07-04 21:15:00', 'Standard', 1, 150.00, 300.00, 280.00, 28),
  ('JL414', 'JL', 'Japan Airlines', 'BigAirline', 'NRT', 'CTS', '2026-07-05 07:30:00', '2026-07-05 09:25:00', 'Standard', 1, 90.00, 300.00, 190.00, 35),
  ('NH217', 'NH', 'ANA', 'BigAirline', 'CTS', 'NRT', '2026-07-12 18:00:00', '2026-07-12 19:55:00', 'Saver', 0, 0.00, 300.00, 175.00, 40),
  ('QF454', 'QF', 'Qantas', 'BigAirline', 'SYD', 'MEL', '2026-07-06 06:00:00', '2026-07-06 07:35:00', 'Standard', 1, 80.00, 300.00, 155.00, 32),
  ('JQ502', 'JQ', 'Jetstar', 'Budget', 'MEL', 'SYD', '2026-07-13 20:15:00', '2026-07-13 21:50:00', 'Saver', 0, 0.00, 300.00, 85.00, 45),
  ('KL1004', 'KL', 'KLM', 'BigAirline', 'AMS', 'LHR', '2026-07-07 15:30:00', '2026-07-07 15:55:00', 'Standard', 1, 110.00, 300.00, 165.00, 24),
  ('AF1681', 'AF', 'Air France', 'BigAirline', 'LHR', 'CDG', '2026-07-08 12:00:00', '2026-07-08 14:15:00', 'Standard', 1, 130.00, 300.00, 220.00, 20);

-- Diagram-aligned seat reservation table (FlightDB)
CREATE TABLE IF NOT EXISTS FlightReservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  BookingID INT NOT NULL,
  FlightNum VARCHAR(20) NOT NULL,
  SeatNo VARCHAR(8) NOT NULL,
  Status VARCHAR(20) NOT NULL, -- HELD / CONFIRMED / RELEASED
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

