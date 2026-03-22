// Travel Booking UI logic

const API_BASE = "http://localhost:5101";
const LOYALTY_BASE = "http://localhost:5105";
const NOTIFICATION_BASE = "http://localhost:5106";

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
      "• Booking API responds: open http://localhost:5101/ in the browser",
      "• Use the UI at http://localhost:8080 (not file://)",
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
  try {
    const out = await fetchJson(`${API_BASE}/booking/cancel/${id}`, {
      method: "POST",
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
      showResult(data, `POST /booking/cancel/${id} • HTTP ${httpStatus}`);
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
      showResult(data ?? { error: msg }, `POST /booking/cancel/${id} • HTTP ${httpStatus}`);
      return;
    }

    if (!data?.data) {
      const msg = "Cancel response missing data payload.";
      setError(uiError, msg);
      showResult({ _help: msg, received: data }, `POST /booking/cancel/${id} • HTTP ${httpStatus}`);
      return;
    }

    showResult(data, `POST /booking/cancel/${id} • HTTP ${httpStatus}`);

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

