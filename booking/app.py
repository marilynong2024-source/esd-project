from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import os
import requests
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text, inspect
import sqlalchemy.exc as sa_exc
import pika
import json

from traveller_os import (
    validate_travellers_for_booking,
    snapshot_display_names,
    fetch_byaccount_rows,
)
from fx_quote import optional_fx_snapshot
from catalog_validate import validate_flight_and_hotel
try:
    # When running inside booking Docker image, we copy the client as traveller_outsystems_client.py
    from traveller_outsystems_client import (
        create_traveller_profile,
        update_traveller_profile,
        delete_traveller_profile,
    )
except ImportError:  # Local dev fallback
    from travellerprofile.outsystems_client import (  # type: ignore[no-redef]
        create_traveller_profile,
        update_traveller_profile,
        delete_traveller_profile,
    )

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


def publish_event(routing_key: str, payload: dict) -> bool:
    try:
        channel = get_amqp_channel()
        message = json.dumps(payload, default=str)
        channel.basic_publish(
            exchange=exchange_name,
            routing_key=routing_key,
            body=message,
            properties=pika.BasicProperties(delivery_mode=2),
        )
        print(f"[booking] Published AMQP {routing_key} → {exchange_name}", flush=True)
        return True
    except Exception as e:
        print(f"[booking] Failed to publish AMQP event {routing_key!r}: {e}", flush=True)
        return False


def _bad_request(message: str):
    return jsonify({"code": 400, "message": message}), 400


def _conflict(message: str):
    return jsonify({"code": 409, "message": message}), 409


def _optional_trimmed_str(data: dict, key: str, max_len: int) -> str | None:
    raw = data.get(key)
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    return s[:max_len]


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
    status = db.Column(db.String(20), default="CONFIRMED")
    refundPercentage = db.Column(db.Integer, nullable=True)
    refundAmount = db.Column(db.Float, nullable=True)
    # Flight seat (demo): only meaningful when airline allows online seat selection (e.g. SQ).
    seatNumber = db.Column(db.String(8), nullable=True)
    # OutSystems Traveller Profile: companion/co-traveller records (not the customer account row).
    travellerProfileId = db.Column(db.Integer, nullable=True)  # first Id (legacy / convenience)
    travellerDisplayName = db.Column(db.String(128), nullable=True)  # summary; truncated
    travellerProfileIdsJson = db.Column(db.Text, nullable=True)  # JSON array of OutSystems Ids, e.g. [1,2,3]
    passengerName = db.Column(db.String(200), nullable=True)
    passengerEmail = db.Column(db.String(255), nullable=True)
    passengerPhone = db.Column(db.String(40), nullable=True)

    def to_dict(self):
        t_ids: list[int] = []
        if self.travellerProfileIdsJson:
            try:
                raw = json.loads(self.travellerProfileIdsJson)
                if isinstance(raw, list):
                    t_ids = [int(x) for x in raw if x is not None]
            except (ValueError, TypeError, json.JSONDecodeError):
                t_ids = []
        if not t_ids and self.travellerProfileId is not None:
            t_ids = [int(self.travellerProfileId)]
        return {
            "id": self.id,
            "customerID": self.customerID,
            "travellerProfileId": self.travellerProfileId,
            "travellerProfileIds": t_ids,
            "travellerDisplayName": self.travellerDisplayName,
            "flightID": self.flightID,
            "hotelID": self.hotelID,
            "hotelRoomType": self.hotelRoomType,
            "hotelIncludesBreakfast": self.hotelIncludesBreakfast,
            "departureTime": self.departureTime,
            "totalPrice": self.totalPrice,
            "currency": self.currency,
            "fareType": self.fareType,
            "loyaltyTier": self.loyaltyTier,
            "status": self.status,
            "refundPercentage": self.refundPercentage,
            "refundAmount": self.refundAmount,
            "seatNumber": self.seatNumber,
            "passengerName": self.passengerName,
            "passengerEmail": self.passengerEmail,
            "passengerPhone": self.passengerPhone,
        }


def traveller_profile_ids_for_event(booking: Booking) -> list[int]:
    """Same Id list as in API responses / AMQP payloads."""
    return booking.to_dict()["travellerProfileIds"]


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


