-- Payment DB (MySQL)

CREATE TABLE IF NOT EXISTS payment_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  customer_id INT,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'SGD',
  payment_method VARCHAR(30) DEFAULT 'Card',
  status VARCHAR(20) NOT NULL, -- PAID / REFUNDED / FAILED
  provider_ref VARCHAR(80),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refund_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  refund_amount DECIMAL(10,2) NOT NULL,
  refund_reason VARCHAR(255),
  status VARCHAR(20) DEFAULT 'REFUNDED',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO payment_transactions
  (booking_id, customer_id, amount, currency, payment_method, status, provider_ref)
VALUES
  (1, 1, 1200.00, 'SGD', 'Card', 'PAID', 'PAY_DEMO_1001'),
  (2, 2, 1500.00, 'SGD', 'Card', 'PAID', 'PAY_DEMO_1002');

INSERT INTO refund_transactions
  (booking_id, refund_amount, refund_reason, status)
VALUES
  (3, 400.00, 'Customer cancellation with partial refund', 'REFUNDED');

