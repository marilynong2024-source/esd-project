-- Traveller Profile DB (Diagram 3/3 aligned)

CREATE TABLE IF NOT EXISTS TravellerProfiles (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  CustomerID INT NOT NULL,
  FullName VARCHAR(120) NOT NULL,
  PassportNumber VARCHAR(40) NOT NULL,
  Nationality VARCHAR(60),
  DateOfBirth DATE,
  MealPreference VARCHAR(40) DEFAULT 'None',
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_passport (PassportNumber),
  CONSTRAINT fk_traveller_customer
    FOREIGN KEY (CustomerID) REFERENCES CustomerDB.customer_accounts(customer_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO TravellerProfiles
  (CustomerID, FullName, PassportNumber, Nationality, DateOfBirth, MealPreference)
VALUES
  (1, 'Ava Chen', 'E1234567A', 'Singapore', '1995-02-14', 'Vegetarian'),
  (1, 'Liam Chen', 'E7654321B', 'Singapore', '1992-07-11', 'None'),
  (2, 'Ben Kumar', 'K9988776C', 'India', '1991-08-03', 'Halal');

