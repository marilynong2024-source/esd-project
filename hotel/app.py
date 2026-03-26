from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Demo room hold lifecycle store (per booking)
# Diagram-aligned endpoints:
# - POST /hold-room
# - PUT /confirm-room
# - PUT /release-room
HOTEL_ROOM_HOLDS: dict[int, dict] = {}


def _parse_int(value: object, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return int(default)


def _parse_bool(value: object) -> bool:
    return bool(value)


def _room(code: str, type_name: str, price_per_night: float, includes_breakfast: bool, available_rooms: int):
    return {
        "code": code,
        "label": f"{type_name} Room",
        "pricePerNight": float(price_per_night),
        "includesBreakfast": bool(includes_breakfast),
        "availableRooms": int(available_rooms),
    }


# Demo dataset sourced from `init_db.sql` (Hotel + RoomType inserts).
# We only expose Standard/Deluxe as booking UI room codes: `STD` and `DLX`.
HOTELS = {
    1: {
        "hotelID": 1,
        "name": "The Grand Tokyo",
        "city": "Tokyo",
        "country": "Japan",
        "address": "1-1 Marunouchi, Chiyoda, Tokyo",
        "starRating": 5,
        "description": "Luxury hotel in the heart of Tokyo with stunning city views.",
        "imageUrl": "https://picsum.photos/seed/tokyogrand/400/300",
        "amenities": "WiFi,Pool,Gym,Spa,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 280.00, False, 30),
            _room("DLX", "Deluxe", 420.00, True, 18),
        ],
        "availableRooms": 5,
    },
    2: {
        "hotelID": 2,
        "name": "Shinjuku Heritage Hotel",
        "city": "Tokyo",
        "country": "Japan",
        "address": "2-5 Kabukicho, Shinjuku, Tokyo",
        "starRating": 4,
        "description": "Modern hotel steps from Shinjuku station and entertainment district.",
        "imageUrl": "https://picsum.photos/seed/shinjuku/400/300",
        "amenities": "WiFi,Gym,Restaurant,Bar",
        "roomTypes": [
            _room("STD", "Standard", 150.00, False, 40),
            _room("DLX", "Deluxe", 220.00, True, 20),
        ],
        "availableRooms": 5,
    },
    3: {
        "hotelID": 3,
        "name": "Asakusa Inn",
        "city": "Tokyo",
        "country": "Japan",
        "address": "2-3-1 Asakusa, Taito, Tokyo",
        "starRating": 3,
        "description": "Cosy budget hotel near Senso-ji Temple and traditional markets.",
        "imageUrl": "https://picsum.photos/seed/asakusa/400/300",
        "amenities": "WiFi,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 90.00, False, 35),
            _room("DLX", "Deluxe", 130.00, True, 15),
        ],
        "availableRooms": 5,
    },
    4: {
        "hotelID": 4,
        "name": "Siam Heritage Bangkok",
        "city": "Bangkok",
        "country": "Thailand",
        "address": "115 Surawong Road, Silom, Bangkok",
        "starRating": 5,
        "description": "Elegant riverside hotel blending Thai heritage with modern luxury.",
        "imageUrl": "https://picsum.photos/seed/siambkk/400/300",
        "amenities": "WiFi,Pool,Spa,Gym,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 200.00, False, 35),
            _room("DLX", "Deluxe", 320.00, True, 20),
        ],
        "availableRooms": 5,
    },
    5: {
        "hotelID": 5,
        "name": "Sukhumvit Suites",
        "city": "Bangkok",
        "country": "Thailand",
        "address": "23 Sukhumvit Soi 11, Bangkok",
        "starRating": 4,
        "description": "Contemporary hotel in Bangkok vibrant nightlife and shopping district.",
        "imageUrl": "https://picsum.photos/seed/sukhumvit/400/300",
        "amenities": "WiFi,Pool,Gym,Bar",
        "roomTypes": [
            _room("STD", "Standard", 110.00, False, 45),
            _room("DLX", "Deluxe", 160.00, True, 22),
        ],
        "availableRooms": 5,
    },
    6: {
        "hotelID": 6,
        "name": "Bangkok Budget Stay",
        "city": "Bangkok",
        "country": "Thailand",
        "address": "88 Khao San Road, Banglamphu, Bangkok",
        "starRating": 3,
        "description": "Affordable hotel on the famous Khao San Road backpacker hub.",
        "imageUrl": "https://picsum.photos/seed/khaosan/400/300",
        "amenities": "WiFi,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 55.00, False, 38),
        ],
        "availableRooms": 5,
    },
    7: {
        "hotelID": 7,
        "name": "The Royal Kensington",
        "city": "London",
        "country": "UK",
        "address": "101 Kensington High St, London",
        "starRating": 5,
        "description": "Classic London luxury hotel near Hyde Park and museums.",
        "imageUrl": "https://picsum.photos/seed/kensington/400/300",
        "amenities": "WiFi,Spa,Gym,Restaurant,Bar",
        "roomTypes": [
            _room("STD", "Standard", 350.00, False, 25),
            _room("DLX", "Deluxe", 520.00, True, 15),
        ],
        "availableRooms": 5,
    },
    8: {
        "hotelID": 8,
        "name": "Covent Garden Boutique",
        "city": "London",
        "country": "UK",
        "address": "10 Long Acre, Covent Garden, London",
        "starRating": 4,
        "description": "Stylish boutique hotel in the heart of London theatre district.",
        "imageUrl": "https://picsum.photos/seed/coventgarden/400/300",
        "amenities": "WiFi,Gym,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 220.00, False, 20),
            _room("DLX", "Deluxe", 320.00, True, 12),
        ],
        "availableRooms": 5,
    },
    9: {
        "hotelID": 9,
        "name": "Paddington Central",
        "city": "London",
        "country": "UK",
        "address": "45 London Street, Paddington, London",
        "starRating": 3,
        "description": "Convenient hotel near Paddington station with easy Heathrow access.",
        "imageUrl": "https://picsum.photos/seed/paddington/400/300",
        "amenities": "WiFi,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 130.00, False, 40),
        ],
        "availableRooms": 5,
    },
    10: {
        "hotelID": 10,
        "name": "Harbour View Sydney",
        "city": "Sydney",
        "country": "Australia",
        "address": "93 Macquarie Street, Sydney CBD",
        "starRating": 5,
        "description": "Iconic hotel with unbeatable views of Sydney Harbour Bridge and Opera House.",
        "imageUrl": "https://picsum.photos/seed/sydneyharbour/400/300",
        "amenities": "WiFi,Pool,Spa,Gym,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 280.00, False, 30),
            _room("DLX", "Deluxe", 420.00, True, 18),
        ],
        "availableRooms": 5,
    },
    11: {
        "hotelID": 11,
        "name": "Surry Hills Boutique",
        "city": "Sydney",
        "country": "Australia",
        "address": "245 Crown Street, Surry Hills, Sydney",
        "starRating": 4,
        "description": "Trendy boutique hotel in Sydney creative and dining neighbourhood.",
        "imageUrl": "https://picsum.photos/seed/surrryhills/400/300",
        "amenities": "WiFi,Gym,Bar,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 160.00, False, 22),
            _room("DLX", "Deluxe", 230.00, True, 14),
        ],
        "availableRooms": 5,
    },
    12: {
        "hotelID": 12,
        "name": "Central Station Hotel",
        "city": "Sydney",
        "country": "Australia",
        "address": "2 Lee Street, Haymarket, Sydney",
        "starRating": 3,
        "description": "Budget-friendly hotel directly above Central Station.",
        "imageUrl": "https://picsum.photos/seed/sydcentral/400/300",
        "amenities": "WiFi,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 95.00, False, 42),
        ],
        "availableRooms": 5,
    },
    13: {
        "hotelID": 13,
        "name": "Seminyak Beach Resort",
        "city": "Bali",
        "country": "Indonesia",
        "address": "Jl. Kayu Aya, Seminyak, Bali",
        "starRating": 5,
        "description": "Stunning beachfront resort with private pool villas and sunset views.",
        "imageUrl": "https://picsum.photos/seed/seminyak/400/300",
        "amenities": "WiFi,Pool,Spa,Gym,Restaurant,Bar",
        "roomTypes": [
            _room("STD", "Standard", 180.00, False, 20),
            _room("DLX", "Deluxe", 280.00, True, 12),
        ],
        "availableRooms": 5,
    },
    14: {
        "hotelID": 14,
        "name": "Ubud Jungle Retreat",
        "city": "Bali",
        "country": "Indonesia",
        "address": "Jl. Raya Ubud, Ubud, Bali",
        "starRating": 4,
        "description": "Serene retreat surrounded by rice terraces and jungle in cultural Ubud.",
        "imageUrl": "https://picsum.photos/seed/ubud/400/300",
        "amenities": "WiFi,Pool,Spa,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 120.00, False, 18),
            _room("DLX", "Deluxe", 180.00, True, 10),
        ],
        "availableRooms": 5,
    },
    15: {
        "hotelID": 15,
        "name": "Kuta Budget Inn",
        "city": "Bali",
        "country": "Indonesia",
        "address": "Jl. Legian, Kuta, Bali",
        "starRating": 3,
        "description": "Affordable stay steps from Kuta beach and nightlife.",
        "imageUrl": "https://picsum.photos/seed/kuta/400/300",
        "amenities": "WiFi,Pool,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 60.00, False, 35),
        ],
        "availableRooms": 5,
    },
    16: {
        "hotelID": 16,
        "name": "Marina Bay Skylines Hotel",
        "city": "Singapore",
        "country": "Singapore",
        "address": "8 Bayfront Ave, Marina Bay, Singapore",
        "starRating": 5,
        "description": "Modern skyline hotel with rooftop views over Marina Bay.",
        "imageUrl": "https://picsum.photos/seed/marinabay/400/300",
        "amenities": "WiFi,Pool,Spa,Gym,Restaurant,Bar",
        "roomTypes": [
            _room("STD", "Standard", 260.00, False, 18),
            _room("DLX", "Deluxe", 390.00, True, 11),
        ],
        "availableRooms": 5,
    },
    17: {
        "hotelID": 17,
        "name": "Orchard Blossom Boutique",
        "city": "Singapore",
        "country": "Singapore",
        "address": "33 Orchard Rd, Singapore 238830",
        "starRating": 4,
        "description": "Boutique hotel near Orchard shopping with calm, curated interiors.",
        "imageUrl": "https://picsum.photos/seed/orchardblossom/400/300",
        "amenities": "WiFi,Gym,Restaurant,Bar",
        "roomTypes": [
            _room("STD", "Standard", 170.00, False, 20),
            _room("DLX", "Deluxe", 240.00, True, 12),
        ],
        "availableRooms": 5,
    },
    18: {
        "hotelID": 18,
        "name": "Little Lion City Stay",
        "city": "Singapore",
        "country": "Singapore",
        "address": "12 Telok Ayer St, Singapore",
        "starRating": 3,
        "description": "Comfortable city stay in the heart of dining and nightlife.",
        "imageUrl": "https://picsum.photos/seed/telokayer/400/300",
        "amenities": "WiFi,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 120.00, False, 30),
            _room("DLX", "Deluxe", 160.00, True, 14),
        ],
        "availableRooms": 5,
    },
    19: {
        "hotelID": 19,
        "name": "Le Grand Paris Maison",
        "city": "Paris",
        "country": "France",
        "address": "15 Rue de Rivoli, 75001 Paris",
        "starRating": 5,
        "description": "Classic Parisian luxury hotel with timeless decor.",
        "imageUrl": "https://picsum.photos/seed/rivoli/400/300",
        "amenities": "WiFi,Pool,Spa,Gym,Restaurant,Bar",
        "roomTypes": [
            _room("STD", "Standard", 320.00, False, 16),
            _room("DLX", "Deluxe", 480.00, True, 9),
        ],
        "availableRooms": 5,
    },
    20: {
        "hotelID": 20,
        "name": "Montmartre View Hotel",
        "city": "Paris",
        "country": "France",
        "address": "88 Rue Lepic, 75018 Paris",
        "starRating": 4,
        "description": "Charming hotel with views toward Montmartre and Sacre-Coeur.",
        "imageUrl": "https://picsum.photos/seed/montmartre/400/300",
        "amenities": "WiFi,Gym,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 220.00, False, 18),
            _room("DLX", "Deluxe", 320.00, True, 10),
        ],
        "availableRooms": 5,
    },
    21: {
        "hotelID": 21,
        "name": "Latin Quarter Budget Inn",
        "city": "Paris",
        "country": "France",
        "address": "7 Rue Monge, 75005 Paris",
        "starRating": 3,
        "description": "Budget-friendly base near museums and cafes.",
        "imageUrl": "https://picsum.photos/seed/latinquarter/400/300",
        "amenities": "WiFi,Restaurant",
        "roomTypes": [
            _room("STD", "Standard", 110.00, False, 26),
            _room("DLX", "Deluxe", 150.00, True, 12),
        ],
        "availableRooms": 5,
    },
}


