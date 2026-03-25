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

## Configuration (submission / `.env`)

Docker Compose reads a **`.env`** file in the project root (same folder as `docker-compose.yml`) for `${VAR}` substitution. **Do not commit secrets.**

1. Copy the template and edit:
   - `copy .env.example .env` (Windows PowerShell: `Copy-Item .env.example .env`)
2. Typical variables:
   - **`BOOKING_DB_URL`** — MySQL connection for the Booking service (default matches `booking-db` in Compose).
   - **`TRAVELLER_PROFILE_BASE_URL`** — teammate’s Traveller Profile base (**no trailing slash**). Exact routes and Create JSON sample: **`travellerprofile/outsystems_client.py`**. Booking only uses **`GET .../byaccount/{customerID}`** and matches **`Id`** to `travellerProfileId`.
   - **`TRAVELLER_PROFILE_REQUIRED`** — `true` to reject bookings if the profile cannot be loaded or does not match `customerID`.
   - **`FX_API_ENABLED`** — `true` to call **exchangerate.host** on create booking and return an **`fxQuote`** object (external API for reports/demos).
   - **`SMU_NOTIFICATION_*`** — optional SMU Lab **SendEmail** after `booking.cancelled` (see `notification/smu_integration.py`).
   - **`TWILIO_*`** — optional **SMS** via Twilio on the same event (see `notification/twilio_integration.py`). Use a trial account + verified `TWILIO_TO_NUMBER` for class demos.

MySQL credentials for the `booking-db` container can be overridden with `MYSQL_*` variables; if you change them, update `BOOKING_DB_URL` to match.

## How to run locally

1. Install Docker Desktop (includes Docker Compose).
2. Open a terminal and go to the project folder:
   - `cd c:\ESD\esd-project`
3. (Optional) Create `.env` from `.env.example` and set OutSystems / FX / SMU as needed.
4. Build and start all services:
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
    - `travellerProfileIds` (optional JSON array of integers — multiple **companion** rows from OutSystems `GET …/byaccount/{customerID}`, each value is that row’s **`Id`**)  
    - `travellerProfileId` (optional single integer — legacy convenience; merged with `travellerProfileIds` if both sent)  
    - Profiles are validated when `TRAVELLER_PROFILE_BASE_URL` is set; responses include **`travellerProfileIds`** on the booking.
    - `seatNumber` (optional — SQ seat map in demo UI)

  Response may include **`fxQuote`** if `FX_API_ENABLED=true` (external FX snapshot).
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

## Refund & loyalty logic (short version — matches current `booking/app.py`)

**Create booking (`POST /booking`)**  
- **Catalog check:** `GET` Flight and Hotel services (`FLIGHT_URL`, `HOTEL_URL`) so bogus IDs fail fast; disable with `SKIP_CATALOG_VALIDATION=true` if needed.  
- Persists the bundle in **MySQL**; calls **Loyalty** `POST /loyalty/earn` (coins + booking-count tier).  
- **Payment on create** is **not** implemented — only **refund** calls Payment today; say so in report or add `POST /payment` after insert if you want parity.  
- Optional: **OutSystems** `travellerProfileId`; optional **FX** (`FX_API_ENABLED=true`).

**Cancel (`POST /booking/cancel/{id}`)** with optional body `{ "cancelSource": "customer" | "airline" | "hotel" }` (default `customer`):

- Package split for refund math: **60% flight / 40% hotel** if `hotelPaymentMode` is `PrepaidInApp`; if `PayAtHotel`, treat **100%** as flight-side for this demo.
- **Customer** cancel: flight refund **0**; hotel refund **full hotel component** only if **≥ 7 days** before departure, else **0**.
- **Airline** cancel: **full** package refund.
- **Hotel** cancel: **hotel component** only (flight **0**).
- `refundPercentage` stored is the **overall % of package** that was refunded (derived from amounts).
- Then: **Payment** `POST /payment/refund`; **Loyalty** `POST /loyalty/adjust`; **RabbitMQ** `booking.cancelled`.

**Loyalty (atomic service)**  
- **Tier** from **completed booking count** (Bronze / Silver / Gold / Platinum).  
- **Coins** (cents) earned per `$1` by tier rate; UI may send `coinsToSpendCents`; cancel **reverses** earn and restores spent coins.

**UI pricing**  
- Tier + promo-code + coins logic is applied in the **browser**; the booking service receives the **final** `totalPrice` (and coins spent).

For narrative detail, see `TEAM_GUIDE.md`.

## Architecture notes & gap mitigations (for report / slides)

| Topic | In code now | If you cannot change it further |
|--------|-------------|---------------------------------|
| **SOA / sequence diagrams** | Draw your own from this README + `TEAM_GUIDE.md` (there is no `diagrams.md`). | Export from report; keep **one** technical overview consistent with **actual** calls (catalog GET on create, loyalty, cancel → payment + MQ). |
| **Flight / Hotel** | Booking **calls atomic GET** before insert when URLs are set. | Mention inventory/seat **dec**rement as a future enhancement if not modelled. |
| **Payment on book** | Refund path only. | State **assumption**: “charge deferred / simulated” **or** add one `POST /payment` after `commit` in `create_booking`. |
| **OutSystems** | Env + `byaccount` validation. | Demo live OS + put REST appendix + screenshot; align **CustomerID** with UI `customerID`. |
| **External API** | FX (`FX_API_ENABLED`) + SMU email (`SMU_NOTIFICATION_*`). | Prefer **recorded video** if live keys/network fail in class. |
| **BTL** | nginx proxy, SMU/FX, seat/companion rules — **confirm with instructor** what counts. | One slide: **why** the BTL helps **your** scenario. |
| **Tests / CI** | None in repo. | Add **Postman/curl** list in report appendix or a `scripts/smoke.sh` — marks for professionalism. |
| **Secrets** | Use `.env` (not committed). | Submit `.env.example` only; never real keys on eLearn. |

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
