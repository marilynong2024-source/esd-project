from __future__ import annotations

from datetime import date, datetime, timedelta
import os
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Demo reservation lifecycle store (per booking)
# Diagram-aligned endpoints:
# - POST /reserve-seat
# - PUT /confirm-seat
# - PUT /release-seat
#
# Supports multi-seat reservations by storing `seatNos` (list) under the same bookingID.
FLIGHT_RESERVATIONS: dict[int, dict] = {}
HOLD_MINUTES = int(os.environ.get("SEAT_HOLD_MINUTES", "15") or "15")


def _utc_now() -> datetime:
    return datetime.utcnow()


def _parse_iso_dt(raw):
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw))
    except Exception:
        return None


def _flight_departure_date(f: dict) -> date | None:
    """Calendar date of departure (for matching hero / bundle date search)."""
    raw = f.get("departureTime")
    if raw is None:
        return None
    s = str(raw).strip().replace(" ", "T")
    if len(s) >= 10:
        try:
            return datetime.strptime(s[:10], "%Y-%m-%d").date()
        except ValueError:
            pass
    dt = _parse_iso_dt(s)
    return dt.date() if dt else None


def _narrow_flights_by_depart_date(results: list[dict], depart_raw: str, win: int) -> list[dict]:
    """Keep flights whose departure calendar day is within ±win days of depart_raw (YYYY-MM-DD)."""
    if not results or not depart_raw or len(str(depart_raw).strip()) < 10:
        return results
    try:
        target_d = datetime.strptime(str(depart_raw).strip()[:10], "%Y-%m-%d").date()
    except ValueError:
        return results
    win = max(0, min(int(win), 14))
    windows = [win]
    if win < 5:
        windows.extend([5, 10, 14])
    for w in windows:
        filtered: list[dict] = []
        for f in results:
            fd = _flight_departure_date(f)
            if fd is not None and abs((fd - target_d).days) <= w:
                filtered.append(f)
        if filtered:
            return filtered
    return results


def _purge_expired_holds():
    now = _utc_now()
    for bid, rec in list(FLIGHT_RESERVATIONS.items()):
        if str(rec.get("status", "")).upper() != "HELD":
            continue
        expires_at = _parse_iso_dt(rec.get("holdExpiresAt"))
        if expires_at and expires_at <= now:
            FLIGHT_RESERVATIONS.pop(bid, None)


def _online_seat_selection(flight_num: str) -> bool:
    # Match UI logic: it enables seat map when prefix is "SQ".
    code = str(flight_num).upper()[:2]
    return code == "SQ"


FLIGHTS = {
    # Keep existing IDs used by current UI defaults
    "SQ001": {
        "flightNum": "SQ001",
        "flightNumber": "SQ001",
        "airline": "Singapore Airlines",
        "origin": "SIN",
        "destination": "NRT",
        "originCity": "Singapore",
        "destinationCity": "Tokyo",
        "departureTime": "2026-05-01T10:00",
        "arrivalTime": "2026-05-01T15:30",
        "durationMins": 390,
        "economyPrice": 668.0,
        "businessPrice": 2180.0,
        "availableSeats": 42,
        "onlineSeatSelection": True,
        "seatNote": "Standard online seat map (demo).",
        "imageUrl": "https://picsum.photos/seed/flight/400/200",
    },
    "SQ002": {
        "flightNum": "SQ002",
        "flightNumber": "SQ002",
        "airline": "Singapore Airlines",
        "origin": "SIN",
        "destination": "SYD",
        "originCity": "Singapore",
        "destinationCity": "Sydney",
        "departureTime": "2026-06-15T09:30",
        "arrivalTime": "2026-06-15T19:30",
        "durationMins": 480,
        "economyPrice": 520.0,
        "businessPrice": 1400.0,
        "availableSeats": 36,
        "onlineSeatSelection": True,
        "seatNote": "Standard online seat map (demo).",
        "imageUrl": "https://picsum.photos/seed/flight/400/200",
    },
    "AK123": {
        "flightNum": "AK123",
        "flightNumber": "AK123",
        "airline": "AirAsia",
        "origin": "SIN",
        "destination": "KUL",
        "originCity": "Singapore",
        "destinationCity": "Kuala Lumpur",
        "departureTime": "2026-07-01T14:00",
        "arrivalTime": "2026-07-01T22:00",
        "durationMins": 480,
        "economyPrice": 280.0,
        "businessPrice": None,
        "availableSeats": 180,
        "onlineSeatSelection": False,
        "seatNote": "AirAsia (demo): seat assignment at online check-in or airport — no advance seat pick in this demo.",
        "imageUrl": "https://picsum.photos/seed/flight/400/200",
    },
    "AA456": {
        "flightNum": "AA456",
        "flightNumber": "AA456",
        "airline": "American Airlines",
        "origin": "SIN",
        "destination": "NRT",
        "originCity": "Singapore",
        "destinationCity": "Tokyo",
        "departureTime": "2026-08-01T10:00",
        "arrivalTime": "2026-08-01T15:00",
        "durationMins": 300,
        "economyPrice": 558.0,
        "businessPrice": 1680.0,
        "availableSeats": 220,
        "onlineSeatSelection": False,
        "seatNote": "Partner / long-haul policy (demo): choose seats at check-in or with an agent.",
        "imageUrl": "https://picsum.photos/seed/flight/400/200",
    },
    "TR789": {
        "flightNum": "TR789",
        "flightNumber": "TR789",
        "airline": "Scoot",
        "origin": "SIN",
        "destination": "BKK",
        "originCity": "Singapore",
        "destinationCity": "Bangkok",
        "departureTime": "2026-08-10T08:00",
        "arrivalTime": "2026-08-10T15:40",
        "durationMins": 100,
        "economyPrice": 99.0,
        "businessPrice": None,
        "availableSeats": 189,
        "onlineSeatSelection": False,
        "seatNote": "Scoot (demo): budget carrier — seat selection at check-in or paid add-on via airline app.",
        "imageUrl": "https://picsum.photos/seed/flight/400/200",
    },
}