@app.route("/hotel/<int:hotel_id>", methods=["GET"])
def get_hotel(hotel_id: int):
    hotel = HOTELS.get(hotel_id)
    if not hotel:
        return jsonify({"code": 404, "message": "Hotel not found"}), 404
    return jsonify({"code": 200, "data": hotel}), 200


@app.route("/hotel/search", methods=["GET"])
def search_hotels():
    # Demo search: filter in-memory by country and/or city.
    # UX: if a user types a wrong city but the country is correct, still show the
    # country's results (so the UI doesn't feel "empty").
    def _norm(s: str) -> str:
        return (s or "").strip().lower()

    country_q = _norm(request.args.get("country"))
    city_q = _norm(request.args.get("city"))
    name_q = _norm(request.args.get("name"))

    def matches(hotel: dict, query: str, key: str) -> bool:
        if not query:
            return True
        v = _norm(hotel.get(key))
        # Partial match so users can type "UK" instead of "United Kingdom", etc.
        return query in v

    def filter_hotels(ignore_city: bool) -> list:
        out = []
        for _, hotel in HOTELS.items():
            if country_q and not matches(hotel, country_q, "country"):
                continue
            if name_q and not matches(hotel, name_q, "name"):
                continue
            if (not ignore_city) and city_q and not matches(hotel, city_q, "city"):
                continue
            out.append(hotel)
        return out

    results = filter_hotels(ignore_city=False)

    # If nothing matched with city, retry with country-only.
    if not results and country_q:
        results = filter_hotels(ignore_city=True)

    return jsonify({"code": 200, "data": results}), 200


