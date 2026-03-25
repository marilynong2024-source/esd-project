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

- `TEAM_GUIDE.md`
- `SCORE_BOOST_CHECKLIST.md` (quick grading/demo uplift checklist)

## Optional: One-command smoke test

After `docker compose up --build`, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke_test.ps1
```
