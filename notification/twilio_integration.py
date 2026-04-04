"""
SMS via Twilio when the notification service consumes AMQP events.

Credentials (recommended): set in project `.env` and pass into the notification
container (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`,
`TWILIO_ENABLED=true`). Optional UI: POST /twilio/config persists under
`data/twilio_runtime.json` (override with env `TWILIO_CONFIG_PATH`).

SMS destination: each booking’s `passengerPhone` from the booking payload
(normalized to E.164). Optional `TWILIO_TO_NUMBER` in `.env` is only a demo
fallback when the booking has no phone.

Credentials: values saved via the UI (`data/twilio_runtime.json` on the
notification volume) take precedence over `.env` for SID, token, and From number
when both are set, so a bad token in `.env` does not override a good UI save.
Restart the notification container after changing `.env` if you rely on env-only
setup and have no saved file (or delete the persisted JSON to force env).

Twilio docs: https://www.twilio.com/docs/sms
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

try:
    from twilio.base.exceptions import TwilioRestException
    from twilio.rest import Client
except ImportError:
    Client = None  # type: ignore[misc, assignment]
    TwilioRestException = Exception  # type: ignore[misc, assignment]

_RUNTIME: dict[str, Any] = {}
_DEFAULT_TWILIO_CONFIG = Path(__file__).resolve().parent / "data" / "twilio_runtime.json"
_CONFIG_PATH = Path(os.environ.get("TWILIO_CONFIG_PATH", str(_DEFAULT_TWILIO_CONFIG)))


def load_persisted_config() -> None:
    if _CONFIG_PATH.is_file():
        try:
            raw = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
        except (OSError, ValueError, TypeError):
            raw = None
        if isinstance(raw, dict):
            for key in ("accountSid", "authToken", "fromNumber", "enabled"):
                if key not in raw:
                    continue
                val = raw[key]
                if key == "enabled":
                    _RUNTIME["enabled"] = bool(val)
                elif isinstance(val, str) and not val.strip():
                    # Do not load empty strings — avoids wiping env-backed creds after a blank UI save.
                    continue
                elif key == "fromNumber":
                    _RUNTIME[key] = _normalize_twilio_from_number(val)
                else:
                    _RUNTIME[key] = val
    _apply_twilio_from_environment()


def _normalize_twilio_from_number(raw: str) -> str:
    """Twilio expects E.164; strip spaces so +1 318 552 2838 works from .env."""
    s = str(raw or "").strip()
    if not s:
        return ""
    if s.startswith("+"):
        digits = "".join(c for c in s[1:] if c.isdigit())
        return f"+{digits}" if digits else ""
    return re.sub(r"\s+", "", s)


def _apply_twilio_from_environment() -> None:
    """
    Docker Compose can pass TWILIO_* from .env into the notification container.
    By default env fills only missing SID / token / From after the persisted JSON load
    (so a good UI save is not overwritten by stale .env).

    Set TWILIO_ENV_OVERRIDES_FILE=true in .env when you update Twilio in .env and
    want those values to replace whatever is in twilio_runtime.json after restart.
    """
    sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    from_num = _normalize_twilio_from_number(os.environ.get("TWILIO_FROM_NUMBER", ""))
    force_env = os.environ.get("TWILIO_ENV_OVERRIDES_FILE", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    if force_env:
        if sid:
            _RUNTIME["accountSid"] = sid
        if token:
            _RUNTIME["authToken"] = token
        if from_num:
            _RUNTIME["fromNumber"] = from_num
    else:
        if sid and not str(_RUNTIME.get("accountSid", "") or "").strip():
            _RUNTIME["accountSid"] = sid
        if token and not str(_RUNTIME.get("authToken", "") or "").strip():
            _RUNTIME["authToken"] = token
        if from_num and not str(_RUNTIME.get("fromNumber", "") or "").strip():
            _RUNTIME["fromNumber"] = from_num
    en = os.environ.get("TWILIO_ENABLED", "").strip().lower()
    if en in ("1", "true", "yes", "on"):
        _RUNTIME["enabled"] = True
    elif en in ("0", "false", "no", "off"):
        _RUNTIME["enabled"] = False


def _persist_config() -> None:
    try:
        _CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        out = {
            "accountSid": str(_RUNTIME.get("accountSid", "") or ""),
            "authToken": str(_RUNTIME.get("authToken", "") or ""),
            "fromNumber": str(_RUNTIME.get("fromNumber", "") or ""),
            "enabled": bool(_RUNTIME.get("enabled")),
        }
        _CONFIG_PATH.write_text(json.dumps(out, indent=0), encoding="utf-8")
    except OSError as e:
        print(f"[twilio] could not persist config: {e}", flush=True)


def get_twilio_public_config() -> dict[str, Any]:
    sid = str(_RUNTIME.get("accountSid", "") or "")
    masked = ""
    if len(sid) > 6:
        masked = sid[:2] + "…" + sid[-4:]
    elif sid:
        masked = "…"
    to_env = str(os.environ.get("TWILIO_TO_NUMBER", "") or "").strip()
    to_masked = ""
    if len(to_env) > 8:
        to_masked = to_env[:4] + "…" + to_env[-3:]
    elif to_env:
        to_masked = "…"
    return {
        "enabled": bool(_RUNTIME.get("enabled")),
        "accountSidMasked": masked,
        "hasAccountSid": bool(sid),
        "fromNumber": str(_RUNTIME.get("fromNumber", "") or ""),
        "hasAuthToken": bool(str(_RUNTIME.get("authToken", "") or "").strip()),
        "defaultToFromEnv": bool(to_env),
        "defaultToMasked": to_masked,
    }


def apply_twilio_config(body: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(body, dict):
        body = {}
    if "enabled" in body:
        _RUNTIME["enabled"] = bool(body["enabled"])
    sid = str(body.get("accountSid") or "").strip()
    if sid:
        _RUNTIME["accountSid"] = sid
    if "authToken" in body and str(body.get("authToken") or "").strip():
        _RUNTIME["authToken"] = str(body["authToken"]).strip()
    fn = _normalize_twilio_from_number(str(body.get("fromNumber") or ""))
    if fn:
        _RUNTIME["fromNumber"] = fn
    _persist_config()
    return get_twilio_public_config()


def _twilio_enabled() -> bool:
    return bool(_RUNTIME.get("enabled"))


def _twilio_credentials() -> tuple[str, str, str]:
    return (
        str(_RUNTIME.get("accountSid", "") or "").strip(),
        str(_RUNTIME.get("authToken", "") or "").strip(),
        _normalize_twilio_from_number(str(_RUNTIME.get("fromNumber", "") or "")),
    )


def send_sms(to_number: str, body: str) -> dict[str, Any]:
    if not _twilio_enabled():
        return {
            "skipped": True,
            "reason": "Twilio is disabled — enable it under SMS settings in the UI",
        }

    if Client is None:
        return {"error": "twilio package not installed in notification container"}

    account_sid, auth_token, from_number = _twilio_credentials()
    if not account_sid or not auth_token:
        return {
            "error": "Twilio Account SID and Auth Token missing — set TWILIO_ACCOUNT_SID and "
            "TWILIO_AUTH_TOKEN in project .env (notification service) or save under SMS settings.",
        }
    if not from_number:
        return {
            "error": "Twilio From number required (E.164) — set TWILIO_FROM_NUMBER in .env or SMS settings",
        }

    to_number = to_number.strip()
    if not to_number:
        return {"error": "SMS destination number is empty"}

    client = Client(account_sid, auth_token)
    try:
        msg = client.messages.create(
            body=body[:1600],
            from_=from_number,
            to=to_number,
        )
        return {
            "ok": True,
            "sid": msg.sid,
            "status": getattr(msg, "status", None),
        }
    except TwilioRestException as e:
        code = getattr(e, "status", None) or getattr(e, "code", None)
        if code == 401:
            return {
                "ok": False,
                "error": (
                    "Twilio HTTP 401 (Authenticate) — Account SID or Auth Token is wrong, revoked, or "
                    "does not match. Copy the live Auth Token from https://console.twilio.com and save "
                    "under SMS settings in the UI (or fix .env and remove the old twilio_runtime.json "
                    "on the notification volume if env-only). Recreate the notification container after "
                    ".env changes. Booking/cancel still succeed without SMS."
                ),
            }
        return {"ok": False, "error": str(e)}


def _normalize_phone_e164(raw: Any, default_cc: str = "65") -> str | None:
    """Best-effort E.164 for Twilio; default country code for SG demo (65)."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    compact = re.sub(r"[\s\-().]", "", s)
    if compact.startswith("+"):
        digits = re.sub(r"\D", "", compact[1:])
        if digits:
            return "+" + digits
        return None
    digits_only = re.sub(r"\D", "", compact)
    if not digits_only:
        return None
    # e.g. 65891234567 (country code + mobile, no leading +)
    if digits_only.startswith(default_cc) and len(digits_only) >= 10:
        return "+" + digits_only
    if len(digits_only) == 8 and digits_only[0] in "89":
        return "+" + default_cc + digits_only
    return None


