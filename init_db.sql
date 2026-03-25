-- ============================================================
-- TripBooking Project — Database Seed File
-- Run this once to set up all tables and demo data
-- ============================================================

-- ============================================================
-- FLIGHT SERVICE DB
-- ============================================================
CREATE DATABASE IF NOT EXISTS FlightDB;
USE FlightDB;

CREATE TABLE IF NOT EXISTS Flight (
    flightID        INT AUTO_INCREMENT PRIMARY KEY,
    flightNumber    VARCHAR(10) NOT NULL,
    airline         VARCHAR(100) NOT NULL,
    origin          VARCHAR(5) NOT NULL,   -- IATA code e.g. SIN
    destination     VARCHAR(5) NOT NULL,   -- IATA code e.g. NRT
    originCity      VARCHAR(100) NOT NULL,
    destinationCity VARCHAR(100) NOT NULL,
    departureTime   DATETIME NOT NULL,
    arrivalTime     DATETIME NOT NULL,
    durationMins    INT NOT NULL,
    economyPrice    DECIMAL(10,2) NOT NULL,
    businessPrice   DECIMAL(10,2) NOT NULL,
    totalSeats      INT NOT NULL DEFAULT 180,
    availableSeats  INT NOT NULL DEFAULT 180,
    status          VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',  -- SCHEDULED, CANCELLED, DELAYED
    imageUrl        VARCHAR(255) DEFAULT 'https://picsum.photos/seed/flight/400/200'
);

-- Singapore → Tokyo
INSERT INTO Flight (flightNumber, airline, origin, destination, originCity, destinationCity, departureTime, arrivalTime, durationMins, economyPrice, businessPrice, totalSeats, availableSeats) VALUES
('SQ634',  'Singapore Airlines', 'SIN', 'NRT', 'Singapore', 'Tokyo',   '2025-06-01 08:00:00', '2025-06-01 15:30:00', 390, 450.00,  1200.00, 180, 120),
('SQ636',  'Singapore Airlines', 'SIN', 'NRT', 'Singapore', 'Tokyo',   '2025-06-01 22:00:00', '2025-06-02 05:30:00', 390, 420.00,  1100.00, 180, 95),
('TR808',  'Scoot',              'SIN', 'NRT', 'Singapore', 'Tokyo',   '2025-06-01 06:00:00', '2025-06-01 14:00:00', 480, 280.00,  NULL,    180, 150),
('3K521',  'Jetstar Asia',       'SIN', 'NRT', 'Singapore', 'Tokyo',   '2025-06-01 09:30:00', '2025-06-01 17:45:00', 495, 260.00,  NULL,    180, 80),

-- Singapore → Bangkok
('SQ706',  'Singapore Airlines', 'SIN', 'BKK', 'Singapore', 'Bangkok', '2025-06-01 07:00:00', '2025-06-01 08:30:00', 90,  180.00,  520.00,  180, 140),
('SQ708',  'Singapore Airlines', 'SIN', 'BKK', 'Singapore', 'Bangkok', '2025-06-01 14:00:00', '2025-06-01 15:30:00', 90,  170.00,  500.00,  180, 100),
('TR862',  'Scoot',              'SIN', 'BKK', 'Singapore', 'Bangkok', '2025-06-01 10:00:00', '2025-06-01 11:40:00', 100, 99.00,   NULL,    180, 160),

-- Singapore → London
('SQ322',  'Singapore Airlines', 'SIN', 'LHR', 'Singapore', 'London',  '2025-06-01 23:55:00', '2025-06-02 06:00:00', 725, 980.00,  3200.00, 300, 200),
('SQ306',  'Singapore Airlines', 'SIN', 'LHR', 'Singapore', 'London',  '2025-06-01 09:00:00', '2025-06-01 15:30:00', 750, 950.00,  3100.00, 300, 180),

-- Singapore → Sydney
('SQ221',  'Singapore Airlines', 'SIN', 'SYD', 'Singapore', 'Sydney',  '2025-06-01 08:30:00', '2025-06-01 19:30:00', 480, 520.00,  1400.00, 250, 170),
('TR8',    'Scoot',              'SIN', 'SYD', 'Singapore', 'Sydney',  '2025-06-01 07:00:00', '2025-06-01 17:45:00', 465, 320.00,  NULL,    250, 200),

