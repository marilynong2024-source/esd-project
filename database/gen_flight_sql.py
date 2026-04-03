"""One-off: regenerate flight_db seed from flight/app.py in-memory catalog."""

import importlib.util
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

spec = importlib.util.spec_from_file_location("flight_app", ROOT / "flight" / "app.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

rows = []
for fn in sorted(mod.FLIGHTS.keys()):
    f = mod.FLIGHTS[fn]
    mo = re.match(r"^([A-Z0-9]{2})", str(fn).upper())
    ac = (mo.group(1) if mo else str(fn)[:2])[:10]
    an = str(f.get("airline") or "Airline").replace("'", "''")[:79]
    at = "BigAirline" if f.get("businessPrice") else "Budget"
    o = f.get("origin", "")
    d = f.get("destination", "")
    dep = str(f.get("departureTime", "")).replace("T", " ")
    arr = str(f.get("arrivalTime", "")).replace("T", " ")
    if len(dep) == 16:
        dep += ":00"
    if len(arr) == 16:
        arr += ":00"
    fare = "Flexi" if at == "BigAirline" else "Saver"
    ref = 1 if at == "BigAirline" else 0
    cc = 150.0 if ref else 0.0
    bp = float(f.get("economyPrice") or 0)
    seats = int(f.get("availableSeats") or 0)
    rows.append(
        f"('{fn}', '{ac}', '{an}', '{at}', '{o}', '{d}', '{dep}', '{arr}', "
        f"'{fare}', {ref}, {cc:.2f}, 300.00, {bp:.2f}, {seats})"
    )

header = (
    "-- Auto-generated from flight/app.py catalog (run: python database/gen_flight_sql.py)\n"
    "INSERT INTO flights "
    "(flight_num, airline_code, airline_name, airline_type, origin, destination, "
    "departure_time, arrival_time, fare_class, refundable, cancellation_charge, "
    "no_show_fee, base_price, available_seats) VALUES\n"
)
Path(__file__).with_name("flight_db_generated.sql").write_text(
    header + ",\n".join(rows) + ";\n", encoding="utf-8"
)
print(f"Wrote {len(rows)} rows to flight_db_generated.sql")
