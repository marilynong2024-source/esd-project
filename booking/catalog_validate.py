"""
Optional orchestration: ensure flight/hotel IDs exist in atomic catalog services.

Uses FLIGHT_URL and HOTEL_URL from the environment (see docker-compose).
Set SKIP_CATALOG_VALIDATION=true to bypass (e.g. local SQLite-only runs).
"""

from __future__ import annotations

import os

import requests


def validate_flight_and_hotel(flight_id: str, hotel_id: int) -> str | None:
    if os.environ.get("SKIP_CATALOG_VALIDATION", "").strip().lower() in (
        "1",
        "true",
        "yes",
    ):
        return None

    flight_base = os.environ.get("FLIGHT_URL", "").strip().rstrip("/")
    hotel_base = os.environ.get("HOTEL_URL", "").strip().rstrip("/")

    if flight_base:
        fid = str(flight_id).strip()
        url = f"{flight_base}/{fid}"
        try:
            r = requests.get(url, timeout=5)
            if r.status_code == 404:
                return f"Flight '{fid}' not found (Flight atomic service)"
            if not r.ok:
                return f"Flight service returned HTTP {r.status_code}"
        except Exception as e:
            return f"Cannot reach Flight service: {e}"

    if hotel_base:
        url = f"{hotel_base}/{int(hotel_id)}"
        try:
            r = requests.get(url, timeout=5)
            if r.status_code == 404:
                return f"Hotel {hotel_id} not found (Hotel atomic service)"
            if not r.ok:
                return f"Hotel service returned HTTP {r.status_code}"
        except Exception as e:
            return f"Cannot reach Hotel service: {e}"

    return None
