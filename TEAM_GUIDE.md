## Team Guide – Travel Booking Microservices Project

### 1. What this system does

- **Scenario**: Users book a **flight + hotel package** and can later **cancel and get a refund**.
- **Key ideas**:
  - Refund depends on **cancellation source** (customer/airline/hotel), **days before departure/check-in**, and package components (flight vs hotel).
  - `Booking` is the **composite microservice** that orchestrates other services and talks to a **real DB (MySQL)**.
  - Cancellation triggers both a **payment refund (HTTP)** and a **notification event (RabbitMQ)**.

---

### 2. Microservices overview

- **UI (`ui/index.html`)**
  - Simple HTML/JS page for local testing.
  - Calls `Booking` APIs using `fetch` (JSON). The “real” front‑end will be in OutSystems.

- **Account (Flask, in‑memory demo)**
  - Endpoints:
    - `GET /account/{customerID}`: fetch basic account profile.
    - `POST /account`: create account.
    - `PUT /account/{customerID}`: update account details.
  - Stores simple fields like `email`, `firstName`, `lastName`, `phoneNumber`, `nationality`, and `accountStatus`.
  - Used as the Python counterpart to the Customer Account atomic MS in OutSystems; `Booking.customerID` refers to this ID.

- **Booking (Flask + SQLAlchemy + MySQL)**
  - Endpoints:
    - `POST /booking`: create a booking (flight + hotel bundle).
    - `GET /booking/{id}`: fetch booking from DB.
    - `POST /booking/cancel/{id}`: compute refund, call Payment, publish event.
  - Owns `BookingDB` (`bookings` table).
  - Contains **refund policy logic** and (optional) external FX API call.

- **Flight / Hotel**
  - In‑memory “fake DBs” with sample flights and hotels.
  - **Hotel** now exposes basic room catalogue:
    - Example hotel with:
      - Room type `STD` – Standard Room (room only), price per night.
      - Room type `DLX` – Deluxe Room (with breakfast), higher price per night.
    - Response includes `roomTypes` (code, label, pricePerNight, includesBreakfast).

- **Payment**
  - `POST /payment`: record payment for a booking (simple in‑memory store).
  - `POST /payment/refund`: record a refund for a booking.

- **Loyalty**
  - `GET /loyalty/{customerID}/points`: check coins/tier (route name kept for backward compatibility).
  - `POST /loyalty/earn`: earn coins after a booking is completed.
  - `POST /loyalty/adjust`: undo a booking’s loyalty effects on cancellation.
  - Internally keeps **coins + completed booking count + tier** (coins are the spendable loyalty currency):
    - `< 2` bookings → Bronze
    - `2–4` bookings → Silver
    - `5–9` bookings → Gold
    - `>= 10` bookings → Platinum

- **Notification**
  - `POST /notify/manual`: manual notifications (not central to demo).
  - `GET /notifications`: shows events consumed from RabbitMQ.
  - Runs a **RabbitMQ consumer** that listens for `booking.cancelled` events.
  - **Optional — SMU Lab Utilities**: you can turn on real **SendEmail** calls when a cancel event arrives. Copy your **API key** from SMU Lab Utilities → API Keys, then set env vars on the `notification` service (see `notification/smu_integration.py` and commented examples in `docker-compose.yml`): `SMU_NOTIFICATION_ENABLED=true`, `SMU_NOTIFICATION_BASE_URL`, `SMU_NOTIFY_EMAIL_TO`, `SMU_NOTIFICATION_AUTH_HEADER` / `SMU_NOTIFICATION_AUTH_VALUE` (usually `Authorization` + `Bearer …`). Successful/failed calls are appended to `GET /notifications` under `source: smu_sendemail`. **SendSMS / SendOTP** use different JSON bodies — extend `smu_integration.py` similarly if your module needs them.

- **RabbitMQ**
  - Exchange: `travel_topic` (type `topic`).
  - Queue: `Notification`, bound with routing key `booking.cancelled`.

---

### 3. How everything runs (for everyone to test)

1. Install **Docker Desktop**.
2. Open a terminal and run:
   - `cd c:\ESD\esd-project`
   - `docker compose up --build`
