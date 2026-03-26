from __future__ import annotations

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Internal service URLs (Docker network DNS)
# Note: flight/hotel bundle helpers are exposed at the service root as:
# - flight: /availability, /price
# - hotel: /availability, /price
FLIGHT_BASE = "http://flight:5102"
HOTEL_BASE = "http://hotel:5103"
LOYALTY_BASE = "http://loyalty:5105/loyalty"
DISCOUNT_BASE = "http://discount:5112"

HTTP_TIMEOUT_SECONDS = 8


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    # Accept both "YYYY-MM-DD" and full "YYYY-MM-DDTHH:MM[:SS]"
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        pass
    try:
        return datetime.strptime(s, "%Y-%m-%d")
    except ValueError:
        return None


def _parse_int(value: str | None, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return int(default)


def _get_json(url: str, params: dict | None = None) -> dict | None:
    try:
        resp = requests.get(url, params=params, timeout=HTTP_TIMEOUT_SECONDS)
        if not resp.ok:
            return None
        return resp.json() if resp.content else {}
    except Exception:
        return None


def _required_param(name: str, raw: str | None) -> tuple[bool, str]:
    if raw is None:
        return False, f"Missing required query parameter: {name}"
    if str(raw).strip() == "":
        return False, f"Missing required query parameter: {name}"
    return True, ""


@app.get("/bundle-price")
def bundle_price():
    # Diagram inputs:
    # origin, destination, departDate, returnDate, numberOfTravellers, customerId
    origin = request.args.get("origin")
    destination = request.args.get("destination")
    depart_date = request.args.get("departDate")
    return_date = request.args.get("returnDate")
    number_of_travellers = request.args.get("numberOfTravellers")
    customer_id = request.args.get("customerId") or request.args.get("customerID")

    ok, msg = _required_param("origin", origin)
    if not ok:
        return jsonify({"code": 400, "message": msg}), 400
    ok, msg = _required_param("destination", destination)
    if not ok:
        return jsonify({"code": 400, "message": msg}), 400
    ok, msg = _required_param("departDate", depart_date)
    if not ok:
        return jsonify({"code": 400, "message": msg}), 400
    ok, msg = _required_param("returnDate", return_date)
    if not ok:
        return jsonify({"code": 400, "message": msg}), 400
    ok, msg = _required_param("numberOfTravellers", number_of_travellers)
    if not ok:
        return jsonify({"code": 400, "message": msg}), 400
    ok, msg = _required_param("customerId", customer_id)
    if not ok:
        return jsonify({"code": 400, "message": msg}), 400

    travellers = max(1, _parse_int(number_of_travellers, 1))
    cid = _parse_int(customer_id, 0)

    depart_dt = _parse_datetime(depart_date)
    return_dt = _parse_datetime(return_date)
    if not depart_dt or not return_dt:
        return jsonify({"code": 400, "message": "Invalid departDate/returnDate format"}), 400
    nights = max(1, (return_dt - depart_dt).days)

    room_type = (request.args.get("roomType") or "").strip().upper() or ""
    if room_type not in ("STD", "DLX"):
        room_type = ""  # will choose based on availability

    loyalty_coins_to_spend_cents = _parse_int(
        request.args.get("loyaltyCoinsToUseCents") or request.args.get("coinsToSpendCents"),
        0,
    )

    # --- Composite synchronous execution order ---
    # 1) Flight service: availability -> price
    flight_avail = _get_json(
        f"{FLIGHT_BASE}/availability",
        params={"origin": origin, "destination": destination, "departDate": depart_date},
    )
    if not flight_avail or flight_avail.get("code") != 200:
        return jsonify({"code": 404, "message": "No flight availability"}), 404
    flight_data = flight_avail.get("data") or {}
    flight_num = flight_data.get("flightNum") or flight_data.get("flight_num")
    available_seats = int(flight_data.get("availableSeats") or 0)
    if not flight_num:
        return jsonify({"code": 404, "message": "Flight availability did not return flightNum"}), 404
    if available_seats < travellers:
        return jsonify({"code": 409, "message": "Not enough flight seats for travellers"}), 409

    flight_price_out = _get_json(
        f"{FLIGHT_BASE}/price",
        params={"flightNum": flight_num},
    )
    if not flight_price_out or flight_price_out.get("code") != 200:
        return jsonify({"code": 404, "message": "Flight price not found"}), 404
    flight_price = float((flight_price_out.get("data") or {}).get("price") or 0)

    flight_total = round(flight_price * travellers, 2)

    # 2) Hotel service: availability -> price
    candidate_room_types = ["DLX", "STD"] if room_type == "" else [room_type]
    hotel_chosen = None
    for rt in candidate_room_types:
        hotel_avail = _get_json(
            f"{HOTEL_BASE}/availability",
            params={
                "city": destination,
                "roomType": rt,
                # "country" is optional; the demo hotel service uses partial match.
                "departDate": depart_date,
                "returnDate": return_date,
            },
        )
        if not hotel_avail or hotel_avail.get("code") != 200:
            continue
        data = hotel_avail.get("data") or {}
        if int(data.get("availableRooms") or 0) >= travellers:
            hotel_chosen = (data, rt)
            break

    if not hotel_chosen:
        return jsonify({"code": 404, "message": "No hotel availability for requested travellers"}), 404

    hotel_data, chosen_room_type = hotel_chosen
    hotel_id = int(hotel_data.get("hotelID") or hotel_data.get("hotelId") or 0)
    available_rooms = int(hotel_data.get("availableRooms") or 0)
    if hotel_id < 1:
        return jsonify({"code": 404, "message": "Hotel availability did not return hotelID"}), 404
    if available_rooms < travellers:
        return jsonify({"code": 409, "message": "Not enough hotel rooms for travellers"}), 409

    hotel_price_out = _get_json(
        f"{HOTEL_BASE}/price",
        params={"hotelID": hotel_id, "roomType": chosen_room_type},
    )
    if not hotel_price_out or hotel_price_out.get("code") != 200:
        return jsonify({"code": 404, "message": "Hotel price not found"}), 404
    hotel_price_per_night = float((hotel_price_out.get("data") or {}).get("pricePerNight") or 0)

    hotel_total = round(hotel_price_per_night * nights * travellers, 2)

    # 3) Discount service: discount-rule
    # Loyalty tier is derived inside the discount service (it will call loyalty).
    # This keeps the orchestration order strictly: Flight -> Hotel -> Discount.
    discount_out = _get_json(
        f"{DISCOUNT_BASE}/discount-rule",
        params={
            "customerId": cid,
            "flightNum": flight_num,
            "hotelId": hotel_id,
            "roomType": chosen_room_type,
            "numberOfTravellers": travellers,
            "nights": nights,
        },
    )

    discount_data = (discount_out or {}).get("data") or {}
    discount_percent = float(discount_data.get("discountPercent") or 0)
    discount_amount = round((flight_total + hotel_total) * (discount_percent / 100.0), 2)

    # Loyalty used (coins)
    loyalty_used_dollars = 0.0
    if cid > 0 and loyalty_coins_to_spend_cents > 0:
        loyalty_out = _get_json(f"{LOYALTY_BASE}/{cid}/points")
        loyalty_points = (loyalty_out or {}).get("data") or {}
        coins_available_cents = int(loyalty_points.get("coins") or 0)
        coins_spent = min(coins_available_cents, loyalty_coins_to_spend_cents)
        loyalty_used_dollars = round(coins_spent / 100.0, 2)

    final_total = round(max(0.0, (flight_total + hotel_total) - discount_amount - loyalty_used_dollars), 2)

    return jsonify(
        {
            "code": 200,
            "data": {
                "flightPrice": flight_total,
                "hotelPrice": hotel_total,
                "discount": discount_amount,
                "loyaltyUsed": loyalty_used_dollars,
                "finalTotal": final_total,
                # extra fields for debugging / slides (not required by diagram)
                "discountPercent": discount_percent,
                "chosenRoomType": chosen_room_type,
                "nights": nights,
                "flightNum": flight_num,
                "hotelID": hotel_id,
            },
        }
    )


@app.get("/")
def health():
    return jsonify({"code": 200, "message": "Bundle Pricing service running"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5111, debug=True)

