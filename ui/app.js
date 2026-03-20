// Travel Booking UI logic

const API_BASE = "http://localhost:5101";
const LOYALTY_BASE = "http://localhost:5105";
const NOTIFICATION_BASE = "http://localhost:5106";

let latestResult = null;
let latestLoyalty = null; // { coins, bookingCount, tier, ... } from loyalty service

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
  try {
    const res = await fetch(`${LOYALTY_BASE}/loyalty/${customerID}/points`);
    const data = await res.json();
    if (data && data.data) {
      latestLoyalty = data.data;
      document.getElementById("loyaltyCoins").textContent =
        data.data.coins ?? data.data.points ?? "-";
      document.getElementById("loyaltyTier").textContent = data.data.tier;
    }
  } catch {
    // Non-fatal for demo.
    latestLoyalty = null;
    document.getElementById("loyaltyCoins").textContent = "-";
    document.getElementById("loyaltyTier").textContent = "-";
  }
}

async function refreshNotifications() {
  try {
    const res = await fetch(`${NOTIFICATION_BASE}/notifications`);
    const data = await res.json();
    document.getElementById("notifications").textContent = JSON.stringify(
      data,
      null,
      2
    );
  } catch (e) {
    document.getElementById("notifications").textContent = JSON.stringify(
      { error: String(e) },
      null,
      2
    );
  }
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

    const res = await fetch(API_BASE + "/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    showResult(data, `POST /booking • HTTP ${res.status}`);
    if (data.data && data.data.id) {
      document.getElementById("cancelBookingID").value = data.data.id;
    }

    // Update loyalty summary after booking creation.
    await updateLoyaltySummary(payload.customerID);
  } catch (err) {
    const msg = String(err);
    setError(createError, msg);
    showResult({ error: msg }, "Network error while creating booking");
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
    const res = await fetch(API_BASE + "/booking/cancel/" + id, { method: "POST" });
    const data = await res.json();
    showResult(data, `POST /booking/cancel/${id} • HTTP ${res.status}`);

    // Show notifications consumed by the RabbitMQ consumer.
    await refreshNotifications();

    // Update loyalty summary for the booking's customer.
    try {
      const bookingRes = await fetch(API_BASE + "/booking/" + id);
      const bookingData = await bookingRes.json();
      const customerID = bookingData?.data?.customerID;
      if (customerID) await updateLoyaltySummary(customerID);
    } catch {
      // Non-fatal for demo.
    }
  } catch (err) {
    const msg = String(err);
    setError(uiError, msg);
    showResult({ error: msg }, "Network error while cancelling booking");
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

