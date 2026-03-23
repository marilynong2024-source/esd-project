-- Discount DB (MySQL)

CREATE TABLE IF NOT EXISTS discount_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  discount_code VARCHAR(30) NOT NULL UNIQUE,
  required_tier VARCHAR(20) NOT NULL, -- Silver/Gold/Platinum
  discount_percent DECIMAL(5,2) NOT NULL,
  active TINYINT(1) DEFAULT 1,
  valid_from DATE,
  valid_to DATE
);

INSERT INTO discount_rules
  (discount_code, required_tier, discount_percent, active, valid_from, valid_to)
VALUES
  ('SILVER10', 'Silver', 10.00, 1, '2026-01-01', '2026-12-31'),
  ('GOLD15', 'Gold', 15.00, 1, '2026-01-01', '2026-12-31'),
  ('PLAT20', 'Platinum', 20.00, 1, '2026-01-01', '2026-12-31');