-- Singapore → Bali
('SQ944',  'Singapore Airlines', 'SIN', 'DPS', 'Singapore', 'Bali',    '2025-06-01 08:00:00', '2025-06-01 09:30:00', 90,  160.00,  480.00,  180, 130),
('TR282',  'Scoot',              'SIN', 'DPS', 'Singapore', 'Bali',    '2025-06-01 06:30:00', '2025-06-01 08:10:00', 100, 89.00,   NULL,    180, 155),

-- Return flights Tokyo → Singapore
('SQ635',  'Singapore Airlines', 'NRT', 'SIN', 'Tokyo',     'Singapore', '2025-06-08 17:00:00', '2025-06-08 23:00:00', 360, 450.00, 1200.00, 180, 110),
('TR809',  'Scoot',              'NRT', 'SIN', 'Tokyo',     'Singapore', '2025-06-08 15:00:00', '2025-06-08 21:30:00', 390, 280.00, NULL,    180, 140),

-- Return flights Bangkok → Singapore
('SQ707',  'Singapore Airlines', 'BKK', 'SIN', 'Bangkok',   'Singapore', '2025-06-05 10:00:00', '2025-06-05 13:30:00', 90,  180.00, 520.00,  180, 120),
('TR863',  'Scoot',              'BKK', 'SIN', 'Bangkok',   'Singapore', '2025-06-05 14:00:00', '2025-06-05 15:40:00', 100, 99.00,  NULL,    180, 150);


-- ============================================================
-- HOTEL SERVICE DB
-- ============================================================
CREATE DATABASE IF NOT EXISTS HotelDB;
USE HotelDB;

CREATE TABLE IF NOT EXISTS Hotel (
    hotelID         INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    city            VARCHAR(100) NOT NULL,
    country         VARCHAR(100) NOT NULL,
    address         VARCHAR(255) NOT NULL,
    starRating      INT NOT NULL,
    description     TEXT,
    imageUrl        VARCHAR(255) DEFAULT 'https://picsum.photos/seed/hotel/400/300',
    amenities       VARCHAR(255)  -- comma separated: WiFi, Pool, Gym, Spa
);

CREATE TABLE IF NOT EXISTS RoomType (
    roomTypeID      INT AUTO_INCREMENT PRIMARY KEY,
    hotelID         INT NOT NULL,
    typeName        VARCHAR(100) NOT NULL,  -- Standard, Deluxe, Suite
    pricePerNight   DECIMAL(10,2) NOT NULL,
    maxGuests       INT NOT NULL DEFAULT 2,
    totalRooms      INT NOT NULL DEFAULT 20,
    availableRooms  INT NOT NULL DEFAULT 20,
    description     VARCHAR(255),
    imageUrl        VARCHAR(255) DEFAULT 'https://picsum.photos/seed/room/400/300',
    FOREIGN KEY (hotelID) REFERENCES Hotel(hotelID)
);

-- Tokyo Hotels
INSERT INTO Hotel (name, city, country, address, starRating, description, imageUrl, amenities) VALUES
('The Grand Tokyo',        'Tokyo', 'Japan', '1-1 Marunouchi, Chiyoda, Tokyo',          5, 'Luxury hotel in the heart of Tokyo with stunning city views.', 'https://picsum.photos/seed/tokyogrand/400/300',   'WiFi,Pool,Gym,Spa,Restaurant'),
('Shinjuku Heritage Hotel','Tokyo', 'Japan', '2-5 Kabukicho, Shinjuku, Tokyo',           4, 'Modern hotel steps from Shinjuku station and entertainment district.', 'https://picsum.photos/seed/shinjuku/400/300', 'WiFi,Gym,Restaurant,Bar'),
('Asakusa Inn',            'Tokyo', 'Japan', '2-3-1 Asakusa, Taito, Tokyo',              3, 'Cosy budget hotel near Senso-ji Temple and traditional markets.', 'https://picsum.photos/seed/asakusa/400/300',   'WiFi,Restaurant');

