// Travel Booking UI logic

// Same-origin paths (nginx proxies to booking / loyalty / notification — see nginx/ui.conf)
const API_BASE = "/api/booking";
const LOYALTY_BASE = "/api/loyalty";
const NOTIFICATION_BASE = "/api/notification";
// Use direct hotel service calls.
// Nginx /api/hotel proxying is unreliable in this environment, but the hotel
// Flask service has CORS enabled and runs on :5103.
const HOTEL_BASE = "http://localhost:5103";

/** Demo personas — pick from dropdown to fill the form for presentations */
const DEMO_PROFILES = [
  {
    id: "ava",
    label: "Ava Chen — casual traveller (cust 1)",
    passengerName: "Ava Chen",
    passengerEmail: "ava.chen@example.com",
    passengerPhone: "+65 9123 4567",
    customerID: 1,
    flightID: "SQ001",
    hotelID: 1,
    hotelRoomType: "STD",
    hotelIncludesBreakfast: false,
    departureTime: "2026-05-01T10:00",
    totalPrice: 1200,
    currency: "SGD",
    fareType: "Flexi",
    discountCode: "",
    coinsToSpendCents: 0,
    preferredSeat: "11D",
  },
  {
    id: "ava_family",
    label: "Ava + 2 companions (cust 1 — OS Ids 9, 10 after seed script)",
    passengerName: "Ava Chen",
    passengerEmail: "ava.chen@example.com",
    passengerPhone: "+65 9123 4567",
    customerID: 1,
    flightID: "SQ001",
    rawTravellerProfileIds: [9, 10],
    hotelID: 1,
    hotelRoomType: "DLX",
    hotelIncludesBreakfast: true,
    departureTime: "2026-05-01T10:00",
    totalPrice: 1800,
    currency: "SGD",
    fareType: "Flexi",
    discountCode: "",
    coinsToSpendCents: 0,
    preferredSeat: "11A",
  },
  {
    id: "ben",
    label: "Ben Kumar — business (cust 2)",
    passengerName: "Ben Kumar",
    passengerEmail: "ben.kumar@example.com",
    passengerPhone: "+65 8123 0000",
    customerID: 2,
    flightID: "SQ002",
    hotelID: 1,
    hotelRoomType: "DLX",
    hotelIncludesBreakfast: true,
    departureTime: "2026-06-15T09:30",
    totalPrice: 1500,
    currency: "SGD",
    fareType: "Standard",
    discountCode: "",
    coinsToSpendCents: 0,
    preferredSeat: "11F",
  },
  {
    id: "airasia",
    label: "Casey — AirAsia AK123 (no online seat map)",
    passengerName: "Casey Tan",
    passengerEmail: "casey.tan@example.com",
    passengerPhone: "+65 9000 1111",
    customerID: 3,
    flightID: "AK123",
    hotelID: 1,
    hotelRoomType: "STD",
    hotelIncludesBreakfast: false,
    departureTime: "2026-07-01T14:00",
    totalPrice: 650,
    currency: "SGD",
    fareType: "Saver",
    discountCode: "",
    coinsToSpendCents: 0,
    preferredSeat: null,
  },
  {
    id: "scoot",
    label: "Dana — Scoot TR789 (check-in only in demo)",
    passengerName: "Dana Wong",
    passengerEmail: "dana.wong@example.com",
    passengerPhone: "+65 8444 2222",
    customerID: 4,
    flightID: "TR789",
    hotelID: 1,
    hotelRoomType: "STD",
    hotelIncludesBreakfast: false,
    departureTime: "2026-08-10T08:00",
    totalPrice: 520,
    currency: "SGD",
    fareType: "Saver",
    discountCode: "",
    coinsToSpendCents: 0,
    preferredSeat: null,
  },
  {
    id: "elena",
    label: "Elena — corporate (cust 5, discount code)",
    passengerName: "Elena Ruiz",
    passengerEmail: "elena.ruiz@corp-demo.sg",
    passengerPhone: "+65 9333 8888",
    customerID: 5,
    flightID: "SQ001",
    hotelID: 1,
    hotelRoomType: "DLX",
    hotelIncludesBreakfast: true,
    departureTime: "2026-09-01T12:00",
    totalPrice: 2400,
    currency: "SGD",
    fareType: "Flexi",
    discountCode: "PLAT20",
    coinsToSpendCents: 500,
    preferredSeat: "12A",
  },
];

const TAKEN_SEATS = new Set(["8A", "8B", "9D", "10F", "12C"]);

/**
 * Typical narrow-body 3–3 layout: A/F window, C/D aisle, B/E middle.
 * Rows 6–7: economy comfort (extra legroom). Row 12: exit row.
 */
function getSeatCharacteristics(row, letter) {
  const L = String(letter).toUpperCase();
  let position = "middle";
  if (L === "A" || L === "F") position = "window";
  else if (L === "C" || L === "D") position = "aisle";

  let zone = "standard";
  if (row === 6 || row === 7) zone = "extra_legroom";
  if (row === 12) zone = "exit_row";

  const bits = [];
  if (position === "window") bits.push("Window");
  else if (position === "aisle") bits.push("Aisle");
  else bits.push("Middle");
  if (zone === "extra_legroom") bits.push("Extra legroom");
  if (zone === "exit_row") bits.push("Exit row · extra legroom");

  return {
    position,
    zone,
    label: bits.join(" · "),
  };
}

let latestResult = null;
let latestLoyalty = null; // { coins, bookingCount, tier, ... } from loyalty service
let latestTravellerRows = [];
let selectedTravellerRow = null; // OutSystems traveller profile row object
let pendingTravellerIdsFromDemo = null;
let selectedHotel = null; // Hotel row from hotel service (for UI only)
let latestHotelRows = [];
let lastHotelRoomType = null;
let travellerProfilesServiceAvailable = true; // avoids repeated 500 spam when OutSystems is not configured

/**
 * Detects GET / response (welcome page), not a booking payload.
 * Happens if the wrong URL is used or a proxy returns the root handler.
 */
function isBookingWelcomePayload(body) {
  return (
    body &&
    typeof body === "object" &&
    body.message === "Booking API is running" &&
    body.endpoints &&
    !("data" in body && body.data !== undefined)
  );
}

function formatNetworkError(err) {
  const s = String(err?.message || err || "Unknown error");
  if (s.includes("Failed to fetch") || s.includes("NetworkError")) {
    return [
      "Could not reach the API (network error).",
      "",
      "Check:",
      "• Docker is running: docker compose up --build",
      "• Open the UI at http://localhost:8080 (not file://) — API is proxied under /api/",
      "• Booking container is Up: docker compose ps",
      "• If booking keeps failing: docker compose logs booking --tail 80",
      "• Direct API (optional): http://localhost:5101/",
    ].join("\n");
  }
  return s;
}

/**
 * fetch + safe JSON parse. Returns { ok, status, body, networkError?, parseError? }.
 */
async function fetchJson(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    return {
      ok: false,
      status: 0,
      body: null,
      networkError: true,
      errorMessage: formatNetworkError(e),
    };
  }
  const text = await res.text();
  let body = null;
  let parseError = false;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      parseError = true;
      body = { _raw: text.slice(0, 500), _parseError: true };
    }
  } else {
    // Nginx/proxy or Flask occasionally yields no body; never leave body null (UI looked "empty").
    body = {
      _emptyBody: true,
      code: 500,
      message: res.ok
        ? `HTTP ${res.status} but response body was empty — check booking container (docker compose logs booking) and nginx /api/booking/ proxy.`
        : `HTTP ${res.status} with empty response body (check nginx/proxy and booking logs).`,
    };
  }
  return { ok: res.ok, status: res.status, body, networkError: false, parseError };
}

function isMissingBookingData(body) {
  return !body || !body.data || body.data.id == null;
}

function computeProjectedTier(bookingCountAfterThisBooking) {
  const n = Number(bookingCountAfterThisBooking || 0);
  if (n >= 10) return "Platinum";
  if (n >= 5) return "Gold";
  if (n >= 2) return "Silver";
  return "Bronze";
}

function tierDiscountPercent(tier) {
  switch (tier) {
    case "Silver":
      return 10;
    case "Gold":
      return 15;
    case "Platinum":
      return 20;
    default:
      return 0;
  }
}

