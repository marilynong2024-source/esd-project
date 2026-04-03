from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import json
import os
from pathlib import Path

app = Flask(__name__)
CORS(app)

# Optional JSON file (e.g. /app/data/accounts.json + Docker volume) so signups survive container restarts.
ACCOUNT_STORE_PATH = os.environ.get("ACCOUNT_STORE_PATH", "").strip() or None


def _load_accounts_from_disk() -> None:
    global ACCOUNTS, NEXT_ID
    if not ACCOUNT_STORE_PATH:
        return
    path = Path(ACCOUNT_STORE_PATH)
    if not path.is_file():
        return
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        loaded = raw.get("accounts") or {}
        if not isinstance(loaded, dict):
            return
        ACCOUNTS.clear()
        for k, v in loaded.items():
            if isinstance(v, dict):
                ACCOUNTS[int(k)] = v
        if ACCOUNTS:
            ni = raw.get("next_id")
            NEXT_ID = int(ni) if ni is not None else max(ACCOUNTS.keys()) + 1
    except Exception as e:
        print(f"[account] Could not load {ACCOUNT_STORE_PATH}: {e}")


def _save_accounts_to_disk() -> None:
    if not ACCOUNT_STORE_PATH:
        return
    path = Path(ACCOUNT_STORE_PATH)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "accounts": {str(k): v for k, v in ACCOUNTS.items()},
            "next_id": NEXT_ID,
        }
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"[account] Could not save {ACCOUNT_STORE_PATH}: {e}")


# In-memory store for demo purposes (seed aligns with `database/customer_db.sql` / `init_db.sql`).
# Overwritten on startup if ACCOUNT_STORE_PATH file exists.
ACCOUNTS = {
    1: {
        "email": "ava.chen@example.com",
        "firstName": "Ava",
        "lastName": "Chen",
        "phoneNumber": "+6591110001",
        "nationality": "Singapore",
        "dateOfBirth": "1995-02-14",
        "accountStatus": "Active",
        "createdAt": datetime.utcnow().isoformat(),
    },
    2: {
        "email": "ben.kumar@example.com",
        "firstName": "Ben",
        "lastName": "Kumar",
        "phoneNumber": "+6591110002",
        "nationality": "India",
        "dateOfBirth": "1991-08-03",
        "accountStatus": "Active",
        "createdAt": datetime.utcnow().isoformat(),
    },
    3: {
        "email": "casey.tan@example.com",
        "firstName": "Casey",
        "lastName": "Tan",
        "phoneNumber": "+6591110003",
        "nationality": "Malaysia",
        "dateOfBirth": "1998-12-09",
        "accountStatus": "Active",
        "createdAt": datetime.utcnow().isoformat(),
    },
    4: {
        "email": "dana.ng@example.com",
        "firstName": "Dana",
        "lastName": "Ng",
        "phoneNumber": "+6591110004",
        "nationality": "Singapore",
        "dateOfBirth": "1993-05-21",
        "accountStatus": "Active",
        "createdAt": datetime.utcnow().isoformat(),
    },
    5: {
        "email": "evan.lee@example.com",
        "firstName": "Evan",
        "lastName": "Lee",
        "phoneNumber": "+6591110005",
        "nationality": "Singapore",
        "dateOfBirth": "1990-11-02",
        "accountStatus": "Active",
        "createdAt": datetime.utcnow().isoformat(),
    },
    6: {
        "email": "fiona.ong@example.com",
        "firstName": "Fiona",
        "lastName": "Ong",
        "phoneNumber": "+6591110006",
        "nationality": "Singapore",
        "dateOfBirth": "1988-03-30",
        "accountStatus": "Active",
        "createdAt": datetime.utcnow().isoformat(),
    },
}
NEXT_ID = 7

_load_accounts_from_disk()


def to_dict(record_id: int, record: dict) -> dict:
    return {
        "customerID": record_id,
        "email": record.get("email"),
        "firstName": record.get("firstName"),
        "lastName": record.get("lastName"),
        "phoneNumber": record.get("phoneNumber"),
        "nationality": record.get("nationality"),
        "dateOfBirth": record.get("dateOfBirth"),
        "accountStatus": record.get("accountStatus", "Active"),
        "createdAt": record.get("createdAt"),
    }


