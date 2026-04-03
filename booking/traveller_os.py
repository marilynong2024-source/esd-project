"""
Booking-side hook to teammate’s Traveller Profile REST (OutSystems).

**Booking** only needs GET `byaccount/{customerId}` and matches the row **Id** to
`travellerProfileId`. Full HTTP contract + Create payload example: see
`travellerprofile/outsystems_client.py` (do not duplicate teammate’s OutSystems
logic here).

Env: TRAVELLER_PROFILE_BASE_URL, TRAVELLER_PROFILE_REQUIRED, TRAVELLER_PROFILE_LOCAL_DEMO

When TRAVELLER_PROFILE_LOCAL_DEMO is true, byaccount + CRUD use an in-process store so the UI
works without OutSystems (avoids nginx 502 when cloud is unreachable). Docker Compose defaults
LOCAL_DEMO to false so booking calls OutSystems.

When LOCAL_DEMO is false and TRAVELLER_PROFILE_BASE_URL is unset or blank, uses the same default
base as travellerprofile/outsystems_client.py. Override TRAVELLER_PROFILE_BASE_URL for your host.
"""

from __future__ import annotations

import copy
import json
import os
import threading
from typing import Any

import requests

_DEFAULT_TRAVELLER_PROFILE_BASE = (
    "https://personal-zhhppbon.outsystemscloud.com/"
    "TravellerProfileService/rest/TravellerProfileAPI"
)

_demo_lock = threading.Lock()
_demo_profiles: dict[int, list[dict[str, Any]]] | None = None
_demo_next_id = 100


