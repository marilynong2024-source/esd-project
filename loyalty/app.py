from datetime import datetime
import os

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

"""
Loyalty service (atomic MS).

Wallet state is keyed by numeric customerID (same id as the account service), not by email.
POST /loyalty/<id>/init-new-account is invoked when a brand-new account is created so that
customer id does not accidentally reuse a demo row from this module's LOYALTY seed.

Tiering rules (by completed booking count):
- Bronze: < 2 bookings
- Silver: 2-4 bookings
- Gold: 5-9 bookings
- Platinum: >= 10 bookings

Coins (loyalty balance):
- Float "coins" (UI: points). Not a cash wallet: redemption stays 100 coins = 1 currency unit
  off the package total at checkout (see bundle/checkout — same as before).
- Earn: LOYALTY_COINS_PER_CURRENCY_UNIT points per 1 unit of booking totalPrice currency
  (default 0.001). Tier labels still update from completed booking count; earn rate does not
  vary by tier.
Example: total 1,700 in booking currency at 0.001 → 1.7 points earned; 100 points still → 1.00
off next trip. Demo seeds are illustrative floats.
"""

# Points earned per 1.0 unit of booking amount (same currency as totalPrice).
COINS_PER_CURRENCY_UNIT = float(os.environ.get("LOYALTY_COINS_PER_CURRENCY_UNIT", "0.001") or "0.001")

LOYALTY = {
    1: {"coins": 11.2, "bookingCount": 3, "tier": "Silver"},
    2: {"coins": 8.6, "bookingCount": 2, "tier": "Silver"},
    3: {"coins": 18.4, "bookingCount": 6, "tier": "Gold"},
    4: {"coins": 5.2, "bookingCount": 2, "tier": "Silver"},
    5: {"coins": 0.0, "bookingCount": 0, "tier": "Bronze"},
    6: {"coins": 98.2, "bookingCount": 13, "tier": "Platinum"},
    7: {"coins": 4.2, "bookingCount": 1, "tier": "Bronze"},
    8: {"coins": 0.0, "bookingCount": 0, "tier": "Bronze"},
    9: {"coins": 94.5, "bookingCount": 12, "tier": "Platinum"},
    10: {"coins": 26.8, "bookingCount": 8, "tier": "Gold"},
    11: {"coins": 13.1, "bookingCount": 3, "tier": "Silver"},
    12: {"coins": 5.9, "bookingCount": 2, "tier": "Silver"},
}

LOYALTY_TRANSACTIONS: list[dict] = []
_TXN_SEQ = 1

TIERS_BY_BOOKING_COUNT = [
    (10, "Platinum"),
    (5, "Gold"),
    (2, "Silver"),
    (0, "Bronze"),
]

def compute_tier_from_booking_count(booking_count: int) -> str:
    booking_count = int(booking_count or 0)
    for threshold, tier in TIERS_BY_BOOKING_COUNT:
        if booking_count >= threshold:
            return tier
    return "Bronze"


def get_record(customer_id: int) -> dict:
    return LOYALTY.get(
        customer_id,
        {
            "coins": 0.0,
            "bookingCount": 0,
            "tier": "Bronze",
        },
    )


def _now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def _append_transaction(
    customer_id: int,
    booking_id: int | None,
    points_changed: float,
    reason: str,
) -> dict:
    global _TXN_SEQ
    row = {
        "ID": _TXN_SEQ,
        "CustomerID": int(customer_id),
        "BookingID": int(booking_id) if booking_id is not None else None,
        "PointsChanged": float(points_changed),
        "TransactionDate": _now_iso(),
        "Reason": str(reason or "")[:255],
    }
    _TXN_SEQ += 1
    LOYALTY_TRANSACTIONS.append(row)
    return row


def normalize_coins(value: object) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        v = 0.0
    return round(max(0.0, v), 6)


def coins_earned_for_booking_amount(amount: float) -> float:
    return round(max(0.0, float(amount or 0.0)) * COINS_PER_CURRENCY_UNIT, 6)


