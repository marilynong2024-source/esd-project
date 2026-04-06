"""
Extra demo hotels (IDs 34+): shared by hotel/app.py and scripts/emit_extra_hotels_sql.py.
Aligned with flight destination cities where possible.
"""
from __future__ import annotations

from typing import Any


def _slug(s: str) -> str:
    return "".join(c if c.isalnum() else "" for c in s.lower())[:24] or "x"


# (city, country, area_street_hint)
_CITIES: list[tuple[str, str, str]] = [
    ("Manila", "Philippines", "Roxas Blvd, Pasay"),
    ("Ho Chi Minh City", "Vietnam", "District 1, Le Loi"),
    ("Hanoi", "Vietnam", "Hoan Kiem, Hang Bai"),
    ("Jakarta", "Indonesia", "Thamrin, Central Jakarta"),
    ("Kuala Lumpur", "Malaysia", "KLCC, Jalan Ampang"),
    ("Hong Kong", "Hong Kong SAR", "Tsim Sha Tsui, Nathan Road"),
    ("Taipei", "Taiwan", "Xinyi District, Songren Rd"),
    ("Auckland", "New Zealand", "Waterfront, Viaduct Harbour"),
    ("Melbourne", "Australia", "CBD, Collins Street"),
    ("Perth", "Australia", "Elizabeth Quay"),
    ("Brisbane", "Australia", "South Bank"),
    ("Los Angeles", "USA", "Downtown, Figueroa St"),
    ("New York", "USA", "Midtown, West 44th St"),
    ("San Francisco", "USA", "Union Square, Powell St"),
    ("Frankfurt", "Germany", "Innenstadt, Zeil"),
    ("Zurich", "Switzerland", "Altstadt, Limmatquai"),
    ("Amsterdam", "Netherlands", "Centrum, Damrak"),
    ("Rome", "Italy", "Centro, Via Nazionale"),
    ("Barcelona", "Spain", "Eixample, Passeig de Gracia"),
    ("Madrid", "Spain", "Salamanca, Calle Serrano"),
    ("Vienna", "Austria", "Innere Stadt, Ringstrasse"),
    ("Istanbul", "Turkey", "Beyoglu, Istiklal Caddesi"),
    ("Mumbai", "India", "Bandra Kurla Complex"),
    ("Delhi", "India", "Connaught Place"),
    ("Chennai", "India", "OMR, Sholinganallur"),
    ("Phuket", "Thailand", "Patong Beach Road"),
    ("Chiang Mai", "Thailand", "Old City, Ratchadamnoen"),
    ("Danang", "Vietnam", "My Khe Beach, Vo Nguyen Giap"),
    ("Osaka", "Japan", "Namba, Dotonbori"),
    ("Kyoto", "Japan", "Higashiyama, Gion"),
    ("Sapporo", "Japan", "Susukino, Minami"),
    ("Nagoya", "Japan", "Sakae, Naka Ward"),
    ("Christchurch", "New Zealand", "Central City, Cathedral Square"),
    ("Wellington", "New Zealand", "Lambton Harbour"),
    ("Penang", "Malaysia", "George Town, Armenian St"),
    ("Langkawi", "Malaysia", "Pantai Cenang"),
    ("Doha", "Qatar", "West Bay, Corniche"),
    ("Cairo", "Egypt", "Zamalek, 26th July St"),
    ("Johannesburg", "South Africa", "Sandton, Rivonia Rd"),
    ("Nairobi", "Kenya", "Westlands, Waiyaki Way"),
    ("Buenos Aires", "Argentina", "Recoleta, Avenida Santa Fe"),
    ("Santiago", "Chile", "Las Condes, Apoquindo"),
    ("Mexico City", "Mexico", "Polanco, Masaryk"),
    ("Toronto", "Canada", "Downtown, Front St"),
    ("Vancouver", "Canada", "Coal Harbour"),
    ("Honolulu", "USA", "Waikiki, Kalakaua Ave"),
    ("Seattle", "USA", "Belltown, 4th Ave"),
    ("Chicago", "USA", "Loop, Michigan Ave"),
    ("Boston", "USA", "Back Bay, Newbury St"),
    ("Miami", "USA", "South Beach, Ocean Drive"),
    ("Las Vegas", "USA", "The Strip"),
]


def _amenities_for_stars(stars: int) -> str:
    if stars >= 5:
        return "WiFi,Pool,Spa,Gym,Restaurant,Bar"
    if stars == 4:
        return "WiFi,Pool,Gym,Restaurant,Bar"
    return "WiFi,Restaurant"


_UPSCALE_BRANDS = (
    "Pullman",
    "Sofitel",
    "Grand Hyatt",
    "JW Marriott",
    "The Ritz-Carlton",
)
_MID_BRANDS = (
    "Novotel",
    "Holiday Inn",
    "Mercure",
    "Courtyard",
    "ibis Styles",
)