function codeDiscountPercent(code, projectedTier) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return 0;
  // Only apply if the customer tier is high enough (based on projected tier after this booking).
  const tierRank = (t) => (t === "Bronze" ? 0 : t === "Silver" ? 1 : t === "Gold" ? 2 : 3);
  const requiredRank =
    c === "SILVER10" ? tierRank("Silver") : c === "GOLD15" ? tierRank("Gold") : c === "PLAT20" ? tierRank("Platinum") : -1;
  if (requiredRank < 0) return 0;
  if (tierRank(projectedTier) < requiredRank) return 0;
  if (c === "SILVER10") return 10;
  if (c === "GOLD15") return 15;
  if (c === "PLAT20") return 20;
  return 0;
}

/**
 * List price from the form, then tier % off list, then promo % off that subtotal, then coins (dollars).
 * Avoids applying both tier and code as full % of list (e.g. 20+20=40% off), which felt like a glitch.
 */
/** Customer IDs &gt; 0 are account holders with loyalty; 0 = guest (no coins / tier in this demo). */
function hasAccountCustomerId(customerID) {
  return Number(customerID) > 0;
}

function computeFinalPriceBreakdown() {
  const basePrice = Math.max(
    0,
    Number(document.getElementById("totalPrice").value) || 0
  );
  const customerID = Number(document.getElementById("customerID").value || 0);

  let tierDiscountPct = 0;
  let codeDiscountPct = 0;
  if (customerID) {
    const bookingCount = Number(latestLoyalty?.bookingCount ?? 0);
    const projectedTier = computeProjectedTier(bookingCount + 1);
    tierDiscountPct = tierDiscountPercent(projectedTier);
    codeDiscountPct = codeDiscountPercent(
      document.getElementById("discountCode").value,
      projectedTier
    );
  }

  const afterTier = basePrice * (1 - tierDiscountPct / 100);
  const afterCode = afterTier * (1 - codeDiscountPct / 100);

  let coinsToSpendCents = 0;
  let coinsOffsetDollars = 0;
  if (hasAccountCustomerId(customerID)) {
    const coinsAvailableCents = Number(latestLoyalty?.coins ?? 0);
    const coinsToSpendRequestedCents = Math.max(
      0,
      Number(document.getElementById("coinsToSpendCents").value || 0)
    );
    coinsToSpendCents = Math.min(coinsAvailableCents, coinsToSpendRequestedCents);
    coinsOffsetDollars = coinsToSpendCents / 100;
  }
  const finalPaid = Math.max(0, afterCode - coinsOffsetDollars);

  return {
    basePrice,
    tierDiscountPct,
    codeDiscountPct,
    afterTier,
    afterCode,
    coinsToSpendCents,
    finalPaid,
  };
}

function refreshPricePreview() {
  const el = document.getElementById("computedTotalPrice");
  if (!el) return;
  const { finalPaid } = computeFinalPriceBreakdown();
  el.textContent = Number.isFinite(finalPaid) ? finalPaid.toFixed(2) : "-";
}

function extractAirlineCode(flightId) {
  const m = String(flightId || "")
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{2})/);
  return m ? m[1] : "";
}

/**
 * SQ = full-service style online seat map in this demo.
 * AK / AA / TR etc. = must use check-in / counter (demo blocks the map).
 */
function getSeatPolicy(flightId) {
  const code = extractAirlineCode(flightId);
  if (!code) {
    return {
      onlineSeatSelection: false,
      airlineCode: "",
      airlineName: "",
      reason: "Enter a flight number (e.g. SQ001 or AK123).",
    };
  }
  const rules = {
    SQ: {
      onlineSeatSelection: true,
      airlineName: "Singapore Airlines",
      reason: "",
    },
    AK: {
      onlineSeatSelection: false,
      airlineName: "AirAsia",
      reason:
        "AirAsia: seat assignment at online check-in or at the airport — advance seat map is disabled in this demo.",
    },
    AA: {
      onlineSeatSelection: false,
      airlineName: "American Airlines",
      reason:
        "American Airlines: advance seat selection is not available in this demo — check in online or at the airport.",
    },
    TR: {
      onlineSeatSelection: false,
      airlineName: "Scoot",
      reason:
        "Scoot: budget carrier — seat selection via the airline app or at check-in (not modelled in this UI).",
    },
  };
  const r = rules[code];
  if (r) {
    return { ...r, airlineCode: code };
  }
  return {
    onlineSeatSelection: false,
    airlineCode: code,
    airlineName: code,
    reason: `Airline ${code}: online seat map not enabled in this demo — confirm your seat at check-in.`,
  };
}

function clearSeatSelection() {
  document.getElementById("seatNumber").value = "";
  document.getElementById("seatSelectedDisplay").textContent = "—";
  const detail = document.getElementById("seatSelectedDetail");
  if (detail) detail.textContent = "";
  document.querySelectorAll("#seatMap button.seat").forEach((b) => {
    b.classList.remove("picked");
  });
}

function selectSeat(seatCode) {
  const code = String(seatCode).toUpperCase();
  document.getElementById("seatNumber").value = code;
  document.getElementById("seatSelectedDisplay").textContent = code;
  const btn = document.querySelector(`#seatMap button.seat[data-seat="${code}"]`);
  const detail = document.getElementById("seatSelectedDetail");
  if (detail) {
    detail.textContent = btn?.dataset?.seatLabel ? `(${btn.dataset.seatLabel})` : "";
  }
  document.querySelectorAll("#seatMap button.seat").forEach((b) => {
    b.classList.toggle("picked", b.dataset.seat === code);
  });
}

function selectSeatByCode(code) {
  const up = String(code || "").toUpperCase();
  const btn = document.querySelector(`#seatMap button.seat[data-seat="${up}"]`);
  if (!btn || btn.disabled) return;
  selectSeat(up);
}

function addSeatButton(container, row, letter) {
  const id = `${row}${letter}`;
  const meta = getSeatCharacteristics(row, letter);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "seat";
  btn.dataset.seat = id;
  btn.dataset.seatLabel = meta.label;
  btn.textContent = letter;
  btn.classList.add(`seat--${meta.position}`);
  btn.classList.add(`seat--zone-${meta.zone}`);

  if (TAKEN_SEATS.has(id)) {
    btn.disabled = true;
    btn.classList.add("taken");
    btn.title = `${id} · ${meta.label} · Already taken`;
  } else {
    btn.title = `${id} · ${meta.label} · Click to select`;
    btn.addEventListener("click", () => selectSeat(id));
  }
  container.appendChild(btn);
}

function addSectionHeader(mapEl, title) {
  const h = document.createElement("div");
  h.className = "seat-section-header";
  h.textContent = title;
  mapEl.appendChild(h);
}

function addSeatRow(mapEl, row) {
  const rowEl = document.createElement("div");
  rowEl.className = "seat-row";
  const num = document.createElement("span");
  num.className = "row-num";
  num.textContent = String(row);
  rowEl.appendChild(num);
  const left = document.createElement("div");
  left.className = "seat-group";
  addSeatButton(left, row, "A");
  addSeatButton(left, row, "B");
  addSeatButton(left, row, "C");
  rowEl.appendChild(left);
  const aisle = document.createElement("span");
  aisle.className = "seat-aisle";
  aisle.setAttribute("aria-hidden", "true");
  rowEl.appendChild(aisle);
  const right = document.createElement("div");
  right.className = "seat-group";
  addSeatButton(right, row, "D");
  addSeatButton(right, row, "E");
  addSeatButton(right, row, "F");
  rowEl.appendChild(right);
  mapEl.appendChild(rowEl);
}

function buildSeatMapOnce() {
  const map = document.getElementById("seatMap");
  if (!map) return;
  map.innerHTML = "";

  addSectionHeader(map, "Economy comfort · extra legroom");
  addSeatRow(map, 6);
  addSeatRow(map, 7);

  addSectionHeader(map, "Standard economy");
  [8, 9, 10, 11].forEach((r) => addSeatRow(map, r));

  addSectionHeader(map, "Exit row · extra legroom (may require eligibility)");
  addSeatRow(map, 12);
}

function updateSeatSelectionUI() {
  const flightInput = document.getElementById("flightID");
  if (!flightInput) return;
  const flightId = flightInput.value;
  const policy = getSeatPolicy(flightId);
  const policyEl = document.getElementById("seatPolicyText");
  const mapWrap = document.getElementById("seatMapWrap");
  const blocked = document.getElementById("seatBlockedNote");

  if (policy.onlineSeatSelection) {
    policyEl.textContent = `${policy.airlineName}: choose a seat on the map below (demo).`;
    mapWrap.hidden = false;
    blocked.hidden = true;
    blocked.textContent = "";
  } else {
    policyEl.textContent = policy.reason;
    mapWrap.hidden = true;
    blocked.hidden = false;
    blocked.textContent = policy.reason;
    clearSeatSelection();
  }
}

