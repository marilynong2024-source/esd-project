-- ============================================================
-- TripBooking Project — Database Seed File
-- Run this once to set up all tables and demo data.
-- Includes a large generated appendix (flights, hotels, customers,
-- bookings, loyalty ledger, reservations). Regenerate via:
--   python scripts/generate_init_db_bulk.py > scripts/_bulk_out.sql
-- then merge the tail after the first TravellerProfiles INSERT block.
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
('SQ634',  'Singapore Airlines', 'SIN', 'NRT', 'Singapore', 'Tokyo',   '2026-05-01 08:00:00', '2026-05-01 15:30:00', 390, 688.00,  2180.00, 180, 120),
('SQ636',  'Singapore Airlines', 'SIN', 'NRT', 'Singapore', 'Tokyo',   '2026-05-01 22:00:00', '2026-05-02 05:30:00', 390, 628.00,  1980.00, 180, 95),
('TR808',  'Scoot',              'SIN', 'NRT', 'Singapore', 'Tokyo',   '2026-05-01 06:00:00', '2026-05-01 14:00:00', 480, 348.00,  NULL,    180, 150),
('3K521',  'Jetstar Asia',       'SIN', 'NRT', 'Singapore', 'Tokyo',   '2026-05-01 09:30:00', '2026-05-01 17:45:00', 495, 318.00,  NULL,    180, 80),

-- Singapore → Bangkok
('SQ706',  'Singapore Airlines', 'SIN', 'BKK', 'Singapore', 'Bangkok', '2026-05-01 07:00:00', '2026-05-01 08:30:00', 90,  180.00,  520.00,  180, 140),
('SQ708',  'Singapore Airlines', 'SIN', 'BKK', 'Singapore', 'Bangkok', '2026-05-01 14:00:00', '2026-05-01 15:30:00', 90,  170.00,  500.00,  180, 100),
('TR862',  'Scoot',              'SIN', 'BKK', 'Singapore', 'Bangkok', '2026-05-01 10:00:00', '2026-05-01 11:40:00', 100, 99.00,   NULL,    180, 160),

-- Singapore → London
('SQ322',  'Singapore Airlines', 'SIN', 'LHR', 'Singapore', 'London',  '2026-05-01 23:55:00', '2026-05-02 06:00:00', 725, 980.00,  3200.00, 300, 200),
('SQ306',  'Singapore Airlines', 'SIN', 'LHR', 'Singapore', 'London',  '2026-05-01 09:00:00', '2026-05-01 15:30:00', 750, 950.00,  3100.00, 300, 180),

-- Singapore → Sydney
('SQ221',  'Singapore Airlines', 'SIN', 'SYD', 'Singapore', 'Sydney',  '2026-05-01 08:30:00', '2026-05-01 19:30:00', 480, 520.00,  1400.00, 250, 170),
('TR8',    'Scoot',              'SIN', 'SYD', 'Singapore', 'Sydney',  '2026-05-01 07:00:00', '2026-05-01 17:45:00', 465, 320.00,  NULL,    250, 200),

-- Singapore → Bali
('SQ944',  'Singapore Airlines', 'SIN', 'DPS', 'Singapore', 'Bali',    '2026-05-01 08:00:00', '2026-05-01 09:30:00', 90,  160.00,  480.00,  180, 130),
('TR282',  'Scoot',              'SIN', 'DPS', 'Singapore', 'Bali',    '2026-05-01 06:30:00', '2026-05-01 08:10:00', 100, 89.00,   NULL,    180, 155),

-- Return flights Tokyo → Singapore
('SQ635',  'Singapore Airlines', 'NRT', 'SIN', 'Tokyo',     'Singapore', '2026-05-06 17:00:00', '2026-05-06 23:00:00', 360, 658.00, 2080.00, 180, 110),
('TR809',  'Scoot',              'NRT', 'SIN', 'Tokyo',     'Singapore', '2026-05-06 15:00:00', '2026-05-06 21:30:00', 390, 328.00, NULL,    180, 140),

-- Return flights Bangkok → Singapore
('SQ707',  'Singapore Airlines', 'BKK', 'SIN', 'Bangkok',   'Singapore', '2026-05-06 10:00:00', '2026-05-06 13:30:00', 90,  180.00, 520.00,  180, 120),
('TR863',  'Scoot',              'BKK', 'SIN', 'Bangkok',   'Singapore', '2026-05-06 14:00:00', '2026-05-06 15:40:00', 100, 99.00,  NULL,    180, 150),

-- Extra outbound leisure (broader demo timetable)
('SQ312',  'Singapore Airlines', 'SIN', 'LHR', 'Singapore', 'London',  '2025-06-10 10:15:00', '2025-06-10 16:40:00', 750, 920.00,  3050.00, 300, 175),
('TR991',  'Scoot',              'SIN', 'DPS', 'Singapore', 'Bali',    '2025-06-15 14:20:00', '2025-06-15 15:50:00', 90,  95.00,   NULL,    180, 170),
('SQ415',  'Singapore Airlines', 'SIN', 'SYD', 'Singapore', 'Sydney',  '2025-06-20 09:05:00', '2025-06-20 20:15:00', 480, 540.00,  1420.00, 250, 160),

-- Extra demo diversity (10 additional legs for reports / SQL exercises)
('SQ210',  'Singapore Airlines', 'SIN', 'MNL', 'Singapore', 'Manila',   '2025-07-02 08:40:00', '2025-07-02 12:55:00', 255, 240.00,  720.00,  180, 140),
('PR501',  'Philippine Airlines', 'MNL', 'SIN', 'Manila',   'Singapore', '2025-07-09 18:20:00', '2025-07-09 22:10:00', 230, 230.00,  690.00,  180, 125),
('KE658',  'Korean Air',          'ICN', 'BKK', 'Seoul',    'Bangkok',  '2025-07-03 10:00:00', '2025-07-03 14:30:00', 330, 410.00, 1150.00, 260, 190),
('OZ752',  'Asiana Airlines',     'ICN', 'NRT', 'Seoul',    'Tokyo',    '2025-07-04 19:00:00', '2025-07-04 21:15:00', 135, 280.00,  820.00,  200, 165),
('JL414',  'Japan Airlines',      'NRT', 'CTS', 'Tokyo',    'Sapporo',  '2025-07-05 07:30:00', '2025-07-05 09:25:00', 115, 190.00,  540.00,  180, 120),
('NH217',  'ANA',                 'CTS', 'NRT', 'Sapporo',  'Tokyo',    '2025-07-12 18:00:00', '2025-07-12 19:55:00', 115, 175.00,  510.00,  180, 110),
('QF454',  'Qantas',              'SYD', 'MEL', 'Sydney',   'Melbourne','2025-07-06 06:00:00', '2025-07-06 07:35:00',  95, 155.00,  420.00,  200, 150),
('JQ502',  'Jetstar',             'MEL', 'SYD', 'Melbourne','Sydney',   '2025-07-13 20:15:00', '2025-07-13 21:50:00',  95,  85.00,  240.00,  200, 175),
('KL1004', 'KLM',                 'AMS', 'LHR', 'Amsterdam','London',   '2025-07-07 15:30:00', '2025-07-07 15:55:00',  85, 165.00,  480.00,  180, 95),
('AF1681', 'Air France',          'LHR', 'CDG', 'London',   'Paris',    '2025-07-08 12:00:00', '2025-07-08 14:15:00', 135, 220.00,  620.00,  180, 88);

-- Diagram-aligned seat reservation ledger (FlightDB / slides)
CREATE TABLE IF NOT EXISTS FlightReservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    BookingID INT NOT NULL,
    FlightNum VARCHAR(20) NOT NULL,
    SeatNo VARCHAR(8) NOT NULL,
    Status VARCHAR(20) NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);


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

-- Diagram-aligned hotel hold/confirm ledger (HotelDB / slides)
CREATE TABLE IF NOT EXISTS HotelBookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    BookingID INT NOT NULL,
    HotelID INT NOT NULL,
    RoomType VARCHAR(20) NOT NULL,
    CheckIn DATETIME NOT NULL,
    CheckOut DATETIME NOT NULL,
    NumberOfKeys INT NOT NULL,
    Status VARCHAR(20) NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- CUSTOMER / ACCOUNT DB (slides: CustomerProfile + customer_accounts)
-- ============================================================
CREATE DATABASE IF NOT EXISTS CustomerDB;
USE CustomerDB;