def local_demo_enabled() -> bool:
    """When true, traveller CRUD is served in-process (no OutSystems HTTP). Avoids nginx 502 when cloud is down."""
    return os.environ.get("TRAVELLER_PROFILE_LOCAL_DEMO", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _ensure_demo_store() -> dict[int, list[dict[str, Any]]]:
    global _demo_profiles, _demo_next_id
    with _demo_lock:
        if _demo_profiles is None:
            _demo_profiles = {
                1: [
                    {
                        "Id": 1,
                        "CustomerID": 1,
                        "FullName": "Ava Chen",
                        "PassportNumber": "E1234567A",
                        "PassportExpiry": "2030-06-01",
                        "DateOfBirth": "1995-02-14",
                        "Nationality": "Singapore",
                        "MealPreference": "Vegetarian",
                        "SeatPreference": "",
                    },
                    {
                        "Id": 2,
                        "CustomerID": 1,
                        "FullName": "Liam Chen",
                        "PassportNumber": "E7654321B",
                        "PassportExpiry": "2031-01-15",
                        "DateOfBirth": "1992-07-11",
                        "Nationality": "Singapore",
                        "MealPreference": "None",
                        "SeatPreference": "",
                    },
                ],
                2: [
                    {
                        "Id": 3,
                        "CustomerID": 2,
                        "FullName": "Ben Kumar",
                        "PassportNumber": "K9988776C",
                        "PassportExpiry": "2029-12-01",
                        "DateOfBirth": "1991-08-03",
                        "Nationality": "India",
                        "MealPreference": "Halal",
                        "SeatPreference": "",
                    },
                ],
            }
            _demo_next_id = 100
        return _demo_profiles


def _demo_find_row(profile_id: int) -> tuple[int, int, dict[str, Any]] | None:
    """Return (customer_id, index_in_list, row) or None."""
    store = _ensure_demo_store()
    pid = int(profile_id)
    for cid, rows in store.items():
        for i, row in enumerate(rows):
            if _row_id(row) == pid:
                return cid, i, row
    return None


def traveller_profile_create_local(data: dict[str, Any]) -> dict[str, Any]:
    store = _ensure_demo_store()
    cid = int(data.get("CustomerID") or 0)
    if cid < 1:
        return {"_error": "CustomerID is required"}
    global _demo_next_id
    with _demo_lock:
        _demo_next_id += 1
        new_id = _demo_next_id
        row: dict[str, Any] = {
            "Id": new_id,
            "TravellerProfileId": new_id,
            "CustomerID": cid,
            "FullName": (data.get("FullName") or "").strip(),
            "PassportNumber": (data.get("PassportNumber") or "").strip(),
            "PassportExpiry": (data.get("PassportExpiry") or "").strip(),
            "DateOfBirth": (data.get("DateOfBirth") or "").strip(),
            "Nationality": (data.get("Nationality") or "").strip(),
            "SeatPreference": (data.get("SeatPreference") or "").strip(),
            "MealPreference": (data.get("MealPreference") or "").strip(),
            "EmergencyContactName": (data.get("EmergencyContactName") or "").strip(),
            "EmergencyContactPhone": (data.get("EmergencyContactPhone") or "").strip(),
            "Relationship": (data.get("Relationship") or "").strip(),
        }
        store.setdefault(cid, []).append(row)
        return copy.deepcopy(row)


def traveller_profile_update_local(data: dict[str, Any]) -> dict[str, Any]:
    tid = _row_id(data)
    if tid is None:
        return {"_error": "Id / TravellerProfileId is required"}
    found = _demo_find_row(tid)
    if not found:
        return {"_error": f"Traveller profile {tid} not found"}
    cid, idx, _prev = found
    store = _ensure_demo_store()
    with _demo_lock:
        row = store[cid][idx]
        for key in (
            "FullName",
            "PassportNumber",
            "PassportExpiry",
            "DateOfBirth",
            "Nationality",
            "SeatPreference",
            "MealPreference",
            "EmergencyContactName",
            "EmergencyContactPhone",
            "Relationship",
        ):
            if key in data and data[key] is not None:
                row[key] = str(data[key]).strip()
        return copy.deepcopy(row)


def traveller_profile_delete_local(data: dict[str, Any]) -> dict[str, Any]:
    tid = _row_id(data)
    if tid is None:
        return {"_error": "Id / TravellerProfileId is required"}
    found = _demo_find_row(tid)
    if not found:
        return {"_ok": True, "_note": "already absent"}
    cid, idx, _ = found
    store = _ensure_demo_store()
    with _demo_lock:
        del store[cid][idx]
    return {"_ok": True}


def _base_url() -> str:
    raw = os.environ.get("TRAVELLER_PROFILE_BASE_URL", "").strip().rstrip("/")
    return raw or _DEFAULT_TRAVELLER_PROFILE_BASE


def _required() -> bool:
    return os.environ.get("TRAVELLER_PROFILE_REQUIRED", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


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


def _unwrap_traveller_list(body: Any) -> list[dict[str, Any]]:
    """OutSystems may return a bare list or { "Data": [ ... ] } or a single profile object."""
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


def fetch_byaccount_rows(
    customer_id: int,
) -> tuple[str | None, list[dict[str, Any]]]:
    """
    One GET …/byaccount/{customerId} for all companion rows.

    Returns:
      (err, []) — request/HTTP/parse failure.
      (None, rows) — HTTP 200 (rows may be empty).
    """
    if local_demo_enabled():
        _ensure_demo_store()
        with _demo_lock:
            rows = copy.deepcopy(_demo_profiles.get(int(customer_id), []))
        return None, rows

    base = _base_url()
    url = f"{base}/byaccount/{int(customer_id)}"
    try:
        r = requests.get(url, timeout=(5, 12))
        if r.status_code != 200:
            snippet = (r.text or "")[:200].replace("\n", " ")
            return (
                f"Traveller Profile service HTTP {r.status_code} for byaccount/{customer_id}: {snippet}",
                [],
            )
        try:
            body = r.json()
        except json.JSONDecodeError:
            return "Traveller Profile service returned non-JSON for byaccount", []
        return None, _unwrap_traveller_list(body)
    except requests.Timeout:
        return "Traveller Profile service timed out (byaccount)", []
    except requests.RequestException as e:
        return f"Traveller Profile service unreachable: {e}", []


def fetch_traveller_profile_for_booking(
    customer_id: int,
    traveller_profile_id: int,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Returns:
      (profile, None) — matched row.
      (None, None) — HTTP 200 but no row matches Id (or empty list).
      (None, err) — network error, timeout, non-JSON, or HTTP error from OutSystems.
    """
    err, rows = fetch_byaccount_rows(customer_id)
    if err:
        return None, err
    for row in rows:
        if _row_id(row) == int(traveller_profile_id):
            return row, None
    return None, None


def snapshot_display_name(data: dict[str, Any]) -> str | None:
    """Short label; masks passport to last 4 chars when present."""
    if not data:
        return None
    name = None
    for k in ("FullName", "Name", "TravellerName"):
        v = data.get(k)
        if v:
            name = str(v).strip()[:120] or None
            break
    if not name:
        fn = (data.get("FirstName") or data.get("firstName") or "").strip()
        ln = (data.get("LastName") or data.get("lastName") or "").strip()
        if fn or ln:
            name = f"{fn} {ln}".strip()[:120] or None
    if not name:
        return None
    pp = (
        data.get("PassportNumber")
        or data.get("PassportNo")
        or data.get("passportNumber")
        or data.get("NationalIDNo")
    )
    if pp:
        pstr = str(pp).strip()
        tail = pstr[-4:] if len(pstr) >= 4 else pstr
        out = f"{name} · …{tail}"
    else:
        out = name
    return out[:120]


def snapshot_display_names(
    profiles: list[dict[str, Any]], max_len: int = 120
) -> str | None:
    """Comma-separated labels for confirmation / AMQP (truncated)."""
    parts: list[str] = []
    for p in profiles:
        label = snapshot_display_name(p)
        if label:
            parts.append(label)
    if not parts:
        return None
    s = ", ".join(parts)
    if len(s) <= max_len:
        return s
    return s[: max_len - 3] + "…"


def account_id_from_profile(data: dict[str, Any]) -> int | None:
    for key in (
        "CustomerID",
        "CustomerAccountId",
        "CustomerId",
        "customerID",
        "AccountId",
        "accountId",
    ):
        raw = data.get(key)
        if raw is None:
            continue
        try:
            return int(raw)
        except (TypeError, ValueError):
            continue
    return None


def _dedupe_ids(ids: list[int]) -> list[int]:
    seen: set[int] = set()
    out: list[int] = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out


def validate_travellers_for_booking(
    customer_id: int,
    traveller_profile_ids: list[int],
) -> tuple[list[dict[str, Any]], str | None, bool, list[int]]:
    """
    Validate multiple OutSystems profile Ids against one byaccount response.

    Returns (matched_rows in request order, error, lookup_performed, ids_to_store).

    When TRAVELLER_PROFILE_REQUIRED is false and an Id is missing remotely, it is
    dropped from ids_to_store. When true, missing Ids are an error.
    """
    ids = _dedupe_ids([i for i in traveller_profile_ids if i > 0])
    if not ids:
        return [], None, False, []

    err, rows = fetch_byaccount_rows(customer_id)
    if err:
        return [], err, True, ids

    by_os_id: dict[int, dict[str, Any]] = {}
    for row in rows:
        rid = _row_id(row)
        if rid is not None:
            by_os_id[int(rid)] = row

    matched: list[dict[str, Any]] = []
    final_ids: list[int] = []
    for tid in ids:
        row = by_os_id.get(tid)
        if not row:
            if _required():
                return (
                    [],
                    (
                        "We couldn’t find that saved traveller on this account. "
                        "Open Travellers, tap Refresh list, and pick a profile from the list—or add a new one."
                    ),
                    True,
                    [],
                )
            continue
        acc = account_id_from_profile(row)
        if acc is not None and int(customer_id) != int(acc):
            return (
                [],
                "That saved traveller belongs to a different account. Sign in as the right member or choose another profile.",
                True,
                [],
            )
        matched.append(row)
        final_ids.append(tid)

    return matched, None, True, final_ids


def validate_traveller_for_booking(
    customer_id: int,
    traveller_profile_id: int | None,
) -> tuple[dict[str, Any] | None, str | None, bool]:
    """
    Single-profile helper; delegates to validate_travellers_for_booking.
    """
    if traveller_profile_id is None:
        return None, None, False
    rows, err, done, _ = validate_travellers_for_booking(
        customer_id, [traveller_profile_id]
    )
    if err:
        return None, err, done
    if not rows:
        return None, None, done
    return rows[0], None, done
