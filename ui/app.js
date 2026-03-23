// Travel Booking UI logic

// Same-origin paths (nginx proxies to booking / loyalty / notification — see nginx/ui.conf)
const API_BASE = "/api/booking";
const LOYALTY_BASE = "/api/loyalty";
const NOTIFICATION_BASE = "/api/notification";

/** Demo personas — pick from dropdown to fill the form for presentations */
const DEMO_PROFILES = [
  {
    id: "ava",
    label: "Ava Chen — casual traveller (cust 1)",
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
    id: "ben",
    label: "Ben Kumar — business (cust 2)",
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
  document.getElementById("flightID").value = p.flightID;
  document.getElementById("hotelID").value = p.hotelID;
  document.getElementById("hotelRoomType").value = p.hotelRoomType;
  document.getElementById("hotelIncludesBreakfast").checked = !!p.hotelIncludesBreakfast;
  document.getElementById("departureTime").value = p.departureTime;
  document.getElementById("totalPrice").value = p.totalPrice;
  document.getElementById("currency").value = p.currency;
  document.getElementById("fareType").value = p.fareType;
  document.getElementById("discountCode").value = p.discountCode || "";
  document.getElementById("coinsToSpendCents").value = p.coinsToSpendCents ?? 0;

  updateSeatSelectionUI();
  if (p.preferredSeat && getSeatPolicy(p.flightID).onlineSeatSelection) {
    selectSeatByCode(p.preferredSeat);
  } else {
    clearSeatSelection();
  }

  const cid = Number(p.customerID);
  if (cid) updateLoyaltySummary(cid);
}

function setManualDefaults() {
  document.getElementById("demoProfile").value = "";
  document.getElementById("customerID").value = 1;
  document.getElementById("flightID").value = "SQ001";
  document.getElementById("hotelID").value = 1;
  document.getElementById("hotelRoomType").value = "STD";
  document.getElementById("hotelIncludesBreakfast").checked = false;
  document.getElementById("departureTime").value = "2026-05-01T10:00";
  document.getElementById("totalPrice").value = 1200;
  document.getElementById("currency").value = "SGD";
  document.getElementById("fareType").value = "Flexi";
  document.getElementById("discountCode").value = "";
  document.getElementById("coinsToSpendCents").value = 0;
  clearSeatSelection();
  updateSeatSelectionUI();
}

function showResult(obj, meta = "") {
  latestResult = obj;
  document.getElementById("result").textContent = JSON.stringify(obj, null, 2);
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
    return;
  }
  const data = out.body;
  latestLoyalty = data.data;
  document.getElementById("loyaltyCoins").textContent =
    data.data.coins ?? data.data.points ?? "-";
  document.getElementById("loyaltyTier").textContent = data.data.tier;
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

  const payload = {
    customerID: Number(document.getElementById("customerID").value),
    flightID: document.getElementById("flightID").value,
    hotelID: Number(document.getElementById("hotelID").value),
    hotelRoomType: document.getElementById("hotelRoomType").value,
    hotelIncludesBreakfast: document.getElementById("hotelIncludesBreakfast").checked,
    departureTime: document.getElementById("departureTime").value,
    totalPrice: Number(document.getElementById("totalPrice").value),
    currency: document.getElementById("currency").value,
    fareType: document.getElementById("fareType").value,
    seatNumber: seatPol.onlineSeatSelection
      ? document.getElementById("seatNumber").value.trim().toUpperCase()
      : null,
  };

  try {
    // Compute discounts/coin offset client-side for the demo.
    // Backend uses the final `totalPrice` you send here.
    const basePrice = Number(document.getElementById("totalPrice").value);
    const customerID = payload.customerID;

    let projectedTier = "Bronze";
    let tierDiscount = 0;
    let codeDiscount = 0;

    if (customerID) {
      const bookingCount = Number(latestLoyalty?.bookingCount ?? 0);
      projectedTier = computeProjectedTier(bookingCount + 1);
      tierDiscount = tierDiscountPercent(projectedTier);
      codeDiscount = codeDiscountPercent(
        document.getElementById("discountCode").value,
        projectedTier
      );
    }

    const coinsAvailableCents = Number(latestLoyalty?.coins ?? 0);
    const coinsToSpendRequestedCents = Math.max(
      0,
      Number(document.getElementById("coinsToSpendCents").value || 0)
    );
    const coinsToSpendCents = Math.min(coinsAvailableCents, coinsToSpendRequestedCents);

    const coinsOffsetValue = coinsToSpendCents / 100;
    const tierDiscountValue = (basePrice * tierDiscount) / 100;
    const codeDiscountValue = (basePrice * codeDiscount) / 100;
    const finalPaid = Math.max(0, basePrice - tierDiscountValue - codeDiscountValue - coinsOffsetValue);

    document.getElementById("computedTotalPrice").textContent = finalPaid.toFixed(2);

    payload.totalPrice = finalPaid;
    payload.coinsToSpendCents = coinsToSpendCents;

    const out = await fetchJson(`${API_BASE}/booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (out.networkError) {
      setError(createError, out.errorMessage);
      showResult({ error: out.errorMessage }, "Network error");
      return;
    }

    const data = out.body;
    const httpStatus = out.status;

    if (out.parseError && data?._parseError) {
      const msg =
        "Server returned non-JSON (wrong URL or proxy). Expected JSON from POST /booking.";
      setError(createError, msg);
      showResult(data, `POST /booking • HTTP ${httpStatus}`);
      return;
    }

    if (isBookingWelcomePayload(data)) {
      const msg =
        "Got the Booking API welcome page (GET /) instead of a booking. Use POST /booking only. Ensure Docker is up: http://localhost:5101/";
      setError(createError, msg);
      showResult(
        {
          _help: msg,
          received: data,
        },
        `Unexpected • HTTP ${httpStatus}`
      );
      return;
    }

    if (!out.ok || (data && typeof data.code === "number" && data.code >= 400)) {
      const msg = data?.message || `Request failed (HTTP ${httpStatus})`;
      setError(createError, msg);
      showResult(data ?? { error: msg }, `POST /booking • HTTP ${httpStatus}`);
      return;
    }

    if (isMissingBookingData(data)) {
      const msg =
        "Response OK but missing booking data (expected code + data.id). Check Booking service.";
      setError(createError, msg);
      showResult(
        { _help: msg, received: data },
        `POST /booking • HTTP ${httpStatus}`
      );
      return;
    }

    showResult(data, `POST /booking • HTTP ${httpStatus}`);
    document.getElementById("cancelBookingID").value = data.data.id;

    await updateLoyaltySummary(payload.customerID);
  } catch (err) {
    const msg = formatNetworkError(err);
    setError(createError, msg);
    showResult({ error: msg }, "Error while creating booking");
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

  const id = document.getElementById("cancelBookingID").value;
  const cancelSource = document.getElementById("cancelSource").value;
  try {
    const out = await fetchJson(`${API_BASE}/booking/cancel/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelSource }),
    });

    if (out.networkError) {
      setError(uiError, out.errorMessage);
      showResult({ error: out.errorMessage }, "Network error");
      return;
    }

    const data = out.body;
    const httpStatus = out.status;

    if (out.parseError && data?._parseError) {
      const msg = "Server returned non-JSON for cancel. Check Booking API.";
      setError(uiError, msg);
      showResult(data, `POST /booking/cancel/${id} (${cancelSource}) • HTTP ${httpStatus}`);
      return;
    }

    if (isBookingWelcomePayload(data)) {
      const msg =
        "Got welcome JSON instead of cancel response. Wrong URL or proxy — use POST /booking/cancel/{id}.";
      setError(uiError, msg);
      showResult({ _help: msg, received: data }, `Unexpected • HTTP ${httpStatus}`);
      return;
    }

    if (!out.ok || (data && typeof data.code === "number" && data.code >= 400)) {
      const msg = data?.message || `Cancel failed (HTTP ${httpStatus})`;
      setError(uiError, msg);
      showResult(
        data ?? { error: msg },
        `POST /booking/cancel/${id} (${cancelSource}) • HTTP ${httpStatus}`
      );
      return;
    }

    if (!data?.data) {
      const msg = "Cancel response missing data payload.";
      setError(uiError, msg);
      showResult(
        { _help: msg, received: data },
        `POST /booking/cancel/${id} (${cancelSource}) • HTTP ${httpStatus}`
      );
      return;
    }

    showResult(data, `POST /booking/cancel/${id} (${cancelSource}) • HTTP ${httpStatus}`);

    await refreshNotifications();

    const bookingOut = await fetchJson(`${API_BASE}/booking/${id}`);
    if (!bookingOut.networkError && bookingOut.body?.data?.customerID) {
      await updateLoyaltySummary(bookingOut.body.data.customerID);
    }
  } catch (err) {
    const msg = formatNetworkError(err);
    setError(uiError, msg);
    showResult({ error: msg }, "Error while cancelling booking");
  } finally {
    cancelBtn.disabled = false;
  }
}

function initUI() {
  populateDemoProfileOptions();
  buildSeatMapOnce();
  updateSeatSelectionUI();

  document.getElementById("demoProfile").addEventListener("change", applyDemoProfile);
  document.getElementById("loadDemoBtn").addEventListener("click", applyDemoProfile);
  document.getElementById("newManualBtn").addEventListener("click", () => {
    setManualDefaults();
    showResult({ info: "Manual mode ready. Edit fields and click Create Booking." }, "Manual entry");
  });
  document.getElementById("flightID").addEventListener("input", updateSeatSelectionUI);
  document.getElementById("flightID").addEventListener("change", updateSeatSelectionUI);

  // Initial load
  refreshNotifications();

  // Load initial loyalty state for the default customer.
  const customerID = Number(document.getElementById("customerID").value || 0);
  if (customerID) updateLoyaltySummary(customerID);

  document.getElementById("customerID").addEventListener("change", () => {
    const id = Number(document.getElementById("customerID").value || 0);
    if (id) updateLoyaltySummary(id);
    else {
      latestLoyalty = null;
      document.getElementById("loyaltyCoins").textContent = "-";
      document.getElementById("loyaltyTier").textContent = "-";
    }
  });

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

