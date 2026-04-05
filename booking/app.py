from typing import Any

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
import os
import requests
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text, inspect
from sqlalchemy import func
import sqlalchemy.exc as sa_exc
import pika
import json

from traveller_os import (
    fetch_byaccount_rows,
    local_demo_enabled,
    snapshot_display_names,
    traveller_profile_create_local,
    traveller_profile_delete_local,
    traveller_profile_update_local,
    validate_travellers_for_booking,
)


def _traveller_profile_env_required() -> bool:
    return os.environ.get("TRAVELLER_PROFILE_REQUIRED", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
from fx_quote import (
    exchange_rate_api_key_from_env,
    get_sgd_to_currency_rate,
    optional_fx_snapshot,
)
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


def _traveller_create_profile(payload: dict):
    if local_demo_enabled():
        return traveller_profile_create_local(payload)
    return create_traveller_profile(payload)


def _traveller_update_profile(payload: dict):
    if local_demo_enabled():
        return traveller_profile_update_local(payload)
    return update_traveller_profile(payload)


def _traveller_delete_profile(payload: dict):
    if local_demo_enabled():
        return traveller_profile_delete_local(payload)
    return delete_traveller_profile(payload)


def _traveller_upstream_error_response(result: Any) -> tuple[Any, int] | None:
    """If OutSystems client returned an error dict, build (jsonify(...), status). Else None."""
    if not isinstance(result, dict):
        return None
    if not result.get("_error"):
        return None
    msg = str(result.get("_error") or "Traveller Profile upstream error")
    return (
        jsonify(
            {
                "code": 503,
                "message": msg,
                "upstreamStatus": result.get("_httpStatus"),
                "detail": (result.get("_raw") or "")[:800] or None,
            }
        ),
        503,
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


def _post_notify_manual(payload: dict) -> str | None:
    """POST /notify/manual on the Notification service (diagram: synchronous confirmation)."""
    base = os.environ.get("NOTIFICATION_URL", "http://notification:5106").rstrip("/")
    try:
        resp = requests.post(f"{base}/notify/manual", json=payload, timeout=5)
        if not resp.ok:
            return f"notify/manual HTTP {resp.status_code}"
    except requests.RequestException as e:
        return f"notify/manual unreachable: {e}"
    return None


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


def _traveller_profile_row_id(row: dict) -> int | None:
    for key in ("Id", "id", "TravellerProfileId", "TravellerId"):
        raw = row.get(key)
        if raw is None:
            continue
        try:
            return int(raw)
        except (TypeError, ValueError):
            continue
    return None


def _extract_traveller_doc(profile: dict) -> dict:
    return {
        "travellerProfileID": _traveller_profile_row_id(profile),
        "fullName": str(
            profile.get("FullName")
            or profile.get("Name")
            or profile.get("TravellerName")
            or ""
        ).strip()
        or None,
        "passportNumber": str(
            profile.get("PassportNumber")
            or profile.get("PassportNo")
            or profile.get("passportNumber")
            or ""
        ).strip()
        or None,
        "mealPreference": str(
            profile.get("MealPreference")
            or profile.get("mealPreference")
            or ""
        ).strip()
        or None,
        "dateOfBirth": str(
            profile.get("DateOfBirth")
            or profile.get("dateOfBirth")
            or profile.get("DOB")
            or ""
        ).strip()
        or None,
    }


def _parse_isoish_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        pass
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            continue
    return None


def _age_years_on(dob_raw: str | None, when_dt: datetime) -> int | None:
    dob = _parse_isoish_date(dob_raw)
    if not dob:
        return None
    years = when_dt.year - dob.year - (
        (when_dt.month, when_dt.day) < (dob.month, dob.day)
    )
    return max(0, years)


def _traveller_age_breakdown(
    traveller_docs: list[dict], departure_raw: str
) -> tuple[int, int, int]:
    dep_dt = _parse_isoish_date(departure_raw) or datetime.utcnow()
    adult = 0
    child = 0
    infant = 0
    for d in traveller_docs:
        age = _age_years_on(d.get("dateOfBirth"), dep_dt)
        # If age unknown, default to adult to avoid silently under-counting seats/rooms.
        if age is None or age >= 12:
            adult += 1
        elif age >= 2:
            child += 1
        else:
            infant += 1
    if not traveller_docs:
        adult = 1
    return adult, child, infant


def _hotel_service_base() -> str:
    hotel_base = os.environ.get("HOTEL_URL", "http://hotel:5103/hotel").strip().rstrip("/")
    if hotel_base.endswith("/hotel"):
        return hotel_base[: -len("/hotel")]
    return hotel_base


def lookup_hotel_name(hotel_id: object) -> str | None:
    """Resolve display name from hotel catalog (GET /hotel/{id})."""
    try:
        hid = int(hotel_id)
    except (TypeError, ValueError):
        return None
    if hid < 1:
        return None
    try:
        r = requests.get(f"{_hotel_service_base()}/hotel/{hid}", timeout=4)
        if r.status_code != 200:
            return None
        body = r.json()
        if not isinstance(body, dict) or int(body.get("code", 0) or 0) != 200:
            return None
        data = body.get("data")
        if not isinstance(data, dict):
            return None
        name = data.get("name")
        s = str(name).strip() if name is not None else ""
        return s or None
    except (requests.RequestException, ValueError, TypeError, json.JSONDecodeError):
        return None


def booking_dict_with_hotel(booking: "Booking") -> dict:
    d = booking.to_dict()
    d["hotelName"] = lookup_hotel_name(d.get("hotelID"))
    return d


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
    # Number of rooms reserved for this package (diagram-required field).
    # Demo assumes 1 room for the selected hotel package.
    noOfRooms = db.Column(db.Integer, default=1)
    refundPercentage = db.Column(db.Integer, nullable=True)
    refundAmount = db.Column(db.Float, nullable=True)
    cancellationPolicyID = db.Column(db.String(40), nullable=True)
    cancellationTimestamp = db.Column(db.String(40), nullable=True)
    # Flight seat (demo): only meaningful when airline allows online seat selection (e.g. SQ).
    seatNumber = db.Column(db.String(8), nullable=True)
    # Multi-seat list (JSON array of seat codes) for bookings with more than 1 traveller.
    seatNumbersJson = db.Column(db.Text, nullable=True)
    # OutSystems Traveller Profile: companion/co-traveller records (not the customer account row).
    travellerProfileId = db.Column(db.Integer, nullable=True)  # first Id (legacy / convenience)
    travellerDisplayName = db.Column(db.String(128), nullable=True)  # summary; truncated
    travellerProfileIdsJson = db.Column(db.Text, nullable=True)  # JSON array of OutSystems Ids, e.g. [1,2,3]
    adultCount = db.Column(db.Integer, nullable=False, default=1)
    childCount = db.Column(db.Integer, nullable=False, default=0)
    infantCount = db.Column(db.Integer, nullable=False, default=0)
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
        seat_nums: list[str] = []
        if self.seatNumbersJson:
            try:
                raw_seats = json.loads(self.seatNumbersJson)
                if isinstance(raw_seats, list):
                    seat_nums = [
                        str(x).strip().upper()
                        for x in raw_seats
                        if x is not None and str(x).strip()
                    ]
            except (ValueError, TypeError, json.JSONDecodeError):
                seat_nums = []
        if not seat_nums and self.seatNumber:
            seat_nums = [str(self.seatNumber).strip().upper()]

        return {
            "id": self.id,
            "customerID": self.customerID,
            "travellerProfileId": self.travellerProfileId,
            "travellerProfileIds": t_ids,
            "travellerDisplayName": self.travellerDisplayName,
            "adultCount": int(self.adultCount or 0),
            "childCount": int(self.childCount or 0),
            "infantCount": int(self.infantCount or 0),
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
            "noOfRooms": self.noOfRooms,
            "refundPercentage": self.refundPercentage,
            "refundAmount": self.refundAmount,
            "cancellationPolicyID": self.cancellationPolicyID,
            "cancellationTimestamp": self.cancellationTimestamp,
            "seatNumber": self.seatNumber,
            "seatNumbers": seat_nums,
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


def compute_refund_policy_id_and_amount(
    *,
    total_price: float,
    fare_type: str,
    loyalty_tier: str | None,
    days_before_departure: int,
    cancel_source: str,
) -> tuple[str, int, float]:
    """
    Diagram-facing refund calculator:
    - Airline cancel => full package refund.
    - Hotel cancel   => hotel-side 40% refund.
    - Customer       => tiered rules by fare/tier and days to departure.
    """
    total = float(total_price or 0.0)
    src = (cancel_source or "customer").strip().lower()
    if src == "airline":
        return "AIRLINE_FULL", 100, round(total, 2)
    if src == "hotel":
        amt = round(total * 0.40, 2)
        pct = int(round((amt / total) * 100)) if total > 0 else 0
        return "HOTEL_PARTIAL", pct, amt

    pct = compute_refund_percentage(
        departure_time=datetime.utcnow() + timedelta(days=max(-1, int(days_before_departure))),
        cancel_time=datetime.utcnow(),
        fare_type=fare_type,
        loyalty_tier=loyalty_tier,
    )
    if days_before_departure < 0:
        pct = 0
    policy = f"{(fare_type or 'Saver').strip().upper()}_{(loyalty_tier or 'STD').strip().upper()}_D{max(-1, int(days_before_departure))}"
    amt = round(max(0.0, total * (pct / 100.0)), 2)
    return policy, pct, amt


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
            "GET /booking/policies": "List cancellation/refund policy rules",
            "GET /booking/refund-estimate?bookingID=<id>&cancelSource=customer": "Estimate cancellation refund",
            "GET /booking/fx-rate?to=USD": "SGD→currency rate for UI display",
            "GET /booking/integrations/health": "FX env summary",
        },
    }), 200


