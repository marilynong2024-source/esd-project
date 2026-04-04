"""
Optional Aviationstack (https://aviationstack.com/) enrichment for demo flights.

Env:
  AVIATIONSTACK_ENABLED   true/false
  AVIATIONSTACK_API_KEY   access_key value
  AVIATIONSTACK_BASE_URL  default https://api.aviationstack.com/v1

Does not replace the in-memory catalog — adds live/status data when requested.
"""

from __future__ import annotations

import os
from typing import Any

import requests

DEFAULT_BASE = "https://api.aviationstack.com/v1"


def aviationstack_enabled() -> bool:
    raw = os.environ.get("AVIATIONSTACK_ENABLED", "").strip().lower()
    if raw not in ("1", "true", "yes", "on"):
        return False
    return bool(os.environ.get("AVIATIONSTACK_API_KEY", "").strip())


def normalize_flight_iata(flight_num: str) -> str:
    """
    SQ001 -> SQ1 (common IATA style). Leave non-matching strings unchanged.
    """
    s = str(flight_num or "").strip().upper()
    if len(s) < 3:
        return s
    prefix, rest = s[:2], s[2:]
    if prefix.isalpha() and rest.isdigit():
        return prefix + str(int(rest))
    return s


def aviationstack_health() -> dict[str, Any]:
    key = (os.environ.get("AVIATIONSTACK_API_KEY") or "").strip()
    en = os.environ.get("AVIATIONSTACK_ENABLED", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    base = (os.environ.get("AVIATIONSTACK_BASE_URL") or DEFAULT_BASE).strip().rstrip("/")
    return {
        "enabled": en and bool(key),
        "configured": bool(key),
        "baseUrl": base,
        "keyPrefix": (key[:4] + "…") if len(key) > 6 else ("set" if key else ""),
    }


def fetch_flight_live_snapshot(flight_iata: str, flight_date: str | None) -> dict[str, Any]:
    """
    Call GET /v1/flights. Returns a small dict safe to JSON-merge into API responses.
    """
    if not aviationstack_enabled():
        return {"skipped": True, "reason": "AVIATIONSTACK disabled or API key missing"}

    key = os.environ.get("AVIATIONSTACK_API_KEY", "").strip()
    base = (os.environ.get("AVIATIONSTACK_BASE_URL") or DEFAULT_BASE).strip().rstrip("/")
    url = f"{base}/flights"
    params: dict[str, str] = {"access_key": key, "flight_iata": flight_iata}
    if flight_date and len(str(flight_date).strip()) >= 10:
        params["flight_date"] = str(flight_date).strip()[:10]

    try:
        r = requests.get(url, params=params, timeout=14)
    except requests.RequestException as e:
        return {"error": str(e), "flightIataRequested": flight_iata}

    try:
        body = r.json() if r.content else {}
    except ValueError:
        return {
            "error": "non-JSON response",
            "httpStatus": r.status_code,
            "flightIataRequested": flight_iata,
        }

    if not r.ok:
        return {
            "error": body.get("error", {}).get("info") if isinstance(body.get("error"), dict) else None,
            "httpStatus": r.status_code,
            "flightIataRequested": flight_iata,
            "raw": body if isinstance(body, dict) else {},
        }

    err = body.get("error") if isinstance(body, dict) else None
    if isinstance(err, dict) and err.get("info"):
        return {
            "error": err.get("info"),
            "flightIataRequested": flight_iata,
        }

    data = body.get("data") if isinstance(body, dict) else None
    count = len(data) if isinstance(data, list) else 0
    first = data[0] if count and isinstance(data, list) else None
    summary = None
    if isinstance(first, dict):
        dep = first.get("departure") or {}
        arr = first.get("arrival") or {}
        summary = {
            "flightStatus": first.get("flight_status"),
            "flightDate": first.get("flight_date"),
            "depScheduled": (dep.get("scheduled") if isinstance(dep, dict) else None),
            "arrScheduled": (arr.get("scheduled") if isinstance(arr, dict) else None),
            "depAirport": (dep.get("iata") if isinstance(dep, dict) else None),
            "arrAirport": (arr.get("iata") if isinstance(arr, dict) else None),
        }

    return {
        "source": "aviationstack.com",
        "flightIataRequested": flight_iata,
        "resultCount": count,
        "sample": summary,
        "pagination": body.get("pagination") if isinstance(body, dict) else None,
    }


def live_enrichment_for_catalog_flight(flight_dict: dict[str, Any]) -> dict[str, Any] | None:
    """Build Aviationstack snapshot using catalog flightNum + departureTime date."""
    fn = str(flight_dict.get("flightNum") or flight_dict.get("flightNumber") or "").strip()
    if not fn:
        return None
    iata = normalize_flight_iata(fn)
    dep = flight_dict.get("departureTime")
    date_str = str(dep)[:10] if dep else None
    return fetch_flight_live_snapshot(iata, date_str)
