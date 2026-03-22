from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Demo flights: IATA-style prefix (first 2 letters) drives seat-selection policy in the UI.
FLIGHTS = {
    "SQ001": {
        "flightNum": "SQ001",
        "airline": "Singapore Airlines",
        "origin": "SIN",
        "destination": "NRT",
        "availableSeats": 42,
        "onlineSeatSelection": True,
        "seatNote": "Standard online seat map (demo).",
    },
    "SQ002": {
        "flightNum": "SQ002",
        "airline": "Singapore Airlines",
        "origin": "SIN",
        "destination": "SYD",
        "availableSeats": 36,
        "onlineSeatSelection": True,
        "seatNote": "Standard online seat map (demo).",
    },
    "AK123": {
        "flightNum": "AK123",
        "airline": "AirAsia",
        "origin": "SIN",
        "destination": "KUL",
        "availableSeats": 180,
        "onlineSeatSelection": False,
        "seatNote": "AirAsia (demo): seat assignment at online check-in or airport — no advance seat pick in this demo.",
    },
    "AA456": {
        "flightNum": "AA456",
        "airline": "American Airlines",
        "origin": "SIN",
        "destination": "NRT",
        "availableSeats": 220,
        "onlineSeatSelection": False,
        "seatNote": "Partner / long-haul policy (demo): choose seats at check-in or with an agent.",
    },
    "TR789": {
        "flightNum": "TR789",
        "airline": "Scoot",
        "origin": "SIN",
        "destination": "BKK",
        "availableSeats": 189,
        "onlineSeatSelection": False,
        "seatNote": "Scoot (demo): budget carrier — seat selection at check-in or paid add-on via airline app.",
    },
}


@app.route("/flight/<flight_num>", methods=["GET"])
def get_flight(flight_num: str):
    flight = FLIGHTS.get(flight_num.upper())
    if not flight:
        return jsonify({"code": 404, "message": "Flight not found"}), 404
    return jsonify({"code": 200, "data": flight}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5102, debug=True)
