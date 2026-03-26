-- Hotel DB (MySQL)

CREATE TABLE IF NOT EXISTS hotels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hotel_id INT NOT NULL UNIQUE,
  hotel_name VARCHAR(120) NOT NULL,
  location VARCHAR(80) NOT NULL,
  rating DECIMAL(2,1) DEFAULT 4.0,
  image_url VARCHAR(255),
  available_rooms INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hotel_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hotel_id INT NOT NULL,
  room_code VARCHAR(20) NOT NULL, -- STD / DLX / STE
  room_name VARCHAR(120) NOT NULL,
  includes_breakfast TINYINT(1) DEFAULT 0,
  price_per_night DECIMAL(10,2) NOT NULL,
  refundable_before_days INT DEFAULT 7,
  UNIQUE KEY uq_hotel_room (hotel_id, room_code)
);

INSERT INTO hotels
  (hotel_id, hotel_name, location, rating, image_url, available_rooms)
VALUES
  (1, 'Shinjuku Central Hotel', 'Tokyo', 4.2, 'https://via.placeholder.com/120x80?text=Hotel+1', 20),
  (2, 'Asakusa River Inn', 'Tokyo', 3.9, 'https://via.placeholder.com/120x80?text=Hotel+2', 15),
  (3, 'Roppongi Grand Suites', 'Tokyo', 4.8, 'https://via.placeholder.com/120x80?text=Hotel+3', 10);

INSERT INTO hotel_rooms
  (hotel_id, room_code, room_name, includes_breakfast, price_per_night, refundable_before_days)
VALUES
  (1, 'STD', 'Standard Room', 0, 150.00, 7),
  (1, 'DLX', 'Deluxe Room', 1, 220.00, 7),
  (2, 'STD', 'Budget Standard', 0, 120.00, 7),
  (2, 'DLX', 'Premium Deluxe', 1, 180.00, 7),
  (3, 'DLX', 'Deluxe Skyline', 1, 260.00, 7),
  (3, 'STE', 'Executive Suite', 1, 380.00, 7);

-- Diagram-aligned hotel room hold/booking table (HotelDB)
CREATE TABLE IF NOT EXISTS HotelBookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  BookingID INT NOT NULL,
  HotelID INT NOT NULL,
  RoomType VARCHAR(20) NOT NULL, -- STD / DLX / etc.
  CheckIn DATETIME NOT NULL,
  CheckOut DATETIME NOT NULL,
  NumberOfKeys INT NOT NULL,
  Status VARCHAR(20) NOT NULL, -- HELD / CONFIRMED / RELEASED
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