@app.route("/availability", methods=["GET"])
def availability():
    """
    Bundle pricing helper for Diagram compliance.

    Accepts:
    - city (destination)
    - country (optional)
    - roomType (STD/DLX) optional; defaults to STD if not provided

    Returns:
    - a single hotelID with availableRooms for the selected room type
    """
    city_q = (request.args.get("city") or request.args.get("destination") or "").strip().lower()
    country_q = (request.args.get("country") or "").strip().lower()
    room_type = (request.args.get("roomType") or request.args.get("room_code") or "STD").strip().upper()
    if room_type not in ("STD", "DLX"):
        room_type = "STD"

    def _norm(s: str) -> str:
        return (s or "").strip().lower()

    candidates = []
    for _, hotel in HOTELS.items():
        if country_q and _norm(hotel.get("country")) != country_q:
            continue
        if city_q and _norm(hotel.get("city")) != city_q:
            continue
        # If city is provided but country doesn't match, allow partial match by city only.
        # (Demo-friendly UX.)
        candidates.append(hotel)

    if not candidates and city_q:
        # fallback: ignore country
        for _, hotel in HOTELS.items():
            if _norm(hotel.get("city")) == city_q:
                candidates.append(hotel)

    if not candidates:
        return jsonify({"code": 404, "message": "No matching hotel availability"}), 404

    chosen = None
    for hotel in candidates:
        rooms = hotel.get("roomTypes") or []
        selected_room = next((r for r in rooms if str(r.get("code", "")).upper() == room_type), None)
        if not selected_room:
            continue
        avail_rooms = int(selected_room.get("availableRooms") or 0)
        # Pick the hotel with the most available rooms for this room type.
        if chosen is None or avail_rooms > chosen[1]:
            chosen = (hotel, avail_rooms)

    if not chosen:
        return jsonify({"code": 404, "message": "No matching room type availability"}), 404

    hotel, avail_rooms = chosen
    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "hotelID": int(hotel.get("hotelID") or 0),
                    "availableRooms": int(avail_rooms),
                    "city": hotel.get("city"),
                    "country": hotel.get("country"),
                    "roomType": room_type,
                },
            }
        ),
        200,
    )