# Add extra demo flights from `init_db.sql` (Hotel/Flight sample DB seed).
# These use the same flightNum keys, so existing booking/calls keep working.
_EXTRA_FLIGHTS = [
    # SIN → NRT (Tokyo) — align outbound with default hero dates (May 2026)
    ("SQ634", "Singapore Airlines", "SIN", "NRT", "Singapore", "Tokyo", "2026-05-01T08:00:00", "2026-05-01T15:30:00", 390, 688.00, 2180.00, 120, 120),
    ("SQ636", "Singapore Airlines", "SIN", "NRT", "Singapore", "Tokyo", "2026-05-01T22:00:00", "2026-05-02T05:30:00", 390, 628.00, 1980.00, 95, 95),
    ("TR808", "Scoot", "SIN", "NRT", "Singapore", "Tokyo", "2026-05-01T06:00:00", "2026-05-01T14:00:00", 480, 348.00, None, 150, 150),
    ("3K521", "Jetstar Asia", "SIN", "NRT", "Singapore", "Tokyo", "2026-05-01T09:30:00", "2026-05-01T17:45:00", 495, 318.00, None, 80, 80),

    # SIN → BKK (Bangkok)
    ("SQ706", "Singapore Airlines", "SIN", "BKK", "Singapore", "Bangkok", "2026-05-01T07:00:00", "2026-05-01T08:30:00", 90, 180.00, 520.00, 140, 140),
    ("SQ708", "Singapore Airlines", "SIN", "BKK", "Singapore", "Bangkok", "2026-05-01T14:00:00", "2026-05-01T15:30:00", 90, 170.00, 500.00, 100, 100),
    ("TR862", "Scoot", "SIN", "BKK", "Singapore", "Bangkok", "2026-05-01T10:00:00", "2026-05-01T11:40:00", 100, 99.00, None, 160, 160),

    # SIN → LHR (London)
    ("SQ322", "Singapore Airlines", "SIN", "LHR", "Singapore", "London", "2026-05-01T23:55:00", "2026-05-02T06:00:00", 725, 980.00, 3200.00, 200, 200),
    ("SQ306", "Singapore Airlines", "SIN", "LHR", "Singapore", "London", "2026-05-01T09:00:00", "2026-05-01T15:30:00", 750, 950.00, 3100.00, 180, 180),

    # SIN → SYD (Sydney)
    ("SQ221", "Singapore Airlines", "SIN", "SYD", "Singapore", "Sydney", "2026-05-01T08:30:00", "2026-05-01T19:30:00", 480, 520.00, 1400.00, 170, 170),
    ("TR8", "Scoot", "SIN", "SYD", "Singapore", "Sydney", "2026-05-01T07:00:00", "2026-05-01T17:45:00", 465, 320.00, None, 200, 200),

    # SIN → DPS (Bali)
    ("SQ944", "Singapore Airlines", "SIN", "DPS", "Singapore", "Bali", "2026-05-01T08:00:00", "2026-05-01T09:30:00", 90, 160.00, 480.00, 130, 130),
    ("TR282", "Scoot", "SIN", "DPS", "Singapore", "Bali", "2026-05-01T06:30:00", "2026-05-01T08:10:00", 100, 89.00, None, 155, 155),

    # Return flights: NRT → SIN (default return matches hero 6 May 2026)
    ("SQ635", "Singapore Airlines", "NRT", "SIN", "Tokyo", "Singapore", "2026-05-06T17:00:00", "2026-05-06T23:00:00", 360, 658.00, 2080.00, 110, 110),
    ("TR809", "Scoot", "NRT", "SIN", "Tokyo", "Singapore", "2026-05-06T15:00:00", "2026-05-06T21:30:00", 390, 328.00, None, 140, 140),

    # Return flights: BKK → SIN
    ("SQ707", "Singapore Airlines", "BKK", "SIN", "Bangkok", "Singapore", "2026-05-06T10:00:00", "2026-05-06T13:30:00", 90, 180.00, 520.00, 120, 120),
    ("TR863", "Scoot", "BKK", "SIN", "Bangkok", "Singapore", "2026-05-06T14:00:00", "2026-05-06T15:40:00", 100, 99.00, None, 150, 150),
    # Worldwide demo routes (bundle gallery beyond Singapore departures)
    ("BA201", "British Airways", "LHR", "CDG", "London", "Paris", "2025-07-01T09:00:00", "2025-07-01T11:30:00", 150, 320.00, 900.00, 180, 100),
    ("BA102", "British Airways", "CDG", "LHR", "Paris", "London", "2025-07-05T18:00:00", "2025-07-05T18:55:00", 115, 185.00, 520.00, 180, 110),
    ("BA304E", "British Airways", "LHR", "NRT", "London", "Tokyo", "2025-07-06T11:00:00", "2025-07-07T07:00:00", 720, 890.00, 3100.00, 280, 72),
    ("JL905", "Japan Airlines", "NRT", "BKK", "Tokyo", "Bangkok", "2025-07-02T11:00:00", "2025-07-02T16:00:00", 320, 410.00, 1200.00, 200, 88),
    ("QF031", "Qantas", "SYD", "SIN", "Sydney", "Singapore", "2025-07-03T20:00:00", "2025-07-04T01:30:00", 480, 580.00, 1600.00, 250, 96),
    ("TG604", "Thai Airways", "BKK", "DPS", "Bangkok", "Bali", "2025-07-04T10:00:00", "2025-07-04T14:30:00", 120, 220.00, 650.00, 180, 74),
]