@app.route("/booking/integrations/health", methods=["GET"])
def booking_integrations_health():
    """One-place check for FX-related env (display rates + optional create-booking snapshot)."""
    er_key = exchange_rate_api_key_from_env()
    fx_on = os.environ.get("FX_API_ENABLED", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "service": "booking",
                    "fxSnapshotOnCreateBooking": fx_on,
                    "fxSnapshotUrlConfigured": bool(
                        (os.environ.get("FX_API_URL") or "").strip()
                    ),
                    "exchangeRateApiKeyConfigured": bool(er_key),
                    "exchangeRateApiKeyPrefix": (er_key[:4] + "…")
                    if len(er_key) > 6
                    else ("set" if er_key else ""),
                    "endpoints": {
                        "displayCurrencyRate": "GET /booking/fx-rate?to=USD",
                    },
                },
            }
        ),
        200,
    )


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


def _parse_seat_numbers_payload(data: dict) -> list[str]:
    """
    Accept seatNumber (single) and/or seatNumbers (array) from the UI.

    Returns a normalized list of seat codes (uppercase).
    If neither is provided, returns [].
    """
    out: list[str] = []

    raw_multi = data.get("seatNumbers")
    if isinstance(raw_multi, list):
        for x in raw_multi:
            if x is None:
                continue
            s = str(x).strip().upper()
            if s:
                out.append(s)
    elif isinstance(raw_multi, str):
        # Allow comma-separated strings as a fallback.
        parts = raw_multi.split(",")
        for p in parts:
            s = str(p).strip().upper()
            if s:
                out.append(s)

    # Backward compatible single seat
    if not out:
        seat_raw = data.get("seatNumber")
        if seat_raw:
            s = str(seat_raw).strip().upper()
            if s:
                out.append(s)

    # Dedup while preserving order.
    seen: set[str] = set()
    uniq: list[str] = []
    for s in out:
        if s not in seen:
            seen.add(s)
            uniq.append(s)
    return uniq