@app.route("/loyalty/<int:customer_id>/points", methods=["GET"])
def get_points(customer_id: int):
    """
    Backward-compatible route name.

    Returns:
    - coins: float balance; checkout discount is still 100 coins = 1 unit off package total
    - bookingCount (completed bookings)
    - tier

    Also returns `points` as an alias of `coins` for older UI code.
    """
    record = get_record(customer_id)
    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "customerID": customer_id,
                    "coins": normalize_coins(record.get("coins")),
                    "bookingCount": record.get("bookingCount", 0),
                    "tier": record["tier"],
                    "coinsPerCurrencyUnit": COINS_PER_CURRENCY_UNIT,
                    # legacy alias
                    "points": normalize_coins(record.get("coins")),
                },
            }
        ),
        200,
    )


@app.route("/loyalty/<int:customer_id>/init-new-account", methods=["POST"])
def init_new_account_wallet(customer_id: int):
    """
    Called by the account service when a customer is created via signup (or POST /account).
    Forces Bronze / empty wallet for that numeric id so new members never inherit demo
    loyalty rows that were keyed to the same id.
    """
    if customer_id < 1:
        return jsonify({"code": 400, "message": "customer_id must be >= 1"}), 400
    LOYALTY[customer_id] = {
        "coins": 0.0,
        "bookingCount": 0,
        "tier": "Bronze",
    }
    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "customerID": customer_id,
                    "coins": 0.0,
                    "bookingCount": 0,
                    "tier": "Bronze",
                },
            }
        ),
        200,
    )


@app.route("/loyalty/<int:customer_id>/earn", methods=["POST"])
def earn_points(customer_id: int):
    """
    Body: { customerID, amount, coinsToSpendCents? }

    - Default behaviour (post-payment):
      - Deduct coinsToSpendCents
      - Increment bookingCount by 1
      - Determine tier AFTER completing the booking
      - Earn coins = amount * coinsRate(tierAfterBooking)

    - Pre-payment coin-deduct stage (diagram compliance):
      - Send: { stage: "deduct" }
      - Only deduct coinsToSpendCents
      - Do NOT change bookingCount or tier
    """
    data = request.get_json(silent=True) or {}
    amount = data.get("amount", 0)
    booking_id = data.get("bookingID")
    reason = data.get("reason") or "Earn from completed booking"
    record = get_record(customer_id)
    current_count = int(record.get("bookingCount", 0) or 0)
    current_coins = normalize_coins(record.get("coins"))
    next_count = current_count + 1
    tier_after_booking = compute_tier_from_booking_count(next_count)
    coins_earned = coins_earned_for_booking_amount(float(amount or 0))
    record["coins"] = normalize_coins(current_coins + coins_earned)
    record["bookingCount"] = next_count
    record["tier"] = tier_after_booking

    LOYALTY[customer_id] = record
    tx = _append_transaction(
        customer_id=customer_id,
        booking_id=booking_id,
        points_changed=coins_earned,
        reason=str(reason),
    )
    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "customerID": customer_id,
                    "coins": record["coins"],
                    "bookingCount": record["bookingCount"],
                    "tier": record["tier"],
                    "coinsEarned": coins_earned,
                    "coinsSpent": 0,
                    "transaction": tx,
                },
            }
        ),
        200,
    )


@app.route("/loyalty/<int:customer_id>/redeem", methods=["POST"])
def redeem_points(customer_id: int):
    data = request.get_json(silent=True) or {}
    booking_id = data.get("bookingID")
    reason = data.get("reason") or "Redeem for pre-payment discount"
    points_to_redeem = int(max(0, int(data.get("points", 0) or 0)))

    record = get_record(customer_id)
    current_coins = int(record.get("coins", 0) or 0)
    redeemed = min(current_coins, points_to_redeem)
    record["coins"] = current_coins - redeemed
    LOYALTY[customer_id] = record

    tx = _append_transaction(
        customer_id=customer_id,
        booking_id=booking_id,
        points_changed=-int(redeemed),
        reason=str(reason),
    )
    return jsonify(
        {
            "code": 200,
            "data": {
                "customerID": customer_id,
                "pointsRedeemed": redeemed,
                "coins": record["coins"],
                "bookingCount": record["bookingCount"],
                "tier": record["tier"],
                "transaction": tx,
            },
        }
    ), 200


