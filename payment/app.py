from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

PAYMENTS = {}
NEXT_ID = 1


@app.route("/payment/health", methods=["GET"])
def payment_health():
    """Simulated payment engine — booking service POSTs /payment/process; no external PSP."""
    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "service": "payment",
                    "engine": "simulated_in_memory",
                    "note": "No card processor: amounts are recorded as PAID for demo. "
                    "SMS uses Twilio on the notification service when the booking publishes notify.user.",
                },
            }
        ),
        200,
    )


@app.route("/payment", methods=["POST"])
def process_payment():
    """
    Initial payment at booking time.
    Body: { bookingID, amount, currency }
    """
    global NEXT_ID
    data = request.get_json() or {}
    payment_id = NEXT_ID
    NEXT_ID += 1
    record = {
        "paymentID": payment_id,
        "bookingID": data.get("bookingID"),
        "amount": data.get("amount", 0),
        "currency": data.get("currency", "SGD"),
        "status": "PAID",
        "createdAt": datetime.utcnow().isoformat(),
    }
    PAYMENTS[payment_id] = record
    return jsonify({"code": 201, "data": record}), 201


@app.route("/payment/process", methods=["POST"])
def process_payment_process():
    """
    Diagram-aligned payment processing endpoint.

    Body: { bookingID, amount, currency, simulateFail? }
    """
    data = request.get_json() or {}
    booking_id = data.get("bookingID")
    amount = data.get("amount", 0)
    currency = data.get("currency", "SGD")
    simulate_fail = bool(data.get("simulateFail", False))

    if simulate_fail or float(amount or 0) <= 0:
        return jsonify({"code": 502, "message": "Payment processing failed (simulated)"}), 502

    global NEXT_ID
    payment_id = NEXT_ID
    NEXT_ID += 1
    record = {
        "paymentID": payment_id,
        "bookingID": booking_id,
        "amount": amount,
        "currency": currency,
        "status": "PAID",
        "createdAt": datetime.utcnow().isoformat(),
    }
    PAYMENTS[payment_id] = record
    return jsonify({"code": 200, "data": record}), 200


@app.route("/payment/refund", methods=["POST"])
@app.route("/refund-payment", methods=["POST"])
@app.route("/payment/refund-payment", methods=["POST"])
def refund_payment():
    """
    Refund payment for a booking.
    Body: { bookingID, refundAmount }
    """
    data = request.get_json() or {}
    booking_id = data.get("bookingID")
    refund_amount = data.get("refundAmount", 0)

    refund_record = {
        "bookingID": booking_id,
        "refundAmount": refund_amount,
        "status": "REFUNDED",
        "refundedAt": datetime.utcnow().isoformat(),
    }
    return jsonify({"code": 200, "data": refund_record}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5104, debug=True)
