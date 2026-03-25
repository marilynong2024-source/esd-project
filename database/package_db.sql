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

-- Sample fake data (3 example bookings)

INSERT INTO bookings (
  customerID, flightID, hotelID, hotelRoomType, hotelIncludesBreakfast,
  departureTime, totalPrice, currency, fareType, loyaltyTier,
  status, refundPercentage, refundAmount,
  seatNumber, travellerProfileId, travellerDisplayName, travellerProfileIdsJson,
  passengerName, passengerEmail, passengerPhone
) VALUES
  (1, 'SQ001', 1, 'STD', 0,
   '2026-05-01T10:00:00', 1200.00, 'SGD', 'Flexi', 'Gold',
   'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
   'Ava Chen', 'ava.chen@example.com', '+65 9123 4567'),

  (2, 'SQ001', 1, 'DLX', 1,
   '2026-06-15T09:30:00', 1500.00, 'SGD', 'Standard', 'Silver',
   'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
   'Ben Kumar', 'ben.kumar@example.com', '+65 8123 0000'),

  (3, 'SQ001', 1, 'STD', 0,
   '2026-04-20T18:45:00', 800.00, 'SGD', 'Saver', NULL,
   'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
   'Casey Tan', 'casey.tan@example.com', '+65 9000 1111');