@app.route("/book-package", methods=["POST"])
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
        hold_token = str(data.get("seatHoldToken") or "").strip()
        seat_numbers = _parse_seat_numbers_payload(data)
        seat_number = seat_numbers[0] if seat_numbers else None

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

        # Account Check (Diagram step):
        # Call GET /account/{userID}. In local demos, accounts might not be pre-created,
        # so we treat 404 as non-fatal but still record a warning.
        if customer_id > 0:
            try:
                account_resp = requests.get(
                    f"http://account:5100/account/{customer_id}", timeout=5
                )
                if account_resp.ok:
                    try:
                        acc_json = account_resp.json()
                    except ValueError:
                        acc_json = {}
                    st = (
                        str((acc_json.get("data") or {}).get("accountStatus") or "")
                        .strip()
                        .lower()
                    )
                    if st and st != "active":
                        return jsonify(
                            {
                                "code": 403,
                                "message": f"Customer account is not active (status={st!r})",
                            }
                        ), 403
                elif account_resp.status_code == 404:
                    return jsonify(
                        {
                            "code": 404,
                            "message": "Customer account not found — create the account first",
                        }
                    ), 404
                else:
                    warnings.append(
                        f"Account check returned HTTP {account_resp.status_code} (demo continues)"
                    )
            except requests.RequestException as e:
                warnings.append(f"Account check unreachable: {e} (demo continues)")

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
        traveller_docs = [_extract_traveller_doc(p) for p in profile_rows]
        traveller_docs = [
            d for d in traveller_docs if d.get("travellerProfileID") is not None
        ]
        adult_count, child_count, infant_count = _traveller_age_breakdown(
            traveller_docs, departure_time
        )
        if (child_count > 0 or infant_count > 0) and adult_count < 1:
            return _bad_request(
                "At least one adult traveller is required when children/infants are included"
            )
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
            seatNumbersJson=(json.dumps(seat_numbers) if seat_numbers else None),
            status="PENDING",
            noOfRooms=1,
            travellerProfileId=traveller_profile_id,
            travellerDisplayName=display_name,
            travellerProfileIdsJson=ids_json,
            adultCount=adult_count,
            childCount=child_count,
            infantCount=infant_count,
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

    # ---- Book Package Composite (Diagram-aligned lifecycle) ----
    # Execution order inside this function:
    # 1) Flight reservation (reserve-seat)
    # 2) Hotel hold (hold-room)
    # 3) Loyalty pre-payment coin-deduct (stage=deduct) BEFORE payment
    # 4) Payment processing (payment/process)
    # 5) Confirmation (confirm-seat + confirm-room)
    # 6) Loyalty post-payment earn (stage=postpay)
    def _base_url(env_name: str, default: str) -> str:
        raw = os.environ.get(env_name, default).strip().rstrip("/")
        # Common compose defaults are like "...:port/flight" or ".../hotel"
        return raw

    flight_base = _base_url("FLIGHT_URL", "http://flight:5102/flight")
    if flight_base.endswith("/flight"):
        flight_base = flight_base[: -len("/flight")]
    hotel_base = _base_url("HOTEL_URL", "http://hotel:5103/hotel")
    if hotel_base.endswith("/hotel"):
        hotel_base = hotel_base[: -len("/hotel")]

    payment_base = _base_url("PAYMENT_URL", "http://payment:5104/payment")
    payment_process_url = (
        payment_base if payment_base.endswith("/process") else f"{payment_base}/process"
    )

    # Derived fields for Diagram lifecycle.
    traveller_ids_for_keys = traveller_profile_ids_for_event(booking)
    number_of_keys = len(traveller_ids_for_keys) if traveller_ids_for_keys else 1

    check_in = booking.departureTime
    check_out = booking.departureTime
    try:
        dep = datetime.fromisoformat(str(booking.departureTime).strip())
        check_out = (dep + timedelta(days=4)).isoformat()
    except Exception:
        # Keep check_out as check_in if parsing fails (demo tolerance).
        pass

    def _release_all():
        try:
            requests.put(
                f"{flight_base}/release-seat",
                json={"bookingID": booking.id},
                timeout=3,
            )
        except Exception:
            pass
        try:
            requests.put(
                f"{hotel_base}/release-room",
                json={"bookingID": booking.id},
                timeout=3,
            )
        except Exception:
            pass

    primary_doc = traveller_docs[0] if traveller_docs else {}

    # 1) Flight Reservation
    seat_numbers_for_hold: list[str] = []
    if booking.seatNumbersJson:
        try:
            raw_seats = json.loads(booking.seatNumbersJson)
            if isinstance(raw_seats, list):
                seat_numbers_for_hold = [
                    str(x).strip().upper()
                    for x in raw_seats
                    if x is not None and str(x).strip()
                ]
        except (ValueError, TypeError, json.JSONDecodeError):
            seat_numbers_for_hold = []

    if not seat_numbers_for_hold and booking.seatNumber:
        seat_numbers_for_hold = [str(booking.seatNumber).strip().upper()]

    if not seat_numbers_for_hold:
        seat_numbers_for_hold = ["AUTO"]

    seat_no = seat_numbers_for_hold[0]
    try:
        reserve_payload = {
            "bookingID": booking.id,
            "flightNum": booking.flightID,
            "seatNo": seat_no,
            "seatNos": seat_numbers_for_hold,
            "holdToken": hold_token,
            "travellers": traveller_docs,
            "adultCount": int(booking.adultCount or 0),
            "childCount": int(booking.childCount or 0),
            "infantCount": int(booking.infantCount or 0),
            "passportNumber": primary_doc.get("passportNumber"),
            "mealPreference": primary_doc.get("mealPreference"),
        }
        reserve_resp = requests.post(
            f"{flight_base}/reserve-seat",
            json=reserve_payload,
            timeout=5,
        )
        if not reserve_resp.ok:
            upstream_msg = ""
            try:
                upstream_msg = str((reserve_resp.json() or {}).get("message") or "")
            except Exception:
                upstream_msg = ""
            _release_all()
            booking.status = "CANCELLED"
            db.session.commit()
            if reserve_resp.status_code == 409:
                return (
                    jsonify(
                        {
                            "code": 409,
                            "message": upstream_msg or "Seat unavailable, please choose again",
                            "upstream": reserve_resp.status_code,
                        }
                    ),
                    409,
                )
            return (
                jsonify(
                    {
                        "code": 502,
                        "message": upstream_msg or "Flight reserve-seat failed",
                        "upstream": reserve_resp.status_code,
                    }
                ),
                502,
            )
    except requests.RequestException as e:
        _release_all()
        booking.status = "CANCELLED"
        db.session.commit()
        return jsonify({"code": 503, "message": f"Flight reserve-seat unreachable: {e}"}), 503

    # 2) Hotel Hold
    room_type = booking.hotelRoomType or "STD"
    try:
        hold_payload = {
            "bookingID": booking.id,
            "hotelID": booking.hotelID,
            "roomType": room_type,
            "checkIn": check_in,
            "checkOut": check_out,
            "numberOfKeys": number_of_keys,
            "adultCount": int(booking.adultCount or 0),
            "childCount": int(booking.childCount or 0),
            "infantCount": int(booking.infantCount or 0),
        }
        hold_resp = requests.post(
            f"{hotel_base}/hold-room",
            json=hold_payload,
            timeout=5,
        )
        if not hold_resp.ok:
            _release_all()
            booking.status = "CANCELLED"
            db.session.commit()
            return (
                jsonify(
                    {"code": 502, "message": "Hotel hold-room failed", "upstream": hold_resp.status_code}
                ),
                502,
            )
    except requests.RequestException as e:
        _release_all()
        booking.status = "CANCELLED"
        db.session.commit()
        return jsonify({"code": 503, "message": f"Hotel hold-room unreachable: {e}"}), 503

    # 3) Loyalty pre-payment point check + redeem
    if booking.customerID:
        loyalty_url = os.environ.get("LOYALTY_URL", "http://loyalty:5105/loyalty")
        try:
            points_resp = requests.get(
                f"{loyalty_url}/{booking.customerID}/points",
                timeout=5,
            )
            points_available = 0
            if points_resp.ok:
                try:
                    points_data = points_resp.json()
                except ValueError:
                    points_data = {}
                if points_data.get("code") == 200 and points_data.get("data"):
                    points_available = int(
                        points_data["data"].get("coins")
                        or points_data["data"].get("points")
                        or 0
                    )
            else:
                warnings.append(
                    f"Loyalty points-check failed HTTP {points_resp.status_code}"
                )
            points_to_redeem = min(int(points_available), int(coins_to_spend_cents))
            if points_to_redeem > 0:
                redeem_resp = requests.post(
                    f"{loyalty_url}/{booking.customerID}/redeem",
                    json={
                        "bookingID": booking.id,
                        "points": points_to_redeem,
                        "reason": "Pre-payment discount",
                    },
                    timeout=5,
                )
                if redeem_resp.ok:
                    try:
                        redeem_data = redeem_resp.json()
                    except ValueError:
                        redeem_data = {}
                    if redeem_data.get("code") == 200 and redeem_data.get("data"):
                        COINS_SPENT_BY_BOOKING[booking.id] = int(
                            redeem_data["data"].get("pointsRedeemed") or points_to_redeem
                        )
                else:
                    warnings.append(
                        f"Loyalty redeem failed HTTP {redeem_resp.status_code}"
                    )
        except requests.RequestException as e:
            warnings.append(f"Loyalty pre-payment unreachable: {e}")

    # 4) Payment processing
    payment_payload = {
        "bookingID": booking.id,
        "amount": float(booking.totalPrice),
        "currency": booking.currency or "SGD",
    }
    try:
        payment_resp = requests.post(
            payment_process_url, json=payment_payload, timeout=10
        )
    except requests.RequestException as e:
        _release_all()
        booking.status = "CANCELLED"
        try:
            db.session.commit()
        except sa_exc.SQLAlchemyError:
            db.session.rollback()
        return jsonify({"code": 503, "message": f"Payment process unreachable: {e}"}), 503

    if not payment_resp.ok:
        _release_all()
        booking.status = "CANCELLED"
        try:
            db.session.commit()
        except sa_exc.SQLAlchemyError:
            db.session.rollback()
        try:
            upstream_body = payment_resp.text or ""
        except Exception:
            upstream_body = ""
        return (
            jsonify(
                {
                    "code": 502,
                    "message": "Payment process failed",
                    "upstreamStatus": payment_resp.status_code,
                    "upstreamBody": upstream_body[:300],
                }
            ),
            502,
        )

    # 5) Confirmation (confirm-seat / confirm-room + diagram PUT availability)
    try:
        confirm_payload = {"bookingID": booking.id}
        requests.put(
            f"{flight_base}/confirm-seat", json=confirm_payload, timeout=5
        )
        requests.put(
            f"{hotel_base}/confirm-room", json=confirm_payload, timeout=5
        )
        seat_numbers_for_avail: list[str] = []
        if booking.seatNumbersJson:
            try:
                raw_seats = json.loads(booking.seatNumbersJson)
                if isinstance(raw_seats, list):
                    seat_numbers_for_avail = [
                        str(x).strip().upper()
                        for x in raw_seats
                        if x is not None and str(x).strip()
                    ]
            except (ValueError, TypeError, json.JSONDecodeError):
                seat_numbers_for_avail = []
        if not seat_numbers_for_avail and booking.seatNumber:
            seat_numbers_for_avail = [
                str(booking.seatNumber).strip().upper()
            ]
        if not seat_numbers_for_avail:
            seat_numbers_for_avail = ["AUTO"]
        try:
            for seat_for_avail in seat_numbers_for_avail:
                if not seat_for_avail:
                    continue
                requests.put(
                    f"{flight_base}/availability/{seat_for_avail}/CONFIRMED",
                    json={
                        "flightNum": booking.flightID,
                        "bookingID": booking.id,
                    },
                    timeout=5,
                )
            requests.put(
                f"{hotel_base}/availability/{int(booking.hotelID)}/CONFIRMED",
                json={
                    "roomType": booking.hotelRoomType or "STD",
                    "bookingID": booking.id,
                },
                timeout=5,
            )
        except requests.RequestException as e:
            warnings.append(f"Inventory availability PUT after confirm: {e}")
    except requests.RequestException as e:
        # If confirmation fails, rollback the holds.
        _release_all()
        booking.status = "CANCELLED"
        db.session.commit()
        return jsonify({"code": 502, "message": f"Confirm-seat/room failed: {e}"}), 502

    booking.status = "CONFIRMED"
    try:
        db.session.commit()
    except sa_exc.SQLAlchemyError:
        db.session.rollback()

    # 6) Loyalty post-payment earn
    if booking.customerID:
        try:
            loyalty_url = os.environ.get("LOYALTY_URL", "http://loyalty:5105/loyalty")
            earn_payload = {
                "bookingID": booking.id,
                "amount": float(booking.totalPrice),
                "reason": "Completed booking reward",
            }
            earn_resp = requests.post(
                f"{loyalty_url}/{booking.customerID}/earn", json=earn_payload, timeout=5
            )
            if earn_resp.ok:
                try:
                    earn_data = earn_resp.json()
                except ValueError:
                    earn_data = {}
                if (
                    earn_data
                    and earn_data.get("code") == 200
                    and earn_data.get("data")
                    and earn_data["data"].get("tier")
                ):
                    booking.loyaltyTier = str(earn_data["data"]["tier"]).title()
                    db.session.commit()
        except requests.RequestException as e:
            warnings.append(f"Loyalty postpay unreachable: {e}")

    t_ids_publish = traveller_profile_ids_for_event(booking)
    if not (booking.passengerPhone or "").strip():
        warnings.append(
            "No mobile on this booking — confirmation SMS cannot be sent. Add Mobile (SMS) under My profile "
            "before paying, or set TWILIO_TO_NUMBER in .env for demo-only delivery."
        )

    confirmed_at = datetime.utcnow().isoformat()
    notify_user_payload = {
        "bookingID": booking.id,
        "customerID": booking.customerID,
        "travellerProfileId": booking.travellerProfileId,
        "travellerProfileIds": t_ids_publish,
        "travellerDisplayName": booking.travellerDisplayName,
        "adultCount": int(booking.adultCount or 0),
        "childCount": int(booking.childCount or 0),
        "infantCount": int(booking.infantCount or 0),
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
        "seatNumbers": booking.to_dict().get("seatNumbers", []),
        "status": booking.status,
        "confirmedAt": confirmed_at,
    }
    # Publish first so the notification worker can send Twilio SMS; HTTP notify stays log-only on success.
    confirmed_ok = publish_event("notify.user", notify_user_payload)
    if confirmed_ok:
        manual_note = _post_notify_manual(
            {
                "source": "book_package",
                "bookingID": booking.id,
                "customerID": booking.customerID,
                "email": booking.passengerEmail,
                "userEmail": booking.passengerEmail,
                "passengerPhone": booking.passengerPhone,
                "status": "CONFIRMED",
                "confirmationPdfNote": "Demo: PDF booking confirmation would be generated here.",
            }
        )
    else:
        warnings.append(
            "Could not publish notify.user to RabbitMQ — confirmation SMS is sent via HTTP fallback if Twilio is on. "
            "Otherwise fix RABBIT_HOST/RABBIT_PORT and restart booking + notification."
        )
        manual_note = _post_notify_manual(
            {
                "source": "confirmation_sync",
                "status": "CONFIRMED",
                "note": "RabbitMQ unreachable — booking service sent this payload for SMS + activity log.",
                **notify_user_payload,
            }
        )
    if manual_note:
        warnings.append(manual_note)

    out: dict = {"code": 201, "data": booking_dict_with_hotel(booking)}
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
    return jsonify({"code": 200, "data": booking_dict_with_hotel(booking)}), 200


