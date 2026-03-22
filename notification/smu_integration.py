"""
Optional integration with SMU Lab Utilities — Notification REST API (SendEmail).

Set these in the environment (e.g. docker-compose) when you want real emails:

  SMU_NOTIFICATION_ENABLED=true
  SMU_NOTIFICATION_BASE_URL=https://smuedu-dev.outsystemsenterprise.com/SMULab_Notification/rest/Notification
  SMU_NOTIFY_EMAIL_TO=your.email@student.smu.edu.sg
  SMU_NOTIFICATION_AUTH_HEADER=Authorization
  SMU_NOTIFICATION_AUTH_VALUE=Bearer <paste API key / token from SMU Lab Utilities>

The exact header name/value is shown in SMU’s API documentation for your key.
"""

from __future__ import annotations

import json
import os
from typing import Any

try:
    import requests
except ImportError:
    requests = None  # type: ignore


def _enabled() -> bool:
    v = os.environ.get("SMU_NOTIFICATION_ENABLED", "").strip().lower()
    return v in ("1", "true", "yes", "on")


def send_email(
    email_address: str,
    email_subject: str,
    email_body: str,
) -> dict[str, Any]:
    """
    POST .../SendEmail with JSON body per SMU Swagger:
    { "emailAddress", "emailSubject", "emailBody" }
    """
    if not _enabled():
        return {"skipped": True, "reason": "SMU_NOTIFICATION_ENABLED is not true"}

    if requests is None:
        return {"error": "requests library not installed in notification container"}

    base = os.environ.get("SMU_NOTIFICATION_BASE_URL", "").strip().rstrip("/")
    if not base:
        return {"error": "SMU_NOTIFICATION_BASE_URL is not set"}

    url = f"{base}/SendEmail"
    headers = {"Content-Type": "application/json", "Accept": "application/json"}

    auth_header = os.environ.get("SMU_NOTIFICATION_AUTH_HEADER", "Authorization").strip()
    auth_value = os.environ.get("SMU_NOTIFICATION_AUTH_VALUE", "").strip()
    if auth_value and auth_header:
        headers[auth_header] = auth_value

    payload = {
        "emailAddress": email_address,
        "emailSubject": email_subject,
        "emailBody": email_body,
    }

    try:
        r = requests.post(url, json=payload, headers=headers, timeout=30)
        try:
            body = r.json()
        except Exception:
            body = {"_raw": r.text[:2000]}
        return {
            "ok": r.ok,
            "status": r.status_code,
            "response": body,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def send_email_for_amqp_event(routing_key: str, event_payload: dict[str, Any]) -> dict[str, Any]:
    """Send a demo email summarising a RabbitMQ booking event."""
    to = os.environ.get("SMU_NOTIFY_EMAIL_TO", "").strip()
    if not to:
        return {
            "skipped": True,
            "reason": "Set SMU_NOTIFY_EMAIL_TO (your inbox) to use SendEmail",
        }

    subject = f"[Travel demo] Event: {routing_key}"
    body = (
        "This is an automated message from the ESD travel booking demo.\n\n"
        f"Routing key: {routing_key}\n\n"
        f"Payload:\n{json.dumps(event_payload, indent=2)}"
    )
    return send_email(to, subject, body)