function readTravellerProfileIdsFromInput() {
  // UI: use names/selectors, but backend still needs numeric IDs.
  const leadEl = document.getElementById("leadTravellerSelect");
  const compEl = document.getElementById("companionTravellerSelect");

  const ids = [];
  const leadId = Number(leadEl?.value || 0);
  if (leadId > 0) ids.push(leadId);

  if (compEl) {
    const selected = Array.from(compEl.selectedOptions || []).map((o) =>
      Number(o.value)
    );
    for (const id of selected) {
      if (id > 0) ids.push(id);
    }
  }

  // Dedup while preserving order.
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function applyTravellerSelectionFromIds(preferredIds) {
  const leadEl = document.getElementById("leadTravellerSelect");
  const compEl = document.getElementById("companionTravellerSelect");
  if (!leadEl || !compEl) return;

  const ids = Array.isArray(preferredIds)
    ? preferredIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const leadId = ids[0] || 0;
  leadEl.value = leadId ? String(leadId) : "";

  // Update passengerName from lead.
  const leadRow = latestTravellerRows.find(
    (r) => Number(r?.Id ?? r?.id ?? r?.TravellerProfileId ?? 0) === leadId
  );
  const leadName = getOsField(leadRow, ["FullName", "Name", "TravellerName"]);
  if (leadRow && leadName) {
    document.getElementById("passengerName").value = leadName;
    const phone = getOsField(leadRow, [
      "EmergencyContactPhone",
      "EmergencyPhone",
      "emergencyContactPhone",
    ]);
    const passengerPhoneEl = document.getElementById("passengerPhone");
    if (passengerPhoneEl && !String(passengerPhoneEl.value || "").trim() && phone) {
      passengerPhoneEl.value = phone;
    }
  }

  // Clear companions then mark selected.
  Array.from(compEl.options || []).forEach((opt) => {
    opt.selected = false;
  });
  const companionIds = new Set(ids.slice(1));
  Array.from(compEl.options || []).forEach((opt) => {
    const id = Number(opt.value);
    if (companionIds.has(id)) opt.selected = true;
  });

  refreshTripContactSummary();
}

function setTravellerProfileIdsInputFromDemo(p) {
  const preferredIds = Array.isArray(p.rawTravellerProfileIds)
    ? p.rawTravellerProfileIds
    : Array.isArray(p.travellerProfileIds)
      ? p.travellerProfileIds
      : Array.isArray(p.travellerProfileId)
        ? p.travellerProfileId
        : p.travellerProfileId !== undefined && p.travellerProfileId !== null
          ? [p.travellerProfileId]
          : [];

  pendingTravellerIdsFromDemo = preferredIds;

  // If profiles are already loaded, apply immediately.
  if (latestTravellerRows && latestTravellerRows.length) {
    applyTravellerSelectionFromIds(preferredIds);
  }
}

function updateCoinsOffsetUI() {
  const cid = Number(document.getElementById("customerID")?.value || 0);
  const wrap = document.getElementById("coinsOffsetWrap");
  const input = document.getElementById("coinsToSpendCents");
  const availEl = document.getElementById("coinsAvailableCents");
  const btnNone = document.getElementById("coinsUseNoneBtn");
  const btnAll = document.getElementById("coinsUseAllBtn");
  if (!wrap || !input) return;
  if (!hasAccountCustomerId(cid)) {
    wrap.hidden = true;
    input.value = "0";
    input.disabled = true;
    if (availEl) availEl.textContent = "-";
    if (btnNone) btnNone.disabled = true;
    if (btnAll) btnAll.disabled = true;
  } else {
    wrap.hidden = false;
    input.disabled = false;

    const coinsAvailableCents = Number(latestLoyalty?.coins ?? 0);
    if (availEl) availEl.textContent = String(coinsAvailableCents);
    if (btnNone) btnNone.disabled = coinsAvailableCents <= 0;
    if (btnAll) btnAll.disabled = coinsAvailableCents <= 0;

    // Keep input capped to available coins for a predictable UX.
    const requested = Number(input.value || 0);
    const capped = Math.min(coinsAvailableCents, Math.max(0, requested));
    if (!Number.isFinite(capped)) {
      input.value = "0";
    } else {
      input.value = String(capped);
    }
  }

  refreshPricePreview();
}

function setCoinsToSpendCents(value) {
  const input = document.getElementById("coinsToSpendCents");
  if (!input) return;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) input.value = "0";
  else input.value = String(Math.floor(n));
  refreshPricePreview();
}

function updateBreakfastAddonUI() {
  const room = document.getElementById("hotelRoomType")?.value;
  const wrap = document.getElementById("breakfastAddonWrap");
  const cb = document.getElementById("hotelIncludesBreakfast");
  if (!wrap || !cb) return;
  if (room === "DLX") {
    wrap.hidden = true;
    cb.checked = true;
  } else {
    wrap.hidden = false;
    if (lastHotelRoomType === "DLX") cb.checked = false;
  }
  lastHotelRoomType = room;
}

function setHotelRoomTypeOptionsFromHotel(hotel) {
  const select = document.getElementById("hotelRoomType");
  if (!select || !hotel || !Array.isArray(hotel.roomTypes)) return;

  const current = select.value;

  const codes = hotel.roomTypes
    .map((rt) => rt.code)
    .filter((c) => c === "STD" || c === "DLX");

  select.innerHTML = "";
  codes.forEach((code) => {
    const rt = hotel.roomTypes.find((x) => x.code === code);
    const label = rt?.label || (code === "DLX" ? "Deluxe" : "Standard");
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = label.includes("Room") ? label : `${label} (hotel room)`;
    select.appendChild(opt);
  });

  if (codes.includes(current)) select.value = current;
  else select.value = codes[0] || "";
}

function setHotelSelection(hotel) {
  if (!hotel) return;

  selectedHotel = hotel;

  const hotelIDEl = document.getElementById("hotelID");
  if (hotelIDEl) hotelIDEl.value = String(hotel.hotelID || hotel.id || 0);

  const displayEl = document.getElementById("hotelSelectedDisplay");
  if (displayEl) displayEl.textContent = hotel.name || "—";

  setHotelRoomTypeOptionsFromHotel(hotel);

  const roomCode = document.getElementById("hotelRoomType")?.value;
  const cb = document.getElementById("hotelIncludesBreakfast");
  if (cb) cb.checked = roomCode === "DLX";

  updateBreakfastAddonUI();
}

function renderHotelResults(hotels) {
  const resultsEl = document.getElementById("hotelResults");
  if (!resultsEl) return;
  resultsEl.innerHTML = "";

  const list = Array.isArray(hotels) ? hotels : [];
  if (!list.length) {
    resultsEl.textContent = "No matching hotels found.";
    return;
  }

  list.forEach((h) => {
    const id = h.hotelID || h.id;
    const card = document.createElement("div");
    card.className = "hotel-card";
    card.innerHTML = `
      <div class="hotel-card__img">
        <img src="${escapeHtml(h.imageUrl || '')}" alt="${escapeHtml(h.name || 'Hotel')}" />
      </div>
      <div class="hotel-card__body">
        <div class="hotel-card__top">
          <div class="hotel-card__title">${escapeHtml(h.name || 'Hotel')}</div>
          <div class="hotel-card__rating">${escapeHtml(String(h.starRating ?? ''))}★</div>
        </div>
        <div class="hotel-card__meta">${escapeHtml(h.city || '')}${h.city && h.country ? ', ' : ''}${escapeHtml(
      h.country || ''
    )}</div>
        <div class="hotel-card__amenities muted">${escapeHtml(h.amenities || '')}</div>
        <div class="hotel-card__rooms muted">Rooms: ${escapeHtml(
          (h.roomTypes || []).map((rt) => rt.code).filter(Boolean).join(", ")
        )}</div>
        <div class="hotel-card__actions">
          <button type="button" class="btn-secondary" data-action="selectHotel" data-id="${escapeHtml(
            String(id || 0)
          )}">
            Select
          </button>
        </div>
      </div>
    `;
    resultsEl.appendChild(card);
  });
}

