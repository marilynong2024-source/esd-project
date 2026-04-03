"""One-off: verify Traveller Profile REST on OutSystems (GET + POST create + PUT/DELETE)."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import requests

# Repo root on path for `travellerprofile.outsystems_client`
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from travellerprofile import outsystems_client as oc  # noqa: E402

BASE = oc._base_url()
HEADERS = {"Content-Type": "application/json"}


def note(name: str, ok: bool, detail: str) -> None:
    sym = "OK" if ok else "FAIL"
    print(f"[{sym}] {name}: {detail}")


def main() -> int:
    # GET GetAllTravellerProfiles
    try:
        r = requests.get(f"{BASE}/GetAllTravellerProfiles", timeout=20)
        if r.status_code == 200:
            data = r.json()
            n = len(data) if isinstance(data, list) else "n/a"
            note("GET GetAllTravellerProfiles", True, f"status={r.status_code}, list_len={n}")
        else:
            note("GET GetAllTravellerProfiles", False, f"status={r.status_code} {r.text[:200]}")
    except Exception as e:
        note("GET GetAllTravellerProfiles", False, str(e))

    # GET byaccount
    try:
        r = requests.get(f"{BASE}/byaccount/7", timeout=20)
        note("GET byaccount/7", r.status_code == 200, f"status={r.status_code} {r.text[:150]}")
    except Exception as e:
        note("GET byaccount/7", False, str(e))

    suffix = str(int(time.time()))[-10:]
    create_body = {
        "CustomerID": 999998,
        "FullName": "API Smoke Test",
        "PassportNumber": f"Z{suffix}A",
        "PassportExpiry": "2032-01-15",
        "DateOfBirth": "1992-06-01",
        "Nationality": "Singaporean",
        "SeatPreference": "Aisle",
        "MealPreference": "Standard",
        "EmergencyContactName": "Test Contact",
        "EmergencyContactPhone": "90000001",
        "Relationship": "self",
    }
    new_id: int | None = None
    try:
        created = oc.create_traveller_profile(create_body)
        if isinstance(created, dict) and created.get("_error"):
            note("POST CreateTravellerProfile (client)", False, str(created.get("_error")))
        else:
            if isinstance(created, dict):
                raw = created.get("Id") or created.get("TravellerProfileId")
                if raw is not None:
                    new_id = int(raw)
            note("POST CreateTravellerProfile (client)", True, f"new_id={new_id} data={str(created)[:200]}")
    except Exception as e:
        note("POST CreateTravellerProfile (client)", False, str(e))

    if new_id is not None:
        upd = {
            "CustomerID": 999998,
            "Id": new_id,
            "TravellerProfileId": new_id,
            "FullName": "API Smoke Test Updated",
            "PassportNumber": create_body["PassportNumber"],
            "PassportExpiry": create_body["PassportExpiry"],
            "DateOfBirth": create_body["DateOfBirth"],
            "Nationality": "Singaporean",
            "MealPreference": "Vegetarian",
        }
        out = oc.update_traveller_profile(upd)
        ok = isinstance(out, dict) and not out.get("_error")
        note(
            "PUT UpdateTravellerProfile?TravellerProfileID= (via client)",
            ok,
            str(out)[:220] if ok else str((out or {}).get("_error", out))[:220],
        )
    else:
        note("PUT UpdateTravellerProfile (client)", False, "skipped (no Id from create)")

    if new_id is not None:
        dele = {"CustomerID": 999998, "Id": new_id, "TravellerProfileId": new_id}
        out = oc.delete_traveller_profile(dele)
        ok = isinstance(out, dict) and not out.get("_error")
        note(
            "DELETE DeleteTravellerProfile?TravellerProfileID= (via client)",
            ok,
            str(out)[:220] if ok else str((out or {}).get("_error", out))[:220],
        )
    else:
        note("DELETE DeleteTravellerProfile (client)", False, "skipped (no Id from create)")

    # Raw REST verbs (usually not how OutSystems exposes actions)
    try:
        r = requests.put(
            f"{BASE}/UpdateTravellerProfile",
            json={"Id": 1},
            headers=HEADERS,
            timeout=15,
        )
        note(
            "HTTP PUT without ?TravellerProfileID=",
            r.status_code == 400,
            f"status={r.status_code} (400 expected — OS requires ?TravellerProfileID=)",
        )
    except Exception as e:
        note("HTTP PUT without query", False, str(e))

    try:
        r = requests.delete(f"{BASE}/DeleteTravellerProfile", timeout=15)
        note(
            "HTTP DELETE without ?TravellerProfileID=",
            r.status_code == 400,
            f"status={r.status_code} (400 expected — OS requires ?TravellerProfileID=)",
        )
    except Exception as e:
        note("HTTP DELETE without query", False, str(e))

    print()
    print(
        "This module: GET reads; POST CreateTravellerProfile; "
        "PUT UpdateTravellerProfile?TravellerProfileID=; DELETE DeleteTravellerProfile?TravellerProfileID="
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
