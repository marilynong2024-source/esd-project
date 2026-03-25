from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


def _online_seat_selection(flight_num: str) -> bool:
    # Match UI logic: it enables seat map when prefix is "SQ".
    code = str(flight_num).upper().slice(0, 2)
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5102, debug=True)
