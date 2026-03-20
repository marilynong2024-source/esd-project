from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

FLIGHTS = {
    "SQ001": {"flightNum": "SQ001", "origin": "SIN", "destination": "NRT", "availableSeats": 10},
}


@app.route("/flight/<flight_num>", methods=["GET"])
def get_flight(flight_num: str):
    flight = FLIGHTS.get(flight_num.upper())
    if not flight:
        return jsonify({"code": 404, "message": "Flight not found"}), 404
    return jsonify({"code": 200, "data": flight}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5102, debug=True)