-- Bangkok Hotels
INSERT INTO Hotel (name, city, country, address, starRating, description, imageUrl, amenities) VALUES
('Siam Heritage Bangkok',  'Bangkok', 'Thailand', '115 Surawong Road, Silom, Bangkok',   5, 'Elegant riverside hotel blending Thai heritage with modern luxury.', 'https://picsum.photos/seed/siambkk/400/300',  'WiFi,Pool,Spa,Gym,Restaurant'),
('Sukhumvit Suites',       'Bangkok', 'Thailand', '23 Sukhumvit Soi 11, Bangkok',         4, 'Contemporary hotel in Bangkok vibrant nightlife and shopping district.', 'https://picsum.photos/seed/sukhumvit/400/300','WiFi,Pool,Gym,Bar'),
('Bangkok Budget Stay',    'Bangkok', 'Thailand', '88 Khao San Road, Banglamphu, Bangkok',3, 'Affordable hotel on the famous Khao San Road backpacker hub.', 'https://picsum.photos/seed/khaosan/400/300',   'WiFi,Restaurant');

-- London Hotels
INSERT INTO Hotel (name, city, country, address, starRating, description, imageUrl, amenities) VALUES
('The Royal Kensington',   'London',  'UK',      '101 Kensington High St, London',        5, 'Classic London luxury hotel near Hyde Park and museums.', 'https://picsum.photos/seed/kensington/400/300',  'WiFi,Spa,Gym,Restaurant,Bar'),
('Covent Garden Boutique', 'London',  'UK',      '10 Long Acre, Covent Garden, London',   4, 'Stylish boutique hotel in the heart of London theatre district.', 'https://picsum.photos/seed/coventgarden/400/300','WiFi,Gym,Restaurant'),
('Paddington Central',     'London',  'UK',      '45 London Street, Paddington, London',  3, 'Convenient hotel near Paddington station with easy Heathrow access.', 'https://picsum.photos/seed/paddington/400/300', 'WiFi,Restaurant');

-- Sydney Hotels
INSERT INTO Hotel (name, city, country, address, starRating, description, imageUrl, amenities) VALUES
('Harbour View Sydney',    'Sydney',  'Australia','93 Macquarie Street, Sydney CBD',       5, 'Iconic hotel with unbeatable views of Sydney Harbour Bridge and Opera House.', 'https://picsum.photos/seed/sydneyharbour/400/300','WiFi,Pool,Spa,Gym,Restaurant'),
('Surry Hills Boutique',   'Sydney',  'Australia','245 Crown Street, Surry Hills, Sydney', 4, 'Trendy boutique hotel in Sydney creative and dining neighbourhood.', 'https://picsum.photos/seed/surryhills/400/300', 'WiFi,Gym,Bar,Restaurant'),
('Central Station Hotel',  'Sydney',  'Australia','2 Lee Street, Haymarket, Sydney',       3, 'Budget-friendly hotel directly above Central Station.', 'https://picsum.photos/seed/sydcentral/400/300',  'WiFi,Restaurant');

-- Bali Hotels
INSERT INTO Hotel (name, city, country, address, starRating, description, imageUrl, amenities) VALUES
('Seminyak Beach Resort',  'Bali',    'Indonesia','Jl. Kayu Aya, Seminyak, Bali',         5, 'Stunning beachfront resort with private pool villas and sunset views.', 'https://picsum.photos/seed/seminyak/400/300',  'WiFi,Pool,Spa,Gym,Restaurant,Bar'),
('Ubud Jungle Retreat',    'Bali',    'Indonesia','Jl. Raya Ubud, Ubud, Bali',            4, 'Serene retreat surrounded by rice terraces and jungle in cultural Ubud.', 'https://picsum.photos/seed/ubud/400/300',     'WiFi,Pool,Spa,Restaurant'),
('Kuta Budget Inn',        'Bali',    'Indonesia','Jl. Legian, Kuta, Bali',               3, 'Affordable stay steps from Kuta beach and nightlife.', 'https://picsum.photos/seed/kuta/400/300',        'WiFi,Pool,Restaurant');