@app.route("/booking/bycustomer/<int:customer_id>", methods=["GET"])
def get_bookings_by_customer(customer_id: int):
    """
    UI support for "My Bookings" panel.
    Returns the most recent confirmed + pending bookings for this member.
    """
    if customer_id < 1:
        return jsonify({"code": 400, "message": "customer_id must be >= 1"}), 400

    try:
        rows = (
            Booking.query.filter(Booking.customerID == customer_id)
            .order_by(Booking.id.desc())
            .limit(10)
            .all()
        )
    except sa_exc.SQLAlchemyError as e:
        app.logger.exception("get_bookings_by_customer DB query failed")
        return jsonify({"code": 503, "message": "Booking database temporarily unavailable"}), 503

    bookings = []
    for b in rows:
        d = b.to_dict()
        hid = d.get("hotelID")
        bookings.append(
            {
                "id": d.get("id"),
                "flightID": d.get("flightID"),
                "hotelID": hid,
                "hotelName": lookup_hotel_name(hid),
                "departureTime": d.get("departureTime"),
                "status": d.get("status"),
                "totalPrice": d.get("totalPrice"),
                "currency": d.get("currency"),
                "travellerDisplayName": d.get("travellerDisplayName"),
                "seatNumber": d.get("seatNumber"),
                "seatNumbers": d.get("seatNumbers") or [],
            }
        )

    return jsonify({"code": 200, "data": {"customerID": customer_id, "bookings": bookings}}), 200


