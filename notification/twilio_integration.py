"""
SMS via Twilio when the notification service consumes AMQP events.

Configure credentials in the UI (POST /twilio/config). They persist under
`notification/data/twilio_runtime.json` (override with env `TWILIO_CONFIG_PATH`).
In Docker, mount a volume on `/app/data` so that path stays writable and survives
container restarts.

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
                if key in raw:
                    _RUNTIME[key] = raw[key]
    _apply_twilio_from_environment()


def _apply_twilio_from_environment() -> None:
    """
    Docker Compose can pass TWILIO_* from .env into the notification container.
    Non-empty env values override the JSON file so the stack works without
    opening the UI first.
    """
    sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    from_num = os.environ.get("TWILIO_FROM_NUMBER", "").strip()
    if sid:
        _RUNTIME["accountSid"] = sid
    if token:
        _RUNTIME["authToken"] = token
    if from_num:
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
    fn = str(body.get("fromNumber") or "").strip()
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
        str(_RUNTIME.get("fromNumber", "") or "").strip(),
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
            "error": "Twilio Account SID and Auth Token required — save them in the UI (SMS settings)",
        }
    if not from_number:
        return {
            "error": "Twilio From number required (E.164) — set it in the UI",
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
    if digits_only.startswith(default_cc) and len(digits_only) >= 2 + 8:
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
            "reason": "No SMS destination: enter a valid mobile on the booking form "
            "(e.g. +65 9123 4567 or 91234567), or set TWILIO_TO_NUMBER in .env for demos",
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
