"""
Booking-side hook to teammate’s Traveller Profile REST (OutSystems).

**Booking** only needs GET `byaccount/{customerId}` and matches the row **Id** to
`travellerProfileId`. Full HTTP contract + Create payload example: see
`travellerprofile/outsystems_client.py` (do not duplicate teammate’s OutSystems
logic here).

Env: TRAVELLER_PROFILE_BASE_URL, TRAVELLER_PROFILE_REQUIRED
"""

from __future__ import annotations

import json
import os
from typing import Any

import requests


def _base_url() -> str:
    return os.environ.get("TRAVELLER_PROFILE_BASE_URL", "").strip().rstrip("/")


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
) -> tuple[str | None, list[dict[str, Any]] | None]:
    """
    One GET …/byaccount/{customerId} for all companion rows.

    Returns:
      (None, None) — TRAVELLER_PROFILE_BASE_URL not set (skip remote).
      (err, []) — request/HTTP/parse failure.
      (None, rows) — HTTP 200 (rows may be empty).
    """
    base = _base_url()
    if not base:
        return None, None
    url = f"{base}/byaccount/{int(customer_id)}"
    try:
        r = requests.get(url, timeout=12)
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
      (None, None) — no URL, or HTTP 200 but no row matches Id (or empty list).
      (None, err) — network error, timeout, non-JSON, or HTTP error from OutSystems.
    """
    err, rows = fetch_byaccount_rows(customer_id)
    if rows is None:
        return None, None
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

    base = _base_url()
    if not base:
        if _required():
            return (
                [],
                "TRAVELLER_PROFILE_BASE_URL is not set but traveller profile id(s) were sent",
                False,
                [],
            )
        return [], None, False, ids

    err, rows = fetch_byaccount_rows(customer_id)
    if rows is None:
        return [], "Traveller Profile base URL was unset during fetch", False, []
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
                        f"Companion profile Id={tid} not found for customer {customer_id} "
                        "(check OutSystems / byaccount list)"
                    ),
                    True,
                    [],
                )
            continue
        acc = account_id_from_profile(row)
        if acc is not None and int(customer_id) != int(acc):
            return (
                [],
                f"Traveller profile Id={tid} is not linked to the given customer ID",
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
