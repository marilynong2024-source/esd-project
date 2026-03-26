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


@app.route("/loyalty/earn", methods=["POST"])
def earn_points():
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
    data = request.get_json() or {}
    customer_id = data.get("customerID")
    amount = data.get("amount", 0)
    coins_to_spend_cents = int(max(0, int(data.get("coinsToSpendCents", 0) or 0)))
    stage = str(data.get("stage") or "").strip().lower()
    if customer_id is None:
        return jsonify({"code": 400, "message": "customerID is required"}), 400

    record = get_record(customer_id)
    current_count = int(record.get("bookingCount", 0) or 0)

    # Spend coins at payment time (before earning new coins).
    current_coins = int(record.get("coins", 0) or 0)
    coins_spent = min(current_coins, coins_to_spend_cents)

    if stage == "deduct":
        # Pre-payment stage: only deduct coins; do not update tier/bookingCount.
        record["coins"] = current_coins - coins_spent
        coins_earned = 0
    else:
        # Post-payment stage: increment bookingCount and earn coins based on tier.
        next_count = current_count + 1
        tier_after_booking = compute_tier_from_booking_count(next_count)
        coins_rate = coins_rate_for_tier(tier_after_booking)
        coins_earned = to_int_cents(float(amount) * coins_rate)
        record["coins"] = (current_coins - coins_spent) + coins_earned
        record["bookingCount"] = next_count
        record["tier"] = tier_after_booking

    LOYALTY[customer_id] = record
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
                    "coinsSpent": coins_spent,
                },
            }
        ),
        200,
    )


# Diagram-aligned alias: the slides refer to POST /loyalty for loyalty updates.
@app.route("/loyalty", methods=["POST"])
def loyalty_post_alias():
    return earn_points()


@app.route("/loyalty/adjust", methods=["POST"])
def adjust_points():
    """
    Adjust loyalty after cancellation.

    Body: { customerID, bookingAmount, bookingTier, coinsSpentCents? }

    - Decrement bookingCount by 1 (down to minimum 0)
    - Deduct coins earned for the cancelled booking based on bookingTier
    """
    data = request.get_json() or {}
    customer_id = data.get("customerID")
    booking_amount = data.get("bookingAmount", 0)
    booking_tier = data.get("bookingTier")
    coins_spent_cents = int(max(0, int(data.get("coinsSpentCents", 0) or 0)))
    if customer_id is None:
        return jsonify({"code": 400, "message": "customerID is required"}), 400

    record = get_record(customer_id)
    coins_rate = coins_rate_for_tier(booking_tier)
    coins_to_remove = to_int_cents(float(booking_amount) * coins_rate)

    current_count = int(record.get("bookingCount", 0) or 0)
    next_count = max(0, current_count - 1)

    # Full cancellation reverses both:
    # - coins earned for that booking
    # - coins spent at payment time
    current_coins = int(record.get("coins", 0) or 0)
    record["coins"] = max(0, current_coins + coins_spent_cents - coins_to_remove)
    record["bookingCount"] = next_count
    record["tier"] = compute_tier_from_booking_count(next_count)

    LOYALTY[customer_id] = record
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
                },
            }
        ),
        200,
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5105, debug=True)