@app.route("/booking/policies", methods=["GET"])
def get_booking_policies():
    data = {
        "sources": ["customer", "airline", "hotel"],
        "fareTypes": ["Saver", "Standard", "Flexi"],
        "notes": "Customer cancellations use fare+tier day brackets. Airline=full refund. Hotel=hotel component refund.",
    }
    return jsonify({"code": 200, "data": data}), 200


@app.route("/booking/fx-rate", methods=["GET"])
def booking_fx_rate():
    """
    Display-currency helper: SGD → target (multiply booking amounts by `rate`).
    Query: to=USD (3-letter ISO code). Uses ExchangeRate-API v6 if EXCHANGE_RATE_API_KEY (or EXCHANGERATE_API_KEY) is set; else Frankfurter.
    """
    to = (request.args.get("to") or request.args.get("target") or "USD").strip()
    try:
        data = get_sgd_to_currency_rate(to)
        return jsonify({"code": 200, "data": data}), 200
    except ValueError as e:
        return jsonify({"code": 400, "message": str(e)}), 400
    except Exception as e:
        return jsonify({"code": 503, "message": f"FX rate unavailable: {e}"}), 503


@app.route("/booking/refund-estimate", methods=["GET"])
def booking_refund_estimate():
    booking_id = request.args.get("bookingID")
    cancel_source = (request.args.get("cancelSource") or "customer").strip().lower()
    if not booking_id:
        return _bad_request("bookingID is required")
    try:
        bid = int(booking_id)
    except ValueError:
        return _bad_request("bookingID must be an integer")
    booking = Booking.query.get(bid)
    if not booking:
        return jsonify({"code": 404, "message": "Booking not found"}), 404
    try:
        departure_time = datetime.fromisoformat(booking.departureTime)
    except Exception:
        return jsonify({"code": 500, "message": "Invalid departureTime format on booking"}), 500
    now = datetime.utcnow()
    days_before_departure = (departure_time - now).days
    policy_id, pct, amount = compute_refund_policy_id_and_amount(
        total_price=float(booking.totalPrice or 0),
        fare_type=booking.fareType or "Saver",
        loyalty_tier=booking.loyaltyTier,
        days_before_departure=days_before_departure,
        cancel_source=cancel_source,
    )
    return jsonify(
        {
            "code": 200,
            "data": {
                "bookingID": bid,
                "cancelSource": cancel_source,
                "daysBeforeDeparture": days_before_departure,
                "cancellationPolicyID": policy_id,
                "refundPercentage": pct,
                "refundAmount": amount,
                "currency": booking.currency or "SGD",
            },
        }
    ), 200


