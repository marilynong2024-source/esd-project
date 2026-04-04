"""One-off generator: prints SQL bulk seed fragments for init_db.sql (stdout)."""
from __future__ import annotations

import random
from datetime import datetime, timedelta

random.seed(42)

# Extra flights: varied routes, 2025-09 through 2026-11
extra_routes = [
    ("SIN", "HKG", "Singapore", "Hong Kong", 230, 220, 980),
    ("HKG", "SIN", "Hong Kong", "Singapore", 235, 210, 960),
    ("SIN", "ICN", "Singapore", "Seoul", 360, 380, 1100),
    ("ICN", "SIN", "Seoul", "Singapore", 355, 360, 1080),
    ("SIN", "DXB", "Singapore", "Dubai", 420, 520, 2100),
    ("DXB", "SIN", "Dubai", "Singapore", 415, 500, 2050),
    ("SIN", "FRA", "Singapore", "Frankfurt", 780, 720, 3400),
    ("SIN", "ZRH", "Singapore", "Zurich", 790, 730, 3500),
    ("NRT", "LAX", "Tokyo", "Los Angeles", 600, 890, 6200),
    ("LAX", "NRT", "Los Angeles", "Tokyo", 605, 870, 6100),
    ("SIN", "MEL", "Singapore", "Melbourne", 450, 410, 1180),
    ("MEL", "SIN", "Melbourne", "Singapore", 445, 400, 1160),
    ("BKK", "HKT", "Bangkok", "Phuket", 85, 95, 320),
    ("SIN", "CGK", "Singapore", "Jakarta", 110, 125, 420),
    ("CGK", "SIN", "Jakarta", "Singapore", 105, 118, 400),
    ("SIN", "KUL", "Singapore", "Kuala Lumpur", 55, 88, 260),
    ("KUL", "SIN", "Kuala Lumpur", "Singapore", 58, 85, 250),
    ("LHR", "JFK", "London", "New York", 480, 780, 5200),
    ("JFK", "LHR", "New York", "London", 475, 760, 5100),
    ("SYD", "AKL", "Sydney", "Auckland", 195, 195, 680),
    ("AKL", "SYD", "Auckland", "Sydney", 200, 188, 660),
    ("SIN", "HAN", "Singapore", "Hanoi", 195, 210, 640),
    ("DPS", "PER", "Bali", "Perth", 240, 285, 720),
    ("SIN", "TPE", "Singapore", "Taipei", 280, 310, 820),
    ("TPE", "NRT", "Taipei", "Tokyo", 195, 340, 980),
]

carriers = [
    ("SQ", "Singapore Airlines"),
    ("TR", "Scoot"),
    ("3K", "Jetstar Asia"),
    ("CX", "Cathay Pacific"),
    ("KA", "Cathay Dragon"),
    ("KE", "Korean Air"),
    ("OZ", "Asiana Airlines"),
    ("EK", "Emirates"),
    ("QF", "Qantas"),
    ("JL", "Japan Airlines"),
    ("NH", "ANA"),
    ("TG", "Thai Airways"),
    ("GA", "Garuda Indonesia"),
    ("MH", "Malaysia Airlines"),
    ("BA", "British Airways"),
    ("AA", "American Airlines"),
    ("UA", "United Airlines"),
]