for (
    flight_num,
    airline,
    origin,
    destination,
    origin_city,
    destination_city,
    departure_time,
    arrival_time,
    duration_mins,
    economy_price,
    business_price,
    total_seats,
    available_seats,
) in _EXTRA_FLIGHTS:
    flight_num = str(flight_num).upper()
    if flight_num in FLIGHTS:
        continue
    online = _online_seat_selection(flight_num)
    FLIGHTS[flight_num] = {
        "flightNum": flight_num,
        "flightNumber": flight_num,
        "airline": airline,
        "origin": origin,
        "destination": destination,
        "originCity": origin_city,
        "destinationCity": destination_city,
        "departureTime": str(departure_time).replace(" ", "T"),
        "arrivalTime": str(arrival_time).replace(" ", "T"),
        "durationMins": int(duration_mins),
        "economyPrice": float(economy_price),
        "businessPrice": business_price if business_price is None else float(business_price),
        "availableSeats": int(available_seats),
        "onlineSeatSelection": online,
        "seatNote": (
            "Standard online seat map (demo)."
            if online
            else "Seat assignment at check-in/airport (demo)."
        ),
        "imageUrl": "https://picsum.photos/seed/flight/400/200",
    }


_GEN_SEQ = 0


def _next_flight_num(prefix: str) -> str:
    global _GEN_SEQ
    while True:
        _GEN_SEQ += 1
        n = _GEN_SEQ % 10000
        pref = str(prefix).upper()
        cand = f"{pref}{n:04d}"
        if len(cand) > 8:
            cand = f"{pref}{n % 9999:04d}"
        if cand not in FLIGHTS:
            return cand