def _parse_traveller_profile_ids(data: dict) -> tuple[list[int], str | None]:
    """Accept travellerProfileIds (array) and/or legacy travellerProfileId (single)."""
    ids: list[int] = []
    raw_multi = data.get("travellerProfileIds")
    if raw_multi is not None:
        if not isinstance(raw_multi, list):
            return [], "travellerProfileIds must be a JSON array of positive integers"
        for x in raw_multi:
            try:
                i = int(x)
                if i <= 0:
                    return [], "Each travellerProfileIds entry must be a positive integer"
                ids.append(i)
            except (TypeError, ValueError):
                return [], "travellerProfileIds must be a JSON array of positive integers"

    raw_tp = data.get("travellerProfileId")
    if raw_tp not in (None, ""):
        try:
            one = int(raw_tp)
            if one <= 0:
                return [], "travellerProfileId must be a positive integer"
            if one not in ids:
                ids.insert(0, one)
        except (TypeError, ValueError):
            return [], "travellerProfileId must be a positive integer"

    if len(ids) > 24:
        return [], "At most 24 traveller profile Ids per booking (demo limit)"

    seen: set[int] = set()
    unique: list[int] = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            unique.append(i)
    return unique, None


@app.route("/booking", methods=["POST"])
def create_booking():
    if not request.is_json:
        return _bad_request("Content-Type must be application/json")
    data = request.get_json(silent=True)
    if data is None or not isinstance(data, dict):
        return _bad_request("Request body must be a valid JSON object")

    warnings: list[str] = []

    try:
        coins_to_spend_cents = int(max(0, int(data.get("coinsToSpendCents", 0) or 0)))
        seat_raw = data.get("seatNumber")
        seat_number = (str(seat_raw).strip().upper() if seat_raw else None) or None

        customer_id = int(data["customerID"])
        if customer_id < 0:
            return _bad_request("customerID must be non-negative")
        if customer_id == 0:
            coins_to_spend_cents = 0

        hotel_id = int(data["hotelID"])
        if hotel_id < 1:
            return _bad_request("hotelID must be a positive integer")

        flight_id = str(data["flightID"]).strip()
        if not flight_id or len(flight_id) > 20:
            return _bad_request("flightID must be a non-empty string (max 20 characters)")

        try:
            total_price = float(data["totalPrice"])
        except (TypeError, ValueError):
            return _bad_request("totalPrice must be a number")
        if total_price < 0 or total_price > 1e9:
            return _bad_request("totalPrice must be between 0 and 1e9")

        departure_time = str(data["departureTime"]).strip()
        if not departure_time:
            return _bad_request("departureTime is required")

        currency = str(data.get("currency") or "SGD").strip()[:8] or "SGD"
        fare_type = str(data.get("fareType") or "Saver").strip()[:20] or "Saver"

        traveller_ids, tid_err = _parse_traveller_profile_ids(data)
        if tid_err:
            return _bad_request(tid_err)

        profile_rows, profile_err, _, traveller_ids_final = (
            validate_travellers_for_booking(customer_id, traveller_ids)
        )
        if profile_err:
            return jsonify({"code": 400, "message": profile_err}), 400

        traveller_profile_id = traveller_ids_final[0] if traveller_ids_final else None
        ids_json = (
            json.dumps(traveller_ids_final) if traveller_ids_final else None
        )
        traveller_snap = snapshot_display_names(profile_rows)
        passenger_name = _optional_trimmed_str(data, "passengerName", 200)
        passenger_email = _optional_trimmed_str(data, "passengerEmail", 255)
        passenger_phone = _optional_trimmed_str(data, "passengerPhone", 40)
        display_name = traveller_snap
        if not display_name and passenger_name:
            display_name = passenger_name[:128]

        cat_err = validate_flight_and_hotel(flight_id, hotel_id)
        if cat_err:
            return _bad_request(cat_err)

        booking = Booking(
            customerID=customer_id,
            flightID=flight_id,
            hotelID=hotel_id,
            hotelRoomType=data.get("hotelRoomType"),
            hotelIncludesBreakfast=bool(data.get("hotelIncludesBreakfast", False)),
            departureTime=departure_time,
            totalPrice=total_price,
            currency=currency,
            fareType=fare_type,
            loyaltyTier=data.get("loyaltyTier"),
            seatNumber=seat_number,
            travellerProfileId=traveller_profile_id,
            travellerDisplayName=display_name,
            travellerProfileIdsJson=ids_json,
            passengerName=passenger_name,
            passengerEmail=passenger_email,
            passengerPhone=passenger_phone,
        )
    except KeyError as e:
        return _bad_request(f"Missing required field: {e.args[0]!r}")

    try:
        db.session.add(booking)
        db.session.commit()
    except sa_exc.SQLAlchemyError as e:
        db.session.rollback()
        print(f"[booking] DB error on create: {e}")
        return jsonify(
            {"code": 500, "message": "Could not save booking (database error)"}
        ), 500

    if booking.customerID:
        loyalty_url = os.environ.get("LOYALTY_URL", "http://localhost:5105/loyalty")
        try:
            earn_payload = {
                "customerID": booking.customerID,
                "amount": float(booking.totalPrice),
                "coinsToSpendCents": coins_to_spend_cents,
            }
            earn_resp = requests.post(
                f"{loyalty_url}/earn", json=earn_payload, timeout=5
            )
            if not earn_resp.ok:
                warnings.append(
                    f"Loyalty service returned HTTP {earn_resp.status_code} for /earn"
                )
                earn_data = {}
            else:
                try:
                    earn_data = earn_resp.json()
                except ValueError:
                    warnings.append("Loyalty service returned non-JSON for /earn")
                    earn_data = {}
            if (
                earn_data
                and earn_data.get("code") == 200
                and earn_data.get("data")
                and earn_data["data"].get("tier")
            ):
                booking.loyaltyTier = earn_data["data"]["tier"]
                try:
                    db.session.commit()
                except sa_exc.SQLAlchemyError as e:
                    db.session.rollback()
                    warnings.append("Could not persist loyalty tier on booking")
                    print(f"[booking] loyalty tier commit: {e}")
                if earn_data["data"].get("coinsSpent") is not None:
                    COINS_SPENT_BY_BOOKING[booking.id] = int(
                        earn_data["data"]["coinsSpent"]
                    )
        except requests.RequestException as e:
            warnings.append(f"Loyalty service unreachable: {e}")

    t_ids_publish = traveller_profile_ids_for_event(booking)
    confirmed_ok = publish_event(
        "booking.confirmed",
        {
            "bookingID": booking.id,
            "customerID": booking.customerID,
            "travellerProfileId": booking.travellerProfileId,
            "travellerProfileIds": t_ids_publish,
            "travellerDisplayName": booking.travellerDisplayName,
            "passengerName": booking.passengerName,
            "passengerEmail": booking.passengerEmail,
            "passengerPhone": booking.passengerPhone,
            "flightID": booking.flightID,
            "hotelID": booking.hotelID,
            "hotelRoomType": booking.hotelRoomType,
            "hotelIncludesBreakfast": booking.hotelIncludesBreakfast,
            "departureTime": booking.departureTime,
            "totalPrice": float(booking.totalPrice or 0),
            "currency": booking.currency or "SGD",
            "fareType": booking.fareType,
            "loyaltyTier": booking.loyaltyTier,
            "seatNumber": booking.seatNumber,
            "status": booking.status,
            "confirmedAt": datetime.utcnow().isoformat(),
        },
    )
    if not confirmed_ok:
        warnings.append(
            "Could not publish booking.confirmed to RabbitMQ — check booking logs, "
            "RABBIT_HOST/RABBIT_PORT, and that the notification worker is running."
        )

    out: dict = {"code": 201, "data": booking.to_dict()}
    if warnings:
        out["warnings"] = warnings
    fx = optional_fx_snapshot(booking.currency or "SGD")
    if fx is not None:
        out["fxQuote"] = fx
    return jsonify(out), 201