CREATE TABLE IF NOT EXISTS customer_accounts (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(60) NOT NULL,
    last_name VARCHAR(60) NOT NULL,
    phone_number VARCHAR(30),
    date_of_birth DATE,
    nationality VARCHAR(60),
    account_status VARCHAR(20) DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS CustomerProfile (
    customerID INT NOT NULL PRIMARY KEY,
    Nationality VARCHAR(60),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    AccountStatus VARCHAR(20) DEFAULT 'Active',
    CONSTRAINT fk_customer_profile_account FOREIGN KEY (customerID) REFERENCES customer_accounts (customer_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO customer_accounts
    (email, password_hash, first_name, last_name, phone_number, date_of_birth, nationality, account_status)
VALUES
    ('ava.chen@example.com', '$2b$demo_hash_1', 'Ava', 'Chen', '+6591110001', '1995-02-14', 'Singapore', 'Active'),
    ('ben.kumar@example.com', '$2b$demo_hash_2', 'Ben', 'Kumar', '+6591110002', '1991-08-03', 'India', 'Active'),
    ('casey.tan@example.com', '$2b$demo_hash_3', 'Casey', 'Tan', '+6591110003', '1998-12-09', 'Malaysia', 'Active'),
    ('dana.ng@example.com', '$2b$demo_hash_4', 'Dana', 'Ng', '+6591110004', '1993-05-21', 'Singapore', 'Active'),
    ('evan.lee@example.com', '$2b$demo_hash_5', 'Evan', 'Lee', '+6591110005', '1990-11-02', 'Singapore', 'Active'),
    ('fiona.ong@example.com', '$2b$demo_hash_6', 'Fiona', 'Ong', '+6591110006', '1988-03-30', 'Singapore', 'Active');

INSERT INTO CustomerProfile (customerID, Nationality, CreatedAt, AccountStatus)
SELECT customer_id, nationality, created_at, account_status
FROM customer_accounts;


-- ============================================================
-- BOOKING SERVICE DB (Docker Compose: travel_booking — slides: PackageBookings)
-- ============================================================
CREATE DATABASE IF NOT EXISTS travel_booking;
USE travel_booking;

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
    cancellationPolicyID VARCHAR(40) NULL,
    cancellationTimestamp VARCHAR(40) NULL,
    seatNumber VARCHAR(8) NULL,
    travellerProfileId INT NULL,
    travellerDisplayName VARCHAR(128) NULL,
    travellerProfileIdsJson TEXT NULL,
    adultCount INT NOT NULL DEFAULT 1,
    childCount INT NOT NULL DEFAULT 0,
    infantCount INT NOT NULL DEFAULT 0,
    passengerName VARCHAR(200) NULL,
    passengerEmail VARCHAR(255) NULL,
    passengerPhone VARCHAR(40) NULL
);

CREATE TABLE IF NOT EXISTS PackageBookings LIKE bookings;

-- Curated bundles (UI + reporting — aligns with BUNDLE_PRESETS in web app)
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
    ('PKG_BKK', 'Bangkok long weekend', 'Singapore', 'Bangkok', 4, 'Temples & street food', 2),
    ('PKG_BALI', 'Bali beach escape', 'Singapore', 'Bali', 7, 'Resorts & relaxation', 3),
    ('PKG_SYD', 'Sydney harbour', 'Singapore', 'Sydney', 7, 'Harbour & beaches', 4),
    ('PKG_LON', 'London summer', 'Singapore', 'London', 8, 'Museums & theatre', 5),
    ('PKG_LON_PAR', 'Paris art escape', 'London', 'Paris', 5, 'Louvre & cafés', 6),
    ('PKG_PAR_LON', 'London from Paris', 'Paris', 'London', 6, 'West End & markets', 7),
    ('PKG_LON_TYO', 'London to Tokyo', 'London', 'Tokyo', 8, 'Shinjuku & day trips', 8),
    ('PKG_SYD_SIN', 'Sydney to Singapore', 'Sydney', 'Singapore', 7, 'Hawkers & Marina Bay', 9),
    ('PKG_TYO_BKK', 'Tokyo to Bangkok', 'Tokyo', 'Bangkok', 6, 'Two-city foodie hop', 10),
    ('PKG_BKK_DPS', 'Bangkok to Bali', 'Bangkok', 'Bali', 7, 'Temples to surf', 11);

-- Member demo bookings: flightID matches FlightDB.flightNumber; hotelID matches destination city in HotelDB.
INSERT INTO bookings (
    customerID, flightID, hotelID, hotelRoomType, hotelIncludesBreakfast,
    departureTime, totalPrice, currency, fareType, loyaltyTier,
    status, refundPercentage, refundAmount,
    seatNumber, travellerProfileId, travellerDisplayName, travellerProfileIdsJson,
    passengerName, passengerEmail, passengerPhone, noOfRooms
) VALUES
    (1, 'SQ634', 1, 'DLX', 1,
     '2026-05-01T08:00:00', 2680.00, 'SGD', 'Flexi', 'Gold',
     'CONFIRMED', NULL, NULL, '12A', 1, 'Ava Chen', NULL,
     'Ava Chen', 'ava.chen@example.com', '+6591110001', 1),
    (1, 'SQ706', 4, 'STD', 0,
     '2026-06-12T11:30:00', 1120.00, 'SGD', 'Saver', 'Gold',
     'CONFIRMED', NULL, NULL, '18C', 1, 'Ava Chen', NULL,
     'Ava Chen', 'ava.chen@example.com', '+6591110001', 1),
    (1, 'TR862', 5, 'DLX', 0,
     '2026-08-03T10:00:00', 890.00, 'SGD', 'Standard', 'Gold',
     'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
     'Ava Chen', 'ava.chen@example.com', '+6591110001', 1),
    (2, 'SQ322', 7, 'STD', 0,
     '2026-05-18T09:00:00', 4850.00, 'SGD', 'Standard', 'Silver',
     'CONFIRMED', NULL, NULL, '4K', NULL, NULL, NULL,
     'Ben Kumar', 'ben.kumar@example.com', '+6591110002', 1),
    (2, 'SQ221', 10, 'DLX', 1,
     '2026-07-22T08:30:00', 3320.00, 'SGD', 'Flexi', 'Silver',
     'CONFIRMED', NULL, NULL, NULL, 2, 'Ben Kumar', NULL,
     'Ben Kumar', 'ben.kumar@example.com', '+6591110002', 1),
    (2, 'SQ635', 16, 'STD', 0,
     '2026-09-05T17:00:00', 2100.00, 'SGD', 'Saver', 'Silver',
     'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
     'Ben Kumar', 'ben.kumar@example.com', '+6591110002', 1),
    (3, 'SQ944', 13, 'STD', 0,
     '2026-04-25T08:00:00', 920.00, 'SGD', 'Saver', NULL,
     'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
     'Casey Tan', 'casey.tan@example.com', '+6591110003', 1),
    (3, 'TR282', 15, 'STD', 0,
     '2026-06-08T06:30:00', 710.00, 'SGD', 'Saver', NULL,
     'CANCELLED', 50, 355.00, NULL, NULL, NULL, NULL,
     'Casey Tan', 'casey.tan@example.com', '+6591110003', 1),
    (3, 'SQ636', 2, 'DLX', 1,
     '2026-10-01T22:00:00', 2550.00, 'SGD', 'Flexi', NULL,
     'PENDING', NULL, NULL, NULL, NULL, NULL, NULL,
     'Casey Tan', 'casey.tan@example.com', '+6591110003', 1),
    (4, 'SQ708', 6, 'STD', 0,
     '2026-05-04T14:00:00', 1050.00, 'SGD', 'Standard', 'Silver',
     'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
     'Dana Ng', 'dana.ng@example.com', '+6591110004', 1),
    (4, 'SQ707', 17, 'DLX', 0,
     '2026-08-20T10:00:00', 1180.00, 'SGD', 'Saver', 'Silver',
     'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
     'Dana Ng', 'dana.ng@example.com', '+6591110004', 1),
    (4, 'SQ306', 8, 'STD', 1,
     '2026-11-12T09:00:00', 5100.00, 'SGD', 'Flexi', 'Silver',
     'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
     'Dana Ng', 'dana.ng@example.com', '+6591110004', 1),
    (5, 'TR808', 3, 'STD', 0,
     '2026-05-01T06:00:00', 1380.00, 'SGD', 'Saver', 'Bronze',
     'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
     'Evan Lee', 'evan.lee@example.com', '+6591110005', 1),
    (5, '3K521', 1, 'DLX', 0,
     '2026-09-18T09:30:00', 1620.00, 'SGD', 'Standard', 'Bronze',
     'PENDING', NULL, NULL, NULL, NULL, NULL, NULL,
     'Evan Lee', 'evan.lee@example.com', '+6591110005', 1),
    (6, 'SQ312', 7, 'SUITE', 1,
     '2026-06-10T10:15:00', 6200.00, 'SGD', 'Flexi', 'Platinum',
     'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
     'Fiona Ong', 'fiona.ong@example.com', '+6591110006', 1),
    (6, 'AF1681', 19, 'STD', 0,
     '2026-07-08T12:00:00', 980.00, 'SGD', 'Standard', 'Platinum',
     'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
     'Fiona Ong', 'fiona.ong@example.com', '+6591110006', 1),
    (6, 'TR8', 11, 'DLX', 0,
     '2026-12-01T07:00:00', 1980.00, 'SGD', 'Saver', 'Platinum',
     'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL,
     'Fiona Ong', 'fiona.ong@example.com', '+6591110006', 1);


-- ============================================================
-- LOYALTY SERVICE DB
-- ============================================================
CREATE DATABASE IF NOT EXISTS LoyaltyDB;
USE LoyaltyDB;

CREATE TABLE IF NOT EXISTS LoyaltyAccounts (
    ID              INT AUTO_INCREMENT PRIMARY KEY,
    CustomerID      INT NOT NULL UNIQUE,
    PointsBalance   INT NOT NULL DEFAULT 0,
    TierLevel       VARCHAR(20) NOT NULL DEFAULT 'Bronze',
    UpdatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS LoyaltyTransactions (
    ID              INT AUTO_INCREMENT PRIMARY KEY,
    CustomerID      INT NOT NULL,
    BookingID       INT NULL,
    PointsChanged   INT NOT NULL DEFAULT 0,
    TransactionDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    Reason          VARCHAR(255)
);

INSERT INTO LoyaltyAccounts (CustomerID, PointsBalance, TierLevel) VALUES
(1, 11200, 'Silver'),
(2, 8600, 'Silver'),
(3, 18400, 'Gold'),
(4, 5200, 'Silver'),
(5, 800, 'Bronze'),
(6, 98200, 'Platinum');

INSERT INTO LoyaltyTransactions (CustomerID, BookingID, PointsChanged, Reason) VALUES
(1, 1, 1200, 'Earn after completed booking'),
(1, 2, -500, 'Redeem points for pre-payment discount'),
(2, 4, 1500, 'Earn after completed booking'),
(3, 8, -800, 'Refund reversal after cancellation');


-- ============================================================
-- TRAVELLER PROFILE DB
-- ============================================================
CREATE DATABASE IF NOT EXISTS TravellerDB;
USE TravellerDB;

CREATE TABLE IF NOT EXISTS TravellerProfiles (
    ID              INT AUTO_INCREMENT PRIMARY KEY,
    CustomerID      INT NOT NULL,
    FullName        VARCHAR(120) NOT NULL,
    PassportNumber  VARCHAR(40) NOT NULL,
    Nationality     VARCHAR(60),
    DateOfBirth     DATE,
    MealPreference  VARCHAR(40) DEFAULT 'None',
    CreatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_traveller_passport (PassportNumber),
    CONSTRAINT fk_travellerprofiles_customer
      FOREIGN KEY (CustomerID) REFERENCES CustomerDB.customer_accounts(customer_id)
      ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO TravellerProfiles
    (CustomerID, FullName, PassportNumber, Nationality, DateOfBirth, MealPreference)
VALUES
    (1, 'Ava Chen', 'E1234567A', 'Singapore', '1995-02-14', 'Vegetarian'),
    (1, 'Liam Chen', 'E7654321B', 'Singapore', '1992-07-11', 'None'),
    (2, 'Ben Kumar', 'K9988776C', 'India', '1991-08-03', 'Halal');

-- BULK DEMO DATA (see scripts/generate_init_db_bulk.py to regenerate)
-- ========== BULK SEED (generated) ==========
USE FlightDB;
INSERT INTO Flight (flightNumber, airline, origin, destination, originCity, destinationCity, departureTime, arrivalTime, durationMins, economyPrice, businessPrice, totalSeats, availableSeats) VALUES
('CX100', 'Cathay Pacific', 'AKL', 'SYD', 'Auckland', 'Sydney', '2025-09-01 08:00:00', '2025-09-01 11:01:00', 200, 188.00, 658.88, 200, 172),
('CX117', 'Cathay Pacific', 'SIN', 'DXB', 'Singapore', 'Dubai', '2025-09-02 11:00:00', '2025-09-02 18:23:00', 420, 520.00, 2096.08, 180, 105),
('TR134', 'Scoot', 'SIN', 'CGK', 'Singapore', 'Jakarta', '2025-09-03 14:00:00', '2025-09-03 15:31:00', 110, 125.00, 364.87, 200, 136),
('SQ151', 'Singapore Airlines', 'SYD', 'AKL', 'Sydney', 'Auckland', '2025-09-04 17:00:00', '2025-09-04 20:30:00', 195, 195.00, 605.04, 300, 244),
('QF168', 'Qantas', 'CGK', 'SIN', 'Jakarta', 'Singapore', '2025-09-05 20:00:00', '2025-09-05 21:25:00', 105, 118.00, 400.70, 200, 111),
('NH185', 'ANA', 'SIN', 'CGK', 'Singapore', 'Jakarta', '2025-09-06 23:00:00', '2025-09-07 00:47:00', 110, 125.00, 370.06, 250, 237),
('GA202', 'Garuda Indonesia', 'SIN', 'ICN', 'Singapore', 'Seoul', '2025-09-07 09:00:00', '2025-09-07 14:46:00', 360, 380.00, 1013.98, 250, 173),
('TR219', 'Scoot', 'NRT', 'LAX', 'Tokyo', 'Los Angeles', '2025-09-08 12:00:00', '2025-09-08 22:09:00', 600, 890.00, 5934.92, 300, 280),
('JL236', 'Japan Airlines', 'LHR', 'JFK', 'London', 'New York', '2025-09-09 15:00:00', '2025-09-09 23:20:00', 480, 780.00, 5063.26, 250, 177),
('3K253', 'Jetstar Asia', 'SIN', 'FRA', 'Singapore', 'Frankfurt', '2025-09-10 18:00:00', '2025-09-11 06:42:00', 780, 720.00, 3339.66, 250, 240),
('CX270', 'Cathay Pacific', 'SIN', 'ZRH', 'Singapore', 'Zurich', '2025-09-11 21:00:00', '2025-09-12 10:14:00', 790, 730.00, 3169.58, 250, 230),
('TG287', 'Thai Airways', 'MEL', 'SIN', 'Melbourne', 'Singapore', '2025-09-13 00:00:00', '2025-09-13 07:18:00', 445, 400.00, 1141.48, 180, 103),
('KE304', 'Korean Air', 'AKL', 'SYD', 'Auckland', 'Sydney', '2025-09-13 10:00:00', '2025-09-13 13:34:00', 200, 188.00, 657.24, 200, 141),
('QF321', 'Qantas', 'BKK', 'HKT', 'Bangkok', 'Phuket', '2025-09-14 13:00:00', '2025-09-14 14:45:00', 85, 95.00, 316.04, 200, 113),
('TR338', 'Scoot', 'SIN', 'MEL', 'Singapore', 'Melbourne', '2025-09-15 16:00:00', '2025-09-15 23:24:00', 450, 410.00, 1196.95, 250, 199),
('3K355', 'Jetstar Asia', 'NRT', 'LAX', 'Tokyo', 'Los Angeles', '2025-09-16 19:00:00', '2025-09-17 04:53:00', 600, 890.00, 6402.29, 250, 223),
('AA372', 'American Airlines', 'AKL', 'SYD', 'Auckland', 'Sydney', '2025-09-17 22:00:00', '2025-09-18 01:25:00', 200, 188.00, 677.78, 300, 264),
('KA389', 'Cathay Dragon', 'NRT', 'LAX', 'Tokyo', 'Los Angeles', '2025-09-18 08:00:00', '2025-09-18 17:55:00', 600, 890.00, 6193.79, 250, 155),
('MH406', 'Malaysia Airlines', 'JFK', 'LHR', 'New York', 'London', '2025-09-19 11:00:00', '2025-09-19 19:12:00', 475, 760.00, 4742.39, 200, 183),
('AA423', 'American Airlines', 'KUL', 'SIN', 'Kuala Lumpur', 'Singapore', '2025-09-20 14:00:00', '2025-09-20 14:43:00', 58, 85.00, 250.29, 180, 161),
('KE440', 'Korean Air', 'AKL', 'SYD', 'Auckland', 'Sydney', '2025-09-21 17:00:00', '2025-09-21 20:43:00', 200, 188.00, 616.73, 180, 131),
('BA457', 'British Airways', 'BKK', 'HKT', 'Bangkok', 'Phuket', '2025-09-22 20:00:00', '2025-09-22 21:38:00', 85, 95.00, 288.09, 180, 93),
('CX474', 'Cathay Pacific', 'SIN', 'TPE', 'Singapore', 'Taipei', '2025-09-23 23:00:00', '2025-09-24 04:03:00', 280, 310.00, 842.11, 250, 152),
('NH491', 'ANA', 'AKL', 'SYD', 'Auckland', 'Sydney', '2025-09-24 09:00:00', '2025-09-24 12:07:00', 200, 188.00, 599.74, 200, 142),
('QF508', 'Qantas', 'SIN', 'HKG', 'Singapore', 'Hong Kong', '2025-09-25 12:00:00', '2025-09-25 16:02:00', 230, 220.00, 982.34, 180, 100),
('UA525', 'United Airlines', 'LAX', 'NRT', 'Los Angeles', 'Tokyo', '2025-09-26 15:00:00', '2025-09-27 01:23:00', 605, 870.00, 5427.67, 250, 153),
('UA542', 'United Airlines', 'DXB', 'SIN', 'Dubai', 'Singapore', '2025-09-27 18:00:00', '2025-09-28 00:35:00', 415, 500.00, 1988.07, 300, 296),
('TG559', 'Thai Airways', 'ICN', 'SIN', 'Seoul', 'Singapore', '2025-09-28 21:00:00', '2025-09-29 02:54:00', 355, 360.00, 969.72, 200, 128),
('3K576', 'Jetstar Asia', 'SIN', 'ICN', 'Singapore', 'Seoul', '2025-09-30 00:00:00', '2025-09-30 06:11:00', 360, 380.00, 1114.53, 200, 184),
('AA593', 'American Airlines', 'SIN', 'HAN', 'Singapore', 'Hanoi', '2025-09-30 10:00:00', '2025-09-30 13:30:00', 195, 210.00, 565.14, 300, 246),
('OZ610', 'Asiana Airlines', 'LHR', 'JFK', 'London', 'New York', '2025-10-01 13:00:00', '2025-10-01 21:25:00', 480, 780.00, 4744.18, 250, 194),
('BA627', 'British Airways', 'KUL', 'SIN', 'Kuala Lumpur', 'Singapore', '2025-10-02 16:00:00', '2025-10-02 16:45:00', 58, 85.00, 224.90, 180, 137),
('EK644', 'Emirates', 'SIN', 'HKG', 'Singapore', 'Hong Kong', '2025-10-03 19:00:00', '2025-10-03 23:07:00', 230, 220.00, 876.16, 180, 90),
('TR661', 'Scoot', 'AKL', 'SYD', 'Auckland', 'Sydney', '2025-10-04 22:00:00', '2025-10-05 01:14:00', 200, 188.00, 569.90, 180, 138),
('UA678', 'United Airlines', 'SIN', 'ICN', 'Singapore', 'Seoul', '2025-10-05 08:00:00', '2025-10-05 13:55:00', 360, 380.00, 996.26, 300, 246),
('KA695', 'Cathay Dragon', 'LHR', 'JFK', 'London', 'New York', '2025-10-06 11:00:00', '2025-10-06 19:16:00', 480, 780.00, 5019.26, 200, 100),
('MH712', 'Malaysia Airlines', 'SIN', 'KUL', 'Singapore', 'Kuala Lumpur', '2025-10-07 14:00:00', '2025-10-07 14:47:00', 55, 88.00, 225.90, 300, 210),
('MH729', 'Malaysia Airlines', 'SIN', 'CGK', 'Singapore', 'Jakarta', '2025-10-08 17:00:00', '2025-10-08 18:59:00', 110, 125.00, 429.56, 180, 94),
('CX746', 'Cathay Pacific', 'AKL', 'SYD', 'Auckland', 'Sydney', '2025-10-09 20:00:00', '2025-10-09 23:03:00', 200, 188.00, 614.15, 250, 148),
('EK763', 'Emirates', 'ICN', 'SIN', 'Seoul', 'Singapore', '2025-10-10 23:00:00', '2025-10-11 04:47:00', 355, 360.00, 959.09, 300, 265),
('KE780', 'Korean Air', 'SIN', 'CGK', 'Singapore', 'Jakarta', '2025-10-11 09:00:00', '2025-10-11 10:47:00', 110, 125.00, 395.86, 180, 124),
('CX797', 'Cathay Pacific', 'LHR', 'JFK', 'London', 'New York', '2025-10-12 12:00:00', '2025-10-12 19:43:00', 480, 780.00, 5098.23, 180, 169),
('EK814', 'Emirates', 'TPE', 'NRT', 'Taipei', 'Tokyo', '2025-10-13 15:00:00', '2025-10-13 18:05:00', 195, 340.00, 912.66, 300, 246),
('TR831', 'Scoot', 'BKK', 'HKT', 'Bangkok', 'Phuket', '2025-10-14 18:00:00', '2025-10-14 19:15:00', 85, 95.00, 296.25, 300, 233),
('JL848', 'Japan Airlines', 'CGK', 'SIN', 'Jakarta', 'Singapore', '2025-10-15 21:00:00', '2025-10-15 22:52:00', 105, 118.00, 395.73, 300, 261),
('JL865', 'Japan Airlines', 'SIN', 'FRA', 'Singapore', 'Frankfurt', '2025-10-17 00:00:00', '2025-10-17 12:53:00', 780, 720.00, 3548.72, 180, 140),
('TR882', 'Scoot', 'HKG', 'SIN', 'Hong Kong', 'Singapore', '2025-10-17 10:00:00', '2025-10-17 14:12:00', 235, 210.00, 907.54, 200, 193),
('3K899', 'Jetstar Asia', 'KUL', 'SIN', 'Kuala Lumpur', 'Singapore', '2025-10-18 13:00:00', '2025-10-18 13:49:00', 58, 85.00, 215.93, 180, 94),
('GA916', 'Garuda Indonesia', 'SIN', 'ZRH', 'Singapore', 'Zurich', '2025-10-19 16:00:00', '2025-10-20 04:57:00', 790, 730.00, 3634.12, 200, 126),
('TR933', 'Scoot', 'SYD', 'AKL', 'Sydney', 'Auckland', '2025-10-20 19:00:00', '2025-10-20 22:34:00', 195, 195.00, 589.15, 250, 131),
('OZ950', 'Asiana Airlines', 'NRT', 'LAX', 'Tokyo', 'Los Angeles', '2025-10-21 22:00:00', '2025-10-22 08:22:00', 600, 890.00, 6158.08, 200, 167),
('KA967', 'Cathay Dragon', 'BKK', 'HKT', 'Bangkok', 'Phuket', '2025-10-22 08:00:00', '2025-10-22 09:47:00', 85, 95.00, 313.31, 300, 220),
('3K984', 'Jetstar Asia', 'TPE', 'NRT', 'Taipei', 'Tokyo', '2025-10-23 11:00:00', '2025-10-23 13:55:00', 195, 340.00, 922.82, 180, 171),
('OZ1001', 'Asiana Airlines', 'LHR', 'JFK', 'London', 'New York', '2025-10-24 14:00:00', '2025-10-24 22:12:00', 480, 780.00, 4695.81, 250, 138),
('EK1018', 'Emirates', 'SIN', 'ICN', 'Singapore', 'Seoul', '2025-10-25 17:00:00', '2025-10-25 23:03:00', 360, 380.00, 997.70, 300, 161),
('JL1035', 'Japan Airlines', 'DPS', 'PER', 'Bali', 'Perth', '2025-10-26 20:00:00', '2025-10-27 00:19:00', 240, 285.00, 753.67, 180, 95),
('JL1052', 'Japan Airlines', 'LHR', 'JFK', 'London', 'New York', '2025-10-27 23:00:00', '2025-10-28 07:22:00', 480, 780.00, 4527.73, 200, 167),
('CX1069', 'Cathay Pacific', 'ICN', 'SIN', 'Seoul', 'Singapore', '2025-10-28 09:00:00', '2025-10-28 15:10:00', 355, 360.00, 951.58, 250, 173),
('NH1086', 'ANA', 'SIN', 'FRA', 'Singapore', 'Frankfurt', '2025-10-29 12:00:00', '2025-10-30 00:53:00', 780, 720.00, 3357.50, 250, 186),
('QF1103', 'Qantas', 'SIN', 'KUL', 'Singapore', 'Kuala Lumpur', '2025-10-30 15:00:00', '2025-10-30 15:38:00', 55, 88.00, 225.80, 300, 230),
('SQ1120', 'Singapore Airlines', 'HKG', 'SIN', 'Hong Kong', 'Singapore', '2025-10-31 18:00:00', '2025-10-31 21:56:00', 235, 210.00, 964.05, 250, 230),
('BA1137', 'British Airways', 'SIN', 'TPE', 'Singapore', 'Taipei', '2025-11-01 21:00:00', '2025-11-02 01:55:00', 280, 310.00, 812.73, 180, 166),
('KA1154', 'Cathay Dragon', 'SIN', 'ICN', 'Singapore', 'Seoul', '2025-11-03 00:00:00', '2025-11-03 06:14:00', 360, 380.00, 942.93, 250, 176),
('KA1171', 'Cathay Dragon', 'LHR', 'JFK', 'London', 'New York', '2025-11-03 10:00:00', '2025-11-03 18:07:00', 480, 780.00, 4552.54, 250, 204),
('TG1188', 'Thai Airways', 'HKG', 'SIN', 'Hong Kong', 'Singapore', '2025-11-04 13:00:00', '2025-11-04 16:48:00', 235, 210.00, 946.96, 180, 135),
('MH1205', 'Malaysia Airlines', 'TPE', 'NRT', 'Taipei', 'Tokyo', '2025-11-05 16:00:00', '2025-11-05 19:34:00', 195, 340.00, 979.90, 200, 180),
('MH1222', 'Malaysia Airlines', 'DXB', 'SIN', 'Dubai', 'Singapore', '2025-11-06 19:00:00', '2025-11-07 01:36:00', 415, 500.00, 1816.04, 250, 150),
('EK1239', 'Emirates', 'SIN', 'CGK', 'Singapore', 'Jakarta', '2025-11-07 22:00:00', '2025-11-07 23:47:00', 110, 125.00, 370.37, 180, 132),
('AA1256', 'American Airlines', 'HKG', 'SIN', 'Hong Kong', 'Singapore', '2025-11-08 08:00:00', '2025-11-08 11:49:00', 235, 210.00, 854.32, 300, 211),
('EK1273', 'Emirates', 'LAX', 'NRT', 'Los Angeles', 'Tokyo', '2025-11-09 11:00:00', '2025-11-09 20:59:00', 605, 870.00, 5213.87, 200, 149),
('QF1290', 'Qantas', 'SIN', 'MEL', 'Singapore', 'Melbourne', '2025-11-10 14:00:00', '2025-11-10 21:14:00', 450, 410.00, 1231.19, 250, 206),
('UA1307', 'United Airlines', 'AKL', 'SYD', 'Auckland', 'Sydney', '2025-11-11 17:00:00', '2025-11-11 20:25:00', 200, 188.00, 650.70, 250, 130),
('CX1324', 'Cathay Pacific', 'SIN', 'HKG', 'Singapore', 'Hong Kong', '2025-11-12 20:00:00', '2025-11-12 23:46:00', 230, 220.00, 868.00, 250, 246),
('MH1341', 'Malaysia Airlines', 'ICN', 'SIN', 'Seoul', 'Singapore', '2025-11-13 23:00:00', '2025-11-14 04:57:00', 355, 360.00, 1075.37, 250, 195),
('UA1358', 'United Airlines', 'SYD', 'AKL', 'Sydney', 'Auckland', '2025-11-14 09:00:00', '2025-11-14 12:02:00', 195, 195.00, 630.39, 200, 168),
('MH1375', 'Malaysia Airlines', 'HKG', 'SIN', 'Hong Kong', 'Singapore', '2025-11-15 12:00:00', '2025-11-15 15:35:00', 235, 210.00, 915.82, 200, 154),
('3K1392', 'Jetstar Asia', 'SIN', 'CGK', 'Singapore', 'Jakarta', '2025-11-16 15:00:00', '2025-11-16 17:12:00', 110, 125.00, 434.34, 250, 166),
('JL1409', 'Japan Airlines', 'ICN', 'SIN', 'Seoul', 'Singapore', '2025-11-17 18:00:00', '2025-11-18 00:07:00', 355, 360.00, 984.81, 300, 217);

USE HotelDB;
INSERT INTO Hotel (name, city, country, address, starRating, description, imageUrl, amenities) VALUES
('Gangnam Towers Seoul', 'Seoul', 'South Korea', '123 Teheran-ro, Gangnam, Seoul', 5, 'Glass tower suites near COEX and nightlife.', 'https://picsum.photos/seed/h-seoul1/400/300', 'WiFi,Pool,Gym,Spa'),
('Han River Stay', 'Seoul', 'South Korea', '45 Banpo-daero, Seocho, Seoul', 4, 'Riverside rooms with skyline views.', 'https://picsum.photos/seed/h-seoul2/400/300', 'WiFi,Gym,Restaurant'),
('Myeongdong Express Inn', 'Seoul', 'South Korea', '8 Myeongdong 10-gil, Seoul', 3, 'Walk to shopping and metro.', 'https://picsum.photos/seed/h-seoul3/400/300', 'WiFi,Restaurant'),
('Burj District Grand', 'Dubai', 'UAE', 'Sheikh Zayed Road, Downtown Dubai', 5, 'Pool deck with Burj Khalifa glimpses.', 'https://picsum.photos/seed/h-dxb1/400/300', 'WiFi,Pool,Spa,Gym'),
('Deira Creek Hotel', 'Dubai', 'UAE', 'Baniyas Road, Deira', 4, 'Traditional souk access and creek views.', 'https://picsum.photos/seed/h-dxb2/400/300', 'WiFi,Pool,Restaurant'),
('Marina Budget Suites', 'Dubai', 'UAE', 'Dubai Marina Walk', 3, 'Compact studios near beach tram.', 'https://picsum.photos/seed/h-dxb3/400/300', 'WiFi,Gym'),
('Victoria Peak Lodge', 'Hong Kong', 'Hong Kong SAR', '100 Peak Road, Hong Kong', 5, 'Quiet luxury above the harbour mist.', 'https://picsum.photos/seed/h-hkg1/400/300', 'WiFi,Spa,Restaurant,Bar'),
('TST Harbour Inn', 'Hong Kong', 'Hong Kong SAR', '36 Nathan Road, Tsim Sha Tsui', 4, 'Ferry and MTR steps away.', 'https://picsum.photos/seed/h-hkg2/400/300', 'WiFi,Gym,Restaurant'),
('Mong Kok City Hostel', 'Hong Kong', 'Hong Kong SAR', '88 Argyle Street, Mong Kok', 2, 'Bright pods for urban explorers.', 'https://picsum.photos/seed/h-hkg3/400/300', 'WiFi'),
('Raffles Arcade Hotel', 'Singapore', 'Singapore', '1 Beach Road, Singapore', 5, 'Colonial charm meets modern spa.', 'https://picsum.photos/seed/h-sin4/400/300', 'WiFi,Pool,Spa,Bar'),
('Clarke Quay Riverside', 'Singapore', 'Singapore', '3 River Valley Road', 4, 'Nightlife and boat quay on doorstep.', 'https://picsum.photos/seed/h-sin5/400/300', 'WiFi,Pool,Restaurant'),
('Changi Village Lodge', 'Singapore', 'Singapore', '1 Changi Village Rd', 3, 'Near airport connector and coastal park.', 'https://picsum.photos/seed/h-sin6/400/300', 'WiFi,Restaurant');
INSERT INTO RoomType (hotelID, typeName, pricePerNight, maxGuests, totalRooms, availableRooms, description, imageUrl) VALUES
(22, 'Standard', 210, 2, 40, 28, 'Gangnam standard', 'https://picsum.photos/seed/r22a/400/300'),
(22, 'Deluxe', 340, 2, 25, 14, 'Corner deluxe', 'https://picsum.photos/seed/r22b/400/300'),
(23, 'Standard', 160, 2, 55, 40, 'River standard', 'https://picsum.photos/seed/r23a/400/300'),
(23, 'Deluxe', 240, 2, 30, 18, 'River deluxe', 'https://picsum.photos/seed/r23b/400/300'),
(24, 'Standard', 95, 2, 60, 50, 'Compact urban', 'https://picsum.photos/seed/r24a/400/300'),
(25, 'Standard', 420, 2, 35, 22, 'Dubai tower standard', 'https://picsum.photos/seed/r25a/400/300'),
(25, 'Suite', 980, 3, 12, 6, 'Skyline suite', 'https://picsum.photos/seed/r25b/400/300'),
(26, 'Standard', 180, 2, 45, 32, 'Creek view', 'https://picsum.photos/seed/r26a/400/300'),
(27, 'Standard', 120, 2, 80, 65, 'Marina studio', 'https://picsum.photos/seed/r27a/400/300'),
(28, 'Standard', 520, 2, 20, 12, 'Peak standard', 'https://picsum.photos/seed/r28a/400/300'),
(28, 'Deluxe', 780, 2, 12, 7, 'Harbour deluxe', 'https://picsum.photos/seed/r28b/400/300'),
(29, 'Standard', 280, 2, 50, 35, 'TST standard', 'https://picsum.photos/seed/r29a/400/300'),
(30, 'Standard', 75, 2, 100, 88, 'Hostel double', 'https://picsum.photos/seed/r30a/400/300'),
(31, 'Standard', 340, 2, 30, 18, 'Raffles wing', 'https://picsum.photos/seed/r31a/400/300'),
(31, 'Suite', 920, 3, 10, 4, 'Heritage suite', 'https://picsum.photos/seed/r31b/400/300'),
(32, 'Standard', 220, 2, 40, 25, 'Quay standard', 'https://picsum.photos/seed/r32a/400/300'),
(33, 'Standard', 140, 2, 50, 42, 'Airport zone', 'https://picsum.photos/seed/r33a/400/300');

USE CustomerDB;
INSERT INTO customer_accounts (email, password_hash, first_name, last_name, phone_number, date_of_birth, nationality, account_status) VALUES
('grace.ng.7@example.com', '$2b$demo_hash_7', 'Grace', 'Ng', '+65910000007', '1982-08-08', 'USA', 'Active'),
('noah.lim.8@example.com', '$2b$demo_hash_8', 'Noah', 'Lim', '+65910000008', '1983-09-09', 'Australia', 'Active'),
('olivia.wong.9@example.com', '$2b$demo_hash_9', 'Olivia', 'Wong', '+65910000009', '1984-10-10', 'Indonesia', 'Active'),
('liam.tan.10@example.com', '$2b$demo_hash_10', 'Liam', 'Tan', '+65910000010', '1985-11-11', 'India', 'Active'),
('sophia.goh.11@example.com', '$2b$demo_hash_11', 'Sophia', 'Goh', '+65910000011', '1986-12-12', 'Philippines', 'Active'),
('mason.koh.12@example.com', '$2b$demo_hash_12', 'Mason', 'Koh', '+65910000012', '1987-01-13', 'USA', 'Active'),
('emma.ho.13@example.com', '$2b$demo_hash_13', 'Emma', 'Ho', '+65910000013', '1988-02-14', 'USA', 'Active'),
('lucas.teo.14@example.com', '$2b$demo_hash_14', 'Lucas', 'Teo', '+65910000014', '1989-03-15', 'India', 'Active'),
('mia.chan.15@example.com', '$2b$demo_hash_15', 'Mia', 'Chan', '+65910000015', '1990-04-16', 'Australia', 'Active'),
('elijah.lim.16@example.com', '$2b$demo_hash_16', 'Elijah', 'Lim', '+65910000016', '1991-05-17', 'USA', 'Active'),
('harper.cheong.17@example.com', '$2b$demo_hash_17', 'Harper', 'Cheong', '+65910000017', '1992-06-18', 'Indonesia', 'Active'),
('james.bautista.18@example.com', '$2b$demo_hash_18', 'James', 'Bautista', '+65910000018', '1993-07-19', 'Singapore', 'Active'),
('evelyn.reyes.19@example.com', '$2b$demo_hash_19', 'Evelyn', 'Reyes', '+65910000019', '1994-08-20', 'Australia', 'Active'),
('benjamin.santos.20@example.com', '$2b$demo_hash_20', 'Benjamin', 'Santos', '+65910000020', '1995-09-21', 'Australia', 'Active'),
('charlotte.cruz.21@example.com', '$2b$demo_hash_21', 'Charlotte', 'Cruz', '+65910000021', '1996-10-22', 'Philippines', 'Active'),
('henry.flores.22@example.com', '$2b$demo_hash_22', 'Henry', 'Flores', '+65910000022', '1997-11-23', 'USA', 'Active'),
('amelia.murphy.23@example.com', '$2b$demo_hash_23', 'Amelia', 'Murphy', '+65910000023', '1998-12-24', 'UK', 'Active'),
('alexander.walsh.24@example.com', '$2b$demo_hash_24', 'Alexander', 'Walsh', '+65910000024', '1999-01-25', 'Vietnam', 'Active'),
('sofia.o'brien.25@example.com', '$2b$demo_hash_25', 'Sofia', 'O'Brien', '+65910000025', '2000-02-26', 'Vietnam', 'Active'),
('sebastian.jensen.26@example.com', '$2b$demo_hash_26', 'Sebastian', 'Jensen', '+65910000026', '2001-03-27', 'Vietnam', 'Active'),
('chloe.larsen.27@example.com', '$2b$demo_hash_27', 'Chloe', 'Larsen', '+65910000027', '2002-04-28', 'Philippines', 'Active'),
('jack.patel.28@example.com', '$2b$demo_hash_28', 'Jack', 'Patel', '+65910000028', '1975-05-01', 'Indonesia', 'Active'),
('victoria.shah.29@example.com', '$2b$demo_hash_29', 'Victoria', 'Shah', '+65910000029', '1976-06-02', 'Vietnam', 'Active'),
('daniel.khan.30@example.com', '$2b$demo_hash_30', 'Daniel', 'Khan', '+65910000030', '1977-07-03', 'India', 'Active'),
('hannah.ali.31@example.com', '$2b$demo_hash_31', 'Hannah', 'Ali', '+65910000031', '1978-08-04', 'Malaysia', 'Active'),
('grace.russo.32@example.com', '$2b$demo_hash_32', 'Grace', 'Russo', '+65910000032', '1979-09-05', 'Australia', 'Active'),
('noah.costa.33@example.com', '$2b$demo_hash_33', 'Noah', 'Costa', '+65910000033', '1980-10-06', 'Indonesia', 'Active'),
('olivia.silva.34@example.com', '$2b$demo_hash_34', 'Olivia', 'Silva', '+65910000034', '1981-11-07', 'UK', 'Active'),
('liam.ng.35@example.com', '$2b$demo_hash_35', 'Liam', 'Ng', '+65910000035', '1982-12-08', 'Malaysia', 'Active'),
('sophia.lim.36@example.com', '$2b$demo_hash_36', 'Sophia', 'Lim', '+65910000036', '1983-01-09', 'Philippines', 'Active'),
('mason.wong.37@example.com', '$2b$demo_hash_37', 'Mason', 'Wong', '+65910000037', '1984-02-10', 'Australia', 'Active'),
('emma.tan.38@example.com', '$2b$demo_hash_38', 'Emma', 'Tan', '+65910000038', '1985-03-11', 'Philippines', 'Active'),
('lucas.goh.39@example.com', '$2b$demo_hash_39', 'Lucas', 'Goh', '+65910000039', '1986-04-12', 'Philippines', 'Active'),
('mia.koh.40@example.com', '$2b$demo_hash_40', 'Mia', 'Koh', '+65910000040', '1987-05-13', 'India', 'Active'),
('elijah.ho.41@example.com', '$2b$demo_hash_41', 'Elijah', 'Ho', '+65910000041', '1988-06-14', 'Singapore', 'Active'),
('harper.teo.42@example.com', '$2b$demo_hash_42', 'Harper', 'Teo', '+65910000042', '1989-07-15', 'Singapore', 'Active'),
('james.chan.43@example.com', '$2b$demo_hash_43', 'James', 'Chan', '+65910000043', '1990-08-16', 'Philippines', 'Active'),
('evelyn.lim.44@example.com', '$2b$demo_hash_44', 'Evelyn', 'Lim', '+65910000044', '1991-09-17', 'Vietnam', 'Active'),
('benjamin.cheong.45@example.com', '$2b$demo_hash_45', 'Benjamin', 'Cheong', '+65910000045', '1992-10-18', 'Malaysia', 'Active'),
('charlotte.bautista.46@example.com', '$2b$demo_hash_46', 'Charlotte', 'Bautista', '+65910000046', '1993-11-19', 'Vietnam', 'Active'),
('henry.reyes.47@example.com', '$2b$demo_hash_47', 'Henry', 'Reyes', '+65910000047', '1994-12-20', 'USA', 'Active'),
('amelia.santos.48@example.com', '$2b$demo_hash_48', 'Amelia', 'Santos', '+65910000048', '1995-01-21', 'Philippines', 'Active'),
('alexander.cruz.49@example.com', '$2b$demo_hash_49', 'Alexander', 'Cruz', '+65910000049', '1996-02-22', 'USA', 'Active'),
('sofia.flores.50@example.com', '$2b$demo_hash_50', 'Sofia', 'Flores', '+65910000050', '1997-03-23', 'Vietnam', 'Active');
INSERT INTO CustomerProfile (customerID, Nationality, CreatedAt, AccountStatus)
SELECT customer_id, nationality, created_at, account_status FROM customer_accounts WHERE customer_id >= 7;

USE TravellerDB;
INSERT INTO TravellerProfiles (CustomerID, FullName, PassportNumber, Nationality, DateOfBirth, MealPreference) VALUES
(3, 'Liam Chan', 'X0000400K', 'UK', '1990-05-01', 'Vegetarian'),
(3, 'Sophia Cheong', 'X0000401L', 'Malaysia', '1991-06-02', 'Halal'),
(4, 'Sophia Cheong', 'X0000402M', 'Malaysia', '1992-07-03', 'Vegan'),
(4, 'Mason Reyes', 'X0000403N', 'Japan', '1993-08-04', 'Kosher'),
(5, 'Mason Reyes', 'X0000404O', 'Japan', '1994-09-05', 'Gluten-free'),
(5, 'Emma Cruz', 'X0000405P', 'Singapore', '1995-10-06', 'Child meal'),
(6, 'Emma Cruz', 'X0000406Q', 'Australia', '1996-11-07', 'None'),
(6, 'Lucas Murphy', 'X0000407R', 'Australia', '1997-12-08', 'Vegetarian'),
(7, 'Lucas Murphy', 'X0000408S', 'Australia', '1998-01-09', 'Halal'),
(7, 'Mia O'Brien', 'X0000409T', 'Singapore', '1999-02-10', 'Vegan'),
(8, 'Mia O'Brien', 'X0000410U', 'Australia', '2000-03-11', 'Kosher'),
(8, 'Elijah Larsen', 'X0000411V', 'UK', '2001-04-12', 'Gluten-free'),
(9, 'Elijah Larsen', 'X0000412W', 'Malaysia', '2002-05-13', 'Child meal'),
(9, 'Harper Shah', 'X0000413X', 'Malaysia', '2003-06-14', 'None'),
(10, 'Harper Shah', 'X0000414Y', 'Australia', '2004-07-15', 'Vegetarian'),
(10, 'James Ali', 'X0000415Z', 'Japan', '2005-08-16', 'Halal'),
(11, 'James Ali', 'X0000416A', 'USA', '2006-09-17', 'Vegan'),
(11, 'Evelyn Costa', 'X0000417B', 'UK', '2007-10-18', 'Kosher'),
(12, 'Evelyn Costa', 'X0000418C', 'Singapore', '2008-11-19', 'Gluten-free'),
(12, 'Benjamin Ng', 'X0000419D', 'USA', '2009-12-20', 'Child meal'),
(13, 'Benjamin Ng', 'X0000420E', 'Malaysia', '1980-01-21', 'None'),
(13, 'Charlotte Wong', 'X0000421F', 'Australia', '1981-02-22', 'Vegetarian'),
(14, 'Charlotte Wong', 'X0000422G', 'Singapore', '1982-03-23', 'Halal'),
(14, 'Henry Goh', 'X0000423H', 'UK', '1983-04-24', 'Vegan'),
(15, 'Henry Goh', 'X0000424I', 'Malaysia', '1984-05-25', 'Kosher'),
(15, 'Amelia Ho', 'X0000425J', 'Australia', '1985-06-01', 'Gluten-free'),
(16, 'Amelia Ho', 'X0000426K', 'UK', '1986-07-02', 'Child meal'),
(16, 'Alexander Chan', 'X0000427L', 'Japan', '1987-08-03', 'None'),
(17, 'Alexander Chan', 'X0000428M', 'USA', '1988-09-04', 'Vegetarian'),
(17, 'Sofia Cheong', 'X0000429N', 'USA', '1989-10-05', 'Halal'),
(18, 'Sofia Cheong', 'X0000430O', 'USA', '1990-11-06', 'Vegan'),
(18, 'Sebastian Reyes', 'X0000431P', 'India', '1991-12-07', 'Kosher'),
(19, 'Sebastian Reyes', 'X0000432Q', 'Australia', '1992-01-08', 'Gluten-free'),
(19, 'Chloe Cruz', 'X0000433R', 'UK', '1993-02-09', 'Child meal'),
(20, 'Chloe Cruz', 'X0000434S', 'USA', '1994-03-10', 'None'),
(20, 'Jack Murphy', 'X0000435T', 'Australia', '1995-04-11', 'Vegetarian'),
(21, 'Jack Murphy', 'X0000436U', 'Japan', '1996-05-12', 'Halal'),
(22, 'Victoria Walsh', 'X0000437V', 'USA', '1997-06-13', 'Vegan'),
(23, 'Daniel O'Brien', 'X0000438W', 'UK', '1998-07-14', 'Kosher'),
(24, 'Hannah Jensen', 'X0000439X', 'Australia', '1999-08-15', 'Gluten-free'),
(25, 'Grace Larsen', 'X0000440Y', 'USA', '2000-09-16', 'Child meal'),
(26, 'Noah Patel', 'X0000441Z', 'UK', '2001-10-17', 'None'),
(27, 'Olivia Shah', 'X0000442A', 'Malaysia', '2002-11-18', 'Vegetarian'),
(28, 'Liam Khan', 'X0000443B', 'Japan', '2003-12-19', 'Halal'),
(29, 'Sophia Ali', 'X0000444C', 'Australia', '2004-01-20', 'Vegan'),
(30, 'Mason Russo', 'X0000445D', 'UK', '2005-02-21', 'Kosher'),
(31, 'Emma Costa', 'X0000446E', 'UK', '2006-03-22', 'Gluten-free'),
(32, 'Lucas Silva', 'X0000447F', 'India', '2007-04-23', 'Child meal'),
(33, 'Mia Ng', 'X0000448G', 'Australia', '2008-05-24', 'None'),
(34, 'Elijah Lim', 'X0000449H', 'Malaysia', '2009-06-25', 'Vegetarian'),
(35, 'Harper Wong', 'X0000450I', 'Australia', '1980-07-01', 'Halal'),
(36, 'James Tan', 'X0000451J', 'Japan', '1981-08-02', 'Vegan'),
(37, 'Evelyn Goh', 'X0000452K', 'India', '1982-09-03', 'Kosher'),
(38, 'Benjamin Koh', 'X0000453L', 'Australia', '1983-10-04', 'Gluten-free'),
(39, 'Charlotte Ho', 'X0000454M', 'Australia', '1984-11-05', 'Child meal'),
(40, 'Henry Teo', 'X0000455N', 'USA', '1985-12-06', 'None'),
(41, 'Amelia Chan', 'X0000456O', 'UK', '1986-01-07', 'Vegetarian'),
(42, 'Alexander Lim', 'X0000457P', 'Japan', '1987-02-08', 'Halal'),
(43, 'Sofia Cheong', 'X0000458Q', 'Malaysia', '1988-03-09', 'Vegan'),
(44, 'Sebastian Bautista', 'X0000459R', 'India', '1989-04-10', 'Kosher'),
(45, 'Chloe Reyes', 'X0000460S', 'UK', '1990-05-11', 'Gluten-free'),
(46, 'Jack Santos', 'X0000461T', 'Singapore', '1991-06-12', 'Child meal'),
(47, 'Victoria Cruz', 'X0000462U', 'Japan', '1992-07-13', 'None'),
(48, 'Daniel Flores', 'X0000463V', 'India', '1993-08-14', 'Vegetarian'),
(49, 'Hannah Murphy', 'X0000464W', 'Malaysia', '1994-09-15', 'Halal'),
(50, 'Grace Walsh', 'X0000465X', 'India', '1995-10-16', 'Vegan');

USE travel_booking;
INSERT INTO bookings (customerID, flightID, hotelID, hotelRoomType, hotelIncludesBreakfast, departureTime, totalPrice, currency, fareType, loyaltyTier, status, refundPercentage, refundAmount, seatNumber, travellerProfileId, travellerDisplayName, travellerProfileIdsJson, passengerName, passengerEmail, passengerPhone, noOfRooms) VALUES
(5, 'TR808', 5, 'SUITE', 1, '2026-05-05T12:00:00', 800, 'SGD', 'Standard', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 4', 'booker4@example.com', '+6580000004', 1),
(6, 'SQ322', 6, 'STD', 0, '2026-06-06T13:00:00', 850, 'SGD', 'Flexi', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 5', 'booker5@example.com', '+6580000005', 1),
(7, 'SQ221', 7, 'DLX', 0, '2026-07-07T14:00:00', 900, 'SGD', 'Saver', 'Silver', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 6', 'booker6@example.com', '+6580000006', 1),
(8, 'SQ944', 8, 'STD', 0, '2026-08-08T15:00:00', 859, 'SGD', 'Standard', 'Bronze', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 7', 'booker7@example.com', '+6580000007', 1),
(9, 'SQ635', 9, 'DLX', 1, '2026-09-09T16:00:00', 909, 'SGD', 'Flexi', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 8', 'booker8@example.com', '+6580000008', 1),
(10, 'KE658', 10, 'SUITE', 0, '2026-10-10T17:00:00', 959, 'SGD', 'Saver', 'Platinum', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 9', 'booker9@example.com', '+6580000009', 1),
(11, 'JL414', 11, 'STD', 0, '2026-11-11T18:00:00', 1009, 'SGD', 'Standard', 'Silver', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 10', 'booker10@example.com', '+6580000010', 1),
(12, 'NH217', 12, 'DLX', 0, '2026-12-12T19:00:00', 1059, 'SGD', 'Flexi', 'Platinum', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 11', 'booker11@example.com', '+6580000011', 1),
(13, 'QF454', 13, 'STD', 1, '2026-01-13T08:00:00', 1109, 'SGD', 'Saver', NULL, 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 12', 'booker12@example.com', '+6580000012', 1),
(14, 'PR501', 14, 'DLX', 0, '2026-02-14T09:00:00', 1159, 'SGD', 'Standard', NULL, 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 13', 'booker13@example.com', '+6580000013', 1),
(15, 'OZ752', 15, 'SUITE', 0, '2026-03-15T10:00:00', 1118, 'SGD', 'Flexi', 'Platinum', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 14', 'booker14@example.com', '+6580000014', 1),
(16, 'SQ001', 16, 'STD', 0, '2026-04-16T11:00:00', 1168, 'SGD', 'Saver', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 15', 'booker15@example.com', '+6580000015', 1),
(17, 'SQ634', 17, 'DLX', 1, '2026-05-17T12:00:00', 1218, 'SGD', 'Standard', 'Bronze', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 16', 'booker16@example.com', '+6580000016', 1),
(18, 'SQ636', 18, 'STD', 0, '2026-06-18T13:00:00', 1268, 'SGD', 'Flexi', 'Platinum', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 17', 'booker17@example.com', '+6580000017', 1),
(19, 'SQ706', 19, 'DLX', 0, '2026-07-19T14:00:00', 1318, 'SGD', 'Saver', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 18', 'booker18@example.com', '+6580000018', 1),
(20, 'TR808', 20, 'SUITE', 0, '2026-08-20T15:00:00', 1368, 'SGD', 'Standard', 'Silver', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 19', 'booker19@example.com', '+6580000019', 1),
(21, 'SQ322', 21, 'STD', 1, '2026-09-21T16:00:00', 1418, 'SGD', 'Flexi', 'Platinum', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 20', 'booker20@example.com', '+6580000020', 1),
(22, 'SQ221', 22, 'DLX', 0, '2026-10-22T17:00:00', 1377, 'SGD', 'Saver', 'Silver', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 21', 'booker21@example.com', '+6580000021', 1),
(23, 'SQ944', 23, 'STD', 0, '2026-11-23T18:00:00', 1427, 'SGD', 'Standard', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 22', 'booker22@example.com', '+6580000022', 1),
(24, 'SQ635', 24, 'DLX', 0, '2026-12-24T19:00:00', 1477, 'SGD', 'Flexi', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 23', 'booker23@example.com', '+6580000023', 1),
(25, 'KE658', 25, 'SUITE', 1, '2026-01-25T08:00:00', 1527, 'SGD', 'Saver', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 24', 'booker24@example.com', '+6580000024', 1),
(26, 'JL414', 26, 'STD', 0, '2026-02-26T09:00:00', 1577, 'SGD', 'Standard', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 25', 'booker25@example.com', '+6580000025', 1),
(27, 'NH217', 27, 'DLX', 0, '2026-03-27T10:00:00', 1627, 'SGD', 'Flexi', NULL, 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 26', 'booker26@example.com', '+6580000026', 1),
(28, 'QF454', 28, 'STD', 0, '2026-04-01T11:00:00', 1677, 'SGD', 'Saver', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 27', 'booker27@example.com', '+6580000027', 1),
(29, 'PR501', 29, 'DLX', 1, '2026-05-02T12:00:00', 1636, 'SGD', 'Standard', NULL, 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 28', 'booker28@example.com', '+6580000028', 1),
(30, 'OZ752', 30, 'SUITE', 0, '2026-06-03T13:00:00', 1686, 'SGD', 'Flexi', 'Bronze', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 29', 'booker29@example.com', '+6580000029', 1),
(31, 'SQ001', 31, 'STD', 0, '2026-07-04T14:00:00', 1736, 'SGD', 'Saver', NULL, 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 30', 'booker30@example.com', '+6580000030', 1),
(32, 'SQ634', 32, 'DLX', 0, '2026-08-05T15:00:00', 1786, 'SGD', 'Standard', 'Silver', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 31', 'booker31@example.com', '+6580000031', 1),
(33, 'SQ636', 33, 'STD', 1, '2026-09-06T16:00:00', 1836, 'SGD', 'Flexi', 'Bronze', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 32', 'booker32@example.com', '+6580000032', 1),
(34, 'SQ706', 1, 'DLX', 0, '2026-10-07T17:00:00', 1886, 'SGD', 'Saver', 'Silver', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 33', 'booker33@example.com', '+6580000033', 1),
(35, 'TR808', 2, 'SUITE', 0, '2026-11-08T18:00:00', 1936, 'SGD', 'Standard', 'Platinum', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 34', 'booker34@example.com', '+6580000034', 1),
(36, 'SQ322', 3, 'STD', 0, '2026-12-09T19:00:00', 1895, 'SGD', 'Flexi', 'Platinum', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 35', 'booker35@example.com', '+6580000035', 1),
(37, 'SQ221', 4, 'DLX', 1, '2026-01-10T08:00:00', 1945, 'SGD', 'Saver', NULL, 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 36', 'booker36@example.com', '+6580000036', 1),
(38, 'SQ944', 5, 'STD', 0, '2026-02-11T09:00:00', 1995, 'SGD', 'Standard', 'Silver', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 37', 'booker37@example.com', '+6580000037', 1),
(39, 'SQ635', 6, 'DLX', 0, '2026-03-12T10:00:00', 2045, 'SGD', 'Flexi', 'Platinum', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 38', 'booker38@example.com', '+6580000038', 1),
(40, 'KE658', 7, 'SUITE', 0, '2026-04-13T11:00:00', 2095, 'SGD', 'Saver', 'Platinum', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 39', 'booker39@example.com', '+6580000039', 1),
(41, 'JL414', 8, 'STD', 1, '2026-05-14T12:00:00', 2145, 'SGD', 'Standard', 'Platinum', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 40', 'booker40@example.com', '+6580000040', 1),
(42, 'NH217', 9, 'DLX', 0, '2026-06-15T13:00:00', 2195, 'SGD', 'Flexi', 'Bronze', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 41', 'booker41@example.com', '+6580000041', 1),
(43, 'QF454', 10, 'STD', 0, '2026-07-16T14:00:00', 2154, 'SGD', 'Saver', 'Bronze', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 42', 'booker42@example.com', '+6580000042', 1),
(44, 'PR501', 11, 'DLX', 0, '2026-08-17T15:00:00', 2204, 'SGD', 'Standard', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 43', 'booker43@example.com', '+6580000043', 1),
(45, 'OZ752', 12, 'SUITE', 1, '2026-09-18T16:00:00', 2254, 'SGD', 'Flexi', 'Silver', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 44', 'booker44@example.com', '+6580000044', 1),
(46, 'SQ001', 13, 'STD', 0, '2026-10-19T17:00:00', 2304, 'SGD', 'Saver', 'Platinum', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 45', 'booker45@example.com', '+6580000045', 1),
(47, 'SQ634', 14, 'DLX', 0, '2026-11-20T18:00:00', 2354, 'SGD', 'Standard', 'Silver', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 46', 'booker46@example.com', '+6580000046', 1),
(48, 'SQ636', 15, 'STD', 0, '2026-12-21T19:00:00', 2404, 'SGD', 'Flexi', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 47', 'booker47@example.com', '+6580000047', 1),
(1, 'SQ706', 16, 'DLX', 1, '2026-01-22T08:00:00', 2454, 'SGD', 'Saver', NULL, 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 48', 'booker48@example.com', '+6580000048', 1),
(2, 'TR808', 17, 'SUITE', 0, '2026-02-23T09:00:00', 2413, 'SGD', 'Standard', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 49', 'booker49@example.com', '+6580000049', 1),
(3, 'SQ322', 18, 'STD', 0, '2026-03-24T10:00:00', 2463, 'SGD', 'Flexi', 'Platinum', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 50', 'booker50@example.com', '+6580000050', 1),
(4, 'SQ221', 19, 'DLX', 0, '2026-04-25T11:00:00', 2513, 'SGD', 'Saver', NULL, 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 51', 'booker51@example.com', '+6580000051', 1),
(5, 'SQ944', 20, 'STD', 1, '2026-05-26T12:00:00', 2563, 'SGD', 'Standard', NULL, 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 52', 'booker52@example.com', '+6580000052', 1),
(6, 'SQ635', 21, 'DLX', 0, '2026-06-27T13:00:00', 2613, 'SGD', 'Flexi', 'Gold', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 53', 'booker53@example.com', '+6580000053', 1),
(7, 'KE658', 22, 'SUITE', 0, '2026-07-01T14:00:00', 2663, 'SGD', 'Saver', 'Platinum', 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 54', 'booker54@example.com', '+6580000054', 1),
(8, 'JL414', 23, 'STD', 0, '2026-08-02T15:00:00', 2713, 'SGD', 'Standard', NULL, 'CANCELLED', 0, 949.55, NULL, NULL, NULL, NULL, 'Guest Booker 55', 'booker55@example.com', '+6580000055', 1),
(9, 'NH217', 24, 'DLX', 1, '2026-09-03T16:00:00', 2672, 'SGD', 'Flexi', 'Gold', 'CANCELLED', 25, 935.2, NULL, NULL, NULL, NULL, 'Guest Booker 56', 'booker56@example.com', '+6580000056', 1),
(10, 'QF454', 25, 'STD', 0, '2026-10-04T17:00:00', 2722, 'SGD', 'Saver', 'Gold', 'CANCELLED', 0, 952.7, NULL, NULL, NULL, NULL, 'Guest Booker 57', 'booker57@example.com', '+6580000057', 1),
(11, 'PR501', 26, 'DLX', 0, '2026-11-05T18:00:00', 2772, 'SGD', 'Standard', 'Platinum', 'CANCELLED', 25, 970.2, NULL, NULL, NULL, NULL, 'Guest Booker 58', 'booker58@example.com', '+6580000058', 1),
(12, 'OZ752', 27, 'SUITE', 0, '2026-12-06T19:00:00', 2822, 'SGD', 'Flexi', 'Gold', 'CANCELLED', 0, 987.7, NULL, NULL, NULL, NULL, 'Guest Booker 59', 'booker59@example.com', '+6580000059', 1),
(13, 'SQ001', 28, 'STD', 1, '2026-01-07T08:00:00', 2872, 'SGD', 'Saver', 'Gold', 'CANCELLED', 25, 1005.2, NULL, NULL, NULL, NULL, 'Guest Booker 60', 'booker60@example.com', '+6580000060', 1),
(14, 'SQ634', 29, 'DLX', 0, '2026-02-08T09:00:00', 2922, 'SGD', 'Standard', 'Gold', 'CANCELLED', 0, 1022.7, NULL, NULL, NULL, NULL, 'Guest Booker 61', 'booker61@example.com', '+6580000061', 1),
(15, 'SQ636', 30, 'STD', 0, '2026-03-09T10:00:00', 2972, 'SGD', 'Flexi', 'Silver', 'CANCELLED', 25, 1040.2, NULL, NULL, NULL, NULL, 'Guest Booker 62', 'booker62@example.com', '+6580000062', 1),
(16, 'SQ706', 31, 'DLX', 0, '2026-04-10T11:00:00', 2931, 'SGD', 'Saver', 'Bronze', 'PENDING', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 63', 'booker63@example.com', '+6580000063', 1),
(17, 'TR808', 32, 'SUITE', 1, '2026-05-11T12:00:00', 2981, 'SGD', 'Standard', 'Silver', 'PENDING', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 64', 'booker64@example.com', '+6580000064', 1),
(18, 'SQ322', 33, 'STD', 0, '2026-06-12T13:00:00', 3031, 'SGD', 'Flexi', 'Gold', 'PENDING', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 65', 'booker65@example.com', '+6580000065', 1),
(19, 'SQ221', 1, 'DLX', 0, '2026-07-13T14:00:00', 3081, 'SGD', 'Saver', 'Bronze', 'PENDING', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 66', 'booker66@example.com', '+6580000066', 1),
(20, 'SQ944', 2, 'STD', 0, '2026-08-14T15:00:00', 3131, 'SGD', 'Standard', NULL, 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, 'Guest Booker 67', 'booker67@example.com', '+6580000067', 1);

INSERT INTO BundleCatalog (bundleCode, title, originCity, destinationCity, defaultNights, highlight, displayOrder) VALUES
('PKG_ICN', 'Seoul long weekend', 'Singapore', 'Seoul', 4, 'K-beauty & BBQ', 12),
('PKG_HKG', 'Hong Kong harbour hop', 'Singapore', 'Hong Kong', 3, 'Dim sum & skyline', 13),
('PKG_DXB', 'Dubai desert & malls', 'Singapore', 'Dubai', 5, 'Gold souk days', 14),
('PKG_MEL', 'Melbourne lanes', 'Singapore', 'Melbourne', 6, 'Coffee culture', 15),
('PKG_PER', 'Perth & Rottnest', 'Singapore', 'Perth', 5, 'Quokka selfie day', 16),
('PKG_TPE', 'Taipei night markets', 'Singapore', 'Taipei', 4, 'Bubble tea crawl', 17),
('PKG_HAN', 'Hanoi heritage', 'Singapore', 'Hanoi', 5, 'Old Quarter walks', 18),
('PKG_JKT', 'Jakarta business mix', 'Singapore', 'Jakarta', 3, 'Museums & malls', 19),
('PKG_NYC', 'LondonûNew York hop', 'London', 'New York', 7, 'Transatlantic classic', 20),
('PKG_AKL', 'Auckland escape', 'Sydney', 'Auckland', 4, 'North Island taste', 21),
('PKG_PHUKET', 'BangkokûPhuket combo', 'Bangkok', 'Phuket', 5, 'Island add-on', 22),
('PKG_FRA', 'Frankfurt fairs', 'Singapore', 'Frankfurt', 4, 'Messe & R÷mer', 23),
('PKG_ZRH', 'Zurich lakes', 'Singapore', 'Zurich', 5, 'Alps day-trip ready', 24);

USE LoyaltyDB;
INSERT INTO LoyaltyAccounts (CustomerID, PointsBalance, TierLevel) VALUES
(7, 1459, 'Bronze'),
(8, 1596, 'Bronze'),
(9, 1733, 'Bronze'),
(10, 1870, 'Silver'),
(11, 2007, 'Silver'),
(12, 2144, 'Silver'),
(13, 2281, 'Silver'),
(14, 2418, 'Silver'),
(15, 2555, 'Silver'),
(16, 2692, 'Silver'),
(17, 2829, 'Silver'),
(18, 2966, 'Silver'),
(19, 3103, 'Silver'),
(20, 3240, 'Gold'),
(21, 3377, 'Gold'),
(22, 3514, 'Gold'),
(23, 3651, 'Gold'),
(24, 3788, 'Gold'),
(25, 3925, 'Gold'),
(26, 4062, 'Gold'),
(27, 4199, 'Gold'),
(28, 4336, 'Gold'),
(29, 4473, 'Gold'),
(30, 4610, 'Platinum'),
(31, 4747, 'Platinum'),
(32, 4884, 'Platinum'),
(33, 5021, 'Platinum'),
(34, 5158, 'Platinum'),
(35, 5295, 'Platinum'),
(36, 5432, 'Platinum'),
(37, 5569, 'Platinum'),
(38, 5706, 'Platinum'),
(39, 5843, 'Platinum'),
(40, 5980, 'Bronze'),
(41, 6117, 'Bronze'),
(42, 6254, 'Bronze'),
(43, 6391, 'Bronze'),
(44, 6528, 'Bronze'),
(45, 6665, 'Bronze'),
(46, 6802, 'Bronze'),
(47, 6939, 'Bronze'),
(48, 7076, 'Bronze'),
(49, 7213, 'Bronze'),
(50, 7350, 'Silver');
INSERT INTO LoyaltyTransactions (CustomerID, BookingID, PointsChanged, Reason) VALUES
(1, 1, -200, 'Redeem on bundle checkout'),
(2, 2, 120, 'Goodwill adjustment'),
(3, 3, 2200, 'Tier bonus month'),
(4, 4, 350, 'Earn after package booking'),
(5, 5, 120, 'Tier bonus month'),
(6, 6, 120, 'Tier bonus month'),
(7, 7, -200, 'Tier bonus month'),
(8, 8, -800, 'Goodwill adjustment'),
(9, 9, -200, 'Tier bonus month'),
(10, 10, -800, 'Earn after package booking'),
(11, 11, 350, 'Goodwill adjustment'),
(12, 12, -200, 'Goodwill adjustment'),
(13, 13, 2200, 'Earn after package booking'),
(14, 14, -800, 'Refund reversal'),
(15, 15, 350, 'Promo double points'),
(16, 16, 2200, 'Promo double points'),
(17, 17, 800, 'Redeem on bundle checkout'),
(18, 18, -800, 'Tier bonus month'),
(19, 19, 2200, 'Earn after package booking'),
(20, 20, -500, 'Promo double points'),
(21, 21, 2200, 'Earn after package booking'),
(22, 22, -800, 'Redeem on bundle checkout'),
(23, 23, -200, 'Partner hotel stay'),
(24, 24, 350, 'Earn after package booking'),
(25, 25, 120, 'Earn after package booking'),
(26, 26, 1500, 'Refund reversal'),
(27, 27, 120, 'Partner hotel stay'),
(28, 28, 1500, 'Promo double points'),
(29, 29, 2200, 'Tier bonus month'),
(30, 30, 1500, 'Tier bonus month'),
(31, 31, -800, 'Refund reversal'),
(32, 32, -500, 'Partner hotel stay'),
(33, 33, 120, 'Goodwill adjustment'),
(34, 34, 120, 'Tier bonus month'),
(35, 35, -500, 'Redeem on bundle checkout'),
(36, 36, 120, 'Redeem on bundle checkout'),
(37, 37, -500, 'Redeem on bundle checkout'),
(38, 38, -800, 'Promo double points'),
(39, 39, 2200, 'Goodwill adjustment'),
(40, 40, 2200, 'Tier bonus month'),
(41, 41, -800, 'Redeem on bundle checkout'),
(42, 42, 350, 'Goodwill adjustment'),
(43, 43, 350, 'Goodwill adjustment'),
(44, 44, 2200, 'Earn after package booking'),
(45, 45, 120, 'Tier bonus month'),
(46, 46, 120, 'Promo double points'),
(47, 47, -500, 'Refund reversal'),
(48, 48, 120, 'Goodwill adjustment'),
(49, 49, -200, 'Tier bonus month'),
(50, 50, -200, 'Earn after package booking'),
(1, 51, -800, 'Redeem on bundle checkout'),
(2, 52, 350, 'Refund reversal'),
(3, 53, 350, 'Promo double points'),
(4, 54, -500, 'Promo double points'),
(5, 55, 350, 'Goodwill adjustment'),
(6, 56, 1500, 'Tier bonus month'),
(7, 57, 2200, 'Promo double points'),
(8, 58, -500, 'Refund reversal'),
(9, 59, -800, 'Promo double points'),
(10, 60, 800, 'Refund reversal'),
(11, 61, 350, 'Earn after package booking'),
(12, 62, -500, 'Redeem on bundle checkout'),
(13, 63, -800, 'Partner hotel stay'),
(14, 64, 350, 'Refund reversal'),
(15, 65, -800, 'Partner hotel stay'),
(16, 1, -200, 'Promo double points'),
(17, 2, 2200, 'Tier bonus month'),
(18, 3, -200, 'Refund reversal'),
(19, 4, 1500, 'Goodwill adjustment'),
(20, 5, 2200, 'Earn after package booking'),
(21, 6, 2200, 'Tier bonus month'),
(22, 7, 1500, 'Tier bonus month'),
(23, 8, 800, 'Goodwill adjustment'),
(24, 9, -500, 'Partner hotel stay'),
(25, 10, -200, 'Tier bonus month'),
(26, 11, 1500, 'Goodwill adjustment'),
(27, 12, 2200, 'Tier bonus month'),
(28, 13, 1500, 'Partner hotel stay'),
(29, 14, -800, 'Promo double points'),
(30, 15, -500, 'Tier bonus month'),
(31, 16, 350, 'Tier bonus month'),
(32, 17, -500, 'Partner hotel stay'),
(33, 18, 1500, 'Partner hotel stay'),
(34, 19, -800, 'Goodwill adjustment'),
(35, 20, 2200, 'Promo double points');

USE FlightDB;
INSERT INTO FlightReservations (BookingID, FlightNum, SeatNo, Status, CreatedAt) VALUES
(2, 'SQ634', '13B', 'CONFIRMED', '2026-01-02 10:00:00'),
(3, 'SQ636', '14C', 'CONFIRMED', '2026-01-03 10:00:00'),
(4, 'SQ706', '15D', 'CONFIRMED', '2026-01-04 10:00:00'),
(5, 'TR808', '16E', 'CONFIRMED', '2026-01-05 10:00:00'),
(6, 'SQ322', '17A', 'CONFIRMED', '2026-01-06 10:00:00'),
(7, 'SQ221', '18B', 'CONFIRMED', '2026-01-07 10:00:00'),
(8, 'SQ944', '19C', 'RELEASED', '2026-01-08 10:00:00'),
(9, 'SQ635', '20D', 'CONFIRMED', '2026-01-09 10:00:00'),
(10, 'KE658', '21E', 'CONFIRMED', '2026-01-10 10:00:00'),
(11, 'JL414', '22A', 'CONFIRMED', '2026-01-11 10:00:00'),
(12, 'NH217', '23B', 'CONFIRMED', '2026-01-12 10:00:00'),
(13, 'QF454', '24C', 'CONFIRMED', '2026-01-13 10:00:00'),
(14, 'PR501', '25D', 'CONFIRMED', '2026-01-14 10:00:00'),
(15, 'OZ752', '26E', 'RELEASED', '2026-01-15 10:00:00'),
(16, 'SQ001', '27A', 'CONFIRMED', '2026-01-16 10:00:00'),
(17, 'SQ634', '28B', 'CONFIRMED', '2026-01-17 10:00:00'),
(18, 'SQ636', '29C', 'CONFIRMED', '2026-01-18 10:00:00'),
(19, 'SQ706', '12D', 'CONFIRMED', '2026-01-19 10:00:00'),
(20, 'TR808', '13E', 'CONFIRMED', '2026-01-20 10:00:00'),
(21, 'SQ322', '14A', 'CONFIRMED', '2026-01-21 10:00:00'),
(22, 'SQ221', '15B', 'RELEASED', '2026-01-22 10:00:00'),
(23, 'SQ944', '16C', 'CONFIRMED', '2026-01-23 10:00:00'),
(24, 'SQ635', '17D', 'CONFIRMED', '2026-01-24 10:00:00'),
(25, 'KE658', '18E', 'CONFIRMED', '2026-01-25 10:00:00'),
(26, 'JL414', '19A', 'CONFIRMED', '2026-01-26 10:00:00'),
(27, 'NH217', '20B', 'CONFIRMED', '2026-01-27 10:00:00'),
(28, 'QF454', '21C', 'CONFIRMED', '2026-01-28 10:00:00'),
(29, 'PR501', '22D', 'RELEASED', '2026-01-01 10:00:00'),
(30, 'OZ752', '23E', 'CONFIRMED', '2026-01-02 10:00:00'),
(31, 'SQ001', '24A', 'CONFIRMED', '2026-01-03 10:00:00'),
(32, 'SQ634', '25B', 'CONFIRMED', '2026-01-04 10:00:00'),
(33, 'SQ636', '26C', 'CONFIRMED', '2026-01-05 10:00:00'),
(34, 'SQ706', '27D', 'CONFIRMED', '2026-01-06 10:00:00'),
(35, 'TR808', '28E', 'CONFIRMED', '2026-01-07 10:00:00'),
(36, 'SQ322', '29A', 'RELEASED', '2026-01-08 10:00:00'),
(37, 'SQ221', '12B', 'CONFIRMED', '2026-01-09 10:00:00'),
(38, 'SQ944', '13C', 'CONFIRMED', '2026-01-10 10:00:00'),
(39, 'SQ635', '14D', 'CONFIRMED', '2026-01-11 10:00:00'),
(40, 'KE658', '15E', 'CONFIRMED', '2026-01-12 10:00:00'),
(41, 'JL414', '16A', 'CONFIRMED', '2026-01-13 10:00:00'),
(42, 'NH217', '17B', 'CONFIRMED', '2026-01-14 10:00:00'),
(43, 'QF454', '18C', 'RELEASED', '2026-01-15 10:00:00'),
(44, 'PR501', '19D', 'CONFIRMED', '2026-01-16 10:00:00'),
(45, 'OZ752', '20E', 'CONFIRMED', '2026-01-17 10:00:00'),
(46, 'SQ001', '21A', 'CONFIRMED', '2026-01-18 10:00:00');

USE HotelDB;
INSERT INTO HotelBookings (BookingID, HotelID, RoomType, CheckIn, CheckOut, NumberOfKeys, Status) VALUES
(3, 2, 'Standard', '2026-02-02 15:00:00', '2026-02-05 11:00:00', 2, 'CONFIRMED'),
(4, 3, 'Standard', '2026-03-03 15:00:00', '2026-03-06 11:00:00', 3, 'CONFIRMED'),
(5, 4, 'Suite', '2026-04-04 15:00:00', '2026-04-07 11:00:00', 1, 'CONFIRMED'),
(6, 5, 'Deluxe', '2026-05-05 15:00:00', '2026-05-08 11:00:00', 2, 'CONFIRMED'),
(7, 6, 'Suite', '2026-06-06 15:00:00', '2026-06-09 11:00:00', 3, 'CONFIRMED'),
(8, 7, 'Deluxe', '2026-07-07 15:00:00', '2026-07-10 11:00:00', 1, 'CANCELLED'),
(9, 8, 'Suite', '2026-08-08 15:00:00', '2026-08-11 11:00:00', 2, 'CONFIRMED'),
(10, 9, 'Deluxe', '2026-09-09 15:00:00', '2026-09-12 11:00:00', 3, 'CONFIRMED'),
(11, 10, 'Standard', '2026-10-10 15:00:00', '2026-10-13 11:00:00', 1, 'CONFIRMED'),
(12, 11, 'Standard', '2026-01-11 15:00:00', '2026-01-14 11:00:00', 2, 'CONFIRMED'),
(13, 12, 'Deluxe', '2026-02-12 15:00:00', '2026-02-15 11:00:00', 3, 'CONFIRMED'),
(14, 13, 'Suite', '2026-03-13 15:00:00', '2026-03-16 11:00:00', 1, 'CANCELLED'),
(15, 14, 'Standard', '2026-04-14 15:00:00', '2026-04-17 11:00:00', 2, 'CONFIRMED'),
(16, 15, 'Deluxe', '2026-05-15 15:00:00', '2026-05-18 11:00:00', 3, 'CONFIRMED'),
(17, 16, 'Deluxe', '2026-06-16 15:00:00', '2026-06-19 11:00:00', 1, 'CONFIRMED'),
(18, 17, 'Suite', '2026-07-17 15:00:00', '2026-07-20 11:00:00', 2, 'CONFIRMED'),
(19, 18, 'Deluxe', '2026-08-18 15:00:00', '2026-08-21 11:00:00', 3, 'CONFIRMED'),
(20, 19, 'Standard', '2026-09-19 15:00:00', '2026-09-22 11:00:00', 1, 'CANCELLED'),
(21, 20, 'Standard', '2026-10-20 15:00:00', '2026-10-23 11:00:00', 2, 'CONFIRMED'),
(22, 21, 'Suite', '2026-01-01 15:00:00', '2026-01-04 11:00:00', 3, 'CONFIRMED'),
(23, 22, 'Suite', '2026-02-02 15:00:00', '2026-02-05 11:00:00', 1, 'CONFIRMED'),
(24, 23, 'Standard', '2026-03-03 15:00:00', '2026-03-06 11:00:00', 2, 'CONFIRMED'),
(25, 24, 'Suite', '2026-04-04 15:00:00', '2026-04-07 11:00:00', 3, 'CONFIRMED'),
(26, 25, 'Standard', '2026-05-05 15:00:00', '2026-05-08 11:00:00', 1, 'CANCELLED'),
(27, 26, 'Deluxe', '2026-06-06 15:00:00', '2026-06-09 11:00:00', 2, 'CONFIRMED'),
(28, 27, 'Suite', '2026-07-07 15:00:00', '2026-07-10 11:00:00', 3, 'CONFIRMED'),
(29, 28, 'Standard', '2026-08-08 15:00:00', '2026-08-11 11:00:00', 1, 'CONFIRMED'),
(30, 29, 'Suite', '2026-09-09 15:00:00', '2026-09-12 11:00:00', 2, 'CONFIRMED'),
(31, 30, 'Deluxe', '2026-10-10 15:00:00', '2026-10-13 11:00:00', 3, 'CONFIRMED'),
(32, 31, 'Standard', '2026-01-11 15:00:00', '2026-01-14 11:00:00', 1, 'CANCELLED'),
(33, 32, 'Standard', '2026-02-12 15:00:00', '2026-02-15 11:00:00', 2, 'CONFIRMED'),
(34, 33, 'Standard', '2026-03-13 15:00:00', '2026-03-16 11:00:00', 3, 'CONFIRMED'),
(35, 1, 'Deluxe', '2026-04-14 15:00:00', '2026-04-17 11:00:00', 1, 'CONFIRMED'),
(36, 2, 'Standard', '2026-05-15 15:00:00', '2026-05-18 11:00:00', 2, 'CONFIRMED'),
(37, 3, 'Suite', '2026-06-16 15:00:00', '2026-06-19 11:00:00', 3, 'CONFIRMED'),
(38, 4, 'Standard', '2026-07-17 15:00:00', '2026-07-20 11:00:00', 1, 'CANCELLED'),
(39, 5, 'Deluxe', '2026-08-18 15:00:00', '2026-08-21 11:00:00', 2, 'CONFIRMED');
