-- Customer Account DB (MySQL)

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
  ('casey.tan@example.com', '$2b$demo_hash_3', 'Casey', 'Tan', '+6591110003', '1998-12-09', 'Malaysia', 'Active');

