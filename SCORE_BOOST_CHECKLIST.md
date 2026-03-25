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