def flight_rows(n_target=72):
    rows = []
    base = datetime(2025, 9, 1, 8, 0, 0)
    fn = 9000
    for i in range(n_target):
        o, d, oc, dc, dmins, eco, bus = random.choice(extra_routes)
        code, airline = random.choice(carriers)
        dep = base + timedelta(days=i % 120, hours=(i * 3) % 17)
        arr = dep + timedelta(minutes=dmins + random.randint(-20, 25))
        num = f"{code}{fn % 9000 + 100}"
        fn += 17
        biz = round(bus * (0.85 + random.random() * 0.2), 2) if bus else None
        seats = random.choice([180, 200, 250, 300])
        avail = max(20, seats - random.randint(0, seats // 2))
        biz_sql = "NULL" if biz is None else f"{biz:.2f}"
        rows.append(
            f"('{num}', '{airline}', '{o}', '{d}', '{oc}', '{dc}', "
            f"'{dep:%Y-%m-%d %H:%M:%S}', '{arr:%Y-%m-%d %H:%M:%S}', {dmins}, {eco:.2f}, {biz_sql}, {seats}, {avail})"
        )
    return rows


def main():
    print("-- ========== BULK SEED (generated) ==========")
    print("USE FlightDB;")
    print("INSERT INTO Flight (flightNumber, airline, origin, destination, originCity, destinationCity, departureTime, arrivalTime, durationMins, economyPrice, businessPrice, totalSeats, availableSeats) VALUES")
    fr = flight_rows(78)
    print(",\n".join(fr) + ";")

    print()
    print("USE HotelDB;")
    print(
        """INSERT INTO Hotel (name, city, country, address, starRating, description, imageUrl, amenities) VALUES
('Gangnam Towers Seoul', 'Seoul', 'South Korea', '123 Teheran-ro, Gangnam, Seoul', 5, 'Glass tower suites near COEX and nightlife.', 'https://picsum.photos/seed/h-seoul1/400/300', 'WiFi,Pool,Gym,Spa'),
('Han River Stay', 'Seoul', 'South Korea', '45 Banpo-daero, Seocho, Seoul', 4, 'Riverside rooms with skyline views.', 'https://picsum.photos/seed/h-seoul2/400/300', 'WiFi,Gym,Restaurant'),
('Myeongdong Express Inn', 'Seoul', 'South Korea', '8 Myeongdong 10-gil, Seoul', 3, 'Walk to shopping and metro.', 'https://picsum.photos/seed/h-seoul3/400/300', 'WiFi,Restaurant'),
('Burj District Grand', 'Dubai', 'UAE', 'Sheikh Zayed Road, Downtown Dubai', 5, 'Pool deck with Burj Khalifa glimpses.', 'https://picsum.photos/seed/h-dxb1/400/300', 'WiFi,Pool,Spa,Gym'),
('Deira Creek Hotel', 'Dubai', 'UAE', 'Baniyas Road, Deira', 4, 'Traditional souk access and creek views.', 'https://picsum.photos/seed/h-dxb2/400/300', 'WiFi,Pool,Restaurant'),
('Marina Budget Suites', 'Dubai', 'UAE', 'Dubai Marina Walk', 3, 'Compact studios near beach tram.', 'https://picsum.photos/seed/h-dxb3/400/300', 'WiFi,Gym'),
('Victoria Peak Lodge', 'Hong Kong', 'Hong Kong SAR', '100 Peak Road, Hong Kong', 5, 'Quiet luxury above the harbour mist.', 'https://picsum.photos/seed/h-hkg1/400/300', 'WiFi,Spa,Restaurant,Bar'),
('TST Harbour Inn', 'Hong Kong', 'Hong Kong SAR', '36 Nathan Road, Tsim Sha Tsui', 4, 'Ferry and MTR steps away.', 'https://picsum.photos/seed/h-hkg2/400/300', 'WiFi,Gym,Restaurant'),
('Mong Kok City Hostel', 'Hong Kong', 'Hong Kong SAR', '88 Argyle Street, Mong Kok', 2, 'Bright pods for urban explorers.', 'https://picsum.photos/seed/h-hkg3/400/300', 'WiFi'),
('Raffles Arcade Hotel', 'Singapore', 'Singapore', '1 Beach Road, Singapore', 5, 'Colonial charm meets modern spa.', 'https://picsum.photos/seed/h-sin4/400/300', 'WiFi,Pool,Spa,Bar'),
('Clarke Quay Riverside', 'Singapore', 'Singapore', '3 River Valley Road', 4, 'Nightlife and boat quay on doorstep.', 'https://picsum.photos/seed/h-sin5/400/300', 'WiFi,Pool,Restaurant'),
('Changi Village Lodge', 'Singapore', 'Singapore', '1 Changi Village Rd', 3, 'Near airport connector and coastal park.', 'https://picsum.photos/seed/h-sin6/400/300', 'WiFi,Restaurant');"""
    )

    # hotelIDs 22-33: two room types each
    print(
        """INSERT INTO RoomType (hotelID, typeName, pricePerNight, maxGuests, totalRooms, availableRooms, description, imageUrl) VALUES
(22, 'Standard', 210, 2, 40, 28, 'Gangnam standard', 'https://picsum.photos/seed/r22a/400/300'),
(22, 'Deluxe', 340, 2, 25, 14, 'Corner deluxe', 'https://picsum.photos/seed/r22b/400/300'),
(23, 'Standard', 160, 2, 55, 40, 'River standard', 'https://picsum.photos/seed/r23a/400/300'),
(23, 'Deluxe', 240, 2, 30, 18, 'River deluxe', 'https://picsum.photos/seed/r23b/400/300'),
(24, 'Standard', 95, 2, 60, 50, 'Compact urban', 'https://picsum.photos/seed/r24a/400/300'),
(25, 'Standard', 420, 2, 35, 22, 'Dubai tower standard', 'https://picsum.photos/seed/r25a/400/300'),
(25, 'Suite', 980, 3, 12, 6, 'Skyline suite', 'https://picsum.photos/seed/r25b/400/300'),
(26, 'Standard', 180, 2, 45, 32, 'Creek view', 'https://picsum.photos/seed/r26a/400/300'),
(27, 'Standard', 120, 2, 80, 65, 'Marina studio', 'https://picsum.photos/seed/r27a/400/300'),
(28, 'Standard', 520, 2, 20, 12, 'Peak standard', 'https://picsum.photos/seed/r28a/400/300'),
(28, 'Deluxe', 780, 2, 12, 7, 'Harbour deluxe', 'https://picsum.photos/seed/r28b/400/300'),
(29, 'Standard', 280, 2, 50, 35, 'TST standard', 'https://picsum.photos/seed/r29a/400/300'),
(30, 'Standard', 75, 2, 100, 88, 'Hostel double', 'https://picsum.photos/seed/r30a/400/300'),
(31, 'Standard', 340, 2, 30, 18, 'Raffles wing', 'https://picsum.photos/seed/r31a/400/300'),
(31, 'Suite', 920, 3, 10, 4, 'Heritage suite', 'https://picsum.photos/seed/r31b/400/300'),
(32, 'Standard', 220, 2, 40, 25, 'Quay standard', 'https://picsum.photos/seed/r32a/400/300'),
(33, 'Standard', 140, 2, 50, 42, 'Airport zone', 'https://picsum.photos/seed/r33a/400/300');"""
    )

    print()
    print("USE CustomerDB;")
    extra_customers = []
    first_names = (
        "Grace Noah Olivia Liam Sophia Mason Emma Lucas Mia Elijah Harper James Evelyn Benjamin"
        " Charlotte Henry Amelia Alexander Sofia Sebastian Chloe Jack Victoria Daniel Hannah"
    ).split()
    last_names = (
        "Ng Lim Wong Tan Goh Koh Ho Teo Chan Lim Cheong Bautista Reyes Santos Cruz Flores"
        " Murphy Walsh O'Brien Jensen Larsen Patel Shah Khan Ali Russo Costa Silva"
    ).split()
    for i in range(7, 51):
        fn = first_names[(i - 7) % len(first_names)]
        ln = last_names[(i - 7) % len(last_names)]
        email = f"{fn.lower()}.{ln.lower()}.{i}@example.com"
        nat = random.choice(
            ["Singapore", "Malaysia", "India", "Philippines", "Australia", "UK", "USA", "Vietnam", "Indonesia"]
        )
        y = 1975 + (i % 28)
        m = 1 + (i % 12)
        d = 1 + (i % 28)
        extra_customers.append(
            f"('{email}', '$2b$demo_hash_{i}', '{fn}', '{ln}', '+6591{i:07d}', '{y}-{m:02d}-{d:02d}', '{nat}', 'Active')"
        )
    print(
        "INSERT INTO customer_accounts (email, password_hash, first_name, last_name, phone_number, date_of_birth, nationality, account_status) VALUES\n"
        + ",\n".join(extra_customers)
        + ";"
    )
    print(
        "INSERT INTO CustomerProfile (customerID, Nationality, CreatedAt, AccountStatus)\n"
        "SELECT customer_id, nationality, created_at, account_status FROM customer_accounts WHERE customer_id >= 7;"
    )

    print()
    print("USE TravellerDB;")
    meals = ["None", "Vegetarian", "Halal", "Vegan", "Kosher", "Gluten-free", "Child meal"]
    tp = []
    pid = 400
    # Extra profiles only (init_db.sql already seeds Ava/Liam for 1, Ben for 2).
    for cid in range(3, 51):
        n = 2 if cid <= 20 else 1
        for j in range(n):
            name_f = first_names[(cid + j) % len(first_names)]
            name_l = last_names[(pid + j) % len(last_names)]
            full = f"{name_f} {name_l}"
            pp = f"X{pid:07d}{chr(65 + (pid % 26))}"
            nat = random.choice(["Singapore", "Malaysia", "India", "UK", "USA", "Japan", "Australia"])
            y, m, d = 1980 + (pid % 30), 1 + (pid % 12), 1 + (pid % 25)
            meal = meals[pid % len(meals)]
            tp.append(f"({cid}, '{full}', '{pp}', '{nat}', '{y}-{m:02d}-{d:02d}', '{meal}')")
            pid += 1
    print(
        "INSERT INTO TravellerProfiles (CustomerID, FullName, PassportNumber, Nationality, DateOfBirth, MealPreference) VALUES\n"
        + ",\n".join(tp)
        + ";"
    )

    print()
    print("USE travel_booking;")
    flights = [
        "SQ001",
        "SQ634",
        "SQ636",
        "SQ706",
        "TR808",
        "SQ322",
        "SQ221",
        "SQ944",
        "SQ635",
        "KE658",
        "JL414",
        "NH217",
        "QF454",
        "PR501",
        "OZ752",
    ]
    statuses = ["CONFIRMED"] * 55 + ["CANCELLED"] * 8 + ["PENDING"] * 4
    roomt = ["STD", "DLX", "STD", "DLX", "SUITE"]
    fares = ["Saver", "Standard", "Flexi"]
    bk2 = []
    for i in range(4, 68):
        cid = 1 + (i % 48)
        fid = flights[i % len(flights)]
        hid = 1 + (i % 33)
        rt = roomt[i % len(roomt)]
        brk = 1 if i % 4 == 0 else 0
        dep = f"2026-{(i % 12) + 1:02d}-{(i % 27) + 1:02d}T{(8 + i % 12):02d}:00:00"
        price = round(600 + (i * 37) % 4200 + (i % 7) * 13, 2)
        fare = fares[i % len(fares)]
        tier = random.choice(["Bronze", "Silver", "Gold", "Platinum", ""])
        st = statuses[i % len(statuses)]
        pname = f"Guest Booker {i}"
        email = f"booker{i}@example.com"
        phone = f"+658{i:07d}"
        refund_p = "NULL" if st != "CANCELLED" else ("25" if i % 2 == 0 else "0")
        refund_a = "NULL" if st != "CANCELLED" else str(round(price * 0.35, 2))
        tier_sql = "NULL" if not tier else f"'{tier}'"
        bk2.append(
            f"({cid}, '{fid}', {hid}, '{rt}', {brk}, '{dep}', {price}, 'SGD', '{fare}', {tier_sql}, "
            f"'{st}', {refund_p}, {refund_a}, NULL, NULL, NULL, NULL, '{pname}', '{email}', '{phone}', 1)"
        )

    print(
        "INSERT INTO bookings (customerID, flightID, hotelID, hotelRoomType, hotelIncludesBreakfast, "
        "departureTime, totalPrice, currency, fareType, loyaltyTier, status, refundPercentage, refundAmount, "
        "seatNumber, travellerProfileId, travellerDisplayName, travellerProfileIdsJson, passengerName, passengerEmail, passengerPhone, noOfRooms) VALUES\n"
        + ",\n".join(bk2)
        + ";"
    )

    bundles = [
        ("PKG_ICN", "Seoul to Singapore", "Seoul", "Singapore", 5, "K-culture to hawker crawl", 18),
        ("PKG_DXB_LON", "Dubai to London", "Dubai", "London", 5, "Desert hub to Thames", 19),
        ("PKG_AMS_LON", "Amsterdam to London", "Amsterdam", "London", 3, "Schiphol Euro hop", 20),
        ("PKG_AMS_SIN", "Amsterdam to Singapore", "Amsterdam", "Singapore", 7, "Canals to Marina Bay", 21),
        ("PKG_SFO_SIN", "San Francisco to Singapore", "San Francisco", "Singapore", 7, "Pacific crossing", 22),
        ("PKG_LAX_TYO", "Los Angeles to Tokyo", "Los Angeles", "Tokyo", 6, "US West to Japan", 23),
        ("PKG_SGN_SIN", "Ho Chi Minh City to Singapore", "Ho Chi Minh City", "Singapore", 4, "Mekong delta link", 24),
        ("PKG_HAN_BKK", "Hanoi to Bangkok", "Hanoi", "Bangkok", 5, "Two capitals contrast", 25),
        ("PKG_CGK_SIN", "Jakarta to Singapore", "Jakarta", "Singapore", 3, "Java neighbour hop", 26),
        ("PKG_MAA_SIN", "Chennai to Singapore", "Chennai", "Singapore", 4, "South India connector", 27),
        ("PKG_MNL_SIN", "Manila to Singapore", "Manila", "Singapore", 4, "Luzon gateway", 28),
        ("PKG_FRA_SIN", "Frankfurt to Singapore", "Frankfurt", "Singapore", 7, "Rhine-Main to tropics", 29),
        ("PKG_TYO_SYD", "Tokyo to Sydney", "Tokyo", "Sydney", 7, "Pacific rim cities", 30),
        ("PKG_LON_SIN", "London to Singapore", "London", "Singapore", 7, "UK to Lion City", 31),
        ("PKG_BKK_TYO", "Bangkok to Tokyo", "Bangkok", "Tokyo", 5, "Temples to neon", 32),
        ("PKG_PAR_TYO", "Paris to Tokyo", "Paris", "Tokyo", 7, "Seine to Shibuya", 33),
        ("PKG_TYO_SIN", "Tokyo to Singapore", "Tokyo", "Singapore", 5, "Return Lion City hop", 34),
        ("PKG_BKK_SIN2", "Bangkok to Singapore", "Bangkok", "Singapore", 3, "Weekend reverse leg", 35),
        ("PKG_DPS_SIN", "Bali to Singapore", "Bali", "Singapore", 4, "Island to city", 36),
        ("PKG_KUL_SIN", "Kuala Lumpur to Singapore", "Kuala Lumpur", "Singapore", 2, "Short neighbour hop", 37),
    ]
    print()
    print(
        "INSERT INTO BundleCatalog (bundleCode, title, originCity, destinationCity, defaultNights, highlight, displayOrder) VALUES\n"
        + ",\n".join(
            f"('{c}', '{t}', '{o}', '{d}', {n}, '{h}', {ord_})" for c, t, o, d, n, h, ord_ in bundles
        )
        + ";"
    )

    print()
    print("USE LoyaltyDB;")
    la = []
    for cid in range(7, 51):
        pts = 500 + (cid * 137) % 25000
        tier = ["Bronze", "Silver", "Gold", "Platinum"][(cid // 10) % 4]
        la.append(f"({cid}, {pts}, '{tier}')")
    print("INSERT INTO LoyaltyAccounts (CustomerID, PointsBalance, TierLevel) VALUES\n" + ",\n".join(la) + ";")

    lt = []
    txid = 20
    for i in range(85):
        cid = 1 + (i % 50)
        bid = 1 + (i % 65)
        delta = random.choice([-800, -500, -200, 120, 350, 800, 1500, 2200])
        reason = random.choice(
            [
                "Earn after package booking",
                "Redeem on bundle checkout",
                "Tier bonus month",
                "Promo double points",
                "Refund reversal",
                "Goodwill adjustment",
                "Partner hotel stay",
            ]
        )
        lt.append(f"({cid}, {bid}, {delta}, '{reason}')")
        txid += 1
    print(
        "INSERT INTO LoyaltyTransactions (CustomerID, BookingID, PointsChanged, Reason) VALUES\n"
        + ",\n".join(lt)
        + ";"
    )

    print()
    print("USE FlightDB;")
    frs = []
    for i in range(1, 46):
        bid = 1 + (i % 64)
        fn = flights[i % len(flights)]
        seat = f"{12 + (i % 18)}{chr(65 + (i % 5))}"
        st = "CONFIRMED" if i % 7 != 0 else "RELEASED"
        frs.append(f"({bid}, '{fn}', '{seat}', '{st}', '2026-01-{1 + (i % 28):02d} 10:00:00')")
    print(
        "INSERT INTO FlightReservations (BookingID, FlightNum, SeatNo, Status, CreatedAt) VALUES\n"
        + ",\n".join(frs)
        + ";"
    )

    print()
    print("USE HotelDB;")
    hbs = []
    for i in range(1, 38):
        bid = 2 + (i % 63)
        hid = 1 + (i % 33)
        rt = random.choice(["Standard", "Deluxe", "Suite"])
        cin = f"2026-{(i % 10) + 1:02d}-{(i % 20) + 1:02d} 15:00:00"
        cout = f"2026-{(i % 10) + 1:02d}-{(i % 20) + 4:02d} 11:00:00"
        keys = 1 + (i % 3)
        st = "CONFIRMED" if i % 6 != 0 else "CANCELLED"
        hbs.append(f"({bid}, {hid}, '{rt}', '{cin}', '{cout}', {keys}, '{st}')")
    print(
        "INSERT INTO HotelBookings (BookingID, HotelID, RoomType, CheckIn, CheckOut, NumberOfKeys, Status) VALUES\n"
        + ",\n".join(hbs)
        + ";"
    )


if __name__ == "__main__":
    main()
