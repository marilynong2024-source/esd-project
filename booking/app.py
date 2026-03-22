from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import os
import requests
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text, inspect
import pika
import json

app = Flask(__name__)
CORS(app)

# In-memory tracking for the demo:
# How many loyalty coins (in cents) were spent for each created booking.
# Needed so cancellation can refund coins that were spent at payment time.
COINS_SPENT_BY_BOOKING = {}

# Database configuration
db_url = os.environ.get("DB_URL", "sqlite:///bookings.db")
app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# RabbitMQ configuration
rabbit_host = os.environ.get("RABBIT_HOST", "localhost")
rabbit_port = int(os.environ.get("RABBIT_PORT", "5672"))
exchange_name = os.environ.get("EXCHANGE_NAME", "travel_topic")
exchange_type = os.environ.get("EXCHANGE_TYPE", "topic")

_amqp_connection = None
_amqp_channel = None


def get_amqp_channel():
    global _amqp_connection, _amqp_channel
    if _amqp_channel and _amqp_channel.is_open:
        return _amqp_channel
    params = pika.ConnectionParameters(
        host=rabbit_host,
        port=rabbit_port,
        heartbeat=300,
        blocked_connection_timeout=300,
    )
    _amqp_connection = pika.BlockingConnection(params)
    _amqp_channel = _amqp_connection.channel()
    _amqp_channel.exchange_declare(
        exchange=exchange_name, exchange_type=exchange_type, durable=True
    )
    return _amqp_channel


def publish_event(routing_key: str, payload: dict):
    try:
        channel = get_amqp_channel()
        message = json.dumps(payload)
        channel.basic_publish(
            exchange=exchange_name,
            routing_key=routing_key,
            body=message,
            properties=pika.BasicProperties(delivery_mode=2),
        )
    except Exception as e:
        # For demo purposes, we just log and continue; cancellation still succeeds.
        print(f"Failed to publish AMQP event: {e}")


class Booking(db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    customerID = db.Column(db.Integer, nullable=False)
    flightID = db.Column(db.String(20), nullable=False)
    hotelID = db.Column(db.Integer, nullable=False)
    hotelRoomType = db.Column(db.String(10), nullable=True)  # e.g. STD, DLX
    hotelIncludesBreakfast = db.Column(db.Boolean, default=False)
    departureTime = db.Column(db.String(40), nullable=False)
    totalPrice = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(8), default="SGD")
    fareType = db.Column(db.String(20), default="Saver")
    loyaltyTier = db.Column(db.String(20), nullable=True)
    # How the hotel portion was paid: "PrepaidInApp" (default) vs "PayAtHotel"
    hotelPaymentMode = db.Column(db.String(20), default="PrepaidInApp")
    status = db.Column(db.String(20), default="CONFIRMED")
    refundPercentage = db.Column(db.Integer, nullable=True)
    refundAmount = db.Column(db.Float, nullable=True)
    # Flight seat (demo): only meaningful when airline allows online seat selection (e.g. SQ).
    seatNumber = db.Column(db.String(8), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "customerID": self.customerID,
            "flightID": self.flightID,
            "hotelID": self.hotelID,
            "hotelRoomType": self.hotelRoomType,
            "hotelIncludesBreakfast": self.hotelIncludesBreakfast,
            "departureTime": self.departureTime,
            "totalPrice": self.totalPrice,
            "currency": self.currency,
            "fareType": self.fareType,
            "loyaltyTier": self.loyaltyTier,
            "hotelPaymentMode": self.hotelPaymentMode,
            "status": self.status,
            "refundPercentage": self.refundPercentage,
            "refundAmount": self.refundAmount,
            "seatNumber": self.seatNumber,
        }