-- Singapore Hotels
INSERT INTO Hotel (name, city, country, address, starRating, description, imageUrl, amenities) VALUES
('Marina Bay Skylines Hotel', 'Singapore', 'Singapore', '8 Bayfront Ave, Marina Bay, Singapore', 5, 'Modern skyline hotel with rooftop views over Marina Bay.', 'https://picsum.photos/seed/marinabay/400/300', 'WiFi,Pool,Spa,Gym,Restaurant,Bar'),
('Orchard Blossom Boutique', 'Singapore', 'Singapore', '33 Orchard Rd, Singapore 238830',     4, 'Boutique hotel near Orchard shopping with calm, curated interiors.', 'https://picsum.photos/seed/orchardblossom/400/300', 'WiFi,Gym,Restaurant,Bar'),
('Little Lion City Stay',    'Singapore', 'Singapore', '12 Telok Ayer St, Singapore',          3, 'Comfortable city stay in the heart of dining and nightlife.', 'https://picsum.photos/seed/telokayer/400/300', 'WiFi,Restaurant');

-- Paris Hotels (France)
INSERT INTO Hotel (name, city, country, address, starRating, description, imageUrl, amenities) VALUES
('Le Grand Paris Maison',    'Paris', 'France', '15 Rue de Rivoli, 75001 Paris',        5, 'Classic Parisian luxury hotel with timeless decor.', 'https://picsum.photos/seed/rivoli/400/300', 'WiFi,Pool,Spa,Gym,Restaurant,Bar'),
('Montmartre View Hotel',    'Paris', 'France', '88 Rue Lepic, 75018 Paris',           4, 'Charming hotel with views toward Montmartre and Sacre-Coeur.', 'https://picsum.photos/seed/montmartre/400/300', 'WiFi,Gym,Restaurant'),
('Latin Quarter Budget Inn', 'Paris', 'France', '7 Rue Monge, 75005 Paris',            3, 'Budget-friendly base near museums and cafes.', 'https://picsum.photos/seed/latinquarter/400/300', 'WiFi,Restaurant');

-- Room Types for Tokyo Hotels (hotelID 1, 2, 3)
INSERT INTO RoomType (hotelID, typeName, pricePerNight, maxGuests, totalRooms, availableRooms, description, imageUrl) VALUES
(1, 'Standard',  280.00, 2, 50, 30, 'Comfortable room with city view and king bed.',          'https://picsum.photos/seed/room1std/400/300'),
(1, 'Deluxe',    420.00, 2, 30, 18, 'Spacious deluxe room with panoramic Tokyo skyline view.','https://picsum.photos/seed/room1dlx/400/300'),
(1, 'Suite',     850.00, 3, 10,  5, 'Luxurious suite with separate living area and jacuzzi.', 'https://picsum.photos/seed/room1ste/400/300'),
(2, 'Standard',  150.00, 2, 60, 40, 'Modern standard room near Shinjuku entertainment.',      'https://picsum.photos/seed/room2std/400/300'),
(2, 'Deluxe',    220.00, 2, 30, 20, 'Deluxe room with upgraded amenities and city view.',     'https://picsum.photos/seed/room2dlx/400/300'),
(3, 'Standard',   90.00, 2, 40, 35, 'Clean comfortable room near Asakusa temple.',            'https://picsum.photos/seed/room3std/400/300'),
(3, 'Deluxe',    130.00, 2, 20, 15, 'Deluxe room with traditional Japanese decor.',           'https://picsum.photos/seed/room3dlx/400/300');

-- Room Types for Bangkok Hotels (hotelID 4, 5, 6)
INSERT INTO RoomType (hotelID, typeName, pricePerNight, maxGuests, totalRooms, availableRooms, description, imageUrl) VALUES
(4, 'Standard',  200.00, 2, 50, 35, 'Elegant room with Thai-inspired decor.',                 'https://picsum.photos/seed/room4std/400/300'),
(4, 'Deluxe',    320.00, 2, 30, 20, 'Deluxe riverside room with stunning Chao Phraya views.', 'https://picsum.photos/seed/room4dlx/400/300'),
(4, 'Suite',     680.00, 3,  8,  4, 'Presidential suite with private terrace and butler.',    'https://picsum.photos/seed/room4ste/400/300'),
(5, 'Standard',  110.00, 2, 60, 45, 'Contemporary room in heart of Sukhumvit.',               'https://picsum.photos/seed/room5std/400/300'),
(5, 'Deluxe',    160.00, 2, 30, 22, 'Deluxe room with pool view and balcony.',                'https://picsum.photos/seed/room5dlx/400/300'),
(6, 'Standard',   55.00, 2, 40, 38, 'Budget room on famous Khao San Road.',                   'https://picsum.photos/seed/room6std/400/300');