async function searchHotels() {
  const country = document.getElementById("hotelSearchCountry")?.value?.trim() || "";
  const city = document.getElementById("hotelSearchCity")?.value?.trim() || "";
  const name = document.getElementById("hotelSearchName")?.value?.trim() || "";

  const resultsEl = document.getElementById("hotelResults");
  const selectedHintEl = document.getElementById("hotelSelectedHint");
  if (selectedHintEl) selectedHintEl.textContent = "Searching hotels…";
  if (resultsEl) resultsEl.textContent = "Loading…";

  const qs = new URLSearchParams();
  if (country) qs.set("country", country);
  if (city) qs.set("city", city);
  if (name) qs.set("name", name);

  const out = await fetchJson(`${HOTEL_BASE}/hotel/search?${qs.toString()}`);
  if (out.networkError) {
    if (selectedHintEl) selectedHintEl.textContent = "Could not reach hotel service.";
    if (resultsEl) resultsEl.textContent = out.errorMessage || "";
    return;
  }

  const hotels = out.body?.data ?? [];
  latestHotelRows = Array.isArray(hotels) ? hotels : [];
  if (!hotels.length) {
    if (selectedHintEl) selectedHintEl.textContent = "No hotels match those details.";
    renderHotelResults([]);
    return;
  }

  if (selectedHintEl) selectedHintEl.textContent = "Pick one hotel option below.";
  renderHotelResults(hotels);
}

async function initHotelSelectionById(hotelId) {
  const hid = Number(hotelId);
  if (!Number.isFinite(hid) || hid < 1) return;

  const out = await fetchJson(`${HOTEL_BASE}/hotel/${hid}`);
  if (out.networkError || !out.ok || !out.body?.data) return;

  setHotelSelection(out.body.data);
}

function populateDemoProfileOptions() {
  const sel = document.getElementById("demoProfile");
  if (!sel) return;
  DEMO_PROFILES.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label;
    sel.appendChild(opt);
  });
}

function applyDemoProfile() {
  const sel = document.getElementById("demoProfile");
  if (!sel || !sel.value) return;
  const p = DEMO_PROFILES.find((x) => x.id === sel.value);
  if (!p) return;

  document.getElementById("customerID").value = p.customerID;
  const tc = document.getElementById("travellerCustomerID");
  if (tc) tc.value = String(p.customerID);
  const pn = document.getElementById("passengerName");
  const pe = document.getElementById("passengerEmail");
  const pp = document.getElementById("passengerPhone");
  if (pn) pn.value = p.passengerName ?? "";
  if (pe) pe.value = p.passengerEmail ?? "";
  if (pp) pp.value = p.passengerPhone ?? "";
  refreshTripContactSummary();
  document.getElementById("flightID").value = p.flightID;
  const hotelId = Number(p.hotelID);
  document.getElementById("hotelID").value = hotelId;
  document.getElementById("hotelRoomType").value = p.hotelRoomType;
  document.getElementById("hotelIncludesBreakfast").checked = !!p.hotelIncludesBreakfast;
  updateBreakfastAddonUI();

  if (Number.isFinite(hotelId) && hotelId > 0) {
    void initHotelSelectionById(hotelId).then(() => {
      const rtSel = document.getElementById("hotelRoomType");
      if (rtSel && p.hotelRoomType) {
        const opt = rtSel.querySelector(`option[value="${p.hotelRoomType}"]`);
        if (opt) rtSel.value = p.hotelRoomType;
      }
      updateBreakfastAddonUI();
    });
  }
  document.getElementById("departureTime").value = p.departureTime;
  document.getElementById("totalPrice").value = p.totalPrice;
  document.getElementById("currency").value = p.currency;
  document.getElementById("fareType").value = p.fareType;
  document.getElementById("discountCode").value = p.discountCode || "";
  document.getElementById("coinsToSpendCents").value = p.coinsToSpendCents ?? 0;
  setTravellerProfileIdsInputFromDemo(p);
  updateCoinsOffsetUI();

  updateSeatSelectionUI();
  // Refresh traveller profile list + selectors so the demo can pick by name.
  if (document.getElementById("travellerProfilesList")) {
    void loadTravellerProfiles();
  }
  if (p.preferredSeat && getSeatPolicy(p.flightID).onlineSeatSelection) {
    selectSeatByCode(p.preferredSeat);
  } else {
    clearSeatSelection();
  }

  const cid = Number(p.customerID);
  if (cid) updateLoyaltySummary(cid);
  else {
    latestLoyalty = null;
    document.getElementById("loyaltyCoins").textContent = "-";
    document.getElementById("loyaltyTier").textContent = "-";
    refreshPricePreview();
  }
}

function setManualDefaults() {
  document.getElementById("demoProfile").value = "";
  document.getElementById("customerID").value = 1;
  const tc = document.getElementById("travellerCustomerID");
  if (tc) tc.value = "1";
  pendingTravellerIdsFromDemo = null;
  const pn0 = document.getElementById("passengerName");
  const pe0 = document.getElementById("passengerEmail");
  const pp0 = document.getElementById("passengerPhone");
  if (pn0) pn0.value = "Ava Chen";
  if (pe0) pe0.value = "ava.chen@example.com";
  if (pp0) pp0.value = "+65 9123 4567";
  refreshTripContactSummary();
  document.getElementById("flightID").value = "SQ001";
  document.getElementById("hotelID").value = 1;
  document.getElementById("hotelRoomType").value = "STD";
  document.getElementById("hotelIncludesBreakfast").checked = false;
  updateBreakfastAddonUI();
  void initHotelSelectionById(1);
  document.getElementById("departureTime").value = "2026-05-01T10:00";
  document.getElementById("totalPrice").value = 1200;
  document.getElementById("currency").value = "SGD";
  document.getElementById("fareType").value = "Flexi";
  document.getElementById("discountCode").value = "";
  document.getElementById("coinsToSpendCents").value = 0;
  updateCoinsOffsetUI();
  const leadSel = document.getElementById("leadTravellerSelect");
  if (leadSel) leadSel.value = "";
  const compSel = document.getElementById("companionTravellerSelect");
  if (compSel) {
    Array.from(compSel.options || []).forEach((opt) => (opt.selected = false));
  }
  clearSeatSelection();
  updateSeatSelectionUI();
  void updateLoyaltySummary(1);
}

function showResult(obj, meta = "") {
  latestResult = obj ?? null;
  const el = document.getElementById("result");
  if (!el) return;
  let txt;
  try {
    txt = JSON.stringify(obj, null, 2);
  } catch {
    txt = JSON.stringify({ _stringifyError: true, value: String(obj) });
  }
  if (txt === undefined) {
    txt = JSON.stringify({
      _note: "Nothing to display — response was undefined.",
      meta,
    });
  }
  el.textContent = txt || "{ }";
  document.getElementById("resultStatus").textContent = meta;
}

function setError(el, msg) {
  el.textContent = msg;
  el.style.display = "block";
}

function clearError(el) {
  el.textContent = "";
  el.style.display = "none";
}

async function updateLoyaltySummary(customerID) {
  const out = await fetchJson(`${LOYALTY_BASE}/loyalty/${customerID}/points`);
  if (out.networkError || !out.ok || !out.body?.data) {
    latestLoyalty = null;
    document.getElementById("loyaltyCoins").textContent = "-";
    document.getElementById("loyaltyTier").textContent = "-";
    refreshPricePreview();
    updateCoinsOffsetUI();
    return;
  }
  const data = out.body;
  latestLoyalty = data.data;
  document.getElementById("loyaltyCoins").textContent =
    data.data.coins ?? data.data.points ?? "-";
  document.getElementById("loyaltyTier").textContent = data.data.tier;
  refreshPricePreview();
  updateCoinsOffsetUI();
}

async function refreshNotifications() {
  const out = await fetchJson(`${NOTIFICATION_BASE}/notifications`);
  if (out.networkError) {
    document.getElementById("notifications").textContent = JSON.stringify(
      { error: out.errorMessage },
      null,
      2
    );
    return;
  }
  document.getElementById("notifications").textContent = JSON.stringify(
    out.body ?? { error: `HTTP ${out.status}` },
    null,
    2
  );
}

