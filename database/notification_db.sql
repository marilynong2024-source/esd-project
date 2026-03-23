-- Notification DB (MySQL) - optional persistence for notification service

CREATE TABLE IF NOT EXISTS notification_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT,
  customer_id INT,
  channel VARCHAR(20) DEFAULT 'EMAIL', -- EMAIL/SMS/IN_APP
  recipient VARCHAR(120),
  subject VARCHAR(200),
  message_content TEXT,
  source VARCHAR(30) DEFAULT 'booking.cancelled',
  status VARCHAR(20) DEFAULT 'SENT',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO notification_logs
  (booking_id, customer_id, channel, recipient, subject, message_content, source, status)
VALUES
  (1, 1, 'EMAIL', 'ava.chen@example.com', 'Booking Confirmed', 'Your booking #1 is confirmed.', 'booking.confirmed', 'SENT'),
  (3, 3, 'EMAIL', 'casey.tan@example.com', 'Booking Cancelled', 'Your booking #3 was cancelled. Refund processed.', 'booking.cancelled', 'SENT');

