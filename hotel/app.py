from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

HOTELS = {
    1: {
        "hotelID": 1,
        "name": "Shinjuku Central Hotel",
        "location": "Tokyo",
        "roomTypes": [
            {
                "code": "STD",
                "label": "Standard Room (Room only)",
                "pricePerNight": 150.0,
                "includesBreakfast": False,
            },
            {
                "code": "DLX",
                "label": "Deluxe Room (with breakfast)",
                "pricePerNight": 220.0,
                "includesBreakfast": True,
            },
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5103, debug=True)

