## Team Guide - Travel Booking Microservices Project (Comprehensive)

This document is the team source of truth for implementation, demo prep, report writing, and handover.

Use `README.md` for quick installation and getting a working web UI fast.  
Use this `TEAM_GUIDE.md` for full technical and project-level reference.

## Quick Navigation
- `1-4`: Project scope, architecture, repo map, runbook
- `5-7`: Business flows, UI behavior, GraphQL/BTL
- `8-10`: API contracts, business rules, OutSystems notes
- `11-13`: Testing, troubleshooting, report/submission checklist
- `14-15`: Team ownership and change-log discipline

## 1) Project Purpose and Scope

### Business scenario
- Users book a bundled trip (flight + hotel), optionally with companion traveller profiles.
- Users can later cancel bookings; refunds follow business rules by cancellation source and timing.
- Loyalty coins and tier affect checkout pricing and post-booking rewards.

### Technical architecture goals
- Use microservices with clear service boundaries and own data stores.
- Use synchronous HTTP orchestration where suitable.
- Use asynchronous messaging (RabbitMQ) for event-driven notifications.
- Include at least one Beyond-The-Labs (BTL) element:
  - GraphQL gateway on top of REST (implemented in this repo).
  - External API integration options (FX, Twilio/SMU notification hooks).

---

## 2) High-Level Architecture

### Services
- `booking` (composite orchestration service, Flask + SQLAlchemy + MySQL)
- `flight` (atomic in-memory catalog, Flask)
- `hotel` (atomic in-memory catalog + room types/add-ons, Flask)
- `payment` (atomic payment/refund recording, Flask)
- `loyalty` (atomic points/tier tracking, Flask)
- `notification` (event consumer + optional external notification integration, Flask)
- `account` (atomic account profile demo, Flask)
- `graphql` (gateway aggregation layer, Flask + Graphene)
- `rabbitmq` (topic exchange message broker)
- `booking-db` (MySQL for booking persistence)
- `ui` (nginx static host + reverse proxy for same-origin API calls)

### Communication patterns
- HTTP sync:
  - UI -> Booking/Loyalty/GraphQL (via nginx reverse proxy)
  - Booking -> Flight/Hotel/Payment/Loyalty
  - GraphQL -> Flight/Hotel/Loyalty
- AMQP async:
  - Booking publishes `booking.cancelled` events to RabbitMQ
  - Notification consumes and stores events for retrieval

### Data ownership
- Booking owns persistent booking records in MySQL.
- Flight/Hotel/Loyalty/Payment/Notification use isolated in-memory stores for demo.
- No direct DB sharing across microservices.

---

## 3) Repository and Runtime Map

### Key directories/files
- `booking/app.py`: booking orchestration, refund logic, booking APIs, seat reservation query endpoint.
- `flight/app.py`: flight catalog + search.
- `hotel/app.py`: hotel catalog + search with room types/add-ons.
- `graphql_gateway/app.py`: GraphQL query schema and resolvers.
- `notification/app.py`: RabbitMQ consumer, notification read endpoint.
- `ui/index.html`, `ui/app.js`, `ui/styles.css`: web UI flow and client logic.
- `nginx/ui.conf`: UI static serving + API reverse proxy config.
- `docker-compose.yml`: all services and networking.
- `init_db.sql`: demo SQL seed references.
- `.env` / `.env.example`: runtime config and secrets.

### Default local URLs
- UI: `http://localhost:8080`
- Booking: `http://localhost:5101`
- Flight: `http://localhost:5102`
- Hotel: `http://localhost:5103`
- Payment: `http://localhost:5104`
- Loyalty: `http://localhost:5105`
- Notification: `http://localhost:5106`
- GraphQL: `http://localhost:5110/graphql`

---

## 4) Setup and Runbook

### Prerequisites
- Docker Desktop (includes Docker Compose).
- Port availability: 8080, 5100-5110, 3307, 5674, 15673.

### First-time setup
1. Copy environment template:
   - PowerShell: `Copy-Item .env.example .env`
2. Fill required values in `.env` (if using external integrations).
3. Start services:
   - `docker compose up --build`
4. Open UI:
   - `http://localhost:8080`

### Restart / reset workflow
- Restart all: `docker compose down && docker compose up --build`
- Only rebuild one service: `docker compose up --build <service>`
- View running status: `docker compose ps`

