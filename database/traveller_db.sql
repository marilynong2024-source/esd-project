-- Traveller Profile DB (MySQL)

CREATE TABLE IF NOT EXISTS traveller_profiles (
  traveller_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  passport_number VARCHAR(40) NOT NULL,
  nationality VARCHAR(60),
  date_of_birth DATE,
  meal_preference VARCHAR(40) DEFAULT 'None',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_passport (passport_number)
);

INSERT INTO traveller_profiles
  (customer_id, full_name, passport_number, nationality, date_of_birth, meal_preference)
VALUES
  (1, 'Ava Chen', 'E1234567A', 'Singapore', '1995-02-14', 'Vegetarian'),
  (1, 'Liam Chen', 'E7654321B', 'Singapore', '1992-07-11', 'None'),
  (2, 'Ben Kumar', 'K9988776C', 'India', '1991-08-03', 'Halal');

