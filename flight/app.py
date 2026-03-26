from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Demo reservation lifecycle store (per booking)
# Diagram-aligned endpoints:
# - POST /reserve-seat
# - PUT /confirm-seat
# - PUT /release-seat
FLIGHT_RESERVATIONS: dict[int, dict] = {}


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
        "economyPrice": 450.0,
        "businessPrice": 1200.0,
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
        "economyPrice": 450.0,
        "businessPrice": 1200.0,
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
    # SIN → NRT (Tokyo)
    ("SQ634", "Singapore Airlines", "SIN", "NRT", "Singapore", "Tokyo", "2025-06-01T08:00:00", "2025-06-01T15:30:00", 390, 450.00, 1200.00, 120, 120),
    ("SQ636", "Singapore Airlines", "SIN", "NRT", "Singapore", "Tokyo", "2025-06-01T22:00:00", "2025-06-02T05:30:00", 390, 420.00, 1100.00, 95, 95),
    ("TR808", "Scoot", "SIN", "NRT", "Singapore", "Tokyo", "2025-06-01T06:00:00", "2025-06-01T14:00:00", 480, 280.00, None, 150, 150),
    ("3K521", "Jetstar Asia", "SIN", "NRT", "Singapore", "Tokyo", "2025-06-01T09:30:00", "2025-06-01T17:45:00", 495, 260.00, None, 80, 80),

    # SIN → BKK (Bangkok)
    ("SQ706", "Singapore Airlines", "SIN", "BKK", "Singapore", "Bangkok", "2025-06-01T07:00:00", "2025-06-01T08:30:00", 90, 180.00, 520.00, 140, 140),
    ("SQ708", "Singapore Airlines", "SIN", "BKK", "Singapore", "Bangkok", "2025-06-01T14:00:00", "2025-06-01T15:30:00", 90, 170.00, 500.00, 100, 100),
    ("TR862", "Scoot", "SIN", "BKK", "Singapore", "Bangkok", "2025-06-01T10:00:00", "2025-06-01T11:40:00", 100, 99.00, None, 160, 160),

    # SIN → LHR (London)
    ("SQ322", "Singapore Airlines", "SIN", "LHR", "Singapore", "London", "2025-06-01T23:55:00", "2025-06-02T06:00:00", 725, 980.00, 3200.00, 200, 200),
    ("SQ306", "Singapore Airlines", "SIN", "LHR", "Singapore", "London", "2025-06-01T09:00:00", "2025-06-01T15:30:00", 750, 950.00, 3100.00, 180, 180),

    # SIN → SYD (Sydney)
    ("SQ221", "Singapore Airlines", "SIN", "SYD", "Singapore", "Sydney", "2025-06-01T08:30:00", "2025-06-01T19:30:00", 480, 520.00, 1400.00, 170, 170),
    ("TR8", "Scoot", "SIN", "SYD", "Singapore", "Sydney", "2025-06-01T07:00:00", "2025-06-01T17:45:00", 465, 320.00, None, 200, 200),

    # SIN → DPS (Bali)
    ("SQ944", "Singapore Airlines", "SIN", "DPS", "Singapore", "Bali", "2025-06-01T08:00:00", "2025-06-01T09:30:00", 90, 160.00, 480.00, 130, 130),
    ("TR282", "Scoot", "SIN", "DPS", "Singapore", "Bali", "2025-06-01T06:30:00", "2025-06-01T08:10:00", 100, 89.00, None, 155, 155),

    # Return flights: NRT → SIN
    ("SQ635", "Singapore Airlines", "NRT", "SIN", "Tokyo", "Singapore", "2025-06-08T17:00:00", "2025-06-08T23:00:00", 360, 450.00, 1200.00, 110, 110),
    ("TR809", "Scoot", "NRT", "SIN", "Tokyo", "Singapore", "2025-06-08T15:00:00", "2025-06-08T21:30:00", 390, 280.00, None, 140, 140),

    # Return flights: BKK → SIN
    ("SQ707", "Singapore Airlines", "BKK", "SIN", "Bangkok", "Singapore", "2025-06-05T10:00:00", "2025-06-05T13:30:00", 90, 180.00, 520.00, 120, 120),
    ("TR863", "Scoot", "BKK", "SIN", "Bangkok", "Singapore", "2025-06-05T14:00:00", "2025-06-05T15:40:00", 100, 99.00, None, 150, 150),
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
    }

    results = []
    for _, f in FLIGHTS.items():
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

    best = None
    best_price = None
    for _, f in FLIGHTS.items():
        if origin_city and str(f.get("originCity", "")).lower() != origin_city:
            continue
        if destination_city and str(f.get("destinationCity", "")).lower() != destination_city:
            continue
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
        best = None
        best_price = None
        for _, f in FLIGHTS.items():
            if origin_city and str(f.get("originCity", "")).lower() != origin_city:
                continue
            if destination_city and str(f.get("destinationCity", "")).lower() != destination_city:
                continue
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
      - seatNo (string)  (use "AUTO" if not modeled)
      - travellers (optional array with passportNumber / mealPreference)
    """
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"code": 400, "message": "Body must be a JSON object"}), 400

    booking_id = data.get("bookingID")
    seat_no = data.get("seatNo") or data.get("seatNumber")
    flight_num = (data.get("flightNum") or data.get("flightID") or "").strip().upper()
    travellers = data.get("travellers") if isinstance(data.get("travellers"), list) else []
    passport_number = data.get("passportNumber")
    meal_preference = data.get("mealPreference")

    try:
        booking_id = int(booking_id)
    except Exception:
        return jsonify({"code": 400, "message": "bookingID is required (int)"}), 400
    if not flight_num:
        return jsonify({"code": 400, "message": "flightNum is required"}), 400
    if not seat_no:
        seat_no = "AUTO"
    seat_no = str(seat_no).strip().upper()

    # Conflict: if another pending booking holds the same seat, reject.
    for bid, rec in FLIGHT_RESERVATIONS.items():
        if bid == booking_id:
            continue
        if str(rec.get("seatNo", "")).upper() == seat_no and rec.get("status") in (
            "HELD",
            "CONFIRMED",
        ):
            return jsonify({"code": 409, "message": f"Seat {seat_no} already reserved"}), 409

    FLIGHT_RESERVATIONS[booking_id] = {
        "bookingID": booking_id,
        "flightNum": flight_num,
        "seatNo": seat_no,
        "travellers": travellers,
        "passportNumber": passport_number,
        "mealPreference": meal_preference,
        "status": "HELD",
    }
    return jsonify({"code": 200, "data": FLIGHT_RESERVATIONS[booking_id]}), 200


@app.route("/confirm-seat", methods=["PUT"])
def confirm_seat():
    """
    Confirm a previously reserved seat after payment.
    Body: { bookingID }
    """
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
    Body: { bookingID }
    """
    data = request.get_json(silent=True) or {}
    booking_id = data.get("bookingID") if isinstance(data, dict) else None
    try:
        booking_id = int(booking_id)
    except Exception:
        return jsonify({"code": 400, "message": "bookingID is required (int)"}), 400

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
            if rec and str(rec.get("seatNo", "")).strip().upper() == seat:
                target_bid = bid
        except Exception:
            pass

    if target_bid is None:
        for bid, rec in FLIGHT_RESERVATIONS.items():
            if str(rec.get("seatNo", "")).strip().upper() == seat and rec.get("status") in ("HELD", "CONFIRMED"):
                target_bid = bid
                break

    if target_bid is None:
        return jsonify({"code": 404, "message": f"Seat {seat} is not reserved"}), 404

    FLIGHT_RESERVATIONS.pop(target_bid, None)
    return jsonify({"code": 200, "data": {"seatNo": seat, "status": "AVAILABLE"}}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5102, debug=True)
