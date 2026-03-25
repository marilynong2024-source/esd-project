"""
Optional external FX quote (submission: "at least one external service").

Uses the free exchangerate.host API (no key) unless you override URL.
Set FX_API_ENABLED=true in `.env` to attach a snapshot to create-booking responses.

Env:
  FX_API_ENABLED   true/false
  FX_API_URL       default: https://api.exchangerate.host/latest?base=SGD&symbols=USD
"""

from __future__ import annotations

import os
from typing import Any

import requests


def optional_fx_snapshot(booking_currency: str) -> dict[str, Any] | None:
    if os.environ.get("FX_API_ENABLED", "").strip().lower() not in ("1", "true", "yes"):
        return None
    base_cur = (booking_currency or "SGD").strip().upper() or "SGD"
    default_url = f"https://api.exchangerate.host/latest?base={base_cur}&symbols=USD,EUR"
    url = os.environ.get("FX_API_URL", default_url).strip() or default_url
    try:
        r = requests.get(url, timeout=8)
        if not r.ok:
            return {"error": f"HTTP {r.status_code}", "url": url}
        body = r.json()
        return {"source": "exchangerate.host", "requestUrl": url, "response": body}
    except Exception as e:
        return {"error": str(e), "url": url}
