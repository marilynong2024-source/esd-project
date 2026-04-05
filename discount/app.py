from __future__ import annotations

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

LOYALTY_BASE = "http://loyalty:5105/loyalty"
HTTP_TIMEOUT_SECONDS = 6


def _get_json(url: str, params: dict | None = None) -> dict | None:
    try:
        resp = requests.get(url, params=params, timeout=HTTP_TIMEOUT_SECONDS)
        if not resp.ok:
            return None
        return resp.json() if resp.content else {}
    except Exception:
        return None


def _parse_int(x, default: int = 0) -> int:
    try:
        return int(x)
    except Exception:
        return int(default)


# Hardcoded discount rules for the demo.
# "More restrictive" interpretation:
# - discounts apply only if the bundle constraints are met (travellers >= 2, nights >= 3, and DLX roomType)
# - tier match: customer tier is used as an eligibility floor (Gold can get Gold/low-tier discounts).
#   We still pick the MAX discount percent to keep the outcome deterministic.
def _tier_rank(t: str) -> int:
    t = (t or "").strip().title()
    order = {"Bronze": 0, "Silver": 1, "Gold": 2, "Platinum": 3}
    return order.get(t, -1)


def _promo_fields(
    promo_in: str,
    *,
    eligible_bundle: bool,
    tier: str | None,
    customer_rank: int,
) -> dict:
    """Optional voucher code from UI — echo validation without changing discount math."""
    promo = (promo_in or "").strip().upper()
    if not promo:
        return {}
    if not eligible_bundle or not tier:
        return {
            "promoRejected": True,
            "promoMessage": "Promo codes need 2+ travellers, 3+ nights, Deluxe room, and a signed-in member.",
        }
    rule = next(
        (
            r
            for r in DISCOUNT_RULES
            if str(r.get("discountCode", "")).strip().upper() == promo
        ),
        None,
    )
    if not rule:
        return {
            "promoRejected": True,
            "promoMessage": "That voucher code is not recognized.",
        }
    req = _tier_rank(str(rule.get("requiredTier", "")))
    if customer_rank < req:
        return {
            "promoRejected": True,
            "promoMessage": f"This code needs {rule['requiredTier']} tier or higher.",
        }
    return {
        "promoAccepted": True,
        "promoCode": promo,
        "promoMessage": f"{promo} accepted — tier discount applies to this quote.",
    }


DISCOUNT_RULES = [
    {
        "discountID": 1,
        "discountCode": "SILVER10",
        "requiredTier": "Silver",
        "discountPercent": 10.0,
        # Diagram DB columns shown; wildcard behavior in this demo.
        "flightID": "*",
        "hotelId": "*",
        "active": True,
    },
    {
        "discountID": 2,
        "discountCode": "GOLD15",
        "requiredTier": "Gold",
        "discountPercent": 15.0,
        "flightID": "*",
        "hotelId": "*",
        "active": True,
    },
    {
        "discountID": 3,
        "discountCode": "PLAT20",
        "requiredTier": "Platinum",
        "discountPercent": 20.0,
        "flightID": "*",
        "hotelId": "*",
        "active": True,
    },
]


@app.get("/discount-rule")
@app.get("/discounts/bundle-rule")
def discount_rule():
    # Diagram input (derived from bundle pricing composite):
    # customerId, flightNum, hotelId, roomType, numberOfTravellers, nights
    customer_id = request.args.get("customerId") or request.args.get("customerID")
    flight_num = request.args.get("flightNum")
    hotel_id = request.args.get("hotelId") or request.args.get("hotelID")
    room_type = (request.args.get("roomType") or "").strip().upper()
    travellers = _parse_int(request.args.get("numberOfTravellers"), 1)
    nights = _parse_int(request.args.get("nights"), 1)
    promo_in = (request.args.get("promoCode") or request.args.get("discountCode") or "").strip()

    cid = _parse_int(customer_id, 0)
    tier = None
    if cid > 0:
        loyalty_out = _get_json(f"{LOYALTY_BASE}/{cid}/points")
        tier = (loyalty_out or {}).get("data", {}).get("tier")

    # SkyBundle spec: if no specific bundle rule applies, default 10% bundle discount.
    default_percent = 10.0

    # Optional stricter tier-based rules (labs-style) apply on top of the baseline.
    eligible_bundle = travellers >= 2 and nights >= 3 and room_type == "DLX"
    tier_norm = str(tier).strip().title() if tier else ""
    customer_rank = _tier_rank(tier_norm)
    promo_extra = _promo_fields(
        promo_in,
        eligible_bundle=eligible_bundle,
        tier=tier,
        customer_rank=customer_rank,
    )

    if not eligible_bundle or not tier:
        data = {
            "discountPercent": default_percent,
            "discountID": 0,
            "discountCode": "BUNDLE10_DEFAULT",
            "flightNum": flight_num,
            "hotelID": hotel_id,
            "note": "Default bundle discount (no tier-specific rule)",
        }
        data.update(promo_extra)
        return jsonify({"code": 200, "data": data}), 200

    matching = [
        r
        for r in DISCOUNT_RULES
        if r["active"]
        and _tier_rank(r["requiredTier"]) >= 0
        and customer_rank >= _tier_rank(r["requiredTier"])
    ]
    if not matching:
        data = {
            "discountPercent": default_percent,
            "discountID": 0,
            "discountCode": "BUNDLE10_DEFAULT",
            "flightNum": flight_num,
            "hotelID": hotel_id,
            "note": "No tier rule matched; default bundle discount",
        }
        data.update(promo_extra)
        return jsonify({"code": 200, "data": data}), 200

    # Pick the highest eligible discount (never below the 10% default).
    r = sorted(matching, key=lambda x: float(x.get("discountPercent") or 0), reverse=True)[0]
    pct = max(float(r["discountPercent"]), default_percent)
    data = {
        "discountID": r["discountID"],
        "discountCode": r["discountCode"],
        "requiredTier": r["requiredTier"],
        "discountPercent": pct,
        "flightID": r["flightID"],
        "hotelId": r["hotelId"],
        "flightNum": flight_num,
        "hotelID": hotel_id,
    }
    data.update(promo_extra)
    return jsonify({"code": 200, "data": data}), 200


@app.get("/")
def health():
    return jsonify({"code": 200, "message": "Discount service running"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5112, debug=True)

