"""Print SQL to append to init_db.sql after the bulk HotelDB RoomType block (hotel 33)."""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "hotel"))

from extra_hotels_data import emit_sql  # noqa: E402

if __name__ == "__main__":
    print(emit_sql())