def compute_refund_percentage(
    departure_time: datetime,
    cancel_time: datetime,
    fare_type: str,
    loyalty_tier: str | None = None,
) -> int:
    delta = departure_time - cancel_time
    days = delta.days
    fare_type = (fare_type or "Saver").lower()

    # Base table inspired by full‑service airlines
    table = {
        "flexi": [
            (30, 100),
            (15, 90),
            (7, 70),
            (1, 50),
        ],
        "standard": [
            (21, 70),
            (7, 50),
            (1, 25),
        ],
        "saver": [],  # non‑refundable
    }

    brackets = table.get(fare_type, table["saver"])
    percentage = 0
    for min_days, pct in brackets:
        if days >= min_days:
            percentage = pct
            break

    # Loyalty override: Gold tier gets bumped one level up (once in our simplified logic)
    if loyalty_tier and loyalty_tier.lower() == "gold" and percentage > 0:
        percentage = min(100, percentage + 10)

    return percentage


@app.route("/")
def index():
    """Health / welcome so opening http://localhost:5101 in browser shows API is up."""
    return jsonify({
        "code": 200,
        "message": "Booking API is running",
        "endpoints": {
            "POST /booking": "Create a booking",
            "GET /booking/<id>": "Get booking by ID",
            "POST /booking/cancel/<id>": "Cancel booking and get refund",
        },
    }), 200


@app.route("/booking", methods=["POST"])
def create_booking():
    data = request.get_json() or {}
    try:
        coins_to_spend_cents = int(max(0, int(data.get("coinsToSpendCents", 0) or 0)))
        seat_raw = data.get("seatNumber")
        seat_number = (str(seat_raw).strip().upper() if seat_raw else None) or None

        booking = Booking(
            customerID=data["customerID"],
            flightID=data["flightID"],
            hotelID=data["hotelID"],
            hotelRoomType=data.get("hotelRoomType"),
            hotelIncludesBreakfast=bool(data.get("hotelIncludesBreakfast", False)),
            departureTime=data["departureTime"],
            totalPrice=data["totalPrice"],
            currency=data.get("currency", "SGD"),
            fareType=data.get("fareType", "Saver"),
            loyaltyTier=data.get("loyaltyTier"),
            hotelPaymentMode=data.get("hotelPaymentMode", "PrepaidInApp"),
            seatNumber=seat_number,
        )
    except KeyError as e:
        return jsonify({"code": 400, "message": f"Missing field: {e}"}), 400

    db.session.add(booking)
    db.session.commit()

    # Loyalty: earn coins based on booking amount.
    # Guest bookings (customerID == 0 or None) do not earn loyalty benefits.
    if booking.customerID:
        loyalty_url = os.environ.get("LOYALTY_URL", "http://localhost:5105/loyalty")
        try:
            earn_payload = {
                "customerID": booking.customerID,
                "amount": float(booking.totalPrice),
                "coinsToSpendCents": coins_to_spend_cents,
            }
            earn_resp = requests.post(f"{loyalty_url}/earn", json=earn_payload, timeout=3)
            earn_data = earn_resp.json()
            if (
                earn_data
                and earn_data.get("code") == 200
                and earn_data.get("data")
                and earn_data["data"].get("tier")
            ):
                # Persist the tier that the loyalty service computed after booking completion.
                booking.loyaltyTier = earn_data["data"]["tier"]
                db.session.commit()
                if earn_data["data"].get("coinsSpent") is not None:
                    # Save how many cents were actually spent so cancellation can restore them.
                    COINS_SPENT_BY_BOOKING[booking.id] = int(earn_data["data"]["coinsSpent"])
        except Exception as e:
            # Non-fatal for demo purposes.
            print(f"Failed to call loyalty earn: {e}")

    return jsonify({"code": 201, "data": booking.to_dict()}), 201


@app.route("/booking/<int:booking_id>", methods=["GET"])
def get_booking(booking_id: int):
    booking = Booking.query.get(booking_id)
    if not booking:
        return jsonify({"code": 404, "message": "Booking not found"}), 404
    return jsonify({"code": 200, "data": booking.to_dict()}), 200