def build_extra_catalog() -> list[dict[str, Any]]:
    """Returns ordered list of hotel specs starting at hotelID START_ID."""
    rows: list[dict[str, Any]] = []
    hid = START_ID
    for city, country, area in _CITIES:
        sl = _slug(city + country[:2])
        # Upscale + mid — two per city for density
        for _tier, stars, _suffix, std_p, dlx_p in (
            ("Grand", 5, "Tower", 120 + len(rows) % 80, 220 + len(rows) % 120),
            ("Harbour", 4, "Hotel", 75 + len(rows) % 55, 130 + len(rows) % 90),
        ):
            if stars >= 5:
                brand = _UPSCALE_BRANDS[hid % len(_UPSCALE_BRANDS)]
                name = f"{brand} {city}"
            else:
                brand = _MID_BRANDS[hid % len(_MID_BRANDS)]
                name = f"{brand} {city} City Centre"
            neighbourhood = area.split(",")[0].strip()
            desc = (
                f"{stars}-star stay at {brand}, near {neighbourhood} ({city}). "
                "Demo inventory for Horizon — Wi-Fi, late checkout, and breakfast bundles available."
            )
            seed = f"xh{hid}-{sl}"
            std_r = 28 + (hid % 15)
            dlx_r = 14 + (hid % 10)
            rows.append(
                {
                    "hotelID": hid,
                    "name": name,
                    "city": city,
                    "country": country,
                    "address": f"{100 + hid % 90} {area}",
                    "starRating": stars,
                    "description": desc,
                    "imageUrl": f"https://picsum.photos/seed/{seed}/400/300",
                    "amenities": _amenities_for_stars(stars),
                    "std_price": float(std_p),
                    "dlx_price": float(dlx_p),
                    "std_rooms": std_r,
                    "dlx_rooms": dlx_r,
                }
            )
            hid += 1
    return rows


START_ID = 34


def max_extra_hotel_id() -> int:
    cat = build_extra_catalog()
    return int(cat[-1]["hotelID"]) if cat else 33


def hotel_dict_for_app(spec: dict[str, Any]) -> dict[str, Any]:
    def room(code: str, type_name: str, price: float, breakfast: bool, avail: int) -> dict[str, Any]:
        return {
            "code": code,
            "label": f"{type_name} Room",
            "pricePerNight": float(price),
            "includesBreakfast": bool(breakfast),
            "availableRooms": int(avail),
        }

    rt = [
        room("STD", "Standard", spec["std_price"], False, spec["std_rooms"]),
        room("DLX", "Deluxe", spec["dlx_price"], True, spec["dlx_rooms"]),
    ]
    return {
        "hotelID": spec["hotelID"],
        "name": spec["name"],
        "city": spec["city"],
        "country": spec["country"],
        "address": spec["address"],
        "starRating": spec["starRating"],
        "description": spec["description"],
        "imageUrl": spec["imageUrl"],
        "amenities": spec["amenities"],
        "roomTypes": rt,
        "availableRooms": 5,
    }


def hotels_dict_for_app() -> dict[int, dict[str, Any]]:
    return {s["hotelID"]: hotel_dict_for_app(s) for s in build_extra_catalog()}


def sql_escape(s: str) -> str:
    return str(s).replace("'", "''").replace("\\", "\\\\")


def emit_sql() -> str:
    specs = build_extra_catalog()
    hv = []
    for s in specs:
        hv.append(
            "('"
            + sql_escape(s["name"])
            + "', '"
            + sql_escape(s["city"])
            + "', '"
            + sql_escape(s["country"])
            + "', '"
            + sql_escape(s["address"])
            + "', "
            + str(int(s["starRating"]))
            + ", '"
            + sql_escape(s["description"])
            + "', '"
            + sql_escape(s["imageUrl"])
            + "', '"
            + sql_escape(s["amenities"])
            + "')"
        )
    rv = []
    for s in specs:
        hid = s["hotelID"]
        rv.append(
            f"({hid}, 'Standard', {s['std_price']:.2f}, 2, 40, {s['std_rooms']}, 'Standard room', 'https://picsum.photos/seed/r{hid}a/400/300')"
        )
        rv.append(
            f"({hid}, 'Deluxe', {s['dlx_price']:.2f}, 2, 25, {s['dlx_rooms']}, 'Deluxe room', 'https://picsum.photos/seed/r{hid}b/400/300')"
        )
    return (
        "USE HotelDB;\n"
        "INSERT INTO Hotel (name, city, country, address, starRating, description, imageUrl, amenities) VALUES\n"
        + ",\n".join(hv)
        + ";\n\n"
        "INSERT INTO RoomType (hotelID, typeName, pricePerNight, maxGuests, totalRooms, availableRooms, description, imageUrl) VALUES\n"
        + ",\n".join(rv)
        + ";\n"
    )