### Logs and health checks
- Booking logs: `docker compose logs booking --tail 120`
- UI/nginx logs: `docker compose logs ui --tail 120`
- GraphQL logs: `docker compose logs graphql --tail 120`
- RabbitMQ UI: `http://localhost:15673` (guest/guest)

---

## 5) Core Business Flows

### Flow A: Create booking
1. User completes 5-step UI flow (Personal -> Traveller profile -> Hotel -> Flights -> Loyalty/Payment).
2. UI computes final price (tier discount, discount code, coin offset).
3. UI calls `POST /booking`.
4. Booking validates/catalog-checks as configured, stores booking in MySQL.
5. Booking calls loyalty earn flow.
6. Booking returns booking reference and details.

### Flow B: Cancel booking
1. User enters booking reference in cancel form.
2. UI calls `POST /booking/cancel/{id}` with optional `cancelSource`.
3. Booking computes refund:
   - customer cancel: no flight refund, hotel refund by 7-day rule
   - airline cancel: full package refund
   - hotel cancel: hotel-side refund
4. Booking calls payment refund API.
5. Booking adjusts loyalty effects.
6. Booking updates booking status in MySQL.
7. Booking publishes `booking.cancelled` event to RabbitMQ.
8. Notification service consumes and exposes event via `GET /notifications`.

### Flow C: Seat handling
- UI requests reserved seats using `GET /booking/seats/{flightID}`.
- Seat map disables already-reserved seats.
- After booking/cancel, seat map refreshes to avoid stale selection.

---

## 6) UI Guide and UX Behavior

### Main UI principles
- User-friendly booking flow instead of technical form dump.
- Name-based selection where possible (especially traveller profiles).
- Search-select model for hotels/flights rather than raw IDs.

### Current tabs in booking flow
1. Personal particulars
2. Traveller profile (CRUD + selection for lead/companions)
3. Hotel (country/city/name search + images + room details)
4. Flights (seat selection, policy hints)
5. Loyalty and payment (coins, discount, final amount)

### Hotel display behavior
- Shows hotel image, star rating, amenities, total available rooms.
- Shows room type lines (STD/DLX), price/night, breakfast add-on, rooms left.
- Selected room summary updates with room details.

### Flight seat behavior
- SQ routes: interactive seat map enabled.
- Some carriers: check-in-only policy (map disabled by rule).
- Exit-row shown as extra legroom and may require eligibility.

---

## 7) GraphQL (BTL) Guide

### Why GraphQL is included
- Demonstrates API style beyond REST (explicit BTL candidate).
- Aggregates data from multiple atomic services for frontend efficiency.
- Reduces client overfetching and multiple round-trips.

### GraphQL gateway service
- Service: `graphql` in `docker-compose.yml`
- Code: `graphql_gateway/app.py`
- Endpoint: `POST /graphql` (proxied via nginx as `/api/graphql/graphql`)

### Implemented queries
- `hotelSearch(country, city, name)`
  - Returns hotel list with room types/add-ons in one response.
- `packagePreview(customerID, flightID, hotelID, roomCode)`
  - Aggregates flight + hotel + loyalty and returns estimated total.

### UI integration status
- `ui/app.js` hotel search uses GraphQL first.
- REST fallback retained for demo resilience if GraphQL is unavailable.

### Example GraphQL payload
```json
{
  "query": "query($country:String,$city:String,$name:String){ hotelSearch(country:$country, city:$city, name:$name){ hotelID name city country roomTypes { code label pricePerNight includesBreakfast availableRooms } } }",
  "variables": { "country": "Singapore", "city": "", "name": "" }
}
```

---

## 8) API Contract Summary

### Booking
- `POST /booking`
- `GET /booking/{id}`
- `POST /booking/cancel/{id}`
- `GET /booking/seats/{flightID}`
- traveller profile proxy routes:
  - `GET /travellerprofiles/byaccount/{customerID}`
  - `POST /travellerprofiles/create`
  - `PUT /travellerprofiles/update/{id}`
  - `DELETE /travellerprofiles/delete/{id}`

### Flight
- `GET /flight/{flightNum}`
- `GET /flight/search`

### Hotel
- `GET /hotel/{hotelID}`
- `GET /hotel/search?country=&city=&name=`

### Loyalty
- `GET /loyalty/{customerID}/points`
- `POST /loyalty/earn`
- `POST /loyalty/adjust`

### Payment
- `POST /payment`
- `POST /payment/refund`

