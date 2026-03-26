from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

"""
Loyalty service (atomic MS).

Tiering rules (by completed booking count):
- Bronze: < 2 bookings
- Silver: 2-4 bookings
- Gold: 5-9 bookings
- Platinum: >= 10 bookings

Coins:
- Coins are spendable cents earned from booking amount.
- Coins earn rate depends on the tier AFTER completing the booking.
  - Bronze: 1 cent per $1
  - Silver: 2 cents per $1
  - Gold: 3 cents per $1
  - Platinum: 5 cents per $1
"""

LOYALTY = {
    1: {"coins": 11200, "bookingCount": 3, "tier": "Silver"},
    2: {"coins": 8600, "bookingCount": 2, "tier": "Silver"},
    3: {"coins": 18400, "bookingCount": 6, "tier": "Gold"},
    4: {"coins": 5200, "bookingCount": 2, "tier": "Silver"},
    5: {"coins": 800, "bookingCount": 0, "tier": "Bronze"},
    6: {"coins": 98200, "bookingCount": 13, "tier": "Platinum"},
}

LOYALTY_TRANSACTIONS: list[dict] = []
_TXN_SEQ = 1

TIERS_BY_BOOKING_COUNT = [
    (10, "Platinum"),
    (5, "Gold"),
    (2, "Silver"),
    (0, "Bronze"),
]

COINS_RATE_BY_TIER_CENTS_PER_DOLLAR = {
    "Bronze": 1,
    "Silver": 2,
    "Gold": 3,
    "Platinum": 5,
}


def compute_tier_from_booking_count(booking_count: int) -> str:
    booking_count = int(booking_count or 0)
    for threshold, tier in TIERS_BY_BOOKING_COUNT:
        if booking_count >= threshold:
            return tier
    return "Bronze"


def coins_rate_for_tier(tier: str | None) -> int:
    tier_norm = (tier or "").strip().title()
    return COINS_RATE_BY_TIER_CENTS_PER_DOLLAR.get(tier_norm, COINS_RATE_BY_TIER_CENTS_PER_DOLLAR["Bronze"])


def get_record(customer_id: int) -> dict:
    return LOYALTY.get(
        customer_id,
        {
            "coins": 0,
            "bookingCount": 0,
            "tier": "Bronze",
        },
    )


def _now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def _append_transaction(
    customer_id: int,
    booking_id: int | None,
    points_changed: int,
    reason: str,
) -> dict:
    global _TXN_SEQ
    row = {
        "ID": _TXN_SEQ,
        "CustomerID": int(customer_id),
        "BookingID": int(booking_id) if booking_id is not None else None,
        "PointsChanged": int(points_changed),
        "TransactionDate": _now_iso(),
        "Reason": str(reason or "")[:255],
    }
    _TXN_SEQ += 1
    LOYALTY_TRANSACTIONS.append(row)
    return row


def to_int_cents(amount: float) -> int:
    # Coins are stored in cents (int).
    return int(max(0, round(float(amount or 0))))


@app.route("/loyalty/<int:customer_id>/points", methods=["GET"])
def get_points(customer_id: int):
    """
    Backward-compatible route name.

    Returns:
    - coins (cents) as the main loyalty currency
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
                    "coins": record.get("coins", 0),
                    "bookingCount": record.get("bookingCount", 0),
                    "tier": record["tier"],
                    # legacy alias
                    "points": record.get("coins", 0),
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
    current_coins = int(record.get("coins", 0) or 0)
    next_count = current_count + 1
    tier_after_booking = compute_tier_from_booking_count(next_count)
    coins_rate = coins_rate_for_tier(tier_after_booking)
    coins_earned = to_int_cents(float(amount) * coins_rate)
    record["coins"] = current_coins + coins_earned
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
    points_to_restore = int(max(0, int(data.get("pointsToRestore", 0) or 0)))
    reason = data.get("reason") or "Refund reversal after booking cancellation"
    record = get_record(customer_id)
    coins_rate = coins_rate_for_tier(booking_tier)
    coins_to_remove = to_int_cents(float(booking_amount) * coins_rate)

    current_count = int(record.get("bookingCount", 0) or 0)
    next_count = max(0, current_count - 1)

    # Full cancellation reverses points spent and removes points earned.
    current_coins = int(record.get("coins", 0) or 0)
    net_change = points_to_restore - coins_to_remove
    record["coins"] = max(0, current_coins + net_change)
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
    points_to_restore = int(max(0, int(data.get("coinsSpentCents", 0) or 0)))
    reason = data.get("reason") or "Refund reversal after booking cancellation"

    record = get_record(int(customer_id))
    coins_rate = coins_rate_for_tier(booking_tier)
    coins_to_remove = to_int_cents(float(booking_amount) * coins_rate)
    current_count = int(record.get("bookingCount", 0) or 0)
    next_count = max(0, current_count - 1)
    current_coins = int(record.get("coins", 0) or 0)
    net_change = points_to_restore - coins_to_remove
    record["coins"] = max(0, current_coins + net_change)
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

