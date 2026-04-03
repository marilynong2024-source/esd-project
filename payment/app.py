import os
import re

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

PAYMENTS = {}
NEXT_ID = 1


def _stripe_secret_status() -> dict:
    raw = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    if not raw:
        return {
            "configured": False,
            "secretKeyLooksValid": False,
            "hint": "Set STRIPE_SECRET_KEY in .env (sk_test_... or sk_live_...). "
            "Publishable keys (pk_...) are for the browser only.",
        }
    ok = bool(re.match(r"^sk_(test|live)_", raw))
    bad_pk = raw.startswith("pk_")
    hint = None
    if bad_pk:
        hint = "Value starts with pk_ — that is a publishable key. Use a secret key (sk_test_...)."
    elif not ok:
        hint = "Secret keys normally start with sk_test_ or sk_live_."
    return {
        "configured": True,
        "secretKeyLooksValid": ok,
        "keyPrefix": raw[:7] + "…" if len(raw) > 7 else "set",
        "hint": hint,
    }


@app.route("/payment/health", methods=["GET"])
def payment_health():
    """
    Stack checks: simulated payment engine + whether Stripe env looks usable.
    Card charges still use the in-memory simulator unless you extend process_payment.
    """
    stripe = _stripe_secret_status()
    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "service": "payment",
                    "engine": "simulated_in_memory",
                    "stripeEnv": stripe,
                    "note": "Booking calls this service over Docker network; optional Stripe "
                    "real charges require implementing PaymentIntent in app.py.",
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

    # Optional simulation for demo/testing.
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

    # For simplicity, we just log refund without complex balance checks.
    refund_record = {
        "bookingID": booking_id,
        "refundAmount": refund_amount,
        "status": "REFUNDED",
        "refundedAt": datetime.utcnow().isoformat(),
    }
    return jsonify({"code": 200, "data": refund_record}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5104, debug=True)

