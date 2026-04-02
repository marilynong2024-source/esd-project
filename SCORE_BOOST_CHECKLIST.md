# Score Boost Checklist (Practical)

Use this in the final week to move marks from "good" to "very good / exceptional".

## 1) Demo Reliability (highest impact)

- Run this before class:
  - `docker compose up --build`
  - `powershell -ExecutionPolicy Bypass -File .\scripts\smoke_test.ps1`
- Keep one terminal open with:
  - `docker compose ps`
  - `docker compose logs booking --tail 80`
- Prepare backup demo video (max 3 min) and verify the URL works.

## 2) Presentation Structure (15 minutes)

- Slide 1: Problem and user journey (why your scenario matters).
- Slide 2: Architecture (services + DB + RabbitMQ + GraphQL gateway).
- Slide 3: Sequence flow for create booking (HTTP orchestration).
- Slide 4: Sequence flow for cancel booking (refund + MQ event).
- Slide 5: BTL justification (GraphQL + real benefit).
- Slide 6+: Live demo.

## 3) Demo Flow To Impress

1. Search hotels by country/city/name and select room type with add-ons.
2. Show flights + seat map behavior (taken seats disabled).
3. Create booking and highlight booking reference.
4. Show loyalty update.
5. Cancel booking and show refund breakdown.
6. Open notifications endpoint and show consumed event.
7. Show one GraphQL query live (`hotelSearch`) and explain reduced calls.

## 4) BTL Talking Points (what to say)

- "We kept REST microservices (core requirement), and added GraphQL as a gateway, not a replacement."
- "GraphQL aggregates hotel/flight/loyalty shaped data in one query for frontend screens."
- "This reduces frontend overfetching and coupling to multiple endpoints."
- "We still maintain service boundaries and independent data stores."

## 5) Report Quality Boost

- Ensure every claimed feature is visibly demoed and in code.
- Include:
  - architecture diagram,
  - interaction diagrams,
  - API appendix,
  - team contribution table,
  - assumptions and limitations.
- Keep report consistent with exact implemented behavior (no over-claims).

## 6) Risk Controls (save marks)

- Avoid introducing new major features right before demo.
- Keep SGD-only checkout in demo to avoid FX instability.
- If external APIs are used, make them optional/non-blocking.
- Rehearse Q&A: refund rules, loyalty logic, and why GraphQL was used.

## 7) Last 48-Hour Plan

- Day -2:
  - freeze features, fix bugs, validate smoke script.
- Day -1:
  - full rehearsal with timer and one backup device.
- Demo day:
  - run smoke script, restart stack once, use stable scripted flow.

## 8) Minimum technical requirements vs this codebase (verification)

Use this when writing the report appendix or rehearsing Q&A.

| Course requirement | Project evidence (where to look) |
|---------------------|----------------------------------|
| 3+ **interesting** scenarios | Bundle pricing flow; book with holds/pay/confirm/loyalty/notify; cancel with refund/release/MQ/SMS. |
| 3+ atomic microservices | `booking`, `flight`, `hotel`, `loyalty`, `payment`, `notification`, `discount`, `bundle-pricing`, `account`, `graphql_gateway`, etc. |
| **OutSystems** | Traveller profile CRUD from booking (`traveller_os`, OutSystems client, `TRAVELLER_PROFILE_BASE_URL`). |
| Reuse across scenarios | **Loyalty** + **payment** + **notification** in book and cancel; **flight**/**hotel** in search and book. |
| External service | **Twilio** (UI-configured), optional **SMU** email; payment is **simulated** (Stripe-shaped demo — state that in report). |
| Orchestration / choreography (×2) | **Booking** orchestrates HTTP chain; **RabbitMQ** `notify.user` for async notification/Twilio. |
| Own data store per service | Booking DB vs in-memory flight/hotel/loyalty/payment stores — state assumptions in report. |
| ≥1 DB | `booking-db` MySQL + SQLAlchemy models. |
| HTTP + messages + JSON + web UI | REST + AMQP + `ui/` + JSON bodies. |
| Docker Compose | `docker-compose.yml` (local deploy; OutSystems external). |
| **BTL** (up to 3 marks) | GraphQL gateway, Kong, composite bundle service, real Twilio path, inventory/availability PUTs aligned to diagrams — **justify benefit** in one report slide + appendix. |

**Deliverables you cannot automate in code:** proposal session, **slides**, **6-page report** (+ appendix), **`video.txt`** with YouTube URL, **eLearn** upload, inter-team evaluation, team contribution table.

## 9) UI / UX expectations (course + guests)

- Prefer **human labels** on the form (member names, “booking reference”, “package total”) — internal field names stay in JSON for APIs only.
- **Nice enough** for marks = clear steps, readable type, obvious primary actions (`styles.css` + sidebar summary). Fancy animation is optional; **reliable demo** beats decoration.
- **Improvements to aim for** if you have time: loading states on slow searches, inline success toast after book, empty-state copy when no hotels found, and a one-page “demo script” PDF for the presenter only.