3. Wait until all containers are up (especially `booking`). If `http://localhost:5101` gives "connection refused", run `docker compose logs booking` to see errors (e.g. DB not ready).
4. Services:
   - Booking API (direct): `http://localhost:5101`
   - Notification API (direct): `http://localhost:5106/notifications`
5. **UI (use this to avoid file:// errors):**
   - Open **`http://localhost:8080`** in your browser (nginx serves the UI and **proxies** APIs under `/api/booking`, `/api/loyalty`, `/api/notification`).
   - Do **not** open `ui/index.html` via `file://` — relative `/api/...` calls will not work.
   - Use “Create Booking” and then “Cancel Booking”.

---

### 4. Main flows (what to explain in slides/demo)

#### 4.1 Book travel package

1. **UI → Booking**
   - `POST /booking` with:
     - `customerID`, `flightID`, `hotelID`
     - `departureTime` (ISO string)
     - `totalPrice`, `currency`
     - `fareType` (`Saver|Standard|Flexi`)
     - `loyaltyTier` (`Bronze|Silver|Gold|Platinum|null`)
2. **Booking**
   - (Optional) calls **external FX API** to get exchange rate.
   - Saves booking into **MySQL `bookings` table** with status `CONFIRMED`.
   - (Optional) calls `Payment` to charge and `Loyalty` to `earn` coins.
3. **Response**
   - Returns the created booking JSON (including `id`).

#### 4.2 Cancel package + refund + notification

1. **UI → Booking**
   - `POST /booking/cancel/{id}`.
   - Optional JSON body: `{ "cancelSource": "customer|airline|hotel" }` (default is `customer`).
2. **Booking**
   - Loads booking from DB.
   - Computes refund by cancellation source + timing.
   - **Exact refund rules implemented in `booking/app.py`:**
     - **Customer cancellation** (`cancelSource=customer`):
       - **Flight refund = 0** (no flight refund for customer-initiated cancellation).
       - **Hotel refund = 100%** only if cancellation is **>= 7 days** before departure/check-in; else **0**.
     - **Airline cancellation** (`cancelSource=airline`):
       - Full package refund in this demo.
     - **Hotel cancellation** (`cancelSource=hotel`):
       - Full hotel-side refund in this demo.
   - Response includes breakdown fields:
     - `flightRefundAmount`, `hotelRefundAmount`, `refundAmount`, `refundPercentage`.
   - **Loyalty side‑effects (earn + adjust + auto tiering):**
     - On **create booking**, Booking calls `POST /loyalty/earn` with:
       - `customerID`, `amount` (the final `totalPrice` you send), and optionally `coinsToSpendCents`.
     - Loyalty then:
       - increments the customer’s `bookingCount` by `+1`,
       - sets the `tier` based on the updated booking count:
         - `<2` Bronze, `2–4` Silver, `5–9` Gold, `>=10` Platinum,
       - earns `coins` at a rate based on that tier:
         - Bronze `1` cent/$1, Silver `2` cent/$1, Gold `3` cent/$1, Platinum `5` cent/$1.
     - On **cancel**, Booking calls `POST /loyalty/adjust` with:
       - `customerID`, `bookingAmount`, `bookingTier` (tier stored on the booking), and `coinsSpentCents`:
         - loyalty decrements `bookingCount` by `-1`,
         - restores coins spent at payment time,
         - removes coins that were earned for that booking.
3. **Booking → Payment**
   - `POST /payment/refund { bookingID, refundAmount }`.
4. **Booking (DB update)**
   - Updates DB row:
     - `status = CANCELLED`
     - `refundPercentage`, `refundAmount`.
5. **Booking → RabbitMQ**
   - Publishes `booking.cancelled` event to `travel_topic` exchange.
6. **RabbitMQ → Notification**
   - Notification’s consumer receives event and appends it to an in‑memory list.
   - `GET /notifications` returns all consumed events.
7. **Booking → UI**
   - Responds with `refundPercentage`, `refundAmount`, and payment info.

---

### 5. Optional external API integration (for “beyond the labs”)

**Idea:** Use a public **currency exchange rate API** when creating a booking.

- Example endpoint (subject to provider changes):  
  - `https://api.exchangerate.host/latest?base=SGD&symbols=USD`
- Sketch of how to integrate in `booking/app.py` (inside `create_booking`):
  1. Read `currency` from request (e.g. `"SGD"`).
  2. If `currency == "SGD"`:
     - Call the external API once to get rate SGD→USD.
     - Compute `priceInUSD = totalPrice * rate`.
     - Optionally store `rate` and/or `priceInUSD` in extra DB columns or return them in the JSON response.
  3. In report/slides, mention:
     - You call the live API sparingly and **cache or hard‑code** a sample response during development to avoid overusing the external service.

> Note: APIs and URLs can change; always check the latest documentation of the provider you choose.

---

### 6. Suggested role breakdown

- **Member A – Booking & DB**
  - Owns `booking/app.py`, SQLAlchemy model, refund logic.
  - Implements or explains external FX API usage.

- **Member B – Payment & Loyalty**
  - Owns payment/loyalty microservices and ensures Booking → Payment/Loyalty calls work.

- **Member C – Notification & RabbitMQ**
  - Understands `notification/app.py`, queue bindings, `/notifications`.
  - Explains asynchronous messaging in slides.

- **Member D – UI & Demo**
  - Owns `ui/index.html`, ensures it calls Booking correctly.
  - Prepares live demo steps and ensures everything is visible and clear.

- **Member E – Diagrams & Report**
  - Uses `README.md` (technical behaviour) and this guide to produce final PowerPoint diagrams and report sections.

---

### 7. OutSystems front‑end (how to connect)

**Goal:** Build a nicer UI in OutSystems that talks to this backend instead of using only `ui/index.html`.

1. **Prepare backend URL**
   - Run backend locally: `docker compose up --build` in `c:\ESD\esd-project`.
   - Expose Booking API with a tunnel (so OutSystems cloud can reach it), e.g. with ngrok:  
     - `ngrok http 5101`  
     - Use the generated `https://<something>.ngrok.io` as your **base URL** (e.g. `https://<id>.ngrok.io`).

2. **Create OutSystems app**
   - Log in to your OutSystems environment (personal or school).
   - Create a new **Reactive Web App** called e.g. **TravelBookingUI**.

3. **Add REST integration to Booking**
   - In Data → **REST** → **Consume REST API**.
   - Base URL: your tunnel URL (e.g. `https://<id>.ngrok.io`).
   - Add methods:
     - `POST /booking` (CreateBooking).
     - `GET /booking/{id}` (GetBookingById).
     - `POST /booking/cancel/{id}` (CancelBooking).
   - Map the JSON structure to match this backend:
     - Request body for create: `customerID`, `flightID`, `hotelID`, `departureTime`, `totalPrice`, `currency`, `fareType`, `loyaltyTier` (plus optional fields per API, e.g. traveller profiles, seat).
     - Response: use `code` + `data` as defined by the API.

4. **Build OutSystems screens**
   - **Screen 1 – Create Booking**
     - Form inputs: Customer ID, Flight ID, Hotel ID, Departure Date/Time, Total Package Price, Currency, Fare Type, Loyalty Tier.
     - On submit: call `CreateBooking` REST method and show returned `data.id`, `status`, etc.
   - **Screen 2 – Cancel Booking**
     - Input: Booking ID.
     - On submit: call `CancelBooking` REST method and show `refundPercentage`, `refundAmount`, and currency.

5. **How to explain this in slides**
   - OutSystems app is the **front‑end layer**.
   - It calls the existing **Booking API** (plus Payment/Loyalty indirectly through Booking).
   - You can show a simple architecture: browser (OutSystems) → Booking (Flask) → Payment/Loyalty/Notification/MySQL/RabbitMQ.

This section is your **cheat sheet for the OutSystems part**: follow steps 1–4 to implement it, and use step 5 wording in your report/presentation.

This file is meant as your **internal cheat sheet** so everyone in the team knows how the system is wired, what to say in the presentation, and where to extend if needed.

---

### 8. End‑to‑end customer journey, loyalty and refund rules

This section summarises the **business flow** and policies you will implement across UI, Booking, Payment, Hotel, Flight and Loyalty. Some details (like seat selection UI) may be partially implemented or mocked, but this is the target behaviour for your report/demo.

#### 8.1 Booking journey (logged‑in customer)

1. **Log in / Create account**
   - Customer account profile is stored in the **Account** microservice (Python) and/or mirrored in an OutSystems atomic MS.
   - **Traveller profiles** — a per-customer list of saved **companions / co-travellers** (people they fly with: family, colleagues, etc.), usually with passenger data such as legal name, DOB, nationality, **passport** number/expiry — are managed in a separate **Traveller Profile** atomic MS in OutSystems (not the same as the account login row).
2. **Start search**
   - Inputs: origin, destination, travel dates, hotel check‑in/check‑out, number of travellers.
   - System returns a **cheapest baseline bundle** (basic flight + basic hotel).
3. **Customise bundle**
   - **Flight**:
     - Choose airline and departure/arrival time.
     - Choose cabin/class (e.g. Economy Saver / Standard / Flexi, Premium, etc.).
     - Optional: choose baggage and seat (secondary feature).
   - **Hotel**:
     - Choose hotel and room type (STD vs DLX, etc.).
     - Toggle breakfast on/off.
     - Simple placeholder image/icon is shown for hotels (more images are a future enhancement).
   - **Filters**: customer can filter by price, rating or other basic attributes.
4. **Add travellers**
   - Customer picks one or more saved companion profiles from OutSystems (each row = someone they’ve travelled with before, with passport-style details on file). The demo HTML UI may only send one `travellerProfileId` per booking; OutSystems holds the full list and attributes.
5. **Payment + loyalty**
   - Show price breakdown (flight + hotel) and loyalty info:
     - **Coins** are stored in cents (cents earned per $1 spent):
       - Bronze: `1` cent per $1.
       - Silver: `2` cents per $1.
       - Gold: `3` cents per $1.
       - Platinum: `5` cents per $1.
     - **Tier thresholds (by bookings)**:
       - Start at **Bronze**.
       - `2` completed bookings → **Silver**.
       - `5` completed bookings → **Gold**.
       - `10` completed bookings → **Platinum**.
     - **Tier discounts on booking price**:
       - Silver: `10%` discount.
       - Gold: `15%` discount.
       - Platinum: `20%` discount.
      - **Discount codes**:
        - UI can accept promo codes such as `SILVER10`, `GOLD15`, `PLAT20`.
        - Discount is only applied if the customer’s **current tier** is high enough (e.g. `GOLD15` only works for Gold and above).
        - Effective price used for Booking/payment is:  
          `basePrice – tierDiscount – discountCodeAmount – coinsOffset`.
   - Payment logic:
     - Apply tier discount (based on projected tier for this booking).
     - Optionally apply a discount code (extra percentage discount).
     - Apply coins offset after discounts.
     - Charge card (via Payment MS or external provider).
   - After successful payment:
     - Earn coins.
    - Check if tier needs upgrading based on completed booking count thresholds (2/5/10) while coins continue accumulating.
6. **Confirmation + PDF + notification**
   - System generates a simple **PDF booking confirmation**.
   - Notification service sends an email/SMS or exposes the confirmation via `/notifications`.

#### 8.2 Guest journey

- Guest can start a search, customise bundle, enter traveller details and pay **without logging in**.
- For guest bookings:
  - `customerID` is set to `0` in the Booking payload.
  - Loyalty tier/coins are **not applied** (no tier discounts, no coins, no tier upgrades).
  - Booking is still stored and can be retrieved by ID, but is not tied to a persistent account profile.

#### 8.3 Refund and cancellation rules (overview)

High‑level rules you can refer to in slides and code comments:

- **Note about demo vs report wording**
  - The Flask “atomic” demo currently uses a simplified refund-percentage calculation.
  - The rules below are the intended **end-to-end cancellation policy** you can explain in your report/slides and map to Booking/Payment/Loyalty behaviour.

- **Customer cancellation**
  - Flight refund is **always 0%** for customer-initiated cancellation.
  - Hotel follows the 7-day rule:
    - `>= 7` days before departure/check-in: hotel side refundable.
    - `< 7` days: hotel side non-refundable.

- **Flight cancellation rules**
  - **Customer-initiated**: flight refund is **0%**.
  - **Airline-initiated**: flight refund is **100%**.

- **Hotel cancellation rules**
  - **Customer cancels**:
    - Cancel **at least 1 week before check-in** → **100% hotel refund**.
    - Cancel **within 1 week** → **no hotel refund**.
  - **Hotel cancels the stay**:
    - Full hotel-side refund in this demo.

- **Mixed scenario: flight cancelled, hotel not cancelled**
  - Attempt to **re-accommodate** the customer on an alternative flight with **similar timing and price**.
  - If a suitable alternative is found and accepted:
    - Hotel booking continues.
    - No immediate package refund; only fare differences if applicable.
  - If no acceptable alternative exists (or the customer rejects all alternatives):
    - Treat as airline-initiated cancellation in this demo and issue full package refund.

- **Effect on loyalty after cancellation**
  - **Full refunds**:
    - Reverse **both** money and loyalty benefits (coins + booking-count progression adjustments derived from that booking).
    - Treat “cancel booking” as reverting the loyalty state that was earned for that booking.
  - **Partial refunds**:
    - Deduct loyalty benefits proportionally to the refunded amount (or, if you want to keep it simple for the demo: deduct all benefits from that booking; document your choice).

This section allows you to explain:
- The **user journey** (login → search → customise bundle → add travellers → pay → confirmation).
- The **loyalty and tiering logic** (coins, booking-count tiers, discounts).
- The **refund and error‑handling policy** for customer/airline/hotel‑initiated cancellations and mixed cases (like flight cancelled but hotel active).

---

### 9. Final agreed business rules (team source of truth)

Use this as the final aligned rulebook for implementation, demo, and slides.

#### 9.1 User journey (Baseline + Upsell)

1. Log in / create account (or continue as guest).
2. Start search with:
   - destination
   - flight departure/arrival date
   - hotel check-in/check-out date
3. System returns cheapest **baseline bundle** (flight + hotel).
4. User customises:
   - Flight: airline/time, class (Flexi/Elite/Standard), baggage, seat (optional if time).
   - Hotel: hotel upgrade, room type, breakfast.
5. User adds traveller details (support multiple travellers with “+”).
6. Checkout:
   - apply tier discount
   - apply discount code (if eligible)
   - offset using loyalty coins
   - pay online
7. System generates PDF booking confirmation and triggers notification.

#### 9.2 Guest flow

- Guest can search, customise, enter traveller details, and pay without login.
- Guest bookings do not earn/apply loyalty benefits.

#### 9.3 Loyalty, tier, discount, and coins

- Start tier: **Bronze**.
- Tier progression (by completed bookings):
  - `2` bookings → Silver
  - `5` bookings → Gold
  - `10` bookings → Platinum
- Tier discount:
  - Silver `10%`
  - Gold `15%`
  - Platinum `20%`
- Coins earned per `$1` spent:
  - Bronze: `1` cent
  - Silver: `2` cents
  - Gold: `3` cents
  - Platinum: `5` cents
- Coins can offset payment at checkout.
- Full refund should reverse money + loyalty effects from that booking.

#### 9.4 Cancellation and refund precedence

Apply rules in this order:

1. **Customer cancellation ≥ 30 days** before departure:
   - full refund (money + loyalty effects reversed).
2. Else apply component rules:
   - **Flight (customer-initiated)**:
     - no free cancellation
     - customer cancellation generally no flight refund
     - may include fixed fee / no-show model (e.g. `$300`) as configured
     - small-plane/non-refundable fares: no refund
     - big-airline refundable fares: refund after cancellation charge (example `$1000 - $500 = $500`)
   - **Flight (airline-initiated)**:
     - full flight refund
   - **Hotel (customer-initiated)**:
     - `>= 7` days before check-in: `100%` hotel refund
     - `< 7` days: `0%` hotel refund
   - **Hotel (hotel-initiated)**:
     - full hotel refund, including loyalty reversal for that component
3. **Flight cancelled but hotel still active**:
   - try similar alternative flight first
   - if accepted: continue booking
   - if rejected/no suitable alternative: full package refund

#### 9.5 Traveller Profile in OutSystems

- Owned as an **OutSystems atomic** module by a teammate. **Five** REST endpoints exist there; this repo’s Python integration documents the **three** used for demos/scripts in `travellerprofile/outsystems_client.py` (`CreateTravellerProfile`, `GetAllTravellerProfiles`, `byaccount/{customerID}`). For the other two operations, use the teammate’s OutSystems / Service Studio definition as the source of truth.
- **Booking** (Docker) only calls **`byaccount/{customerID}`** and ties `travellerProfileId` to the row **`Id`**; it snapshots `FullName` + masked passport when `TRAVELLER_PROFILE_BASE_URL` is set.

