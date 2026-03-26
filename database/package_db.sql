-- Schema for the travel_booking database (MySQL)

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customerID INT NOT NULL,
  flightID VARCHAR(20) NOT NULL,
  hotelID INT NOT NULL,
  hotelRoomType VARCHAR(10),
  hotelIncludesBreakfast TINYINT(1) DEFAULT 0,
  departureTime VARCHAR(40) NOT NULL,
  totalPrice DOUBLE NOT NULL,
  currency VARCHAR(8) DEFAULT 'SGD',
  fareType VARCHAR(20) DEFAULT 'Saver',
  loyaltyTier VARCHAR(20),
  status VARCHAR(20) DEFAULT 'CONFIRMED',
  noOfRooms INT DEFAULT 1,
  refundPercentage INT,
  refundAmount DOUBLE,
  seatNumber VARCHAR(8) NULL,
  travellerProfileId INT NULL,
  travellerDisplayName VARCHAR(128) NULL,
  travellerProfileIdsJson TEXT NULL,
  passengerName VARCHAR(200) NULL,
  passengerEmail VARCHAR(255) NULL,
  passengerPhone VARCHAR(40) NULL
);

-- Diagram-aligned alias table name (for rubric readability)
CREATE TABLE IF NOT EXISTS PackageBookings LIKE bookings;

CREATE TABLE IF NOT EXISTS BundleCatalog (
  bundleCode VARCHAR(32) PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  originCity VARCHAR(80) NOT NULL,
  destinationCity VARCHAR(80) NOT NULL,
  defaultNights INT NOT NULL,
  highlight VARCHAR(255) NULL,
  displayOrder INT DEFAULT 0
);

INSERT INTO BundleCatalog (bundleCode, title, originCity, destinationCity, defaultNights, highlight, displayOrder) VALUES
  ('PKG_TOKYO', 'Tokyo city break', 'Singapore', 'Tokyo', 5, 'Culture, dining & shopping', 1),
  ('PKG_BKK', 'Bangkok long weekend', 'Singapore', 'Bangkok', 4, 'Temples & food halls', 2),
  ('PKG_BALI', 'Bali beach escape', 'Singapore', 'Bali', 7, 'Resorts & beaches', 3),
  ('PKG_SYD', 'Sydney harbour', 'Singapore', 'Sydney', 7, 'Harbour views', 4),
  ('PKG_LON', 'London summer', 'Singapore', 'London', 8, 'Theatre & museums', 5);

-- Sample fake data (example bookings — varied status / room / party size)

INSERT INTO bookings (
  customerID, flightID, hotelID, hotelRoomType, hotelIncludesBreakfast,
  departureTime, totalPrice, currency, fareType, loyaltyTier,
  status, refundPercentage, refundAmount,
  seatNumber, travellerProfileId, travellerDisplayName, travellerProfileIdsJson,
  passengerName, passengerEmail, passengerPhone, noOfRooms
) VALUES
  (1, 'SQ001', 1, 'STD', 0,
   '2026-05-01T10:00:00', 1200.00, 'SGD', 'Flexi', 'Gold',
   'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
   'Ava Chen', 'ava.chen@example.com', '+65 9123 4567', 1),
  (2, 'SQ001', 1, 'DLX', 1,
   '2026-06-15T09:30:00', 1500.00, 'SGD', 'Standard', 'Silver',
   'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
   'Ben Kumar', 'ben.kumar@example.com', '+65 8123 0000', 1),
  (3, 'SQ001', 1, 'STD', 0,
   '2026-04-20T18:45:00', 800.00, 'SGD', 'Saver', NULL,
   'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
   'Casey Tan', 'casey.tan@example.com', '+65 9000 1111', 1),
  (1, 'SQ634', 4, 'DLX', 1,
   '2026-07-12T08:00:00', 2450.50, 'SGD', 'Flexi', 'Gold',
   'CONFIRMED', NULL, NULL, '12D', NULL, NULL, NULL,
   'Ava Chen', 'ava.chen@example.com', '+65 9123 4567', 1),
  (4, 'TR789', 5, 'STD', 0,
   '2026-08-10T08:00:00', 620.00, 'SGD', 'Saver', 'Silver',
   'PENDING', NULL, NULL, NULL, NULL, NULL, NULL,
   'Dana Ng', 'dana.ng@example.com', '+65 9333 0101', 1),
  (2, 'SQ221', 10, 'STD', 0,
   '2026-03-01T08:30:00', 3100.00, 'SGD', 'Standard', 'Silver',
   'CANCELLED', 50, 450.00, '4A', NULL, NULL, NULL,
   'Ben Kumar', 'ben.kumar@example.com', '+65 8123 0000', 2);

