from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

# In-memory store for demo purposes.
ACCOUNTS = {}
NEXT_ID = 1


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