async function copyLatestResult() {
  if (!latestResult) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(latestResult, null, 2));
    document.getElementById("resultStatus").textContent = "Copied";
    setTimeout(() => (document.getElementById("resultStatus").textContent = ""), 1200);
  } catch {
    setError(document.getElementById("uiError"), "Copy failed (clipboard permission).");
  }
}

async function onCreateBookingSubmit(e) {
  e.preventDefault();

  const createBtn = document.getElementById("createBtn");
  const createError = document.getElementById("createError");
  const uiError = document.getElementById("uiError");
  clearError(createError);
  clearError(uiError);
  createBtn.disabled = true;

  const flightId = document.getElementById("flightID").value.trim();
  const seatPol = getSeatPolicy(flightId);
  if (seatPol.onlineSeatSelection) {
    const sn = document.getElementById("seatNumber").value.trim();
    if (!sn) {
      setError(
        createError,
        "Select a seat on the map (required for Singapore Airlines flights in this demo)."
      );
      createBtn.disabled = false;
      return;
    }
  }

  const passengerName = document.getElementById("passengerName").value.trim();
  if (!passengerName) {
    setError(createError, "Enter the lead traveller’s full name.");
    createBtn.disabled = false;
    return;
  }
  const passengerEmailRaw = document.getElementById("passengerEmail").value.trim();
  const passengerPhoneRaw = document.getElementById("passengerPhone").value.trim();

  const hotelId = Number(document.getElementById("hotelID").value || 0);
  if (!Number.isFinite(hotelId) || hotelId < 1) {
    setError(createError, "Pick a hotel option first.");
    createBtn.disabled = false;
    return;
  }

  const hotelRoomType = document.getElementById("hotelRoomType").value;
  if (!hotelRoomType) {
    setError(createError, "Select a room type for your hotel.");
    createBtn.disabled = false;
    return;
  }
  const payload = {
    customerID: Number(document.getElementById("customerID").value),
    passengerName,
    flightID: document.getElementById("flightID").value,
    hotelID: Number(document.getElementById("hotelID").value),
    hotelRoomType,
    hotelIncludesBreakfast:
      hotelRoomType === "DLX" ||
      document.getElementById("hotelIncludesBreakfast").checked,
    departureTime: document.getElementById("departureTime").value,
    totalPrice: Number(document.getElementById("totalPrice").value),
    currency: document.getElementById("currency").value,
    fareType: document.getElementById("fareType").value,
    seatNumber: seatPol.onlineSeatSelection
      ? document.getElementById("seatNumber").value.trim().toUpperCase()
      : null,
  };
  if (passengerEmailRaw) payload.passengerEmail = passengerEmailRaw;
  if (passengerPhoneRaw) payload.passengerPhone = passengerPhoneRaw;
  const tpIds = readTravellerProfileIdsFromInput();
  if (tpIds.length) {
    payload.travellerProfileIds = tpIds;
  }

  try {
    const breakdown = computeFinalPriceBreakdown();
    refreshPricePreview();
    payload.totalPrice = breakdown.finalPaid;
    payload.coinsToSpendCents = breakdown.coinsToSpendCents;

    const out = await fetchJson(`${API_BASE}/booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (out.networkError) {
      setError(createError, out.errorMessage);
      showResult({ error: out.errorMessage }, "Can't reach the server");
      return;
    }

    const data = out.body;
    const httpStatus = out.status;

    if (out.parseError && data?._parseError) {
      const msg =
        "We didn't get a valid confirmation back — check the booking service URL and that Docker is running.";
      setError(createError, msg);
      showResult(data, "Something went wrong");
      return;
    }

    if (isBookingWelcomePayload(data)) {
      const msg =
        "Connected to the booking service homepage instead of the confirmation endpoint — start the booking API (e.g. Docker) and try again.";
      setError(createError, msg);
      showResult(
        {
          _help: msg,
          received: data,
        },
        "Unexpected response"
      );
      return;
    }

    if (!out.ok || (data && typeof data.code === "number" && data.code >= 400)) {
      const msg = data?.message || `Request failed (HTTP ${httpStatus})`;
      setError(createError, msg);
      showResult(data ?? { error: msg }, "Couldn't confirm trip");
      return;
    }

    if (isMissingBookingData(data)) {
      const msg =
        "Confirmation was incomplete. Check that the booking service is running.";
      setError(createError, msg);
      showResult(
        { _help: msg, received: data },
        "Incomplete confirmation"
      );
      return;
    }

    showResult(data, "Trip confirmed");
    document.getElementById("cancelBookingID").value = String(data.data.id);

    await updateLoyaltySummary(payload.customerID);
  } catch (err) {
    const msg = formatNetworkError(err);
    setError(createError, msg);
    showResult({ error: msg }, "Couldn't confirm trip");
  } finally {
    createBtn.disabled = false;
  }
}

async function onCancelBookingSubmit(e) {
  e.preventDefault();

  const cancelBtn = document.getElementById("cancelBtn");
  const uiError = document.getElementById("uiError");
  clearError(uiError);
  cancelBtn.disabled = true;

  const idRaw = document.getElementById("cancelBookingID").value.trim();
  const cancelSource = document.getElementById("cancelSource").value;
  if (!idRaw || !/^\d+$/.test(idRaw) || Number(idRaw) < 1) {
    setError(uiError, "Enter a valid booking reference (whole number from your confirmation).");
    cancelBtn.disabled = false;
    return;
  }
  const id = idRaw;
  try {
    const out = await fetchJson(`${API_BASE}/booking/cancel/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelSource }),
    });

    if (out.networkError) {
      setError(uiError, out.errorMessage);
      showResult({ error: out.errorMessage }, "Can't reach the server");
      return;
    }

    const data = out.body;
    const httpStatus = out.status;

    if (out.parseError && data?._parseError) {
      const msg = "We didn't get a valid response for cancellation — check the booking service.";
      setError(uiError, msg);
      showResult(data, "Something went wrong");
      return;
    }

    if (isBookingWelcomePayload(data)) {
      const msg =
        "Couldn't complete cancellation — wrong service or URL. Check the booking app and proxy.";
      setError(uiError, msg);
      showResult({ _help: msg, received: data }, "Unexpected response");
      return;
    }

    if (!out.ok || (data && typeof data.code === "number" && data.code >= 400)) {
      let msg =
        (data && typeof data.message === "string" && data.message.trim() !== ""
          ? data.message
          : null) || `Cancel failed (HTTP ${httpStatus})`;
      if (
        httpStatus === 404 &&
        (String(msg).toLowerCase().includes("not found") || data?.code === 404)
      ) {
        msg = `${msg} — use the booking reference from confirmation, not your customer number.`;
      }
      setError(uiError, msg);
      showResult(
        data ?? { error: msg },
        "Couldn't cancel"
      );
      return;
    }

    if (!data?.data) {
      const msg = "Cancellation response was incomplete.";
      setError(uiError, msg);
      showResult(
        { _help: msg, received: data },
        "Incomplete response"
      );
      return;
    }

    showResult(data, "Cancellation processed");

    await refreshNotifications();

    const bookingOut = await fetchJson(`${API_BASE}/booking/${id}`);
    if (!bookingOut.networkError && bookingOut.body?.data?.customerID) {
      await updateLoyaltySummary(bookingOut.body.data.customerID);
    }
  } catch (err) {
    const msg = formatNetworkError(err);
    setError(uiError, msg);
    showResult({ error: msg }, "Couldn't cancel");
  } finally {
    cancelBtn.disabled = false;
  }
}

function setActiveSegment(segmentKey) {
  const panels = {
    book: "segment-book",
    manage: "segment-manage",
  };
  const buttons = {
    book: "tabBook",
    manage: "tabManage",
  };

  for (const [key, panelId] of Object.entries(panels)) {
    const panel = document.getElementById(panelId);
    const btn = document.getElementById(buttons[key]);
    const isActive = key === segmentKey;
    if (panel) {
      if (isActive) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    }
    if (btn) {
      btn.classList.toggle("segment-tab--active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    }
  }
}

function setupSegmentTabs() {
  const tabBook = document.getElementById("tabBook");
  const tabManage = document.getElementById("tabManage");

  if (tabBook) {
    tabBook.addEventListener("click", () => {
      setActiveSegment("book");
      document.getElementById("step-book")?.scrollIntoView({ behavior: "smooth" });
    });
  }
  if (tabManage) {
    tabManage.addEventListener("click", () => {
      setActiveSegment("manage");
      document.getElementById("step-manage")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  // Keep the existing “stepper” links working with the new tab panels.
  document.querySelectorAll("a.booking-flow__link").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === "#step-book" || href === "#step-manage") {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (href === "#step-book") setActiveSegment("book");
        if (href === "#step-manage") setActiveSegment("manage");
        document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
      });
    }
  });
}

