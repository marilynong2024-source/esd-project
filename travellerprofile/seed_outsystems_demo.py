#!/usr/bin/env python3
"""
Create fake Traveller Profile rows in OutSystems (CreateTravellerProfile REST).

Aligns CustomerID with the HTML demo (customers 1–5) so GET …/byaccount/{id}
returns several people for some accounts.

Usage (repo root):

  pip install requests
  python travellerprofile/seed_outsystems_demo.py

Env:

  TRAVELLER_PROFILE_BASE_URL — optional; defaults to the URL in outsystems_client.py
"""

from __future__ import annotations

import os
import sys
from typing import Any

import requests

# Same default as outsystems_client.py
_DEFAULT_BASE = (
    "https://personal-zhhppbon.outsystemscloud.com/"
    "TravellerProfileService/rest/TravellerProfileAPI"
)


def base_url() -> str:
    return os.environ.get("TRAVELLER_PROFILE_BASE_URL", _DEFAULT_BASE).strip().rstrip("/")


def row(
    customer_id: int,
    full_name: str,
    passport: str,
    *,
    dob: str = "1995-06-01",
    nationality: str = "Singaporean",
    seat: str = "Window",
    meal: str = "None",
    emergency: str = "Demo Contact",
    emergency_phone: str = "90000000",
    relationship: str = "Family",
    passport_expiry: str = "2030-12-31",
) -> dict[str, Any]:
    return {
        "CustomerID": int(customer_id),
        "FullName": full_name,
        "PassportNumber": passport,
        "PassportExpiry": passport_expiry,
        "DateOfBirth": dob,
        "Nationality": nationality,
        "SeatPreference": seat,
        "MealPreference": meal,
        "EmergencyContactName": emergency,
        "EmergencyContactPhone": emergency_phone,
        "Relationship": relationship,
    }


# Multiple companions per customer — passports must be unique for your OS module rules.
SEED: list[tuple[int, list[dict[str, Any]]]] = [
    (
        1,
        [
            row(1, "Liam Chen", "DEMO01SGP10001", dob="1992-07-11", meal="Halal"),
            row(1, "Maya Chen", "DEMO01SGP10002", dob="2018-03-20", meal="Child meal"),
        ],
    ),
    (
        2,
        [
            row(2, "Priya Kumar", "DEMO02IND20001", nationality="Indian", meal="Vegetarian"),
        ],
    ),
    (
        3,
        [
            row(3, "Alex Tan", "DEMO03MYS30001", nationality="Malaysian"),
            row(3, "Sam Tan", "DEMO03MYS30002", nationality="Malaysian", seat="Aisle"),
        ],
    ),
    (
        4,
        [
            row(4, "Jordan Lee", "DEMO04SGP40001"),
        ],
    ),
    (
        5,
        [
            row(5, "Robin Ho", "DEMO05SGP50001", meal="Vegan"),
            row(5, "Taylor Ho", "DEMO05SGP50002", seat="Aisle", meal="None"),
            row(5, "Casey Ho", "DEMO05SGP50003", dob="2015-11-08", meal="Child meal"),
        ],
    ),
]


def create_one(payload: dict[str, Any]) -> tuple[bool, str]:
    url = f"{base_url()}/CreateTravellerProfile"
    try:
        r = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=20,
        )
        body = (r.text or "")[:500]
        if r.status_code in (200, 201):
            return True, f"HTTP {r.status_code} {body}"
        return False, f"HTTP {r.status_code} {body}"
    except requests.RequestException as e:
        return False, str(e)


def main() -> int:
    b = base_url()
    print(f"Base URL: {b}\n")
    ok_n = 0
    fail_n = 0

    for customer_id, profiles in SEED:
        for p in profiles:
            name = p.get("FullName", "?")
            success, msg = create_one(p)
            if success:
                ok_n += 1
                print(f"[OK] Customer {customer_id} · {name} — {msg}")
            else:
                fail_n += 1
                print(f"[FAIL] Customer {customer_id} · {name} — {msg}")

    print(f"\nDone: {ok_n} ok, {fail_n} failed.")
    print("\nVerify with:")
    print(f"  GET {b}/byaccount/1")
    print(f"  GET {b}/byaccount/5   (three companions)")
    return 0 if fail_n == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
