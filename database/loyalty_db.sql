-- Loyalty DB (Diagram 3/3 aligned)

CREATE TABLE IF NOT EXISTS LoyaltyAccounts (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  CustomerID INT NOT NULL UNIQUE,
  PointsBalance INT NOT NULL DEFAULT 0,
  TierLevel VARCHAR(20) NOT NULL DEFAULT 'Bronze',
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS LoyaltyTransactions (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  CustomerID INT NOT NULL,
  BookingID INT NULL,
  PointsChanged INT NOT NULL DEFAULT 0,
  TransactionDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  Reason VARCHAR(255)
);

INSERT INTO LoyaltyAccounts
  (CustomerID, PointsBalance, TierLevel)
VALUES
  (1, 11200, 'Silver'),
  (2, 8600, 'Silver'),
  (3, 18400, 'Gold');

INSERT INTO LoyaltyTransactions
  (CustomerID, BookingID, PointsChanged, Reason)
VALUES
  (1, 1, 1200, 'Earn after completed booking'),
  (2, 2, 300, 'Earn after completed booking (Silver tier)'),
  (3, 3, -500, 'Redeem points for pre-payment discount');

