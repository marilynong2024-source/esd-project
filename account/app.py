from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

# In-memory store for demo purposes (seed aligns with `database/customer_db.sql` / `init_db.sql`).
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
    return jsonify({"code": 200, "data": to_dict(customer_id, record)}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5100, debug=True)