@app.route("/booking/<int:booking_id>", methods=["GET"])
def get_booking(booking_id: int):
    booking = Booking.query.get(booking_id)
    if not booking:
        return jsonify({"code": 404, "message": "Booking not found"}), 404
    return jsonify({"code": 200, "data": booking.to_dict()}), 200


@app.route("/travellerprofiles/byaccount/<int:customer_id>", methods=["GET"])
def traveller_profiles_byaccount(customer_id: int):
    err, rows = fetch_byaccount_rows(customer_id)
    if rows is None and err is None:
        return (
            jsonify(
                {
                    "code": 500,
                    "message": "Traveller profile service not configured (TRAVELLER_PROFILE_BASE_URL is empty).",
                }
            ),
            500,
        )
    if err:
        return jsonify({"code": 502, "message": err}), 502
    return jsonify({"code": 200, "data": rows or []}), 200


@app.route(
    "/travellerprofiles/update/<int:traveller_profile_id>", methods=["PUT", "POST"]
)
def traveller_profile_update(traveller_profile_id: int):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"code": 400, "message": "Body must be a JSON object"}), 400

    # OutSystems actions vary slightly by naming; send both common keys.
    payload.setdefault("Id", int(traveller_profile_id))
    payload.setdefault("TravellerProfileId", int(traveller_profile_id))

    result = update_traveller_profile(payload)
    return jsonify({"code": 200, "data": result}), 200


