-- Loyalty DB (MySQL)

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL UNIQUE,
  booking_count INT DEFAULT 0,
  tier_level VARCHAR(20) DEFAULT 'Bronze', -- Bronze/Silver/Gold/Platinum
  coins INT DEFAULT 0, -- stored in cents
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  booking_id INT,
  transaction_type VARCHAR(30) NOT NULL, -- EARN/SPEND/REVERSAL
  points_changed INT DEFAULT 0,
  coins_changed INT DEFAULT 0, -- cents
  reason VARCHAR(255),
  transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO loyalty_accounts
  (customer_id, booking_count, tier_level, coins)
VALUES
  (1, 1, 'Bronze', 120),
  (2, 2, 'Silver', 430),
  (3, 6, 'Gold', 1250);

INSERT INTO loyalty_transactions
  (customer_id, booking_id, transaction_type, points_changed, coins_changed, reason)
VALUES
  (1, 1, 'EARN', 1200, 120, 'Completed booking'),
  (2, 2, 'EARN', 1500, 300, 'Completed booking as Silver'),
  (3, 3, 'EARN', 800, 240, 'Completed booking as Gold');