def _merge_programmatic_catalog() -> None:
    """Hundreds of demo flights for dropdowns and availability (in-memory)."""
    route_specs: list[tuple[str, str, str, str, int, float]] = [
        ("Singapore", "Tokyo", "SIN", "NRT", 400, 598),
        ("Singapore", "Bangkok", "SIN", "BKK", 100, 210),
        ("Singapore", "Bali", "SIN", "DPS", 170, 195),
        ("Singapore", "Sydney", "SIN", "SYD", 510, 560),
        ("Singapore", "London", "SIN", "LHR", 820, 990),
        ("Singapore", "Paris", "SIN", "CDG", 840, 1010),
        ("Singapore", "Kuala Lumpur", "SIN", "KUL", 70, 98),
        ("Tokyo", "Singapore", "NRT", "SIN", 415, 588),
        ("Tokyo", "Bangkok", "NRT", "BKK", 340, 420),
        ("Tokyo", "Sydney", "NRT", "SYD", 550, 890),
        ("London", "Paris", "LHR", "CDG", 85, 175),
        ("London", "Tokyo", "LHR", "NRT", 745, 940),
        ("London", "Singapore", "LHR", "SIN", 830, 1040),
        ("Paris", "London", "CDG", "LHR", 90, 168),
        ("Paris", "Tokyo", "CDG", "NRT", 770, 950),
        ("Sydney", "Singapore", "SYD", "SIN", 520, 570),
        ("Sydney", "Melbourne", "SYD", "MEL", 95, 110),
        ("Melbourne", "Sydney", "MEL", "SYD", 95, 108),
        ("Bangkok", "Singapore", "BKK", "SIN", 110, 205),
        ("Bangkok", "Bali", "BKK", "DPS", 195, 245),
        ("Bangkok", "Tokyo", "BKK", "NRT", 355, 470),
        ("Bali", "Singapore", "DPS", "SIN", 160, 188),
        ("Kuala Lumpur", "Singapore", "KUL", "SIN", 72, 92),
        ("Seoul", "Bangkok", "ICN", "BKK", 340, 430),
        ("Seoul", "Tokyo", "ICN", "NRT", 145, 235),
        ("Seoul", "Singapore", "ICN", "SIN", 400, 510),
        ("Manila", "Singapore", "MNL", "SIN", 215, 200),
        ("Manila", "Tokyo", "MNL", "NRT", 270, 380),
        ("Dubai", "London", "DXB", "LHR", 475, 640),
        ("Dubai", "Singapore", "DXB", "SIN", 485, 590),
        ("Frankfurt", "Singapore", "FRA", "SIN", 780, 880),
        ("Amsterdam", "London", "AMS", "LHR", 85, 155),
        ("Amsterdam", "Singapore", "AMS", "SIN", 795, 900),
        ("Los Angeles", "Tokyo", "LAX", "NRT", 660, 720),
        ("San Francisco", "Singapore", "SFO", "SIN", 1000, 1180),
        ("Ho Chi Minh City", "Singapore", "SGN", "SIN", 120, 165),
        ("Hanoi", "Bangkok", "HAN", "BKK", 110, 145),
        ("Jakarta", "Singapore", "CGK", "SIN", 100, 125),
        ("Chennai", "Singapore", "MAA", "SIN", 240, 280),
    ]
    dep_slots = ["06:20", "08:55", "11:30", "14:15", "17:40", "20:25", "23:10"]
    carriers: list[tuple[str, str]] = [
        ("Singapore Airlines", "SQ"),
        ("Scoot", "TR"),
        ("AirAsia", "AK"),
        ("Jetstar Asia", "3K"),
        ("British Airways", "BA"),
        ("Japan Airlines", "JL"),
        ("ANA", "NH"),
        ("Qantas", "QF"),
        ("Thai Airways", "TG"),
        ("Cathay Pacific", "CX"),
        ("Emirates", "EK"),
        ("Korean Air", "KE"),
        ("Philippine Airlines", "PR"),
        ("Vietnam Airlines", "VN"),
        ("Garuda Indonesia", "GA"),
        ("United Airlines", "UA"),
        ("Delta Air Lines", "DL"),
        ("Lufthansa", "LH"),
        ("KLM", "KL"),
    ]
    base_day0 = datetime(2026, 5, 1, tzinfo=None)

    for rxi, (oc, dc, apio, apd, dur_mins, price_mid) in enumerate(route_specs):
        for si, hhmm in enumerate(dep_slots):
            airline, prefix = carriers[(rxi + si * 3) % len(carriers)]
            flight_num = _next_flight_num(prefix)
            h, m = (int(hhmm[:2]), int(hhmm[3:]))
            dep_dt = base_day0 + timedelta(days=(rxi + si) % 28, hours=h, minutes=m)
            arr_dt = dep_dt + timedelta(minutes=int(dur_mins))
            dep_s = dep_dt.strftime("%Y-%m-%dT%H:%M")
            arr_s = arr_dt.strftime("%Y-%m-%dT%H:%M")
            jitter = ((rxi * 17 + si * 31) % 90) - 45
            economy = max(59.0, float(price_mid) + jitter * 0.4)
            biz = (
                round(economy * 2.8, 2)
                if prefix in ("SQ", "BA", "JL", "NH", "QF", "EK", "KE", "LH", "KL")
                else None
            )
            seats = max(24, 320 - (rxi * 9 + si * 11) % 260)
            online = _online_seat_selection(flight_num)
            FLIGHTS[flight_num] = {
                "flightNum": flight_num,
                "flightNumber": flight_num,
                "airline": airline,
                "origin": apio,
                "destination": apd,
                "originCity": oc,
                "destinationCity": dc,
                "departureTime": dep_s,
                "arrivalTime": arr_s,
                "durationMins": int(dur_mins),
                "economyPrice": round(economy, 2),
                "businessPrice": biz,
                "availableSeats": int(seats),
                "onlineSeatSelection": online,
                "seatNote": (
                    "Standard online seat map (demo)."
                    if online
                    else "Seat assignment at check-in/airport (demo)."
                ),
                "imageUrl": f"https://picsum.photos/seed/{flight_num}/400/200",
            }


_merge_programmatic_catalog()


