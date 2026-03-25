from flask import Flask, jsonify, request
from flask_cors import CORS
import graphene
import requests

app = Flask(__name__)
CORS(app)

FLIGHT_BASE = "http://flight:5102/flight"
HOTEL_BASE = "http://hotel:5103/hotel"
LOYALTY_BASE = "http://loyalty:5105/loyalty"
HTTP_TIMEOUT_SECONDS = 8


def _get_json(url: str, params: dict | None = None) -> dict | None:
    try:
        resp = requests.get(url, params=params, timeout=HTTP_TIMEOUT_SECONDS)
        data = resp.json() if resp.content else {}
        if not resp.ok:
            return None
        return data
    except Exception:
        return None


class RoomType(graphene.ObjectType):
    code = graphene.String()
    label = graphene.String()
    price_per_night = graphene.Float(name="pricePerNight")
    includes_breakfast = graphene.Boolean(name="includesBreakfast")
    available_rooms = graphene.Int(name="availableRooms")


class HotelType(graphene.ObjectType):
    hotel_id = graphene.Int(name="hotelID")
    name = graphene.String()
    city = graphene.String()
    country = graphene.String()
    star_rating = graphene.Int(name="starRating")
    image_url = graphene.String(name="imageUrl")
    amenities = graphene.String()
    available_rooms = graphene.Int(name="availableRooms")
    room_types = graphene.List(RoomType, name="roomTypes")


class FlightType(graphene.ObjectType):
    flight_num = graphene.String(name="flightNum")
    airline = graphene.String()
    origin_city = graphene.String(name="originCity")
    destination_city = graphene.String(name="destinationCity")
    departure_time = graphene.String(name="departureTime")
    economy_price = graphene.Float(name="economyPrice")
    business_price = graphene.Float(name="businessPrice")
    available_seats = graphene.Int(name="availableSeats")
    online_seat_selection = graphene.Boolean(name="onlineSeatSelection")


class LoyaltyType(graphene.ObjectType):
    customer_id = graphene.Int(name="customerID")
    coins = graphene.Int()
    booking_count = graphene.Int(name="bookingCount")
    tier = graphene.String()


class PackagePreviewType(graphene.ObjectType):
    customer_id = graphene.Int(name="customerID")
    estimated_total_price = graphene.Float(name="estimatedTotalPrice")
    currency = graphene.String()
    flight = graphene.Field(FlightType)
    hotel = graphene.Field(HotelType)
    loyalty = graphene.Field(LoyaltyType)


class Query(graphene.ObjectType):
    hotel_search = graphene.List(
        HotelType,
        country=graphene.String(),
        city=graphene.String(),
        name=graphene.String(),
    )
    package_preview = graphene.Field(
        PackagePreviewType,
        customer_id=graphene.Int(required=True, name="customerID"),
        flight_id=graphene.String(required=True, name="flightID"),
        hotel_id=graphene.Int(required=True, name="hotelID"),
        room_code=graphene.String(name="roomCode"),
        name="packagePreview",
    )

    def resolve_hotel_search(self, info, country=None, city=None, name=None):
        params = {}
        if country:
            params["country"] = country
        if city:
            params["city"] = city
        if name:
            params["name"] = name

        out = _get_json(f"{HOTEL_BASE}/search", params=params)
        rows = (out or {}).get("data") or []
        return rows

    def resolve_package_preview(self, info, customer_id, flight_id, hotel_id, room_code=None):
        flight_out = _get_json(f"{FLIGHT_BASE}/{str(flight_id).upper()}")
        hotel_out = _get_json(f"{HOTEL_BASE}/{int(hotel_id)}")
        loyalty_out = _get_json(f"{LOYALTY_BASE}/{int(customer_id)}/points")

        flight = (flight_out or {}).get("data") or {}
        hotel = (hotel_out or {}).get("data") or {}
        loyalty = (loyalty_out or {}).get("data") or {}

        flight_price = float(flight.get("economyPrice") or 0)
        room_types = hotel.get("roomTypes") or []
        chosen_room = None
        if room_code:
            wanted = str(room_code).strip().upper()
            chosen_room = next((rt for rt in room_types if str(rt.get("code", "")).upper() == wanted), None)
        if not chosen_room and room_types:
            chosen_room = room_types[0]
        hotel_price = float((chosen_room or {}).get("pricePerNight") or 0)

        estimated_total = round(flight_price + hotel_price, 2)
        return {
            "customerID": int(customer_id),
            "estimatedTotalPrice": estimated_total,
            "currency": "SGD",
            "flight": flight,
            "hotel": hotel,
            "loyalty": loyalty,
        }


schema = graphene.Schema(query=Query)


@app.get("/")
def health():
    return jsonify({"code": 200, "message": "GraphQL gateway is running", "endpoint": "/graphql"}), 200


@app.post("/graphql")
def graphql_endpoint():
    payload = request.get_json(silent=True) or {}
    query = payload.get("query")
    variables = payload.get("variables")
    if not query:
        return jsonify({"errors": [{"message": "Missing GraphQL query"}]}), 400

    result = schema.execute(query, variable_values=variables)
    body = {}
    if result.errors:
        body["errors"] = [{"message": str(err)} for err in result.errors]
    if result.data is not None:
        body["data"] = result.data
    status = 200 if not result.errors else 400
    return jsonify(body), status


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5110, debug=True)