def _sms_is_booking_confirmation(routing_key: str, payload: dict[str, Any]) -> bool:
    if routing_key == "booking.confirmed":
        return True
    if payload.get("cancelledAt"):
        return False
    return bool(payload.get("confirmedAt"))


def send_sms_for_amqp_event(
    routing_key: str, event_payload: dict[str, Any]
) -> dict[str, Any]:
    """Send a short SMS summarising a RabbitMQ booking event."""
    to = _normalize_phone_e164(event_payload.get("passengerPhone"))
    if not to:
        to = _normalize_phone_e164(os.environ.get("TWILIO_TO_NUMBER"))
    if not to:
        return {
            "skipped": True,
            "reason": "No SMS destination: add Mobile (SMS) under My profile (E.164 or local 8-digit), "
            "then book again — or optional TWILIO_TO_NUMBER in .env for demos only",
        }

    bid = event_payload.get("bookingID", "?")
    cur = event_payload.get("currency") or "SGD"
    who = (
        event_payload.get("passengerName")
        or event_payload.get("travellerDisplayName")
        or "Guest"
    )
    if _sms_is_booking_confirmation(routing_key, event_payload):
        total = event_payload.get("totalPrice")
        flight = event_payload.get("flightID") or "?"
        dep = str(event_payload.get("departureTime") or "").replace("T", " ")[:16]
        seat = event_payload.get("seatNumber")
        seat_bit = f" Seat {seat}." if seat else ""
        body = (
            f"[Travel demo] Booking #{bid} confirmed — {who}. "
            f"{flight} {dep}. Total {cur} {total}.{seat_bit}"
        )
    else:
        pct = event_payload.get("refundPercentage")
        amt = event_payload.get("refundAmount")
        body = (
            f"[Travel demo] Booking #{bid} cancelled/refunded ({who}). "
            f"Refund {pct}% (~{cur} {amt})."
        )

    return send_sms(to, body)
