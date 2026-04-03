# esd-project

Travel package booking demo built with microservices (Flask + Docker Compose).

## Quick Start (Easy Install + Working Web UI)

### 1) Prerequisites
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Use PowerShell in this project folder: `c:\ESD\esd-project`

### 2) Setup
```powershell
Copy-Item .env.example .env
docker compose up --build
```

### 3) Open the app
- Web UI (main): [http://localhost:8080](http://localhost:8080)
- Do **not** open `ui/index.html` using `file://`

### 4) Confirm everything is up
```powershell
docker compose ps
```
You should see containers for `ui`, `booking`, `flight`, `hotel`, `payment`, `loyalty`, `notification`, `graphql`, `booking-db`, `rabbitmq`.

### 5) If UI/API is not working
```powershell
docker compose logs booking --tail 120
docker compose logs ui --tail 120
docker compose logs graphql --tail 120
```

---

## Project requirements (IS213 checklist)

Your **slides, report, video (`video.txt`), and eLearn zip** are still your team’s responsibility — this repo is the executable part. The implementation is intended to satisfy the course **minimum technical requirements**:

| Requirement | How this project satisfies it |
|-------------|-------------------------------|
| ≥3 **interesting** user scenarios | Bundle search & price; book package (orchestration); cancel/refund + notifications. |
| ≥3 atomic microservices, 3+ data entities | e.g. **booking** (+DB), **flight**, **hotel**, **loyalty**, **payment**, **discount**, **notification**, **account**, **bundle-pricing**, **graphql** — each with its own data/concerns. |
| **OutSystems** | Traveller profiles integrated from booking service (see `TRAVELLER_PROFILE_*` env / OutSystems client). |
| Service **reused** across scenarios | **Loyalty**, **payment**, **flight**, **hotel**, **notification** used in multiple flows. |
| **External service** | **Twilio** (SMS, UI + saved config) is the main live hook; **payment** is simulated in Docker. |
| ≥2 scenarios with **orchestration/choreography** | Booking orchestrates many HTTP calls; **RabbitMQ** `notify.user` choreography to notification (+ optional Twilio). |
| Exclusive **data store** per service where applicable | e.g. booking MySQL; in-memory stores in demo services — document in report appendix. |
| ≥1 service with a **DB** | **booking** + `booking-db` (MySQL in Compose). |
| **HTTP** between services | Flask REST calls throughout. |
| **Message-based** communication | RabbitMQ from booking → notification. |
| **Web GUI** + **JSON** | `ui/` SPA-style form + JSON APIs. |
| **Docker** + **Docker Compose** | `docker-compose.yml` (OutSystems excluded from Compose by design). |
| **Beyond-the-labs** (for marks) | **GraphQL** gateway, **Kong** in compose, bundle composite, optional real Twilio, etc. — justify in report. |

## What Is Included

- `booking`: create/cancel package bookings, DB persistence, refund logic
- `flight` + `hotel`: catalog services (fake data)
- `payment`: payment/refund records (simulated)
- `loyalty`: coins + tier logic
- `notification`: RabbitMQ event consumer
- `graphql`: aggregation layer on top of REST
- `ui` (nginx): web app + reverse-proxy under `/api/...`

---

## Main URLs

- UI: [http://localhost:8080](http://localhost:8080)
- Booking API: [http://localhost:5101](http://localhost:5101)
- Notification events: [http://localhost:5106/notifications](http://localhost:5106/notifications)
- GraphQL endpoint: [http://localhost:5110/graphql](http://localhost:5110/graphql)

---

## Core Demo APIs

- `POST /booking`
- `GET /booking/{id}`
- `POST /booking/cancel/{id}`
- `GET /booking/seats/{flightID}`
- `GET /hotel/search?country=&city=&name=`
- `GET /flight/{flightNum}`
- `GET /loyalty/{customerID}/points`
- `GET /notifications`
- `POST /graphql`

---

## Notes for This Demo

- Currency is fixed to **SGD** in UI flow.
- Hotel search supports country/city/name and includes image + room types.
- Seat map blocks already-reserved seats for supported airlines.
- GraphQL is used as a BTL-friendly aggregation layer (REST remains primary architecture).

---

## Full Technical Guide

For comprehensive architecture, business rules, report/demo prep, troubleshooting, and team workflow, see:

- `TEAM_GUIDE.txt` (full team reference — plain text)
- `SCORE_BOOST_CHECKLIST.md` (quick grading/demo uplift checklist)

## Optional: One-command smoke test

After `docker compose up --build`, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke_test.ps1
```