@app.route("/flight/<flight_num>", methods=["GET"])
def get_flight(flight_num: str):
    flight = FLIGHTS.get(flight_num.upper())
    if not flight:
        return jsonify({"code": 404, "message": "Flight not found"}), 404
    # Backward-compatible keys for current booking UI:
    flight.setdefault("flightNum", flight.get("flightNumber", flight_num.upper()))
    return jsonify({"code": 200, "data": flight}), 200


@app.route("/flight/search", methods=["GET"])
def search_flights():
    origin_city = (request.args.get("originCity") or "").strip().lower()
    destination_city = (request.args.get("destinationCity") or "").strip().lower()
    origin_country = (request.args.get("originCountry") or "").strip().lower()
    destination_country = (request.args.get("destinationCountry") or "").strip().lower()

    city_to_country = {
        "singapore": "singapore",
        "tokyo": "japan",
        "bangkok": "thailand",
        "london": "uk",
        "sydney": "australia",
        "bali": "indonesia",
        "kuala lumpur": "malaysia",
        "paris": "france",
        "seoul": "south korea",
        "manila": "philippines",
        "dubai": "uae",
        "melbourne": "australia",
        "frankfurt": "germany",
        "amsterdam": "netherlands",
        "los angeles": "usa",
        "san francisco": "usa",
        "ho chi minh city": "vietnam",
        "hanoi": "vietnam",
        "jakarta": "indonesia",
        "chennai": "india",
    }

    min_seats = int(request.args.get("minSeats") or "0")

    results = []
    for _, f in FLIGHTS.items():
        if min_seats > 0:
            try:
                if int(f.get("availableSeats") or 0) < min_seats:
                    continue
            except (TypeError, ValueError):
                continue
        if origin_city and str(f.get("originCity", "")).lower() != origin_city:
            continue
        if destination_city and str(f.get("destinationCity", "")).lower() != destination_city:
            continue
        if origin_country:
            oc = city_to_country.get(str(f.get("originCity", "")).lower(), "")
            if not oc or oc != origin_country:
                continue
        if destination_country:
            dc = city_to_country.get(str(f.get("destinationCity", "")).lower(), "")
            if not dc or dc != destination_country:
                continue
        results.append(f)

    # Optional: only flights whose departure date is near the traveller's chosen outbound day.
    depart_raw = (request.args.get("departDate") or request.args.get("departureDate") or "").strip()
    try:
        win = int(request.args.get("dateWindowDays") or "2")
    except (TypeError, ValueError):
        win = 2
    results = _narrow_flights_by_depart_date(results, depart_raw, win)

    return jsonify({"code": 200, "data": results}), 200


@app.route("/availability", methods=["GET"])
def availability():
    """
    Bundle pricing helper for Diagram compliance.

    Accepts:
    - origin / originCity
    - destination / destinationCity

    Returns a single best matching flight with availableSeats.
    """
    origin_city = (request.args.get("originCity") or request.args.get("origin") or "").strip().lower()
    destination_city = (
        request.args.get("destinationCity") or request.args.get("destination") or ""
    ).strip().lower()
    depart_raw = (request.args.get("departDate") or request.args.get("departureDate") or "").strip()
    try:
        win = int(request.args.get("dateWindowDays") or "2")
    except (TypeError, ValueError):
        win = 2

    matches: list[dict] = []
    for _, f in FLIGHTS.items():
        if origin_city and str(f.get("originCity", "")).lower() != origin_city:
            continue
        if destination_city and str(f.get("destinationCity", "")).lower() != destination_city:
            continue
        matches.append(f)

    matches = _narrow_flights_by_depart_date(matches, depart_raw, win)

    best = None
    best_price = None
    for f in matches:
        # Choose cheapest economy as "best".
        price = f.get("economyPrice")
        try:
            price_f = float(price)
        except Exception:
            price_f = float("inf")
        if best is None or price_f < best_price:
            best = f
            best_price = price_f

    if not best:
        return jsonify({"code": 404, "message": "No matching flight availability"}), 404

    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "flightNum": best.get("flightNum") or best.get("flightNumber"),
                    "availableSeats": int(best.get("availableSeats") or 0),
                    "originCity": best.get("originCity"),
                    "destinationCity": best.get("destinationCity"),
                },
            }
        ),
        200,
    )


