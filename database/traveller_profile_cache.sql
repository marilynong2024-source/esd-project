-- OPTIONAL: local mirror/cache of OutSystems Traveller Profile rows (MySQL 8+).
--
-- Source of truth for the project remains OutSystems (course requirement). Use this only if
-- you need denormalized reporting, offline lists, or audit — and keep it in sync yourself
-- (e.g. after Create in OS, INSERT here; or nightly job — not implemented in this repo).
--
-- How to read a user's profiles in production flow (no DB required):
--   1) GET  {TRAVELLER_PROFILE_BASE_URL}/byaccount/{customerId}
--   2) Each list element has Id + FullName + PassportNumber + … (exact keys from teammate)
--   3) To pick one companion for a booking, match `travellerProfileId` to that Id (see booking/traveller_os.py)

CREATE TABLE IF NOT EXISTS traveller_profile_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL COMMENT 'Matches CustomerID in OutSystems / booking.customerID',
  outsystems_profile_id INT NOT NULL COMMENT 'OutSystems entity Id (TravellerProfile.Id)',
  full_name VARCHAR(200),
  passport_last4 CHAR(4) DEFAULT NULL COMMENT 'Optional mask only; avoid storing full passport if possible',
  snapshot_json JSON DEFAULT NULL COMMENT 'Last API row as JSON — demo only; mind PII policies',
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_os_profile (customer_id, outsystems_profile_id),
  KEY idx_customer (customer_id)
);

-- Example (you would upsert after a successful OutSystems Create or after GET list):
-- INSERT INTO traveller_profile_cache (customer_id, outsystems_profile_id, full_name, passport_last4, snapshot_json)
-- VALUES (1, 42, 'Jane Lee', '567A', JSON_OBJECT('Id', 42, 'FullName', 'Jane Lee'))
-- ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), snapshot_json = VALUES(snapshot_json), synced_at = CURRENT_TIMESTAMP;