@app.route("/loyalty/<int:customer_id>/refund", methods=["POST"])
def refund_points(customer_id: int):
    """
    Adjust loyalty after cancellation.

    Body: { customerID, bookingAmount, bookingTier, coinsSpentCents? }

    - Decrement bookingCount by 1 (down to minimum 0)
    - Deduct coins earned for the cancelled booking based on bookingTier
    """
    data = request.get_json(silent=True) or {}
    booking_id = data.get("bookingID")
    booking_amount = data.get("bookingAmount", 0)
    booking_tier = data.get("bookingTier")
    try:
        points_to_restore = max(0.0, float(data.get("pointsToRestore", 0) or 0))
    except (TypeError, ValueError):
        points_to_restore = 0.0
    points_to_restore = round(points_to_restore, 6)
    reason = data.get("reason") or "Refund reversal after booking cancellation"
    record = get_record(customer_id)
    _ = booking_tier  # reserved if tiered earn returns later
    coins_to_remove = coins_earned_for_booking_amount(float(booking_amount or 0))

    current_count = int(record.get("bookingCount", 0) or 0)
    next_count = max(0, current_count - 1)

    # Full cancellation reverses points spent and removes points earned.
    current_coins = normalize_coins(record.get("coins"))
    net_change = round(points_to_restore - coins_to_remove, 6)
    record["coins"] = normalize_coins(current_coins + net_change)
    record["bookingCount"] = next_count
    record["tier"] = compute_tier_from_booking_count(next_count)

    LOYALTY[customer_id] = record
    tx = _append_transaction(
        customer_id=customer_id,
        booking_id=booking_id,
        points_changed=net_change,
        reason=str(reason),
    )
    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "customerID": customer_id,
                    "coins": record["coins"],
                    "bookingCount": record["bookingCount"],
                    "tier": record["tier"],
                    "coinsRemoved": coins_to_remove,
                    "pointsRestored": points_to_restore,
                    "transaction": tx,
                },
            }
        ),
        200,
    )


@app.route("/loyalty/<int:customer_id>/transactions", methods=["GET"])
def get_transactions(customer_id: int):
    rows = [t for t in LOYALTY_TRANSACTIONS if int(t["CustomerID"]) == int(customer_id)]
    return jsonify({"code": 200, "data": rows}), 200


# Backward-compatible aliases used by existing orchestration code.
@app.route("/loyalty/earn", methods=["POST"])
def earn_points_legacy():
    data = request.get_json(silent=True) or {}
    customer_id = data.get("customerID")
    if customer_id is None:
        return jsonify({"code": 400, "message": "customerID is required"}), 400
    return earn_points(int(customer_id))


@app.route("/loyalty/adjust", methods=["POST"])
def adjust_points_legacy():
    data = request.get_json(silent=True) or {}
    customer_id = data.get("customerID")
    if customer_id is None:
        return jsonify({"code": 400, "message": "customerID is required"}), 400
    booking_id = data.get("bookingID")
    booking_amount = data.get("bookingAmount", 0)
    booking_tier = data.get("bookingTier")
    try:
        points_to_restore = max(0.0, float(data.get("coinsSpentCents", 0) or 0))
    except (TypeError, ValueError):
        points_to_restore = 0.0
    points_to_restore = round(points_to_restore, 6)
    reason = data.get("reason") or "Refund reversal after booking cancellation"

    record = get_record(int(customer_id))
    _ = booking_tier
    coins_to_remove = coins_earned_for_booking_amount(float(booking_amount or 0))
    current_count = int(record.get("bookingCount", 0) or 0)
    next_count = max(0, current_count - 1)
    current_coins = normalize_coins(record.get("coins"))
    net_change = round(points_to_restore - coins_to_remove, 6)
    record["coins"] = normalize_coins(current_coins + net_change)
    record["bookingCount"] = next_count
    record["tier"] = compute_tier_from_booking_count(next_count)
    LOYALTY[int(customer_id)] = record
    tx = _append_transaction(
        customer_id=int(customer_id),
        booking_id=booking_id,
        points_changed=net_change,
        reason=str(reason),
    )
    return jsonify(
        {
            "code": 200,
            "data": {
                "customerID": int(customer_id),
                "coins": record["coins"],
                "bookingCount": record["bookingCount"],
                "tier": record["tier"],
                "coinsRemoved": coins_to_remove,
                "pointsRestored": points_to_restore,
                "transaction": tx,
            },
        }
    ), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5105, debug=True)