@app.route("/flights/price", methods=["GET"])
@app.route("/price", methods=["GET"])
def price():
    """
    Bundle pricing helper for Diagram compliance.

    Accepts either:
    - flightNum
    or fallback to origin+destination.
    """
    flight_num = (request.args.get("flightNum") or "").strip().upper()
    # Direct fetch if flightNum was provided
    flight = FLIGHTS.get(flight_num) if flight_num else None
    if flight_num and not flight:
        return jsonify({"code": 404, "message": "Flight not found"}), 404

    if not flight:
        # If flightNum isn't provided, pick the cheapest matching flight like availability()
        origin_city = (request.args.get("originCity") or request.args.get("origin") or "").strip().lower()
        destination_city = (
            request.args.get("destinationCity") or request.args.get("destination") or ""
        ).strip().lower()
        depart_raw = (request.args.get("departDate") or request.args.get("departureDate") or "").strip()
        try:
            win = int(request.args.get("dateWindowDays") or "2")
        except (TypeError, ValueError):
            win = 2
        matches = []
        for _, f in FLIGHTS.items():
            if origin_city and str(f.get("originCity", "")).lower() != origin_city:
                continue
            if destination_city and str(f.get("destinationCity", "")).lower() != destination_city:
                continue
            matches.append(f)
        matches = _narrow_flights_by_depart_date(matches, depart_raw, win)
        best = None
        best_price = None
        for f in matches:
            try:
                price_f = float(f.get("economyPrice") or 0)
            except Exception:
                price_f = float("inf")
            if best is None or price_f < best_price:
                best = f
                best_price = price_f
        flight = best

    if not flight:
        return jsonify({"code": 404, "message": "No matching flight price"}), 404

    try:
        economy_price = float(flight.get("economyPrice") or 0)
    except Exception:
        economy_price = 0.0

    return jsonify({"code": 200, "data": {"flightNum": flight.get("flightNum"), "price": economy_price}}), 200


@app.route("/reserve-seat", methods=["POST"])
def reserve_seat():
    """
    Reserve a seat for a pending booking.

    Body:
      - bookingID (int)
      - flightNum or flightID (string)
      - seatNo (string) OR seatNos (array of strings) (use "AUTO" if not modeled)
      - travellers (optional array with passportNumber / mealPreference)
    """
    _purge_expired_holds()
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"code": 400, "message": "Body must be a JSON object"}), 400

    booking_id = data.get("bookingID")
    seat_no = data.get("seatNo") or data.get("seatNumber")
    seat_nos_raw = data.get("seatNos") or data.get("seatNumbers")
    flight_num = (data.get("flightNum") or data.get("flightID") or "").strip().upper()
    travellers = data.get("travellers") if isinstance(data.get("travellers"), list) else []
    hold_token = str(data.get("holdToken") or "").strip()
    passport_number = data.get("passportNumber")
    meal_preference = data.get("mealPreference")

    try:
        booking_id = int(booking_id)
    except Exception:
        return jsonify({"code": 400, "message": "bookingID is required (int)"}), 400
    if not flight_num:
        return jsonify({"code": 400, "message": "flightNum is required"}), 400
    seat_nos: list[str] = []
    if isinstance(seat_nos_raw, list):
        for x in seat_nos_raw:
            if x is None:
                continue
            s = str(x).strip().upper()
            if s:
                seat_nos.append(s)
    elif seat_no:
        seat_nos.append(str(seat_no).strip().upper())

    if not seat_nos:
        seat_nos = ["AUTO"]

    # Backward compatible single-seat key (first seat).
    seat_no = seat_nos[0]

    requested = {s for s in seat_nos if s and s != "AUTO"}

    # If client is upgrading an existing temporary hold into a booking-bound hold,
    # remove that hold first so it does not conflict with itself.
    if hold_token:
        hold_key = f"HOLD:{hold_token}"
        hold_rec = FLIGHT_RESERVATIONS.get(hold_key)
        if hold_rec:
            FLIGHT_RESERVATIONS.pop(hold_key, None)

    # Conflict: if another pending booking/hold has the same seat, reject.
    for bid, rec in FLIGHT_RESERVATIONS.items():
        if bid == booking_id:
            continue
        if hold_token and str(rec.get("holdToken") or "").strip() == hold_token:
            continue
        rec_status = str(rec.get("status", "")).upper()
        if rec_status not in ("HELD", "CONFIRMED"):
            continue

        other_seats = rec.get("seatNos")
        if isinstance(other_seats, list):
            other_set = {str(s).strip().upper() for s in other_seats if s is not None}
        else:
            other_set = {str(rec.get("seatNo", "")).strip().upper()} if rec.get("seatNo") else set()

        # "AUTO" means "not modelled" in this demo, so it doesn't participate in seat conflicts.
        if requested and (other_set & requested):
            first_conflict = sorted(list(other_set & requested))[0]
            return (
                jsonify({"code": 409, "message": f"Seat {first_conflict} already reserved"}),
                409,
            )

    now = _utc_now()
    expires = now + timedelta(minutes=HOLD_MINUTES)
    FLIGHT_RESERVATIONS[booking_id] = {
        "bookingID": booking_id,
        "flightNum": flight_num,
        "seatNo": seat_no,
        "seatNos": seat_nos,
        "travellers": travellers,
        "passportNumber": passport_number,
        "mealPreference": meal_preference,
        "holdToken": hold_token or None,
        "holdStartedAt": now.isoformat(),
        "holdExpiresAt": expires.isoformat(),
        "status": "HELD",
    }
    return jsonify({"code": 200, "data": FLIGHT_RESERVATIONS[booking_id]}), 200