@app.route("/account/login", methods=["POST"])
def login():
    """
    Demo login: match email to a seeded loyalty account. Password must be non-empty
    but is not verified (course / local demo only).
    """
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    if not email:
        return jsonify({"code": 400, "message": "email is required"}), 400
    if password is None or str(password).strip() == "":
        return jsonify({"code": 401, "message": "password is required"}), 401

    for cid, rec in ACCOUNTS.items():
        if str(rec.get("email") or "").strip().lower() != email:
            continue
        if rec.get("accountStatus") not in (None, "Active"):
            return jsonify({"code": 403, "message": "Account is not active"}), 403
        fn = rec.get("firstName") or ""
        ln = rec.get("lastName") or ""
        display = f"{fn} {ln}".strip() or rec.get("email")
        return (
            jsonify(
                {
                    "code": 200,
                    "data": {
                        "customerID": cid,
                        "email": rec.get("email"),
                        "firstName": rec.get("firstName"),
                        "lastName": rec.get("lastName"),
                        "displayName": display,
                    },
                }
            ),
            200,
        )

    return jsonify({"code": 401, "message": "Unknown email — try a seeded demo account"}), 401


@app.route("/account/signup", methods=["POST"])
def signup():
    """
    Create a new demo loyalty account and return minimal profile details.

    Body: { email, firstName, lastName, phoneNumber?, nationality?, dateOfBirth? }
    """
    global NEXT_ID
    data = request.get_json() or {}
    raw_email = (data.get("email") or "").strip().lower()
    if not raw_email:
        return jsonify({"code": 400, "message": "email is required"}), 400

    # Reject duplicates by email (case-insensitive).
    for rec in ACCOUNTS.values():
        if str(rec.get("email") or "").strip().lower() == raw_email:
            return jsonify({"code": 409, "message": "An account with this email already exists"}), 409

    record_id = NEXT_ID
    NEXT_ID += 1

    record = {
        "email": data.get("email"),
        "firstName": data.get("firstName") or "",
        "lastName": data.get("lastName") or "",
        "phoneNumber": data.get("phoneNumber"),
        "nationality": data.get("nationality"),
        "dateOfBirth": data.get("dateOfBirth"),
        "accountStatus": "Active",
        "createdAt": datetime.utcnow().isoformat(),
    }
    ACCOUNTS[record_id] = record
    _save_accounts_to_disk()

    out = to_dict(record_id, record)
    out["displayName"] = f"{record.get('firstName') or ''} {record.get('lastName') or ''}".strip() or out["email"]
    return jsonify({"code": 201, "data": out}), 201


@app.route("/account/<int:customer_id>", methods=["GET"])
def get_account(customer_id: int):
    record = ACCOUNTS.get(customer_id)
    if not record:
        return jsonify({"code": 404, "message": "Account not found"}), 404
    return jsonify({"code": 200, "data": to_dict(customer_id, record)}), 200


@app.route("/account", methods=["POST"])
def create_account():
    """
    Create a new customer account.
    Body (JSON): { email, firstName, lastName, phoneNumber, nationality, dateOfBirth }
    """
    global NEXT_ID
    data = request.get_json() or {}
    if not data.get("email"):
        return jsonify({"code": 400, "message": "email is required"}), 400

    record_id = NEXT_ID
    NEXT_ID += 1

    record = {
        "email": data.get("email"),
        "firstName": data.get("firstName"),
        "lastName": data.get("lastName"),
        "phoneNumber": data.get("phoneNumber"),
        "nationality": data.get("nationality"),
        "dateOfBirth": data.get("dateOfBirth"),
        "accountStatus": "Active",
        "createdAt": datetime.utcnow().isoformat(),
    }
    ACCOUNTS[record_id] = record
    _save_accounts_to_disk()

    return jsonify({"code": 201, "data": to_dict(record_id, record)}), 201


@app.route("/account/<int:customer_id>", methods=["PUT"])
def update_account(customer_id: int):
    """
    Update basic account information.
    Body (partial JSON): any of { email, firstName, lastName, phoneNumber, nationality, dateOfBirth, accountStatus }
    """
    record = ACCOUNTS.get(customer_id)
    if not record:
        return jsonify({"code": 404, "message": "Account not found"}), 404

    data = request.get_json() or {}
    for field in ["email", "firstName", "lastName", "phoneNumber", "nationality", "dateOfBirth", "accountStatus"]:
        if field in data:
            record[field] = data[field]

    ACCOUNTS[customer_id] = record
    _save_accounts_to_disk()
    return jsonify({"code": 200, "data": to_dict(customer_id, record)}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5100, debug=True)