@app.route("/travellerprofiles/create", methods=["POST"])
def traveller_profile_create():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"code": 400, "message": "Body must be a JSON object"}), 400

    result = create_traveller_profile(payload)
    return jsonify({"code": 200, "data": result}), 200


@app.route(
    "/travellerprofiles/delete/<int:traveller_profile_id>",
    methods=["DELETE", "POST"],
)
def traveller_profile_delete(traveller_profile_id: int):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"code": 400, "message": "Body must be a JSON object"}), 400

    payload.setdefault("Id", int(traveller_profile_id))
    payload.setdefault("TravellerProfileId", int(traveller_profile_id))

    result = delete_traveller_profile(payload)
    return jsonify({"code": 200, "data": result}), 200


@app.route("/booking/cancel/<int:booking_id>", methods=["POST"])
def cancel_booking(booking_id: int):
    booking = Booking.query.get(booking_id)
    if not booking:
        return jsonify({"code": 404, "message": "Booking not found"}), 404

    if str(booking.status or "").upper() == "CANCELLED":
        return _conflict("Booking is already cancelled")

    try:
        departure_time = datetime.fromisoformat(booking.departureTime)
    except Exception:
        return (
            jsonify({"code": 500, "message": "Invalid departureTime format on booking"}),
            500,
        )

    now = datetime.utcnow()
    total_price = float(booking.totalPrice or 0)
    days_before_departure = (departure_time - now).days
    raw_body = request.get_json(silent=True)
    if raw_body is None:
        req = {}
    elif not isinstance(raw_body, dict):
        return _bad_request("Request body must be a JSON object if provided")
    else:
        req = raw_body

    cancel_source = (req.get("cancelSource") or "customer").strip().lower()
    allowed_sources = frozenset({"customer", "airline", "hotel"})
    if cancel_source not in allowed_sources:
        return _bad_request(
            f"cancelSource must be one of: {', '.join(sorted(allowed_sources))}"
        )

    # Demo package split: 60% flight + 40% hotel (both prepaid in-app).
    flight_component = total_price * 0.6
    hotel_component = total_price * 0.4

    # Rule requested by team:
    # - Flight has no refund unless airline cancels.
    # - Hotel refund is 100% only when cancelled >= 7 days before departure, else 0.
    if cancel_source == "airline":
        # Airline-initiated cancellation -> full package refund in this demo.
        amount = total_price
        flight_refund = flight_component
        hotel_refund = hotel_component
    elif cancel_source == "hotel":
        # Hotel-initiated cancellation -> full hotel-side refund.
        flight_refund = 0.0
        hotel_refund = hotel_component
        amount = flight_refund + hotel_refund
    else:
        # Customer cancellation.
        flight_refund = 0.0
        hotel_refund = hotel_component if days_before_departure >= 7 else 0.0
        amount = flight_refund + hotel_refund

    percentage = int(round((amount / total_price) * 100)) if total_price > 0 else 0

    payment_url = os.environ.get(
        "PAYMENT_URL", "http://localhost:5104/payment/refund"
    )
    refund_payload = {"bookingID": booking_id, "refundAmount": amount}
    try:
        payment_resp = requests.post(
            payment_url, json=refund_payload, timeout=10
        )
    except requests.RequestException as e:
        return jsonify(
            {"code": 503, "message": f"Payment service unreachable: {e}"}
        ), 503

    if not payment_resp.ok:
        return jsonify(
            {
                "code": 502,
                "message": "Payment service did not accept the refund request",
                "upstreamStatus": payment_resp.status_code,
                "upstreamBody": (payment_resp.text or "")[:500],
            }
        ), 502

    try:
        payment_data = payment_resp.json()
    except ValueError:
        return jsonify(
            {
                "code": 502,
                "message": "Payment service returned a non-JSON body",
                "upstreamBody": (payment_resp.text or "")[:500],
            }
        ), 502

    booking.status = "CANCELLED"
    booking.refundPercentage = percentage
    booking.refundAmount = amount
    try:
        db.session.commit()
    except sa_exc.SQLAlchemyError as e:
        db.session.rollback()
        print(f"[booking] DB error after refund for booking {booking_id}: {e}")
        return jsonify(
            {
                "code": 500,
                "message": "Refund was sent to Payment but updating the booking in the database failed — flag for manual check",
                "payment": payment_data,
            }
        ), 500

    cancel_warnings: list[str] = []
    if booking.customerID:
        loyalty_url = os.environ.get("LOYALTY_URL", "http://localhost:5105/loyalty")
        try:
            adjust_payload = {
                "customerID": booking.customerID,
                "bookingAmount": float(booking.totalPrice),
                "bookingTier": booking.loyaltyTier,
                "coinsSpentCents": int(COINS_SPENT_BY_BOOKING.get(booking_id, 0) or 0),
            }
            adj_resp = requests.post(
                f"{loyalty_url}/adjust", json=adjust_payload, timeout=5
            )
            if not adj_resp.ok:
                cancel_warnings.append(
                    f"Loyalty service returned HTTP {adj_resp.status_code} for /adjust"
                )
            else:
                try:
                    adj_resp.json()
                except ValueError:
                    cancel_warnings.append(
                        "Loyalty service returned non-JSON for /adjust"
                    )
            COINS_SPENT_BY_BOOKING.pop(booking_id, None)
        except requests.RequestException as e:
            cancel_warnings.append(f"Loyalty adjust unreachable: {e}")

    # Publish cancellation event for async processing (e.g. notification)
    t_ids_event = traveller_profile_ids_for_event(booking)

    published = publish_event(
        "booking.cancelled",
        {
            "bookingID": booking_id,
            "customerID": booking.customerID,
            "travellerProfileId": booking.travellerProfileId,
            "travellerProfileIds": t_ids_event,
            "travellerDisplayName": booking.travellerDisplayName,
            "passengerName": booking.passengerName,
            "passengerEmail": booking.passengerEmail,
            "passengerPhone": booking.passengerPhone,
            "refundPercentage": percentage,
            "refundAmount": round(amount, 2),
            "flightID": booking.flightID,
            "hotelID": booking.hotelID,
            "departureTime": booking.departureTime,
            "totalPrice": float(booking.totalPrice or 0),
            "currency": booking.currency or "SGD",
            "fareType": booking.fareType,
            "loyaltyTier": booking.loyaltyTier,
            "seatNumber": booking.seatNumber,
            "cancelledAt": now.isoformat(),
        },
    )
    if not published:
        cancel_warnings.append(
            "Could not publish booking.cancelled to RabbitMQ — check booking logs "
            "and that the rabbitmq service is reachable (notification/Twilio will not run)."
        )

    result = {
        "bookingID": booking_id,
        "cancelSource": cancel_source,
        "refundPercentage": percentage,
        "refundAmount": amount,
        "flightRefundAmount": round(flight_refund, 2),
        "hotelRefundAmount": round(hotel_refund, 2),
        "currency": booking.currency or "SGD",
        "payment": payment_data,
    }
    out = {"code": 200, "data": result}
    if cancel_warnings:
        out["warnings"] = cancel_warnings
    return jsonify(out), 200


