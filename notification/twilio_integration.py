"""
Optional SMS via Twilio when the notification service consumes AMQP events.

Set in `.env` / docker-compose (never commit real secrets):

  TWILIO_ENABLED=true
  TWILIO_ACCOUNT_SID=ACxxxxxxxx
  TWILIO_AUTH_TOKEN=your_auth_token
  TWILIO_FROM_NUMBER=+15551234567   # your Twilio SMS-capable number (E.164)
  TWILIO_TO_NUMBER=+6591234567      # recipient (trial accounts: verify in Twilio console)

Twilio docs: https://www.twilio.com/docs/sms
"""

from __future__ import annotations

import os
from typing import Any

try:
    from twilio.base.exceptions import TwilioRestException
    from twilio.rest import Client
except ImportError:
    Client = None  # type: ignore[misc, assignment]
    TwilioRestException = Exception  # type: ignore[misc, assignment]


def _enabled() -> bool:
    v = os.environ.get("TWILIO_ENABLED", "").strip().lower()
    return v in ("1", "true", "yes", "on")


def send_sms(to_number: str, body: str) -> dict[str, Any]:
    if not _enabled():
        return {"skipped": True, "reason": "TWILIO_ENABLED is not true"}

    if Client is None:
        return {"error": "twilio package not installed in notification container"}

    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    from_number = os.environ.get("TWILIO_FROM_NUMBER", "").strip()

    if not account_sid or not auth_token:
        return {"error": "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required"}
    if not from_number:
        return {"error": "TWILIO_FROM_NUMBER is required (E.164)"}

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
    except TwilioException as e:
        return {"ok": False, "error": str(e)}


def send_sms_for_amqp_event(
    routing_key: str, event_payload: dict[str, Any]
) -> dict[str, Any]:
    """Send a short SMS summarising a RabbitMQ booking event."""
    to = os.environ.get("TWILIO_TO_NUMBER", "").strip()
    if not to:
        return {
            "skipped": True,
            "reason": "Set TWILIO_TO_NUMBER (E.164) to receive SMS",
        }

    bid = event_payload.get("bookingID", "?")
    pct = event_payload.get("refundPercentage")
    amt = event_payload.get("refundAmount")
    cur = event_payload.get("currency") or "SGD"
    who = (
        event_payload.get("passengerName")
        or event_payload.get("travellerDisplayName")
        or "Guest"
    )
    body = (
        f"[Travel demo] {routing_key} booking #{bid} ({who}). "
        f"Refund {pct}% (~{cur} {amt})."
    )

    return send_sms(to, body)