@app.route("/availability/<seat_no>/<status>", methods=["PUT"])
def update_seat_availability(seat_no: str, status: str):
    """
    Diagram: PUT /availability/{SeatNo}/{Status} — adjust flight seat inventory after booking.
    Body: { flightNum (required), bookingID (optional) }
    """
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"code": 400, "message": "Body must be a JSON object"}), 400
    flight_num = str(data.get("flightNum") or data.get("flightID") or "").strip().upper()
    st = str(status or "").strip().upper()
    if not flight_num:
        return jsonify({"code": 400, "message": "flightNum is required in body"}), 400
    flight = FLIGHTS.get(flight_num)
    if not flight:
        return jsonify({"code": 404, "message": "Flight not found"}), 404
    try:
        cur = int(flight.get("availableSeats") or 0)
    except Exception:
        cur = 0
    if st in ("CONFIRMED", "BOOKED", "OCCUPIED"):
        flight["availableSeats"] = max(0, cur - 1)
    elif st in ("RELEASED", "AVAILABLE", "CANCELLED"):
        flight["availableSeats"] = cur + 1
    else:
        return jsonify({"code": 400, "message": f"Unsupported status {st!r}"}), 400
    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "seatNo": str(seat_no).strip().upper(),
                    "status": st,
                    "flightNum": flight_num,
                    "availableSeats": int(flight.get("availableSeats") or 0),
                },
            }
        ),
        200,
    )


@app.route("/confirm-seat", methods=["PUT"])
def confirm_seat():
    """
    Confirm a previously reserved seat after payment.
    Body: { bookingID }
    """
    _purge_expired_holds()
    data = request.get_json(silent=True) or {}
    booking_id = data.get("bookingID") if isinstance(data, dict) else None
    try:
        booking_id = int(booking_id)
    except Exception:
        return jsonify({"code": 400, "message": "bookingID is required (int)"}), 400

    rec = FLIGHT_RESERVATIONS.get(booking_id)
    if not rec:
        return jsonify({"code": 404, "message": "Seat reservation not found"}), 404

    rec["status"] = "CONFIRMED"
    return jsonify({"code": 200, "data": rec}), 200


@app.route("/release-seat", methods=["PUT"])
def release_seat():
    """
    Release a held seat (rollback) on payment failure.
    Body: { bookingID } or { flightRef } (flightRef = flightNum string for diagram parity).
    """
    _purge_expired_holds()
    data = request.get_json(silent=True) or {}
    booking_id = data.get("bookingID") if isinstance(data, dict) else None
    flight_ref = (data.get("flightRef") or data.get("flightNum") or "").strip().upper()
    hold_token = str(data.get("holdToken") or "").strip()
    if hold_token:
        hold_key = f"HOLD:{hold_token}"
        if hold_key in FLIGHT_RESERVATIONS:
            FLIGHT_RESERVATIONS.pop(hold_key, None)
            return jsonify({"code": 200, "data": {"holdToken": hold_token}}), 200
    if booking_id is None and flight_ref:
        for bid, rec in FLIGHT_RESERVATIONS.items():
            if str(rec.get("flightNum", "")).strip().upper() == flight_ref and rec.get(
                "status"
            ) in ("HELD", "CONFIRMED"):
                booking_id = bid
                break
    try:
        booking_id = int(booking_id)
    except Exception:
        return jsonify({"code": 400, "message": "bookingID or resolvable flightRef is required"}), 400

    rec = FLIGHT_RESERVATIONS.get(booking_id)
    if not rec:
        return jsonify({"code": 404, "message": "Seat reservation not found"}), 404

    # Remove entirely to free the seat.
    FLIGHT_RESERVATIONS.pop(booking_id, None)
    return jsonify({"code": 200, "data": {"bookingID": booking_id}}), 200