def ensure_booking_columns():
    """Add columns introduced after first deploy (MySQL/SQLite)."""
    try:
        inspector = inspect(db.engine)
        if not inspector.has_table("bookings"):
            return
        cols = {c["name"] for c in inspector.get_columns("bookings")}
        alters = []
        if "seatNumber" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN seatNumber VARCHAR(8) NULL"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN seatNumber VARCHAR(8)"
            )
        if "travellerProfileId" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN travellerProfileId INT NULL"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN travellerProfileId INTEGER"
            )
        if "travellerDisplayName" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN travellerDisplayName VARCHAR(128) NULL"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN travellerDisplayName VARCHAR(128)"
            )
        if "travellerProfileIdsJson" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN travellerProfileIdsJson TEXT NULL"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN travellerProfileIdsJson TEXT"
            )
        if "passengerName" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN passengerName VARCHAR(200) NULL"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN passengerName VARCHAR(200)"
            )
        if "passengerEmail" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN passengerEmail VARCHAR(255) NULL"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN passengerEmail VARCHAR(255)"
            )
        if "passengerPhone" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN passengerPhone VARCHAR(40) NULL"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN passengerPhone VARCHAR(40)"
            )
        for stmt in alters:
            db.session.execute(text(stmt))
        if alters:
            db.session.commit()
            print(f"Migrated bookings columns: {len(alters)} statement(s)")
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