@app.route("/booking/seats/<flight_id>", methods=["GET"])
def get_reserved_seats_for_flight(flight_id: str):
    fid = str(flight_id or "").strip().upper()
    if not fid:
        return jsonify({"code": 400, "message": "flight_id is required"}), 400

    try:
        rows = (
            Booking.query.filter(func.upper(Booking.flightID) == fid)
            .filter(
                (Booking.seatNumbersJson.isnot(None))
                | (Booking.seatNumber.isnot(None))
            )
            .filter(func.upper(func.coalesce(Booking.status, "")) == "CONFIRMED")
            .all()
        )
    except sa_exc.SQLAlchemyError:
        app.logger.exception("get_reserved_seats_for_flight DB query failed")
        return (
            jsonify(
                {
                    "code": 503,
                    "message": "Booking database temporarily unavailable for seat lookup.",
                }
            ),
            503,
        )

    seats: list[str] = []
    seen: set[str] = set()
    for b in rows:
        # Prefer the full seat list for multi-traveller bookings.
        added_any = False
        if b.seatNumbersJson:
            try:
                raw = json.loads(b.seatNumbersJson)
                if isinstance(raw, list):
                    for x in raw:
                        s = str(x or "").strip().upper()
                        if s and s not in seen:
                            seen.add(s)
                            seats.append(s)
                            added_any = True
            except (ValueError, TypeError, json.JSONDecodeError):
                pass

        if not added_any and b.seatNumber:
            s = str(b.seatNumber or "").strip().upper()
            if s and s not in seen:
                seen.add(s)
                seats.append(s)

    return jsonify({"code": 200, "data": {"flightID": fid, "seats": seats}}), 200


@app.route("/travellerprofiles/byaccount/<int:customer_id>", methods=["GET"])
def traveller_profiles_byaccount(customer_id: int):
    try:
        err, rows = fetch_byaccount_rows(customer_id)
    except Exception as e:
        return (
            jsonify(
                {
                    "code": 500,
                    "message": f"Traveller profile lookup failed: {e}",
                }
            ),
            500,
        )
    if err:
        if not _traveller_profile_env_required():
            return (
                jsonify(
                    {
                        "code": 200,
                        "data": [],
                        "message": err,
                    }
                ),
                200,
            )
        return jsonify({"code": 503, "message": err}), 503
    return jsonify({"code": 200, "data": rows or []}), 200


@app.route("/traveller/<int:traveller_profile_id>", methods=["GET"])
def traveller_get(traveller_profile_id: int):
    customer_raw = request.args.get("customerID")
    if not customer_raw:
        return jsonify({"code": 400, "message": "customerID query param is required"}), 400
    try:
        customer_id = int(customer_raw)
    except (TypeError, ValueError):
        return jsonify({"code": 400, "message": "customerID must be an integer"}), 400

    err, rows = fetch_byaccount_rows(customer_id)
    if err:
        if not _traveller_profile_env_required():
            return jsonify({"code": 200, "data": {}, "message": err}), 200
        return jsonify({"code": 503, "message": err}), 503
    for row in rows or []:
        if _traveller_profile_row_id(row) == int(traveller_profile_id):
            return jsonify({"code": 200, "data": row}), 200
    return jsonify({"code": 404, "message": "Traveller profile not found"}), 404


@app.route("/traveller", methods=["POST"])
def traveller_create():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"code": 400, "message": "Body must be a JSON object"}), 400
    result = _traveller_create_profile(payload)
    return jsonify({"code": 200, "data": result}), 200


@app.route("/traveller/<int:traveller_profile_id>", methods=["PUT"])
def traveller_update(traveller_profile_id: int):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"code": 400, "message": "Body must be a JSON object"}), 400
    payload.setdefault("Id", int(traveller_profile_id))
    payload.setdefault("TravellerProfileId", int(traveller_profile_id))
    result = _traveller_update_profile(payload)
    return jsonify({"code": 200, "data": result}), 200


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

    try:
        result = _traveller_update_profile(payload)
    except Exception as e:
        return (
            jsonify({"code": 500, "message": f"Traveller profile update failed: {e}"}),
            500,
        )
    bad = _traveller_upstream_error_response(result)
    if bad:
        return bad
    return jsonify({"code": 200, "data": result}), 200


@app.route("/travellerprofiles/create", methods=["POST"])
def traveller_profile_create():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"code": 400, "message": "Body must be a JSON object"}), 400

    try:
        result = _traveller_create_profile(payload)
    except Exception as e:
        return (
            jsonify({"code": 500, "message": f"Traveller profile create failed: {e}"}),
            500,
        )
    bad = _traveller_upstream_error_response(result)
    if bad:
        return bad
    if result is None:
        return (
            jsonify(
                {
                    "code": 503,
                    "message": "CreateTravellerProfile returned no data (check OutSystems REST response).",
                }
            ),
            503,
        )
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

    try:
        result = _traveller_delete_profile(payload)
    except Exception as e:
        return (
            jsonify({"code": 500, "message": f"Traveller profile delete failed: {e}"}),
            500,
        )
    bad = _traveller_upstream_error_response(result)
    if bad:
        return bad
    return jsonify({"code": 200, "data": result}), 200


