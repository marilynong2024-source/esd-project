-- Customer Account DB (MySQL)
--
-- This stores **account / identity** (email, name, phone) for the Account microservice.
--
-- **Traveller profiles** (companion rows: passport on file, seat/meal prefs, etc.) are **not**
-- duplicated here for the graded design: they are owned by **OutSystems** and read via REST:
--   GET {TRAVELLER_PROFILE_BASE_URL}/byaccount/{customerID}
-- Python helpers: travellerprofile/outsystems_client.py (get_profiles_by_account,
-- get_traveller_profile). Booking validates picks using booking/traveller_os.py.
--
-- Optional local **cache** of OutSystems rows (e.g. reporting): see traveller_profile_cache.sql.

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

INSERT INTO customer_accounts
  (email, password_hash, first_name, last_name, phone_number, date_of_birth, nationality, account_status)
VALUES
  ('ava.chen@example.com', '$2b$demo_hash_1', 'Ava', 'Chen', '+6591110001', '1995-02-14', 'Singapore', 'Active'),
  ('ben.kumar@example.com', '$2b$demo_hash_2', 'Ben', 'Kumar', '+6591110002', '1991-08-03', 'India', 'Active'),
  ('casey.tan@example.com', '$2b$demo_hash_3', 'Casey', 'Tan', '+6591110003', '1998-12-09', 'Malaysia', 'Active'),
  ('dana.ng@example.com', '$2b$demo_hash_4', 'Dana', 'Ng', '+6591110004', '1993-05-21', 'Singapore', 'Active'),
  ('evan.lee@example.com', '$2b$demo_hash_5', 'Evan', 'Lee', '+6591110005', '1990-11-02', 'Singapore', 'Active'),
  ('fiona.ong@example.com', '$2b$demo_hash_6', 'Fiona', 'Ong', '+6591110006', '1988-03-30', 'Singapore', 'Active');

-- Diagram-aligned table (slides: CustomerProfile) — same primary key as account row
CREATE TABLE IF NOT EXISTS CustomerProfile (
  customerID INT NOT NULL PRIMARY KEY,
  Nationality VARCHAR(60),
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  AccountStatus VARCHAR(20) DEFAULT 'Active',
  CONSTRAINT fk_customer_profile_account FOREIGN KEY (customerID) REFERENCES customer_accounts (customer_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO CustomerProfile (customerID, Nationality, CreatedAt, AccountStatus)
SELECT customer_id, nationality, created_at, account_status
FROM customer_accounts
ON DUPLICATE KEY UPDATE
  Nationality = VALUES(Nationality),
  CreatedAt = VALUES(CreatedAt),
  AccountStatus = VALUES(AccountStatus);

