from __future__ import annotations

import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Internal service URLs (Docker network DNS)
# Note: flight/hotel bundle helpers are exposed at the service root as:
# - flight: /availability, /price
# - hotel: /availability, /price
ACCOUNT_BASE = os.environ.get("ACCOUNT_SERVICE_URL", "http://account:5100").rstrip("/")
FLIGHT_BASE = "http://flight:5102"
HOTEL_BASE = "http://hotel:5103"
LOYALTY_BASE = "http://loyalty:5105/loyalty"
DISCOUNT_BASE = "http://discount:5112"

HTTP_TIMEOUT_SECONDS = 8


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    # Accept both "YYYY-MM-DD" and full "YYYY-MM-DDTHH:MM[:SS]"
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        pass
    try:
        return datetime.strptime(s, "%Y-%m-%d")
    except ValueError:
        return None


def _parse_int(value: str | None, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return int(default)


def _safe_int(value: object, default: int = 0) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _safe_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _http_get_json(url: str, params: dict | None = None) -> tuple[dict | None, str | None]:
    """
    GET and parse JSON regardless of HTTP status (so 404 bodies with {code,message} work).
    Returns (body_dict, transport_error). transport_error is set only for network/parse failures.
    """
    try:
        resp = requests.get(url, params=params, timeout=HTTP_TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        return None, f"upstream unreachable: {exc}"
    text = (resp.text or "").strip()
    if not text:
        return None, f"empty response (HTTP {resp.status_code})"
    try:
        body = resp.json()
    except ValueError:
        return None, f"invalid JSON (HTTP {resp.status_code})"
    if not isinstance(body, dict):
        return None, "upstream returned non-object JSON"
    return body, None


def _required_param(name: str, raw: str | None) -> tuple[bool, str]:
    if raw is None:
        return False, f"Missing required query parameter: {name}"
    if str(raw).strip() == "":
        return False, f"Missing required query parameter: {name}"
    return True, ""


def _stable_hash_u32(s: str) -> int:
    """Deterministic hash for package cards (not Python's salted hash())."""
    acc = 5381
    for ch in s:
        acc = ((acc << 5) + acc) + ord(ch)
        acc &= 0xFFFFFFFF
    return int(acc)


def _flight_ranked_options(
    origin: str,
    destination: str,
    depart_date: str,
    travellers: int,
) -> list[tuple[float, str]]:
    """Sorted cheapest-first (economy, flightNum) with enough seats."""
    body, terr = _http_get_json(
        f"{FLIGHT_BASE}/flight/search",
        params={
            "originCity": origin.strip(),
            "destinationCity": destination.strip(),
            "departDate": depart_date,
            "minSeats": str(travellers),
        },
    )
    if terr or not body or body.get("code") != 200:
        return []
    rows = body.get("data") or []
    out: list[tuple[float, str]] = []
    for f in rows:
        if not isinstance(f, dict):
            continue
        if _safe_int(f.get("availableSeats")) < travellers:
            continue
        fn = f.get("flightNum") or f.get("flightNumber")
        if not fn:
            continue
        price = _safe_float(f.get("economyPrice"), float("inf"))
        out.append((price, str(fn).strip().upper()))
    out.sort(key=lambda x: x[0])
    seen: set[str] = set()
    deduped: list[tuple[float, str]] = []
    for p, fn in out:
        if fn in seen:
            continue
        seen.add(fn)
        deduped.append((p, fn))
    return deduped


def _hotel_ranked_options(
    destination_city: str,
    travellers: int,
    forced_room: str,
) -> list[tuple[float, int, str]]:
    """
    Sorted cheapest-first: (sort_price, hotelID, roomType STD|DLX).
    forced_room: '' → prefer STD then DLX per hotel; 'STD'|'DLX' → only that code.
    """
    body, terr = _http_get_json(
        f"{HOTEL_BASE}/hotel/search",
        params={"city": destination_city.strip()},
    )
    if terr or not body or body.get("code") != 200:
        return []
    rows = body.get("data") or []
    room_order = (
        [forced_room]
        if forced_room in ("STD", "DLX")
        else ["STD", "DLX"]
    )
    out: list[tuple[float, int, str]] = []
    for h in rows:
        if not isinstance(h, dict):
            continue
        hid = _safe_int(h.get("hotelID") or h.get("hotelId"))
        if hid < 1:
            continue
        rooms = h.get("roomTypes") or []
        best: tuple[float, str] | None = None
        for rt in room_order:
            sel = next(
                (r for r in rooms if str(r.get("code", "")).upper() == rt),
                None,
            )
            if not sel:
                continue
            if _safe_int(sel.get("availableRooms")) < travellers:
                continue
            ppn = _safe_float(sel.get("pricePerNight"), float("inf"))
            if best is None or ppn < best[0]:
                best = (ppn, rt)
        if best is None:
            continue
        ppn, rt = best
        out.append((ppn, hid, rt))
    out.sort(key=lambda x: (x[0], x[1]))
    seen_h: set[int] = set()
    deduped: list[tuple[float, int, str]] = []
    for row in out:
        if row[1] in seen_h:
            continue
        seen_h.add(row[1])
        deduped.append(row)
    return deduped


def _account_check(customer_id: int) -> tuple[bool, str | None, str]:
    """
    Diagram step 2–3: verify account exists and is active.
    Third return value: 'transport' | 'client' for HTTP status mapping.
    """
    body, terr = _http_get_json(f"{ACCOUNT_BASE}/account/{customer_id}")
    if terr or body is None:
        return False, f"Account service unreachable ({terr or 'unknown'})", "transport"
    api_code = body.get("code")
    if api_code == 404:
        return False, "Customer account not found", "client"
    if api_code != 200:
        msg = body.get("message") or f"Account check failed (code {api_code})"
        return False, msg, "client"
    data = body.get("data") or {}
    status = str(data.get("accountStatus", "")).strip().lower()
    if status and status != "active":
        return (
            False,
            f"Account is not active (status={data.get('accountStatus')!r})",
            "client",
        )
    return True, None, "client"


@app.errorhandler(Exception)
def _handle_unexpected(exc: Exception):
    if isinstance(exc, HTTPException):
        return jsonify(
            {"code": exc.code or 500, "message": exc.description or str(exc)}
        ), exc.code or 500
    app.logger.exception("bundle-pricing unhandled error")
    return (
        jsonify(
            {
                "code": 500,
                "message": "Unexpected error while pricing bundle — see service logs",
            }
        ),
        500,
    )


@app.get("/bundle-price")
def bundle_price():
    # Diagram inputs:
    # origin, destination, departDate, returnDate, numberOfTravellers, customerId
    origin = request.args.get("origin")
    destination = request.args.get("destination")
    depart_date = request.args.get("departDate")
    return_date = request.args.get("returnDate")
    number_of_travellers = request.args.get("numberOfTravellers")
    customer_id = request.args.get("customerId") or request.args.get("customerID")
    if customer_id is None or str(customer_id).strip() == "":
        customer_id = "0"

    ok, msg = _required_param("origin", origin)
    if not ok:
        return jsonify({"code": 400, "message": msg}), 400
    ok, msg = _required_param("destination", destination)
    if not ok:
        return jsonify({"code": 400, "message": msg}), 400
    ok, msg = _required_param("departDate", depart_date)
    if not ok:
        return jsonify({"code": 400, "message": msg}), 400
    ok, msg = _required_param("returnDate", return_date)
    if not ok:
        return jsonify({"code": 400, "message": msg}), 400
    ok, msg = _required_param("numberOfTravellers", number_of_travellers)
    if not ok:
        return jsonify({"code": 400, "message": msg}), 400

    o_norm = str(origin).strip()
    d_norm = str(destination).strip()
    if o_norm.casefold() == d_norm.casefold():
        return (
            jsonify(
                {
                    "code": 400,
                    "message": f"Origin and destination cannot be the same ({o_norm}). "
                    "Pick two different cities (e.g. Singapore → Tokyo).",
                }
            ),
            400,
        )

    travellers = max(1, _parse_int(number_of_travellers, 1))
    cid = _parse_int(customer_id, 0)

    depart_dt = _parse_datetime(depart_date)
    return_dt = _parse_datetime(return_date)
    if not depart_dt or not return_dt:
        return jsonify({"code": 400, "message": "Invalid departDate/returnDate format"}), 400
    if return_dt < depart_dt:
        return (
            jsonify(
                {
                    "code": 400,
                    "message": "returnDate must be on or after departDate",
                }
            ),
            400,
        )
    nights = max(1, (return_dt - depart_dt).days)

    room_type = (request.args.get("roomType") or "").strip().upper() or ""
    if room_type not in ("STD", "DLX"):
        room_type = ""  # will choose based on availability (value: STD before DLX)

    loyalty_coins_to_spend_cents = _parse_int(
        request.args.get("loyaltyCoinsToUseCents") or request.args.get("coinsToSpendCents"),
        0,
    )
    promo_code = (request.args.get("promoCode") or request.args.get("discountCode") or "").strip()
    package_id = (request.args.get("packageId") or "").strip()
    # Gallery position 0..n-1 — spreads picks when packageId hashes collide.
    card_index = max(0, _parse_int(request.args.get("cardIndex"), 0))

    # --- Composite order aligned with diagram "Search & Price Bundle" ---
    # 2–3 Account, 4–5 Loyalty, 6–7 Flight, 8–9 Hotel, 10–11 Discount, then coin offset.
    loyalty_preview: dict | None = None
    if cid > 0:
        acc_ok, acc_err, acc_kind = _account_check(cid)
        if not acc_ok:
            if acc_kind == "transport":
                return jsonify({"code": 503, "message": acc_err}), 503
            code = 404 if acc_err and "not found" in acc_err.lower() else 403
            return jsonify({"code": code, "message": acc_err}), code
        loyalty_raw, loy_terr = _http_get_json(f"{LOYALTY_BASE}/{cid}/points")
        if loy_terr:
            return (
                jsonify(
                    {
                        "code": 503,
                        "message": f"Loyalty service unavailable ({loy_terr})",
                    }
                ),
                503,
            )
        if loyalty_raw.get("code") != 200:
            msg = loyalty_raw.get("message") or "Loyalty points unavailable"
            return jsonify({"code": 503, "message": msg}), 503
        loyalty_preview = loyalty_raw.get("data") or {}

    # 6–7 / 8–9) Flight + hotel: ranked search + stable pick per packageId (gallery cards differ).
    forced_hotel_room = room_type if room_type in ("STD", "DLX") else ""
    f_opts = _flight_ranked_options(o_norm, d_norm, depart_date, travellers)
    h_opts = _hotel_ranked_options(d_norm, travellers, forced_hotel_room)

    flight_num: str | None = None
    chosen_room_type = "STD"
    hotel_id = 0
    available_seats = 0
    available_rooms = 0

    if f_opts and h_opts:
        hf = _stable_hash_u32(package_id + "|f") if package_id else 0
        hh = _stable_hash_u32(package_id + "|h") if package_id else 0
        # Without packageId, ignore cardIndex so manual "Search bundle" stays cheapest (0,0).
        effective_ci = card_index if package_id else 0
        fi = (hf + effective_ci * 13) % len(f_opts)
        hi = (hh + effective_ci * 11) % len(h_opts)
        _, flight_num = f_opts[fi]
        _sort_pn, hotel_id, chosen_room_type = h_opts[hi]
        available_seats = max(travellers, 1)
        available_rooms = max(travellers, 1)
    else:
        # Fallback: single cheapest via /availability (search empty or transport issue).
        flight_avail, fa_terr = _http_get_json(
            f"{FLIGHT_BASE}/availability",
            params={"origin": origin, "destination": destination, "departDate": depart_date},
        )
        if fa_terr:
            return jsonify({"code": 503, "message": f"Flight service: {fa_terr}"}), 503
        if flight_avail.get("code") != 200:
            fm = (
                flight_avail.get("message")
                or f"No flight availability for {origin} → {destination}. "
                "Adjust From/To or dates."
            )
            return jsonify({"code": 404, "message": fm}), 404
        flight_data = flight_avail.get("data") or {}
        flight_num = flight_data.get("flightNum") or flight_data.get("flight_num")
        available_seats = _safe_int(flight_data.get("availableSeats"))
        if not flight_num:
            return (
                jsonify({"code": 404, "message": "Flight availability did not return flightNum"}),
                404,
            )
        if available_seats < travellers:
            return (
                jsonify({"code": 409, "message": "Not enough flight seats for travellers"}),
                409,
            )

        candidate_room_types = ["STD", "DLX"] if room_type == "" else [room_type]
        hotel_chosen = None
        hotel_last_terr: str | None = None
        for rt in candidate_room_types:
            hotel_avail, ha_terr = _http_get_json(
                f"{HOTEL_BASE}/availability",
                params={
                    "city": destination,
                    "roomType": rt,
                    "departDate": depart_date,
                    "returnDate": return_date,
                    "minRooms": str(travellers),
                },
            )
            if ha_terr:
                hotel_last_terr = ha_terr
                continue
            if hotel_avail.get("code") != 200:
                continue
            data = hotel_avail.get("data") or {}
            if _safe_int(data.get("availableRooms")) >= travellers:
                hotel_chosen = (data, rt)
                break

        if not hotel_chosen:
            if hotel_last_terr:
                return (
                    jsonify({"code": 503, "message": f"Hotel service: {hotel_last_terr}"}),
                    503,
                )
            return (
                jsonify({"code": 404, "message": "No hotel availability for requested travellers"}),
                404,
            )

        hotel_data, chosen_room_type = hotel_chosen
        hotel_id = _safe_int(hotel_data.get("hotelID") or hotel_data.get("hotelId"))
        available_rooms = _safe_int(hotel_data.get("availableRooms"))
        if hotel_id < 1:
            return (
                jsonify({"code": 404, "message": "Hotel availability did not return hotelID"}),
                404,
            )
        if available_rooms < travellers:
            return (
                jsonify({"code": 409, "message": "Not enough hotel rooms for travellers"}),
                409,
            )

    if not flight_num:
        return jsonify({"code": 404, "message": "No flight available for bundle"}), 404
    if hotel_id < 1:
        return jsonify({"code": 404, "message": "No hotel available for bundle"}), 404

    flight_price_out, fp_terr = _http_get_json(
        f"{FLIGHT_BASE}/flights/price",
        params={"flightNum": flight_num},
    )
    if fp_terr:
        return jsonify({"code": 503, "message": f"Flight service: {fp_terr}"}), 503
    if flight_price_out.get("code") != 200:
        return (
            jsonify(
                {
                    "code": 404,
                    "message": flight_price_out.get("message") or "Flight price not found",
                }
            ),
            404,
        )
    flight_price = _safe_float((flight_price_out.get("data") or {}).get("price"), 0.0)

    flight_total = round(flight_price * travellers, 2)

    hotel_price_out, hp_terr = _http_get_json(
        f"{HOTEL_BASE}/hotels/price",
        params={"hotelID": hotel_id, "roomType": chosen_room_type},
    )
    if hp_terr:
        return jsonify({"code": 503, "message": f"Hotel service: {hp_terr}"}), 503
    if hotel_price_out.get("code") != 200:
        return (
            jsonify(
                {
                    "code": 404,
                    "message": hotel_price_out.get("message") or "Hotel price not found",
                }
            ),
            404,
        )
    hotel_price_per_night = _safe_float(
        (hotel_price_out.get("data") or {}).get("pricePerNight"), 0.0
    )

    hotel_total = round(hotel_price_per_night * nights * travellers, 2)

    # 10–11) Discount service (may call Loyalty again internally for tier — idempotent GET)
    disc_params = {
        "customerId": cid,
        "flightNum": flight_num,
        "hotelId": hotel_id,
        "roomType": chosen_room_type,
        "numberOfTravellers": travellers,
        "nights": nights,
    }
    if promo_code:
        disc_params["promoCode"] = promo_code
    discount_out, disc_terr = _http_get_json(
        f"{DISCOUNT_BASE}/discounts/bundle-rule",
        params=disc_params,
    )
    if disc_terr:
        return (
            jsonify(
                {"code": 503, "message": f"Discount service unavailable ({disc_terr})"}
            ),
            503,
        )
    if discount_out.get("code") != 200:
        return (
            jsonify(
                {
                    "code": 503,
                    "message": discount_out.get("message")
                    or "Discount service returned an error",
                }
            ),
            503,
        )

    discount_data = discount_out.get("data") or {}
    discount_percent = _safe_float(discount_data.get("discountPercent"), 0.0)
    discount_amount = round((flight_total + hotel_total) * (discount_percent / 100.0), 2)

    # Optional coin offset (reuse loyalty snapshot from diagram steps 4–5 when cid > 0)
    loyalty_used_dollars = 0.0
    if cid > 0 and loyalty_coins_to_spend_cents > 0 and loyalty_preview is not None:
        coins_available_cents = _safe_int(loyalty_preview.get("coins"))
        coins_spent = min(coins_available_cents, loyalty_coins_to_spend_cents)
        loyalty_used_dollars = round(coins_spent / 100.0, 2)

    list_price_total = round(flight_total + hotel_total, 2)
    final_total = round(max(0.0, list_price_total - discount_amount - loyalty_used_dollars), 2)

    out_data: dict = {
        "flightPrice": flight_total,
        "hotelPrice": hotel_total,
        "listPriceTotal": list_price_total,
        "discount": discount_amount,
        "loyaltyUsed": loyalty_used_dollars,
        "finalTotal": final_total,
        "discountPercent": discount_percent,
        "chosenRoomType": chosen_room_type,
        "nights": nights,
        "flightNum": flight_num,
        "hotelID": hotel_id,
    }
    for k in ("promoRejected", "promoAccepted", "promoCode", "promoMessage"):
        if k in discount_data:
            out_data[k] = discount_data[k]
    if loyalty_preview:
        out_data["tier"] = loyalty_preview.get("tier")
        out_data["bookingCount"] = loyalty_preview.get("bookingCount")
        out_data["coinBalanceCents"] = _safe_int(loyalty_preview.get("coins"))

    return jsonify({"code": 200, "data": out_data})


@app.get("/")
def health():
    return jsonify({"code": 200, "message": "Bundle Pricing service running"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5111, debug=True)