@app.route("/flight/inventory/<seat_no>/release", methods=["PUT"])
def release_inventory_seat(seat_no: str):
    """
    Diagram-aligned release endpoint:
    PUT /flight/inventory/{seatNo}/release
    Body: { bookingID?, flightNum? }
    """
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        data = {}
    seat = str(seat_no or "").strip().upper()
    booking_id = data.get("bookingID")
    target_bid = None

    if booking_id is not None:
        try:
            bid = int(booking_id)
            rec = FLIGHT_RESERVATIONS.get(bid)
            other_seats = rec.get("seatNos") if rec else None
            if rec and isinstance(other_seats, list):
                if {str(s).strip().upper() for s in other_seats if s is not None} & {seat}:
                    target_bid = bid
            elif rec and str(rec.get("seatNo", "")).strip().upper() == seat:
                target_bid = bid
        except Exception:
            pass

    if target_bid is None:
        for bid, rec in FLIGHT_RESERVATIONS.items():
            rec_status = rec.get("status")
            if rec_status not in ("HELD", "CONFIRMED"):
                continue
            other_seats = rec.get("seatNos")
            if isinstance(other_seats, list):
                if {str(s).strip().upper() for s in other_seats if s is not None} & {seat}:
                    target_bid = bid
                    break
            elif str(rec.get("seatNo", "")).strip().upper() == seat:
                target_bid = bid
                break

    if target_bid is None:
        return jsonify({"code": 404, "message": f"Seat {seat} is not reserved"}), 404

    rec = FLIGHT_RESERVATIONS.get(target_bid)
    if not rec:
        return jsonify({"code": 404, "message": f"Seat {seat} is not reserved"}), 404

    other_seats = rec.get("seatNos")
    if isinstance(other_seats, list):
        remaining = [s for s in other_seats if str(s).strip().upper() != seat]
        # Keep record if other seats still reserved for this booking.
        if remaining:
            rec["seatNos"] = [str(x).strip().upper() for x in remaining if x is not None]
            rec["seatNo"] = rec["seatNos"][0]
        else:
            FLIGHT_RESERVATIONS.pop(target_bid, None)
    else:
        # Backward compatible: single-seat reservation
        if str(rec.get("seatNo", "")).strip().upper() == seat:
            FLIGHT_RESERVATIONS.pop(target_bid, None)

    return jsonify({"code": 200, "data": {"seatNo": seat, "status": "AVAILABLE"}}), 200


@app.route("/seat-holds", methods=["POST"])
def create_seat_hold():
    """
    Create/update a temporary seat hold (15-min default).
    Body: { holdToken, flightNum, seatNos[] }
    """
    _purge_expired_holds()
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"code": 400, "message": "Body must be a JSON object"}), 400

    hold_token = str(data.get("holdToken") or "").strip()
    flight_num = str(data.get("flightNum") or data.get("flightID") or "").strip().upper()
    seat_nos_raw = data.get("seatNos") or data.get("seatNumbers") or []
    if not hold_token:
        return jsonify({"code": 400, "message": "holdToken is required"}), 400
    if not flight_num:
        return jsonify({"code": 400, "message": "flightNum is required"}), 400
    if not isinstance(seat_nos_raw, list) or not seat_nos_raw:
        return jsonify({"code": 400, "message": "seatNos[] is required"}), 400

    seat_nos = []
    for x in seat_nos_raw:
        s = str(x or "").strip().upper()
        if s:
            seat_nos.append(s)
    requested = {s for s in seat_nos if s != "AUTO"}
    if not requested:
        return jsonify({"code": 400, "message": "seatNos[] must include real seat codes"}), 400

    # Remove previous hold owned by this token before checking conflicts.
    FLIGHT_RESERVATIONS.pop(f"HOLD:{hold_token}", None)

    for _, rec in FLIGHT_RESERVATIONS.items():
        rec_status = str(rec.get("status", "")).upper()
        if rec_status not in ("HELD", "CONFIRMED"):
            continue
        if str(rec.get("flightNum") or "").strip().upper() != flight_num:
            continue
        if str(rec.get("holdToken") or "").strip() == hold_token:
            continue
        other = rec.get("seatNos") if isinstance(rec.get("seatNos"), list) else [rec.get("seatNo")]
        other_set = {str(s or "").strip().upper() for s in other if s}
        conflict = requested & other_set
        if conflict:
            seat = sorted(list(conflict))[0]
            return jsonify({"code": 409, "message": f"Seat {seat} unavailable", "seatNo": seat}), 409

    now = _utc_now()
    expires = now + timedelta(minutes=HOLD_MINUTES)
    rec = {
        "bookingID": None,
        "holdToken": hold_token,
        "flightNum": flight_num,
        "seatNo": seat_nos[0],
        "seatNos": seat_nos,
        "holdStartedAt": now.isoformat(),
        "holdExpiresAt": expires.isoformat(),
        "status": "HELD",
    }
    FLIGHT_RESERVATIONS[f"HOLD:{hold_token}"] = rec
    return jsonify({"code": 200, "data": rec}), 200


@app.route("/seat-holds/<flight_num>", methods=["GET"])
def list_active_holds(flight_num: str):
    """List currently-held seats for a flight (excluding optional token owner)."""
    _purge_expired_holds()
    fnum = str(flight_num or "").strip().upper()
    exclude_token = str(request.args.get("excludeToken") or "").strip()
    seats = set()
    for _, rec in FLIGHT_RESERVATIONS.items():
        if str(rec.get("status", "")).upper() != "HELD":
            continue
        if str(rec.get("flightNum") or "").strip().upper() != fnum:
            continue
        if exclude_token and str(rec.get("holdToken") or "").strip() == exclude_token:
            continue
        others = rec.get("seatNos") if isinstance(rec.get("seatNos"), list) else [rec.get("seatNo")]
        for s in others:
            up = str(s or "").strip().upper()
            if up and up != "AUTO":
                seats.add(up)
    return jsonify({"code": 200, "data": {"flightNum": fnum, "seats": sorted(list(seats))}}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5102, debug=True)