### Notification
- `GET /notifications`
- `POST /notify/manual`

---

## 9) Business Rules and Assumptions

### Loyalty
- Tier by completed booking count:
  - `<2` Bronze, `2-4` Silver, `5-9` Gold, `>=10` Platinum.
- Tier discount (UI pricing model):
  - Silver 10%, Gold 15%, Platinum 20%.
- Coins earn rate in cents per 1 SGD (configured in loyalty service).
- On cancellation, loyalty side effects are reversed/adjusted.

### Refund policy
- Customer cancellation:
  - flight refund = 0
  - hotel refund = 100% only if >= 7 days before departure/check-in, else 0
- Airline cancellation:
  - full package refund
- Hotel cancellation:
  - hotel-side refund

### Traveller profile assumptions
- OutSystems traveller profile service may be optional in local demos.
- If unavailable/unconfigured, UI degrades gracefully with messaging.

---

## 10) OutSystems Integration Notes

### Recommended approach
- Keep OutSystems as presentation/workflow UI layer.
- Consume Python REST APIs for booking and cancellation.
- Optionally consume GraphQL endpoint for richer search/display.

### Connectivity
- If OutSystems cloud cannot reach local Docker host directly, use secure tunneling.
- Map OutSystems structures to backend JSON (`code` + `data` envelope style).

### Demo-safe advice
- Prepare fallback demo video in case external tunnel/network fails.

---

## 11) Testing and Demo Script

### Minimum smoke test checklist
1. Open UI at `http://localhost:8080`.
2. Search hotel by country (`Singapore` / `France`) and verify images + room lines.
3. Select room type and verify selected room summary updates.
4. Select SQ flight, verify seat map appears and taken seats disabled.
5. Create booking, note booking reference.
6. Cancel booking with `customer` and verify refund amount logic.
7. Check `GET /notifications` for consumed `booking.cancelled`.
8. Verify loyalty values change after create and cancel.
9. Test GraphQL `hotelSearch` directly via `/graphql`.

### Suggested 15-minute presentation demo order
1. Architecture slide (services + sync/async lines).
2. Create booking in UI.
3. Show loyalty effect.
4. Cancel booking and show refund + notification event.
5. Show GraphQL request/response and explain BTL value.

---

## 12) Troubleshooting Playbook

### UI loads but API actions fail
- Ensure opened from `http://localhost:8080`, not `file://`.
- Check nginx route config in `nginx/ui.conf`.
- Check `docker compose ps` for missing/down services.

### Nginx upstream resolution issues
- Ensure service names in `docker-compose.yml` match nginx upstream names.
- Rebuild UI container after config changes:
  - `docker compose up --build ui`

### Booking startup errors
- DB not ready: check `booking-db` health.
- Verify `BOOKING_DB_URL` matches DB creds.

### GraphQL issues
- Check `graphql` container is up.
- Test direct endpoint `http://localhost:5110/graphql`.
- Verify query fields match schema names exactly.

### RabbitMQ/notifications issues
- Confirm rabbitmq service up and queue bindings active.
- Verify notification consumer thread running via logs.

---

## 13) Report and Submission Checklist

### Must include
- Slides, report, source code, README, and demo video link.
- API documentation appendix for all microservices.
- Architecture and interaction diagrams consistent with real implementation.
- Team contribution table.

### BTL evidence checklist
- Show GraphQL gateway in architecture diagram.
- Show at least one real GraphQL request/response.
- Explain why GraphQL is beneficial for your scenario (aggregation + flexibility).

### Consistency checks before submission
- Ensure code, slides, and report describe the same implemented behavior.
- Avoid claiming unimplemented features as complete.
- Note assumptions and demo constraints explicitly.

---

## 14) Team Ownership and Operating Model

### Suggested ownership split
- Member A: Booking + DB + refund orchestration.
- Member B: Loyalty + Payment business rules.
- Member C: Notification + RabbitMQ + external notify integrations.
- Member D: UI/UX flow + GraphQL client usage.
- Member E: OutSystems + report/diagrams + integration verification.

### Working agreements
- One source of truth for business rules: this file.
- Update this guide whenever behavior changes.
- Validate via smoke checklist before merging.

---

## 15) Change Log Guidance

When major changes are made, append:
- Date
- What changed
- Why
- Impacted services/files
- Demo/report implications

Keeping this concise log prevents drift between code and presentation content.