function setupLoyaltyPaymentTabs() {
  const tabLoyalty = document.getElementById("tabLoyaltyPoints");
  const tabPayment = document.getElementById("tabPayment");
  const panelLoyalty = document.getElementById("panelLoyaltyPoints");
  const panelPayment = document.getElementById("panelPayment");
  if (!tabLoyalty || !tabPayment || !panelLoyalty || !panelPayment) return;

  const setActive = (which) => {
    const isLoyalty = which === "loyalty";
    panelLoyalty.hidden = !isLoyalty;
    panelPayment.hidden = isLoyalty;

    tabLoyalty.classList.toggle("segment-tab--active", isLoyalty);
    tabPayment.classList.toggle("segment-tab--active", !isLoyalty);

    tabLoyalty.setAttribute("aria-selected", isLoyalty ? "true" : "false");
    tabPayment.setAttribute("aria-selected", !isLoyalty ? "true" : "false");

    tabLoyalty.tabIndex = isLoyalty ? 0 : -1;
    tabPayment.tabIndex = !isLoyalty ? 0 : -1;
  };

  tabLoyalty.addEventListener("click", () => setActive("loyalty"));
  tabPayment.addEventListener("click", () => setActive("payment"));
}

function setupBookingFlowTabs() {
  const steps = [
    { tabId: "bookingStep1Tab", panelId: "bookingStep1Panel" },
    { tabId: "bookingStep2Tab", panelId: "bookingStep2Panel" },
    { tabId: "bookingStep3Tab", panelId: "bookingStep3Panel" },
    { tabId: "bookingStep4Tab", panelId: "bookingStep4Panel" },
    { tabId: "bookingStep5Tab", panelId: "bookingStep5Panel" },
  ];

  const tabEls = {};
  const panelEls = {};
  for (const s of steps) {
    tabEls[s.tabId] = document.getElementById(s.tabId);
    panelEls[s.panelId] = document.getElementById(s.panelId);
  }

  const setActiveStep = (stepIndex) => {
    for (let i = 0; i < steps.length; i++) {
      const isActive = i === stepIndex;
      const { tabId, panelId } = steps[i];
      const tab = tabEls[tabId];
      const panel = panelEls[panelId];
      if (panel) panel.hidden = !isActive;
      if (tab) {
        tab.classList.toggle("segment-tab--active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
        tab.tabIndex = isActive ? 0 : -1;
      }
    }
    const activePanelId = steps[stepIndex]?.panelId;
    if (activePanelId)
      document.getElementById(activePanelId)?.scrollIntoView({ behavior: "smooth", block: "start" });

    // Step 4 (index 3) includes traveller profile CRUD + selectors.
    if (stepIndex === 3) {
      const listEl = document.getElementById("travellerProfilesList");
      if (listEl && latestTravellerRows.length === 0) {
        void loadTravellerProfiles();
      }
    }
  };

  steps.forEach((s, idx) => {
    tabEls[s.tabId]?.addEventListener("click", () => setActiveStep(idx));
  });

  // Ensure correct initial visibility (HTML defaults should already handle this).
  const initial = 0;
  setActiveStep(initial);
}

function refreshTripContactSummary() {
  const name = document.getElementById("passengerName")?.value?.trim() || "";
  const phone = document.getElementById("passengerPhone")?.value?.trim() || "";
  const nameEl = document.getElementById("summaryPassengerName");
  const phoneEl = document.getElementById("summaryPassengerPhone");
  if (nameEl) nameEl.textContent = name || "—";
  if (phoneEl) phoneEl.textContent = phone || "—";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[ch] || ch;
  });
}

function getOsField(row, candidates) {
  if (!row) return "";
  for (const key of candidates) {
    const v = row[key];
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s !== "") return s;
    }
  }
  return "";
}

function toDateInputValue(v) {
  if (!v) return "";
  const s = String(v);
  // Accept ISO date or ISO datetime.
  return s.includes("T") ? s.slice(0, 10) : s;
}

function maskPassport(passport) {
  const s = String(passport || "").trim();
  if (!s) return "";
  return s.length <= 4 ? s : s.slice(-4);
}

function populateTravellerSelectorsFromRows(rows) {
  const leadSel = document.getElementById("leadTravellerSelect");
  const compSel = document.getElementById("companionTravellerSelect");
  const passengerNameEl = document.getElementById("passengerName");
  const passengerPhoneEl = document.getElementById("passengerPhone");

  if (!leadSel || !compSel) return;

  const safeRows = Array.isArray(rows) ? rows : [];

  const makeOptionText = (row) => {
    const id = Number(row?.Id ?? row?.id ?? row?.TravellerProfileId ?? 0) || 0;
    const fullName = getOsField(row, ["FullName", "Name", "TravellerName"]);
    const passport = getOsField(row, ["PassportNumber", "PassportNo", "passportNumber"]);
    const tail = maskPassport(passport);
    const title = fullName || `Traveller #${id}`;
    return tail ? `${title} · …${tail}` : title;
  };

  // Build options.
  const leadPlaceholder = document.createElement("option");
  leadPlaceholder.value = "";
  leadPlaceholder.textContent = "— Pick from saved profiles —";

  leadSel.innerHTML = "";
  leadSel.appendChild(leadPlaceholder);
  compSel.innerHTML = "";

  safeRows.forEach((row) => {
    const id = Number(row?.Id ?? row?.id ?? row?.TravellerProfileId ?? 0);
    if (!id) return;
    const txt = makeOptionText(row);
    leadSel.appendChild(new Option(txt, String(id)));
    compSel.appendChild(new Option(txt, String(id)));
  });

  // Apply pending selection (from demo) or default to first row.
  let desired = Array.isArray(pendingTravellerIdsFromDemo)
    ? pendingTravellerIdsFromDemo
    : null;

  let leadId = 0;
  let companionIds = [];
  if (desired && desired.length) {
    leadId = Number(desired[0]) || 0;
    companionIds = desired.slice(1).map((x) => Number(x)).filter((n) => n > 0);
  } else if (safeRows.length) {
    leadId = Number(safeRows[0]?.Id ?? safeRows[0]?.id ?? 0) || 0;
  }

  leadSel.value = leadId ? String(leadId) : "";
  Array.from(compSel.options || []).forEach((opt) => {
    opt.selected = companionIds.includes(Number(opt.value));
  });

  // Update passengerName + passengerPhone from the selected lead.
  const leadRow = safeRows.find(
    (r) => Number(r?.Id ?? r?.id ?? r?.TravellerProfileId ?? 0) === leadId
  );
  const leadName = getOsField(leadRow, ["FullName", "Name", "TravellerName"]);
  if (leadName && passengerNameEl) passengerNameEl.value = leadName;

  if (passengerPhoneEl && passengerPhoneEl.value.trim() === "") {
    const phone = getOsField(leadRow, [
      "EmergencyContactPhone",
      "EmergencyPhone",
      "emergencyContactPhone",
    ]);
    if (phone) passengerPhoneEl.value = phone;
  }

  pendingTravellerIdsFromDemo = null;
}