@app.route("/booking/cancel/<int:booking_id>", methods=["POST"])
def cancel_booking(booking_id: int):
    booking = Booking.query.get(booking_id)
    if not booking:
        return jsonify({"code": 404, "message": "Booking not found"}), 404

    raw_early = request.get_json(silent=True)
    req_early: dict = raw_early if isinstance(raw_early, dict) else {}

    if str(booking.status or "").upper() == "CANCELLED":
        # Idempotent: UI retries / double-clicks should not surface 409.
        pct = booking.refundPercentage
        amt = booking.refundAmount
        result = {
            "bookingID": booking_id,
            "cancelSource": (req_early.get("cancelSource") or "customer").strip().lower(),
            "refundPercentage": int(pct) if pct is not None else None,
            "refundAmount": float(amt) if amt is not None else 0.0,
            "status": "CANCELLED",
            "cancellationPolicyID": booking.cancellationPolicyID,
            "cancellationTimestamp": booking.cancellationTimestamp,
            "currency": booking.currency or "SGD",
            "alreadyCancelled": True,
        }
        return jsonify({"code": 200, "data": result}), 200

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

    policy_id, percentage, amount = compute_refund_policy_id_and_amount(
        total_price=total_price,
        fare_type=booking.fareType or "Saver",
        loyalty_tier=booking.loyaltyTier,
        days_before_departure=days_before_departure,
        cancel_source=cancel_source,
    )

    payment_base = os.environ.get("PAYMENT_URL", "http://payment:5104/payment").rstrip("/")
    payment_url = (
        payment_base
        if payment_base.endswith("/refund-payment")
        else f"{payment_base}/refund-payment"
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

    cancel_warnings: list[str] = []

    # Required sequence after successful refund:
    # 1) release flight seat by seatNo
    # 2) release hotel room by roomID
    flight_base = os.environ.get("FLIGHT_URL", "http://flight:5102/flight").strip().rstrip("/")
    if flight_base.endswith("/flight"):
        flight_base = flight_base[: -len("/flight")]
    hotel_base = os.environ.get("HOTEL_URL", "http://hotel:5103/hotel").strip().rstrip("/")
    if hotel_base.endswith("/hotel"):
        hotel_base = hotel_base[: -len("/hotel")]

    seat_numbers_for_release: list[str] = []
    if booking.seatNumbersJson:
        try:
            raw_seats = json.loads(booking.seatNumbersJson)
            if isinstance(raw_seats, list):
                seat_numbers_for_release = [
                    str(x).strip().upper()
                    for x in raw_seats
                    if x is not None and str(x).strip()
                ]
        except (ValueError, TypeError, json.JSONDecodeError):
            seat_numbers_for_release = []
    if not seat_numbers_for_release and booking.seatNumber:
        seat_numbers_for_release = [str(booking.seatNumber).strip().upper()]
    # No placeholder release calls: flight service only tracks in-memory holds from this checkout flow.
    seat_numbers_for_release = [
        s
        for s in seat_numbers_for_release
        if s and str(s).strip().upper() not in ("AUTO", "NONE", "TBD")
    ]
    room_id = f"{int(booking.hotelID)}:{(booking.hotelRoomType or 'STD').strip().upper()}"

    try:
        for seat_no in seat_numbers_for_release:
            flight_release_resp = requests.put(
                f"{flight_base}/flight/inventory/{seat_no}/release",
                json={"bookingID": booking_id, "flightNum": booking.flightID},
                timeout=8,
            )
            if flight_release_resp.ok:
                continue
            # Seed / DB-only bookings often have no row in Flight's in-memory map — treat as idempotent.
            if flight_release_resp.status_code == 404:
                cancel_warnings.append(
                    f"Flight seat release: no in-service hold for {seat_no} (booking {booking_id}) — skipped."
                )
                continue
            return jsonify(
                {
                    "code": 502,
                    "message": "Flight inventory release failed",
                    "upstreamStatus": flight_release_resp.status_code,
                    "upstreamBody": (flight_release_resp.text or "")[:500],
                }
            ), 502
    except requests.RequestException as e:
        return jsonify({"code": 503, "message": f"Flight release unreachable: {e}"}), 503

    try:
        hotel_release_resp = requests.put(
            f"{hotel_base}/hotel/inventory/{room_id}/release",
            json={"bookingID": booking_id, "hotelID": booking.hotelID},
            timeout=8,
        )
    except requests.RequestException as e:
        return jsonify({"code": 503, "message": f"Hotel release unreachable: {e}"}), 503
    if not hotel_release_resp.ok:
        if hotel_release_resp.status_code == 404:
            cancel_warnings.append(
                f"Hotel room release: no in-service hold for {room_id} (booking {booking_id}) — skipped."
            )
        else:
            return jsonify(
                {
                    "code": 502,
                    "message": "Hotel inventory release failed",
                    "upstreamStatus": hotel_release_resp.status_code,
                    "upstreamBody": (hotel_release_resp.text or "")[:500],
                }
            ), 502

    booking.status = "CANCELLED"
    booking.refundPercentage = percentage
    booking.refundAmount = amount
    booking.cancellationPolicyID = policy_id
    booking.cancellationTimestamp = now.isoformat()
    try:
        db.session.commit()
    except sa_exc.SQLAlchemyError as e:
        db.session.rollback()
        print(f"[booking] DB error after refund for booking {booking_id}: {e}")
        return jsonify(
            {
                "code": 500,
                "message": "Refund was sent to Payment but booking update failed after release steps",
                "payment": payment_data,
            }
        ), 500

    try:
        for seat_no in seat_numbers_for_release:
            if not seat_no:
                continue
            requests.put(
                f"{flight_base}/availability/{seat_no}/RELEASED",
                json={"flightNum": booking.flightID, "bookingID": booking_id},
                timeout=5,
            )
        requests.put(
            f"{hotel_base}/availability/{int(booking.hotelID)}/RELEASED",
            json={
                "roomType": booking.hotelRoomType or "STD",
                "bookingID": booking_id,
            },
            timeout=5,
        )
    except requests.RequestException as e:
        cancel_warnings.append(f"PUT availability after cancel: {e}")

    if booking.customerID:
        loyalty_url = os.environ.get("LOYALTY_URL", "http://localhost:5105/loyalty")
        try:
            refund_payload = {
                "bookingID": booking_id,
                "bookingAmount": float(booking.totalPrice),
                "bookingTier": booking.loyaltyTier,
                "pointsToRestore": int(COINS_SPENT_BY_BOOKING.get(booking_id, 0) or 0),
                "reason": "Booking cancellation reversal",
            }
            adj_resp = requests.post(
                f"{loyalty_url}/{booking.customerID}/refund", json=refund_payload, timeout=5
            )
            if not adj_resp.ok:
                cancel_warnings.append(
                    f"Loyalty service returned HTTP {adj_resp.status_code} for /refund"
                )
            else:
                try:
                    adj_resp.json()
                except ValueError:
                    cancel_warnings.append(
                        "Loyalty service returned non-JSON for /refund"
                    )
            COINS_SPENT_BY_BOOKING.pop(booking_id, None)
        except requests.RequestException as e:
            cancel_warnings.append(f"Loyalty adjust unreachable: {e}")

    # Publish cancellation event for async processing (e.g. notification)
    t_ids_event = traveller_profile_ids_for_event(booking)

    cancel_amqp_payload = {
        "bookingID": booking_id,
        "customerID": booking.customerID,
        "travellerProfileId": booking.travellerProfileId,
        "travellerProfileIds": t_ids_event,
        "travellerDisplayName": booking.travellerDisplayName,
        "adultCount": int(booking.adultCount or 0),
        "childCount": int(booking.childCount or 0),
        "infantCount": int(booking.infantCount or 0),
        "passengerName": booking.passengerName,
        "passengerEmail": booking.passengerEmail,
        "passengerPhone": booking.passengerPhone,
        "refundPercentage": percentage,
        "refundAmount": round(amount, 2),
        "cancelSource": cancel_source,
        "flightID": booking.flightID,
        "hotelID": booking.hotelID,
        "departureTime": booking.departureTime,
        "totalPrice": float(booking.totalPrice or 0),
        "currency": booking.currency or "SGD",
        "fareType": booking.fareType,
        "loyaltyTier": booking.loyaltyTier,
        "seatNumber": booking.seatNumber,
        "seatNumbers": booking.to_dict().get("seatNumbers", []),
        "status": "CANCELLED",
        "cancelledAt": now.isoformat(),
        "cancellationPolicyID": policy_id,
    }
    # Dedicated routing key so notification/Twilio never confuses cancel with confirm (both used notify.user before).
    published = publish_event("booking.cancelled", cancel_amqp_payload)
    if not published:
        cancel_warnings.append(
            "Could not publish booking.cancelled to RabbitMQ — check booking logs "
            "and that the rabbitmq service is reachable (notification/Twilio will not run)."
        )
        manual_cancel = _post_notify_manual(
            {
                "source": "cancellation_sync",
                "bookingID": booking_id,
                "customerID": booking.customerID,
                "email": booking.passengerEmail,
                "userEmail": booking.passengerEmail,
                "passengerPhone": booking.passengerPhone,
                "passengerName": booking.passengerName,
                "travellerDisplayName": booking.travellerDisplayName,
                "refundAmount": round(amount, 2),
                "refundPercentage": percentage,
                "cancelSource": cancel_source,
                "cancellationPolicyID": policy_id,
                "flightID": booking.flightID,
                "departureTime": booking.departureTime,
                "currency": booking.currency or "SGD",
                "refundAmt": round(amount, 2),
                "status": "CANCELLED",
                "cancelledAt": now.isoformat(),
                "note": "Fallback: RabbitMQ unreachable; synchronous cancel notice + SMS.",
            }
        )
        if manual_cancel:
            cancel_warnings.append(manual_cancel)

    result = {
        "bookingID": booking_id,
        "cancelSource": cancel_source,
        "refundPercentage": percentage,
        "refundAmount": amount,
        "status": "CANCELLED",
        "cancellationPolicyID": policy_id,
        "currency": booking.currency or "SGD",
        "payment": payment_data,
    }
    out = {"code": 200, "data": result}
    if cancel_warnings:
        out["warnings"] = cancel_warnings
    return jsonify(out), 200


@app.route("/cancel-booking", methods=["POST"])
def cancel_booking_diagram():
    """SkyBundle diagram path: POST /cancel-booking { bookingID, userID?, ... }."""
    raw_body = request.get_json(silent=True)
    if not isinstance(raw_body, dict):
        return _bad_request("Request body must be a JSON object")
    bid = raw_body.get("bookingID")
    if bid is None:
        return _bad_request("bookingID is required")
    try:
        bid_int = int(bid)
    except (TypeError, ValueError):
        return _bad_request("bookingID must be an integer")
    uid = raw_body.get("userID")
    booking = Booking.query.get(bid_int)
    if not booking:
        return jsonify({"code": 404, "message": "Booking not found"}), 404
    if uid is not None and booking.customerID is not None:
        try:
            if int(uid) != int(booking.customerID):
                return jsonify(
                    {"code": 403, "message": "userID does not match booking customerID"},
                    403,
                )
        except (TypeError, ValueError):
            return _bad_request("userID must be an integer when provided")
    return cancel_booking(bid_int)


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
        if "seatNumbersJson" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN seatNumbersJson TEXT NULL"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN seatNumbersJson TEXT"
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
        if "noOfRooms" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN noOfRooms INT DEFAULT 1"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN noOfRooms INTEGER DEFAULT 1"
            )
        if "cancellationPolicyID" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN cancellationPolicyID VARCHAR(40) NULL"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN cancellationPolicyID VARCHAR(40)"
            )
        if "cancellationTimestamp" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN cancellationTimestamp VARCHAR(40) NULL"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN cancellationTimestamp VARCHAR(40)"
            )
        if "adultCount" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN adultCount INT NOT NULL DEFAULT 1"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN adultCount INTEGER DEFAULT 1"
            )
        if "childCount" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN childCount INT NOT NULL DEFAULT 0"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN childCount INTEGER DEFAULT 0"
            )
        if "infantCount" not in cols:
            alters.append(
                "ALTER TABLE bookings ADD COLUMN infantCount INT NOT NULL DEFAULT 0"
                if db.engine.dialect.name != "sqlite"
                else "ALTER TABLE bookings ADD COLUMN infantCount INTEGER DEFAULT 0"
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