@app.route("/booking/cancel/<int:booking_id>", methods=["POST"])
def cancel_booking(booking_id: int):
    booking = Booking.query.get(booking_id)
    if not booking:
        return jsonify({"code": 404, "message": "Booking not found"}), 404

    try:
        departure_time = datetime.fromisoformat(booking.departureTime)
    except Exception:
        return (
            jsonify({"code": 500, "message": "Invalid departureTime format on booking"}),
            500,
        )

    now = datetime.utcnow()
    fare_type = booking.fareType or "Saver"
    loyalty_tier = booking.loyaltyTier  # e.g. Bronze, Silver, Gold
    percentage = compute_refund_percentage(departure_time, now, fare_type, loyalty_tier)
    total_price = booking.totalPrice or 0

    # Refund computation (simplified for this demo):
    # We refund against the full total (no "Pay at hotel" split).
    amount = total_price * percentage / 100

    # Call payment refund microservice
    payment_url = os.environ.get("PAYMENT_URL", "http://localhost:5104/payment/refund")
    refund_payload = {"bookingID": booking_id, "refundAmount": amount}
    try:
        payment_resp = requests.post(payment_url, json=refund_payload, timeout=5)
        payment_data = payment_resp.json()
    except Exception as e:
        return jsonify({"code": 500, "message": f"Error calling payment service: {e}"}), 500

    booking.status = "CANCELLED"
    booking.refundPercentage = percentage
    booking.refundAmount = amount
    db.session.commit()

    # Loyalty: adjust after cancellation.
    # Decrement bookingCount and deduct the coins earned for this specific booking.
    if booking.customerID:
        loyalty_url = os.environ.get("LOYALTY_URL", "http://localhost:5105/loyalty")
        try:
            adjust_payload = {
                "customerID": booking.customerID,
                "bookingAmount": float(booking.totalPrice),
                "bookingTier": booking.loyaltyTier,
                "coinsSpentCents": int(COINS_SPENT_BY_BOOKING.get(booking_id, 0) or 0),
            }
            requests.post(f"{loyalty_url}/adjust", json=adjust_payload, timeout=3)
            COINS_SPENT_BY_BOOKING.pop(booking_id, None)
        except Exception as e:
            print(f"Failed to call loyalty adjust: {e}")

    # Publish cancellation event for async processing (e.g. notification)
    publish_event(
        "booking.cancelled",
        {
            "bookingID": booking_id,
            "customerID": booking.customerID,
            "refundPercentage": percentage,
            "refundAmount": amount,
            "fareType": booking.fareType,
            "loyaltyTier": booking.loyaltyTier,
            "cancelledAt": now.isoformat(),
        },
    )

    result = {
        "bookingID": booking_id,
        "refundPercentage": percentage,
        "refundAmount": amount,
        "currency": booking.currency or "SGD",
        "payment": payment_data,
    }
    return jsonify({"code": 200, "data": result}), 200


def ensure_booking_columns():
    """Add columns introduced after first deploy (MySQL/SQLite)."""
    try:
        inspector = inspect(db.engine)
        if not inspector.has_table("bookings"):
            return
        cols = {c["name"] for c in inspector.get_columns("bookings")}
        if "seatNumber" not in cols:
            dialect = db.engine.dialect.name
            if dialect == "sqlite":
                db.session.execute(text("ALTER TABLE bookings ADD COLUMN seatNumber VARCHAR(8)"))
            else:
                db.session.execute(
                    text("ALTER TABLE bookings ADD COLUMN seatNumber VARCHAR(8) NULL")
                )
            db.session.commit()
            print("Migrated: added bookings.seatNumber")
    except Exception as e:
        db.session.rollback()
        print(f"ensure_booking_columns (non-fatal): {e}")


def wait_for_db(max_attempts=30, delay=2):
    """Wait for MySQL to be ready before creating tables (avoids crash on docker compose up)."""
    import time
    for attempt in range(max_attempts):
        try:
            with app.app_context():
                db.session.execute(text("SELECT 1"))
            print("Database ready.")
            return
        except Exception as e:
            print(f"DB not ready (attempt {attempt + 1}/{max_attempts}): {e}")
            if attempt == max_attempts - 1:
                raise
            time.sleep(delay)


if __name__ == "__main__":
    with app.app_context():
        wait_for_db()
        db.create_all()
        ensure_booking_columns()
    app.run(host="0.0.0.0", port=5101, debug=True)