-- Room Types for London Hotels (hotelID 7, 8, 9)
INSERT INTO RoomType (hotelID, typeName, pricePerNight, maxGuests, totalRooms, availableRooms, description, imageUrl) VALUES
(7, 'Standard',  350.00, 2, 40, 25, 'Classic London luxury room near Hyde Park.',             'https://picsum.photos/seed/room7std/400/300'),
(7, 'Deluxe',    520.00, 2, 25, 15, 'Spacious deluxe room with park views.',                  'https://picsum.photos/seed/room7dlx/400/300'),
(7, 'Suite',    1200.00, 3,  8,  3, 'Grand suite with separate lounge and butler service.',   'https://picsum.photos/seed/room7ste/400/300'),
(8, 'Standard',  220.00, 2, 30, 20, 'Boutique styled room in Covent Garden.',                 'https://picsum.photos/seed/room8std/400/300'),
(8, 'Deluxe',    320.00, 2, 20, 12, 'Superior room with West End theatre district views.',    'https://picsum.photos/seed/room8dlx/400/300'),
(9, 'Standard',  130.00, 2, 50, 40, 'Comfortable room steps from Paddington station.',        'https://picsum.photos/seed/room9std/400/300');

-- Room Types for Sydney Hotels (hotelID 10, 11, 12)
INSERT INTO RoomType (hotelID, typeName, pricePerNight, maxGuests, totalRooms, availableRooms, description, imageUrl) VALUES
(10, 'Standard',  280.00, 2, 50, 30, 'Harbour view room with Opera House glimpse.',           'https://picsum.photos/seed/room10std/400/300'),
(10, 'Deluxe',    420.00, 2, 30, 18, 'Deluxe room with full harbour bridge view.',            'https://picsum.photos/seed/room10dlx/400/300'),
(10, 'Suite',     900.00, 3, 10,  5, 'Penthouse suite with 270 degree harbour panorama.',     'https://picsum.photos/seed/room10ste/400/300'),
(11, 'Standard',  160.00, 2, 30, 22, 'Stylish room in trendy Surry Hills neighbourhood.',    'https://picsum.photos/seed/room11std/400/300'),
(11, 'Deluxe',    230.00, 2, 20, 14, 'Superior room with rooftop terrace access.',            'https://picsum.photos/seed/room11dlx/400/300'),
(12, 'Standard',   95.00, 2, 50, 42, 'Budget friendly room above Central Station.',          'https://picsum.photos/seed/room12std/400/300');

-- Room Types for Bali Hotels (hotelID 13, 14, 15)
INSERT INTO RoomType (hotelID, typeName, pricePerNight, maxGuests, totalRooms, availableRooms, description, imageUrl) VALUES
(13, 'Standard',  180.00, 2, 30, 20, 'Beachfront standard room with ocean view.',             'https://picsum.photos/seed/room13std/400/300'),
(13, 'Deluxe',    280.00, 2, 20, 12, 'Pool villa with direct beach access.',                  'https://picsum.photos/seed/room13dlx/400/300'),
(13, 'Suite',     580.00, 3,  8,  4, 'Private pool villa with outdoor shower and butler.',    'https://picsum.photos/seed/room13ste/400/300'),
(14, 'Standard',  120.00, 2, 25, 18, 'Jungle view room with rice terrace scenery.',           'https://picsum.photos/seed/room14std/400/300'),
(14, 'Deluxe',    180.00, 2, 15, 10, 'Private villa with plunge pool and jungle view.',       'https://picsum.photos/seed/room14dlx/400/300'),
(15, 'Standard',   60.00, 2, 40, 35, 'Budget room steps from Kuta beach.',                   'https://picsum.photos/seed/room15std/400/300');

