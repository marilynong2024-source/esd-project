"""
Optional orchestration: ensure flight/hotel IDs exist in atomic catalog services.

Uses FLIGHT_URL and HOTEL_URL from the environment (see docker-compose).
Set SKIP_CATALOG_VALIDATION=true to bypass (e.g. local SQLite-only runs).

Both env vars may be either:
  - http://flight:5102/flight   (compose default — append /{flightId})
  - http://flight:5102          (append /flight/{flightId})
"""

from __future__ import annotations

import os

import requests


def _flight_lookup_url(flight_base: str, flight_id: str) -> str:
    base = flight_base.strip().rstrip("/")
    fid = str(flight_id).strip().upper()
    if not base:
        return ""
    if base.endswith("/flight"):
        return f"{base}/{fid}"
    return f"{base}/flight/{fid}"


def _hotel_lookup_url(hotel_base: str, hotel_id: int) -> str:
    base = hotel_base.strip().rstrip("/")
    if not base:
        return ""
    hid = int(hotel_id)
    if base.endswith("/hotel"):
        return f"{base}/{hid}"
    return f"{base}/hotel/{hid}"


def validate_flight_and_hotel(flight_id: str, hotel_id: int) -> str | None:
    if os.environ.get("SKIP_CATALOG_VALIDATION", "").strip().lower() in (
        "1",
        "true",
        "yes",
    ):
        return None

    flight_base = os.environ.get("FLIGHT_URL", "").strip()
    hotel_base = os.environ.get("HOTEL_URL", "").strip()

    if flight_base:
        fid = str(flight_id).strip()
        url = _flight_lookup_url(flight_base, fid)
        if not url:
            return None
        try:
            r = requests.get(url, timeout=5)
            if r.status_code == 404:
                return f"Flight '{fid}' not found (Flight atomic service)"
            if not r.ok:
                return f"Flight service returned HTTP {r.status_code}"
        except Exception as e:
            return f"Cannot reach Flight service: {e}"

    if hotel_base:
        url = _hotel_lookup_url(hotel_base, int(hotel_id))
        if not url:
            return None
        try:
            r = requests.get(url, timeout=5)
            if r.status_code == 404:
                return f"Hotel {hotel_id} not found (Hotel atomic service)"
            if not r.ok:
                return f"Hotel service returned HTTP {r.status_code}"
        except Exception as e:
            return f"Cannot reach Hotel service: {e}"

    return None