async function loadTravellerProfiles() {
  if (!travellerProfilesServiceAvailable) return;

  const listEl = document.getElementById("travellerProfilesList");
  const errEl = document.getElementById("travellerProfilesError");
  const customerIdRaw = document.getElementById("travellerCustomerID")?.value ?? "";

  if (errEl) {
    errEl.hidden = true;
    errEl.textContent = "";
  }

  const customerID = Number(customerIdRaw || 0);
  if (!customerID || customerID < 1) {
    if (errEl) {
      errEl.textContent = "Enter a valid customer number.";
      errEl.hidden = false;
    }
    if (listEl) listEl.textContent = "";
    return;
  }

  if (listEl) listEl.textContent = "Loading profiles...";

  const out = await fetchJson(`${API_BASE}/travellerprofiles/byaccount/${customerID}`);
  if (out.networkError) {
    if (errEl) {
      errEl.textContent = out.errorMessage;
      errEl.hidden = false;
    }
    if (listEl) listEl.textContent = "";
    return;
  }

  if (!out.ok) {
    const msg = out.body?.message || out.errorMessage || `HTTP ${out.status}`;
    const lower = String(msg).toLowerCase();
    if (lower.includes("traveller profile service not configured") || lower.includes("not configured")) {
      travellerProfilesServiceAvailable = false;
    }
    if (errEl) {
      errEl.textContent = msg;
      errEl.hidden = false;
    }
    latestTravellerRows = [];
    if (listEl) listEl.textContent = "";
    // Clear selectors used in Trip tab to avoid stale drop-down values.
    populateTravellerSelectorsFromRows([]);
    return;
  }

  const data = out.body?.data ?? [];
  latestTravellerRows = Array.isArray(data) ? data : [];

  if (!listEl) return;
  listEl.innerHTML = "";

  if (!latestTravellerRows.length) {
    listEl.textContent = "No saved traveller profiles found for this account.";
    return;
  }

  latestTravellerRows.forEach((row) => {
    const id = Number(row?.Id ?? row?.id ?? row?.TravellerProfileId ?? 0);
    const fullName = getOsField(row, ["FullName", "Name", "TravellerName", "fullName"]);
    const passport = getOsField(row, ["PassportNumber", "PassportNo", "passportNumber"]);
    const tail = maskPassport(passport);
    const title = fullName || `Traveller #${id}`;
    const sub = tail ? `Passport •••• ${tail}` : "Passport on file";

    const item = document.createElement("div");
    item.className = "traveller-item";
    item.innerHTML = `
      <div class="traveller-item__meta">
        <div class="traveller-item__title">${escapeHtml(title)}</div>
        <div class="traveller-item__sub">${escapeHtml(sub)}</div>
      </div>
      <button type="button" class="btn-secondary" data-action="selectTraveller" data-id="${id}">
        Edit
      </button>
    `;
    listEl.appendChild(item);
  });

  // Keep Trip tab selectors in sync (so users can pick by name).
  populateTravellerSelectorsFromRows(latestTravellerRows);
}

function resetTravellerEdit() {
  selectedTravellerRow = null;
  const wrap = document.getElementById("travellerEditWrap");
  const idEl = document.getElementById("travellerEditId");
  if (wrap) wrap.hidden = true;
  if (idEl) idEl.value = "";
  const statusEl = document.getElementById("travellerEditStatus");
  if (statusEl) statusEl.textContent = "";

  const delBtn = document.getElementById("travellerDeleteBtn");
  if (delBtn) delBtn.disabled = true;
}

function populateTravellerEditFromRow(row) {
  selectedTravellerRow = row;
  const idEl = document.getElementById("travellerEditId");
  if (idEl) idEl.value = String(row?.Id ?? row?.id ?? "");

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = v || "";
  };

  setVal("travellerEditFullName", getOsField(row, ["FullName", "Name", "TravellerName"]));
  setVal("travellerEditPassportNumber", getOsField(row, ["PassportNumber", "PassportNo"]));
  setVal(
    "travellerEditPassportExpiry",
    toDateInputValue(getOsField(row, ["PassportExpiry", "PassportExpire"]))
  );
  setVal("travellerEditDateOfBirth", toDateInputValue(getOsField(row, ["DateOfBirth", "DOB"])));
  setVal("travellerEditNationality", getOsField(row, ["Nationality", "nationality"]));
  setVal("travellerEditSeatPreference", getOsField(row, ["SeatPreference", "seatPreference"]));
  setVal("travellerEditMealPreference", getOsField(row, ["MealPreference", "mealPreference"]));
  setVal(
    "travellerEditEmergencyContactName",
    getOsField(row, ["EmergencyContactName", "EmergencyContact", "emergencyContactName"])
  );
  setVal(
    "travellerEditEmergencyContactPhone",
    getOsField(row, ["EmergencyContactPhone", "emergencyContactPhone", "EmergencyPhone"])
  );
  setVal("travellerEditRelationship", getOsField(row, ["Relationship", "relationship"]));

  const wrap = document.getElementById("travellerEditWrap");
  if (wrap) wrap.hidden = false;

  const delBtn = document.getElementById("travellerDeleteBtn");
  if (delBtn) delBtn.disabled = false;
}

function getTravellerEditPayload() {
  const customerID = Number(document.getElementById("travellerCustomerID")?.value ?? 0);
  const traveller_profile_id = Number(document.getElementById("travellerEditId")?.value ?? 0);

  const required = {
    fullName: document.getElementById("travellerEditFullName")?.value?.trim() || "",
    passportNumber: document.getElementById("travellerEditPassportNumber")?.value?.trim() || "",
    passportExpiry: document.getElementById("travellerEditPassportExpiry")?.value?.trim() || "",
  };

  const payload = selectedTravellerRow ? { ...selectedTravellerRow } : {};
  payload.CustomerID = customerID;
  if (traveller_profile_id && traveller_profile_id > 0) {
    payload.Id = traveller_profile_id;
    payload.TravellerProfileId = traveller_profile_id;
  }

  payload.FullName = required.fullName;
  payload.PassportNumber = required.passportNumber;
  payload.PassportExpiry = required.passportExpiry;

  const optFields = [
    ["DateOfBirth", "travellerEditDateOfBirth"],
    ["Nationality", "travellerEditNationality"],
    ["SeatPreference", "travellerEditSeatPreference"],
    ["MealPreference", "travellerEditMealPreference"],
    ["EmergencyContactName", "travellerEditEmergencyContactName"],
    ["EmergencyContactPhone", "travellerEditEmergencyContactPhone"],
    ["Relationship", "travellerEditRelationship"],
  ];

  optFields.forEach(([osKey, domId]) => {
    const val = document.getElementById(domId)?.value?.trim() || "";
    if (val !== "") payload[osKey] = val;
  });

  return { customerID, traveller_profile_id, required, payload };
}

function getTravellerCreatePayload() {
  const customerID = Number(document.getElementById("travellerCustomerID")?.value ?? 0);

  const required = {
    fullName: document.getElementById("travellerEditFullName")?.value?.trim() || "",
    passportNumber: document.getElementById("travellerEditPassportNumber")?.value?.trim() || "",
    passportExpiry: document.getElementById("travellerEditPassportExpiry")?.value?.trim() || "",
  };

  const payload = {
    CustomerID: customerID,
    FullName: required.fullName,
    PassportNumber: required.passportNumber,
    PassportExpiry: required.passportExpiry,
  };

  const optFields = [
    ["DateOfBirth", "travellerEditDateOfBirth"],
    ["Nationality", "travellerEditNationality"],
    ["SeatPreference", "travellerEditSeatPreference"],
    ["MealPreference", "travellerEditMealPreference"],
    ["EmergencyContactName", "travellerEditEmergencyContactName"],
    ["EmergencyContactPhone", "travellerEditEmergencyContactPhone"],
    ["Relationship", "travellerEditRelationship"],
  ];

  optFields.forEach(([osKey, domId]) => {
    const val = document.getElementById(domId)?.value?.trim() || "";
    if (val !== "") payload[osKey] = val;
  });

  return { customerID, required, payload };
}