-- Room Types for Singapore Hotels (hotelID 16, 17, 18)
INSERT INTO RoomType (hotelID, typeName, pricePerNight, maxGuests, totalRooms, availableRooms, description, imageUrl) VALUES
(16, 'Standard',  260.00, 2, 40, 18, 'Standard room with city view near Marina Bay.',                'https://picsum.photos/seed/room16std/400/300'),
(16, 'Deluxe',    390.00, 2, 25, 11, 'Deluxe room with skyline views and breakfast included.',     'https://picsum.photos/seed/room16dlx/400/300'),
(16, 'Suite',     820.00, 3,  8,  3, 'Suite with separate lounge and panoramic windows.',         'https://picsum.photos/seed/room16ste/400/300'),

(17, 'Standard',  170.00, 2, 35, 20, 'Boutique standard room with Orchard-inspired decor.',          'https://picsum.photos/seed/room17std/400/300'),
(17, 'Deluxe',    240.00, 2, 20, 12, 'Deluxe room with upgraded amenities and breakfast included.', 'https://picsum.photos/seed/room17dlx/400/300'),

(18, 'Standard',  120.00, 2, 45, 30, 'Budget-friendly city stay with cozy interiors.',               'https://picsum.photos/seed/room18std/400/300'),
(18, 'Deluxe',    160.00, 2, 25, 14, 'Comfortable deluxe room with breakfast included.',            'https://picsum.photos/seed/room18dlx/400/300');

-- Room Types for Paris Hotels (hotelID 19, 20, 21)
INSERT INTO RoomType (hotelID, typeName, pricePerNight, maxGuests, totalRooms, availableRooms, description, imageUrl) VALUES
(19, 'Standard',  320.00, 2, 35, 16, 'Classic standard room with Paris street views.',                'https://picsum.photos/seed/room19std/400/300'),
(19, 'Deluxe',    480.00, 2, 20,  9, 'Deluxe room with breakfast included and elegant styling.',    'https://picsum.photos/seed/room19dlx/400/300'),
(19, 'Suite',     980.00, 3,  8,  2, 'Suite with refined living area for longer stays.',             'https://picsum.photos/seed/room19ste/400/300'),

(20, 'Standard',  220.00, 2, 35, 18, 'Standard room near Montmartre with fresh decor.',             'https://picsum.photos/seed/room20std/400/300'),
(20, 'Deluxe',    320.00, 2, 20, 10, 'Deluxe room with breakfast included and terrace access.',    'https://picsum.photos/seed/room20dlx/400/300'),

(21, 'Standard',  110.00, 2, 45, 26, 'Budget standard room near Latin Quarter.',                      'https://picsum.photos/seed/room21std/400/300'),
(21, 'Deluxe',    150.00, 2, 25, 12, 'Value deluxe room with breakfast included.',                 'https://picsum.photos/seed/room21dlx/400/300');


-- ============================================================
-- BOOKING SERVICE DB
-- ============================================================
CREATE DATABASE IF NOT EXISTS BookingDB;
USE BookingDB;

