"""
Traveller Profile REST — implemented in OutSystems by the team (teammate-owned).

Base URL (no trailing slash):
  https://personal-zhhppbon.outsystemscloud.com/TravellerProfileService/rest/TravellerProfileAPI

This Python wrapper only calls the three routes we integrate from Docker / scripts.
The OutSystems module has **five** REST operations total; see your teammate’s docs for the other two.

────────────────────────────────────────────────────────────────────────────
POST /CreateTravellerProfile
  Example JSON body:
  {
    "CustomerID": 4427,
    "FullName": "John lee",
    "PassportNumber": "S1234567A",
    "PassportExpiry": "2028-01-01",
    "DateOfBirth": "1990-05-15",
    "Nationality": "Singaporean",
    "SeatPreference": "Window",
    "MealPreference": "Vegetarian",
    "EmergencyContactName": "Jane lee",
    "EmergencyContactPhone": "91234567",
    "Relationship": "self"
  }
GET /GetAllTravellerProfiles   (debug)
GET /byaccount/{customerID}
────────────────────────────────────────────────────────────────────────────

Override base with env TRAVELLER_PROFILE_BASE_URL if the host/path ever changes.

For update/delete:
- Defaults assume the OutSystems operation names are `UpdateTravellerProfile`
  and `DeleteTravellerProfile`.
- If the operation names differ, override with env vars:
  - `TRAVELLER_PROFILE_UPDATE_PATH`
  - `TRAVELLER_PROFILE_DELETE_PATH`
"""

from __future__ import annotations

import os
from typing import Any

import requests

_DEFAULT = (
    "https://personal-zhhppbon.outsystemscloud.com/"
    "TravellerProfileService/rest/TravellerProfileAPI"
)


def _base_url() -> str:
    return os.environ.get("TRAVELLER_PROFILE_BASE_URL", _DEFAULT).strip().rstrip("/")


def _row_id(row: dict[str, Any]) -> int | None:
    for key in ("Id", "id", "TravellerProfileId", "TravellerId"):
        raw = row.get(key)
        if raw is None:
            continue
        try:
            return int(raw)
        except (TypeError, ValueError):
            continue
    return None


def _unwrap_list(body: Any) -> list[dict[str, Any]]:
    if body is None:
        return []
    if isinstance(body, list):
        return [x for x in body if isinstance(x, dict)]
    if isinstance(body, dict):
        for key in ("Data", "data", "List", "TravellerProfiles", "Result"):
            inner = body.get(key)
            if isinstance(inner, list):
                return [x for x in inner if isinstance(x, dict)]
        if _row_id(body) is not None or body.get("FullName") or body.get("CustomerID") is not None:
            return [body]
    return []


def create_traveller_profile(data: dict[str, Any]) -> Any:
    """POST .../CreateTravellerProfile — pass through the JSON your OutSystems action expects."""
    r = requests.post(
        f"{_base_url()}/CreateTravellerProfile",
        json=data,
        headers={"Content-Type": "application/json"},
        timeout=15,
    )
    if r.status_code in (200, 201):
        try:
            return r.json()
        except Exception:
            return {"_raw": r.text}
    return None


def get_all_traveller_profiles() -> list[dict[str, Any]] | None:
    """GET .../GetAllTravellerProfiles"""
    r = requests.get(f"{_base_url()}/GetAllTravellerProfiles", timeout=15)
    if r.status_code != 200:
        return None
    return _unwrap_list(r.json())


def get_profiles_by_account(customer_id: int) -> list[dict[str, Any]] | None:
    """GET .../byaccount/{customerID}"""
    r = requests.get(f"{_base_url()}/byaccount/{int(customer_id)}", timeout=15)
    if r.status_code != 200:
        return None
    return _unwrap_list(r.json())


def get_traveller_profile(customer_id: int, traveller_profile_id: int) -> dict[str, Any] | None:
    """Pick one row by OutSystems Id from the byaccount list (no separate GET-by-id in the three routes above)."""
    rows = get_profiles_by_account(customer_id)
    if not rows:
        return None
    tid = int(traveller_profile_id)
    for row in rows:
        if _row_id(row) == tid:
            return row
    return None


def _update_path() -> str:
    return os.environ.get("TRAVELLER_PROFILE_UPDATE_PATH", "UpdateTravellerProfile").strip()


def _delete_path() -> str:
    return os.environ.get("TRAVELLER_PROFILE_DELETE_PATH", "DeleteTravellerProfile").strip()


def update_traveller_profile(data: dict[str, Any]) -> Any:
    """
    POST .../<UpdateTravellerProfile> (operation name configurable by env).

    The OutSystems update action typically expects:
    - CustomerID
    - Id/TravellerProfileId
    - FullName, PassportNumber, PassportExpiry, DateOfBirth, Nationality, ...
    """
    r = requests.post(
        f"{_base_url()}/{_update_path()}",
        json=data,
        headers={"Content-Type": "application/json"},
        timeout=20,
    )
    if r.status_code in (200, 201):
        try:
            return r.json()
        except Exception:
            return {"_raw": r.text}
    return {"_httpStatus": r.status_code, "_raw": r.text[:500]}


def delete_traveller_profile(data: dict[str, Any]) -> Any:
    """
    POST .../<DeleteTravellerProfile> (operation name configurable by env).

    The OutSystems delete action typically expects:
    - CustomerID
    - Id/TravellerProfileId
    """
    r = requests.post(
        f"{_base_url()}/{_delete_path()}",
        json=data,
        headers={"Content-Type": "application/json"},
        timeout=20,
    )
    if r.status_code in (200, 201):
        try:
            return r.json()
        except Exception:
            return {"_raw": r.text}
    return {"_httpStatus": r.status_code, "_raw": r.text[:500]}
