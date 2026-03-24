# esd-project

## Overview

Travel package booking demo using a **microservices architecture**:
- **Booking**: creates and cancels bundled flight + hotel bookings, stores them in MySQL, and applies refund and loyalty rules.
- **Account**: simple customer account service (Python, in‑memory) for basic profile data used by bookings.
- **Flight / Hotel**: simple services with fake in‑memory data for flights, hotels, room types and breakfast options.
- **Payment**: records initial payments and refund requests (simulated).
- **Loyalty**: tracks points, tier and adjustments across bookings.
- **Notification**: listens to RabbitMQ events and exposes consumed notifications.
- **UI**: lightweight HTML page for local testing; the main “nice” front‑end will be built in OutSystems and will call these APIs.

All services are implemented in Python Flask and are started together with Docker Compose.

## How to run locally

1. Install Docker Desktop (includes Docker Compose).
2. Open a terminal and go to the project folder:
   - `cd c:\ESD\esd-project`
3. Build and start all services:
   - `docker compose up --build`
4. Once everything is up:
   - **Test UI:** `http://localhost:8080` — the page calls APIs **through nginx** at `/api/booking`, `/api/loyalty`, `/api/notification` (same origin; see `nginx/ui.conf`). The UI includes **demo customer profiles** and a **seat map** for `SQ*` flights; carriers like `AK`/`TR` show “check-in only” in the demo.
   - Booking API (direct): `http://localhost:5101`
   - Notification API (direct): `http://localhost:5106/notifications`

## Main APIs (for slides/report)

- **Create booking**  
  - `POST /booking` (Booking service, port 5101)  
  - Body (JSON, main fields):  
    - `customerID` (from OutSystems Customer Account)  
    - `travellerProfileIDs` (comma-separated string or array of traveller profile IDs from OutSystems TravellerProfileService)  
    - `flightID` (e.g. `SQ001`)  
    - `hotelID` (e.g. `1`)  
    - `hotelRoomType` (e.g. `STD` or `DLX`)  
    - `hotelIncludesBreakfast` (boolean)  
    - `departureTime` (ISO string)  
    - `totalPrice` (final package price after any **tier discounts**, **discount codes** and **coins offset**, calculated in UI/OutSystems)  
    - `currency` (e.g. `SGD`)  
    - `fareType` (`Saver|Standard|Flexi`)  
    - `loyaltyTier` (e.g. `Bronze|Silver|Gold|Platinum|null`)  
    - `hotelPaymentMode` (`PrepaidInApp` or `PayAtHotel`)
- **Get booking**  
  - `GET /booking/{id}`
- **Cancel booking + refund**  
  - `POST /booking/cancel/{id}`  
  - Orchestrates:
    - Computes refund based on **cancellation source + timing + hotel payment mode**.
    - Optional request body: `{ "cancelSource": "customer|airline|hotel" }` (default: `customer`).
    - Calls `payment` microservice: `POST /payment/refund`.
    - Updates booking status and refund fields in MySQL.
    - Publishes `booking.cancelled` event to RabbitMQ (`travel_topic` exchange).

Other microservices expose:
- `GET /flight/{flightNum}`
- `GET /hotel/{hotelID}`
- `POST /payment`
- `POST /payment/refund`
- `GET /loyalty/{customerID}/points`
- `POST /loyalty/earn`
- `POST /loyalty/adjust`
- `POST /notify/manual`
- `GET /notifications` (to see events consumed from RabbitMQ)

## Messaging

- Uses **RabbitMQ topic exchange** `travel_topic`.
- Booking publishes a **`booking.cancelled`** event after a successful refund flow.
- Notification service runs an AMQP consumer (background thread) that:
  - Binds queue `Notification` with routing key `booking.cancelled`.
  - Appends received events into an in‑memory list exposed via `GET /notifications`.

## Refund & loyalty logic (short version)

- Refund rules:
  - `POST /booking/cancel/{id}` accepts optional `{ "cancelSource": "customer|airline|hotel" }`.
  - Customer cancellation: if `>= 30` days before departure, full refund.
  - Otherwise, customer-side flight refund is generally 0 (or fare-rule dependent for refundable big-airline tickets), while hotel uses the 7-day rule.
  - Airline cancellation: full package refund in this demo.
  - Hotel cancellation: full hotel-side refund in this demo.
- Loyalty:
  - `$1` spent = `1` tier point.
  - Loyalty service stores **points + tier** and auto‑upgrades tier based on thresholds.
  - Booking calls **Loyalty** to earn points on create and adjust (deduct) after refund.
- Tier‑based discounts and promo codes:
  - Tiers (Bronze → Silver → Gold → Platinum) grant percentage discounts (e.g. Silver 10%, Gold 15%, Platinum 20%).
  - UI/OutSystems can also accept **promo codes** (e.g. `SILVER10`, `GOLD15`, `PLAT20`) that apply extra percentage discount only if the customer’s tier is high enough.
  - The effective amount sent as `totalPrice` is the net after tier discount, promo code and any loyalty coins used.
- Refund:
  - Calculated percentage uses fare type, timing and loyalty tier uplift.
  - Refund amount is applied to the **refundable portion** of `totalPrice` (taking hotel payment mode into account).
  - For full refunds, you can explain that both cash and loyalty benefits for that booking are reversed.

For a more detailed, story‑style explanation (flows, loyalty coins, guest vs logged‑in user, partial cancellation rules), see `TEAM_GUIDE.md`.

## Database scripts (schema + dummy data)

`database/` now contains ready-to-use MySQL scripts for each domain:
- `customer_db.sql`
- `traveller_db.sql`
- `flight_db.sql`
- `hotel_db.sql`
- `package_db.sql`
- `loyalty_db.sql`
- `payment_db.sql`
- `notification_db.sql`
- `discount_db.sql`

You can import any file into MySQL (inside Docker) with:

`docker exec -i esd-project-booking-db-1 mysql -utravel_user -ptravel_pass travel_booking < database/<file>.sql`