function onTravellerCreateNew() {
  selectedTravellerRow = null;

  const wrap = document.getElementById("travellerEditWrap");
  if (wrap) wrap.hidden = false;

  const idEl = document.getElementById("travellerEditId");
  if (idEl) idEl.value = "";

  const statusEl = document.getElementById("travellerEditStatus");
  if (statusEl) statusEl.textContent = "Creating a new traveller profile…";

  // Clear input fields.
  [
    "travellerEditFullName",
    "travellerEditPassportNumber",
    "travellerEditPassportExpiry",
    "travellerEditDateOfBirth",
    "travellerEditNationality",
    "travellerEditSeatPreference",
    "travellerEditMealPreference",
    "travellerEditEmergencyContactName",
    "travellerEditEmergencyContactPhone",
    "travellerEditRelationship",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const delBtn = document.getElementById("travellerDeleteBtn");
  if (delBtn) delBtn.disabled = true;
}

async function onTravellerSave() {
  const statusEl = document.getElementById("travellerEditStatus");
  if (statusEl) statusEl.textContent = "";

  const { customerID, traveller_profile_id, required, payload } = getTravellerEditPayload();
  if (!customerID || customerID < 1) {
    if (statusEl) statusEl.textContent = "Customer number is required.";
    return;
  }

  if (!required.fullName || !required.passportNumber || !required.passportExpiry) {
    if (statusEl) statusEl.textContent = "Full name + passport number + expiry are required.";
    return;
  }

  const isCreate = !traveller_profile_id || traveller_profile_id < 1;
  let out;

  if (isCreate) {
    const create = getTravellerCreatePayload();
    if (!create.required.fullName || !create.required.passportNumber || !create.required.passportExpiry) {
      if (statusEl) statusEl.textContent = "Full name + passport number + expiry are required.";
      return;
    }

    out = await fetchJson(`${API_BASE}/travellerprofiles/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(create.payload),
    });
  } else {
    out = await fetchJson(`${API_BASE}/travellerprofiles/update/${traveller_profile_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  if (statusEl) statusEl.textContent = out.networkError
    ? out.errorMessage
    : `${isCreate ? "Create" : "Update"} response: ${JSON.stringify(out.body?.data ?? out.body ?? {}, null, 0)}`;

  await loadTravellerProfiles();
}

async function onTravellerDelete() {
  const statusEl = document.getElementById("travellerEditStatus");
  if (statusEl) statusEl.textContent = "";

  const traveller_profile_id = Number(document.getElementById("travellerEditId")?.value ?? 0);
  const customerID = Number(document.getElementById("travellerCustomerID")?.value ?? 0);

  if (!traveller_profile_id || traveller_profile_id < 1) {
    if (statusEl) statusEl.textContent = "Select a traveller record first.";
    return;
  }

  const ok = window.confirm("Delete this traveller profile? This cannot be undone in the demo UI.");
  if (!ok) return;

  const payload = { CustomerID: customerID, Id: traveller_profile_id, TravellerProfileId: traveller_profile_id };

  const out = await fetchJson(`${API_BASE}/travellerprofiles/delete/${traveller_profile_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (statusEl) {
    statusEl.textContent = out.networkError
      ? out.errorMessage
      : `Delete response: ${JSON.stringify(out.body?.data ?? out.body ?? {}, null, 0)}`;
  }

  resetTravellerEdit();
  await loadTravellerProfiles();
}

function setupTravellerProfilesUI() {
  const customerInput = document.getElementById("travellerCustomerID");
  const loadBtn = document.getElementById("loadTravellerProfilesBtn");
  const listEl = document.getElementById("travellerProfilesList");
  const createBtn = document.getElementById("travellerCreateBtn");

  if (customerInput) {
    const initialCustomer = Number(document.getElementById("customerID")?.value ?? 0);
    if (initialCustomer) customerInput.value = String(initialCustomer);
  }

  if (loadBtn) {
    loadBtn.addEventListener("click", () => loadTravellerProfiles());
  }

  if (createBtn) {
    createBtn.addEventListener("click", () => onTravellerCreateNew());
  }

  if (customerInput) {
    customerInput.addEventListener("change", () => loadTravellerProfiles());
  }

  // Keep tabs’ customerID in sync for convenience.
  const bookingCustomerInput = document.getElementById("customerID");
  if (bookingCustomerInput && customerInput) {
    bookingCustomerInput.addEventListener("change", () => {
      customerInput.value = bookingCustomerInput.value;
      // Refresh saved traveller list + the selectors used in Trip tab.
      void loadTravellerProfiles();
    });
  }

  const leadSel = document.getElementById("leadTravellerSelect");
  if (leadSel) {
    leadSel.addEventListener("change", () => {
      const leadId = Number(leadSel.value || 0);
      const leadRow = latestTravellerRows.find(
        (r) => Number(r?.Id ?? r?.id ?? 0) === leadId
      );
      const name = getOsField(leadRow, ["FullName", "Name", "TravellerName"]);
      const passengerNameEl = document.getElementById("passengerName");
      if (passengerNameEl && name) passengerNameEl.value = name;
      const passengerPhoneEl = document.getElementById("passengerPhone");
      const phone = getOsField(leadRow, [
        "EmergencyContactPhone",
        "EmergencyPhone",
        "emergencyContactPhone",
      ]);
      if (passengerPhoneEl && passengerPhoneEl.value.trim() === "" && phone) {
        passengerPhoneEl.value = phone;
      }

      refreshTripContactSummary();
    });
  }

  if (listEl) {
    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      const id = Number(btn.getAttribute("data-id") ?? 0);
      if (action === "selectTraveller") {
        const row = latestTravellerRows.find((r) => Number(r?.Id ?? r?.id ?? 0) === id);
        if (row) populateTravellerEditFromRow(row);
      }
    });
  }

  const saveBtn = document.getElementById("travellerSaveBtn");
  if (saveBtn) saveBtn.addEventListener("click", () => onTravellerSave());

  const delBtn = document.getElementById("travellerDeleteBtn");
  if (delBtn) delBtn.addEventListener("click", () => onTravellerDelete());
}

function initUI() {
  populateDemoProfileOptions();
  buildSeatMapOnce();
  updateSeatSelectionUI();

  setupSegmentTabs();
  setupLoyaltyPaymentTabs();
  setupBookingFlowTabs();
  setupTravellerProfilesUI();
  refreshTripContactSummary();

  document.getElementById("demoProfile").addEventListener("change", applyDemoProfile);
  document.getElementById("loadDemoBtn").addEventListener("click", applyDemoProfile);
  document.getElementById("newManualBtn").addEventListener("click", () => {
    setManualDefaults();
    showResult({ info: "Ready — edit the form, then confirm & pay when done." }, "Ready to edit");
  });
  document.getElementById("flightID").addEventListener("input", updateSeatSelectionUI);
  document.getElementById("flightID").addEventListener("change", updateSeatSelectionUI);
  document
    .getElementById("hotelRoomType")
    .addEventListener("change", updateBreakfastAddonUI);

  ["passengerName", "passengerEmail", "passengerPhone"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", refreshTripContactSummary);
  });

  document.getElementById("hotelSearchBtn")?.addEventListener("click", () => {
    void searchHotels();
  });

  document.getElementById("hotelResults")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='selectHotel']");
    if (!btn) return;
    const id = Number(btn.getAttribute("data-id") || 0);
    if (!Number.isFinite(id) || id < 1) return;
    void initHotelSelectionById(id);
  });

  // Initial load
  refreshNotifications();
  updateBreakfastAddonUI();
  const hotelId = Number(document.getElementById("hotelID")?.value || 0);
  void initHotelSelectionById(hotelId > 0 ? hotelId : 1);

  // Load initial loyalty state for the default customer.
  const customerID = Number(document.getElementById("customerID").value || 0);
  updateCoinsOffsetUI();
  if (customerID) updateLoyaltySummary(customerID);
  else refreshPricePreview();

  document.getElementById("customerID").addEventListener("change", () => {
    const id = Number(document.getElementById("customerID").value || 0);
    updateCoinsOffsetUI();
    if (id) updateLoyaltySummary(id);
    else {
      latestLoyalty = null;
      document.getElementById("loyaltyCoins").textContent = "-";
      document.getElementById("loyaltyTier").textContent = "-";
      refreshPricePreview();
    }
    // Keep Trip-tab traveller selectors in sync with the account chosen.
    if (document.getElementById("leadTravellerSelect")) {
      void loadTravellerProfiles();
    }
  });

  ["totalPrice", "discountCode", "coinsToSpendCents"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", refreshPricePreview);
    document.getElementById(id)?.addEventListener("change", refreshPricePreview);
  });

  const btnNone = document.getElementById("coinsUseNoneBtn");
  if (btnNone) {
    btnNone.addEventListener("click", () => {
      setCoinsToSpendCents(0);
    });
  }
  const btnAll = document.getElementById("coinsUseAllBtn");
  if (btnAll) {
    btnAll.addEventListener("click", () => {
      const cid = Number(document.getElementById("customerID")?.value || 0);
      if (!hasAccountCustomerId(cid)) return;
      const coinsAvail = Number(latestLoyalty?.coins ?? 0);
      setCoinsToSpendCents(coinsAvail);
    });
  }

  document.getElementById("copyResultBtn").addEventListener("click", () => {
    clearError(document.getElementById("uiError"));
    copyLatestResult();
  });

  document.getElementById("refreshNotifBtn").addEventListener("click", () => {
    clearError(document.getElementById("uiError"));
    refreshNotifications();
  });

  document.getElementById("createForm").addEventListener("submit", onCreateBookingSubmit);
  document.getElementById("cancelForm").addEventListener("submit", onCancelBookingSubmit);
}

window.addEventListener("DOMContentLoaded", initUI);