@app.route("/price", methods=["GET"])
def price():
    """
    Bundle pricing helper for Diagram compliance.

    Accepts:
    - hotelID + roomType
    """
    hotel_id = request.args.get("hotelID") or request.args.get("hotelId") or ""
    room_type = (request.args.get("roomType") or "STD").strip().upper()
    if room_type not in ("STD", "DLX"):
        room_type = "STD"

    try:
        hid = int(hotel_id)
    except Exception:
        hid = 0

    hotel = HOTELS.get(hid)
    if not hotel:
        return jsonify({"code": 404, "message": "Hotel not found"}), 404

    rooms = hotel.get("roomTypes") or []
    selected_room = next((r for r in rooms if str(r.get("code", "")).upper() == room_type), None)
    if not selected_room:
        return jsonify({"code": 404, "message": "Room type not found"}), 404

    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "hotelID": hid,
                    "roomType": room_type,
                    "pricePerNight": float(selected_room.get("pricePerNight") or 0),
                    "availableRooms": int(selected_room.get("availableRooms") or 0),
                    "includesBreakfast": bool(selected_room.get("includesBreakfast") or False),
                },
            }
        ),
        200,
    )


@app.route("/hold-room", methods=["POST"])
def hold_room():
    """
    Hold a hotel room for a pending booking.
    Body:
      - bookingID (int)
      - hotelID (int)
      - roomType (STD/DLX)
      - checkIn (string datetime)
      - checkOut (string datetime)
      - numberOfKeys (int)
    """
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"code": 400, "message": "Body must be a JSON object"}), 400

    try:
        booking_id = int(data.get("bookingID"))
    except Exception:
        return jsonify({"code": 400, "message": "bookingID is required (int)"}), 400

    hotel_id = _parse_int(data.get("hotelID"), 0)
    room_type = (data.get("roomType") or "").strip().upper() or "STD"
    number_of_keys = _parse_int(data.get("numberOfKeys"), 1)
    check_in = data.get("checkIn") or data.get("checkInDate") or ""
    check_out = data.get("checkOut") or data.get("checkOutDate") or ""

    if not hotel_id:
        return jsonify({"code": 400, "message": "hotelID is required (int)"}), 400
    if room_type not in ("STD", "DLX"):
        room_type = "STD"
    if not check_in or not check_out:
        return jsonify({"code": 400, "message": "checkIn and checkOut are required"}), 400

    # For demo: allow one hold per booking_id; no concurrency logic.
    HOTEL_ROOM_HOLDS[booking_id] = {
        "bookingID": booking_id,
        "hotelID": hotel_id,
        "roomType": room_type,
        "checkIn": str(check_in),
        "checkOut": str(check_out),
        "numberOfKeys": number_of_keys,
        "status": "HELD",
    }
    return jsonify({"code": 200, "data": HOTEL_ROOM_HOLDS[booking_id]}), 200


@app.route("/confirm-room", methods=["PUT"])
def confirm_room():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"code": 400, "message": "Body must be a JSON object"}), 400

    booking_id = data.get("bookingID")
    try:
        booking_id = int(booking_id)
    except Exception:
        return jsonify({"code": 400, "message": "bookingID is required (int)"}), 400

    rec = HOTEL_ROOM_HOLDS.get(booking_id)
    if not rec:
        return jsonify({"code": 404, "message": "Room hold not found"}), 404

    rec["status"] = "CONFIRMED"
    return jsonify({"code": 200, "data": rec}), 200


@app.route("/release-room", methods=["PUT"])
def release_room():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"code": 400, "message": "Body must be a JSON object"}), 400

    booking_id = data.get("bookingID")
    try:
        booking_id = int(booking_id)
    except Exception:
        return jsonify({"code": 400, "message": "bookingID is required (int)"}), 400

    if booking_id in HOTEL_ROOM_HOLDS:
        HOTEL_ROOM_HOLDS.pop(booking_id, None)
        return jsonify({"code": 200, "data": {"bookingID": booking_id}}), 200

    return jsonify({"code": 404, "message": "Room hold not found"}), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5103, debug=True)