CREATE TABLE IF NOT EXISTS Booking (
    bookingID               INT AUTO_INCREMENT PRIMARY KEY,
    accountID               INT NOT NULL,
    travellerProfileID      INT NOT NULL,
    flightID                INT,               -- NULL if hotel only
    returnFlightID          INT,               -- NULL if one way
    hotelID                 INT,               -- NULL if flight only
    roomTypeID              INT,               -- NULL if flight only
    flightClass             VARCHAR(20),       -- ECONOMY, BUSINESS
    checkInDate             DATE,
    checkOutDate            DATE,
    departureDate           DATE,
    returnDate              DATE,
    numGuests               INT DEFAULT 1,
    flightPrice             DECIMAL(10,2) DEFAULT 0,
    hotelPrice              DECIMAL(10,2) DEFAULT 0,
    discountPercent         DECIMAL(5,2)  DEFAULT 0,
    loyaltyCoinsUsed        INT DEFAULT 0,
    totalAmount             DECIMAL(10,2) NOT NULL,
    loyaltyPointsEarned     INT DEFAULT 0,
    stripePaymentIntentID   VARCHAR(255),
    stripeRefundID          VARCHAR(255),
    status                  VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
    -- CONFIRMED, CANCELLED, REFUND_PENDING, REFUNDED, NO_SHOW
    cancellationReason      TEXT,
    refundAmount            DECIMAL(10,2) DEFAULT 0,
    createdAt               DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt               DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Sample bookings for demo
INSERT INTO Booking (accountID, travellerProfileID, flightID, hotelID, roomTypeID, flightClass, checkInDate, checkOutDate, departureDate, flightPrice, hotelPrice, totalAmount, loyaltyPointsEarned, stripePaymentIntentID, status) VALUES
(1, 1, 1, 1, 1, 'ECONOMY', '2025-06-01', '2025-06-08', '2025-06-01', 450.00, 1960.00, 2410.00, 2410, 'pi_demo_001', 'CONFIRMED'),
(1, 1, 5, 4, 9, 'ECONOMY', '2025-06-15','2025-06-18', '2025-06-15', 180.00,  600.00,  780.00,  780,  'pi_demo_002', 'CONFIRMED'),
(2, 2, 8, 7, 16,'BUSINESS','2025-07-01', '2025-07-07', '2025-07-01', 3200.00,2100.00, 5300.00, 5300, 'pi_demo_003', 'CONFIRMED');


-- ============================================================
-- LOYALTY SERVICE DB
-- ============================================================
CREATE DATABASE IF NOT EXISTS LoyaltyDB;
USE LoyaltyDB;

CREATE TABLE IF NOT EXISTS LoyaltyAccount (
    loyaltyID       INT AUTO_INCREMENT PRIMARY KEY,
    accountID       INT NOT NULL UNIQUE,
    tier            VARCHAR(20) NOT NULL DEFAULT 'BRONZE',  -- BRONZE, SILVER, GOLD, PLATINUM
    totalPoints     INT NOT NULL DEFAULT 0,   -- for tier calculation (1 per $1 spent)
    coinBalance     INT NOT NULL DEFAULT 0,   -- redeemable coins (value depends on tier)
    totalBookings   INT NOT NULL DEFAULT 0,
    createdAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS LoyaltyTransaction (
    transactionID   INT AUTO_INCREMENT PRIMARY KEY,
    loyaltyID       INT NOT NULL,
    bookingID       INT,
    type            VARCHAR(20) NOT NULL,  -- EARN, REDEEM, REFUND_REVERSAL
    points          INT NOT NULL,          -- points earned/deducted
    coins           INT NOT NULL,          -- coins earned/deducted
    description     VARCHAR(255),
    createdAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loyaltyID) REFERENCES LoyaltyAccount(loyaltyID)
);

-- Tier rules reference table (for easy querying in code)
CREATE TABLE IF NOT EXISTS LoyaltyTier (
    tier                VARCHAR(20) PRIMARY KEY,
    minBookings         INT NOT NULL,
    coinValueCents      INT NOT NULL,   -- how many cents 1 coin is worth
    discountPercent     DECIMAL(5,2) NOT NULL
);

INSERT INTO LoyaltyTier (tier, minBookings, coinValueCents, discountPercent) VALUES
('BRONZE',   0,  1, 0.00),
('SILVER',   2,  2, 10.00),
('GOLD',     5,  3, 15.00),
('PLATINUM', 10, 5, 20.00);

-- Sample loyalty accounts
INSERT INTO LoyaltyAccount (accountID, tier, totalPoints, coinBalance, totalBookings) VALUES
(1, 'SILVER',   3190, 3190, 2),
(2, 'BRONZE',   5300, 5300, 1);

-- Sample transactions
INSERT INTO LoyaltyTransaction (loyaltyID, bookingID, type, points, coins, description) VALUES
(1, 1, 'EARN', 2410, 2410, 'Earned from Tokyo bundle booking #1'),
(1, 2, 'EARN',  780,  780, 'Earned from Bangkok booking #2'),
(2, 3, 'EARN', 5300, 5300, 'Earned from London business booking #3');
