// Travel Booking UI logic

// Same-origin paths (nginx proxies to services — see nginx/ui.conf)
const API_BASE = "/api/booking";
const LOYALTY_BASE = "/api/loyalty";
const NOTIFICATION_BASE = "/api/notification";
const GRAPHQL_BASE = "/api/graphql/graphql";
const FLIGHT_BASE = "/api/flight";
const BUNDLE_PRICE_BASE = "/api/bundle-price";
// Keep REST hotel base as fallback path if GraphQL is down.
const HOTEL_BASE = "http://localhost:5103";

/**
 * Curated packages — multiple hubs worldwide. `region` drives filter chips:
 * asia | europe | intercontinental
 */
const BUNDLE_PRESETS = [
  {
    id: "tokyo",
    title: "Tokyo city break",
    route: "Singapore → Tokyo",
    origin: "Singapore",
    destination: "Tokyo",
    region: "asia",
    depart: "2026-05-01T10:00",
    ret: "2026-05-06T11:00",
    blurb: "5 nights · culture & dining",
    image: "https://picsum.photos/seed/pkg-tokyo/520/300",
  },
  {
    id: "bangkok",
    title: "Bangkok nights",
    route: "Singapore → Bangkok",
    origin: "Singapore",
    destination: "Bangkok",
    region: "asia",
    depart: "2026-06-10T08:00",
    ret: "2026-06-14T18:00",
    blurb: "4 nights · temples & street food",
    image: "https://picsum.photos/seed/pkg-bangkok/520/300",
  },
  {
    id: "bali",
    title: "Bali unwind",
    route: "Singapore → Bali",
    origin: "Singapore",
    destination: "Bali",
    region: "asia",
    depart: "2026-07-05T09:00",
    ret: "2026-07-12T10:00",
    blurb: "7 nights · beaches & spas",
    image: "https://picsum.photos/seed/pkg-bali/520/300",
  },
  {
    id: "sydney",
    title: "Sydney harbour",
    route: "Singapore → Sydney",
    origin: "Singapore",
    destination: "Sydney",
    region: "asia",
    depart: "2026-08-02T09:30",
    ret: "2026-08-09T16:00",
    blurb: "7 nights · Opera House & coast",
    image: "https://picsum.photos/seed/pkg-sydney/520/300",
  },
  {
    id: "london",
    title: "London grand tour",
    route: "Singapore → London",
    origin: "Singapore",
    destination: "London",
    region: "intercontinental",
    depart: "2026-05-20T23:55",
    ret: "2026-05-28T11:00",
    blurb: "8 nights · museums & theatre",
    image: "https://picsum.photos/seed/pkg-london/520/300",
  },
  {
    id: "lon-par",
    title: "Paris art escape",
    route: "London → Paris",
    origin: "London",
    destination: "Paris",
    region: "europe",
    depart: "2026-06-02T09:00",
    ret: "2026-06-07T17:00",
    blurb: "5 nights · Louvre & cafés",
    image: "https://picsum.photos/seed/pkg-paris/520/300",
  },
  {
    id: "par-lon",
    title: "London from Paris",
    route: "Paris → London",
    origin: "Paris",
    destination: "London",
    region: "europe",
    depart: "2026-06-10T10:00",
    ret: "2026-06-16T20:00",
    blurb: "6 nights · West End & markets",
    image: "https://picsum.photos/seed/pkg-london-par/520/300",
  },
  {
    id: "lon-tyo",
    title: "London to Tokyo",
    route: "London → Tokyo",
    origin: "London",
    destination: "Tokyo",
    region: "intercontinental",
    depart: "2026-06-18T11:00",
    ret: "2026-06-26T16:00",
    blurb: "8 nights · Shinjuku & day trips",
    image: "https://picsum.photos/seed/pkg-lon-tok/520/300",
  },
  {
    id: "syd-sin",
    title: "Sydney to Singapore",
    route: "Sydney → Singapore",
    origin: "Sydney",
    destination: "Singapore",
    region: "asia",
    depart: "2026-07-01T08:00",
    ret: "2026-07-08T10:00",
    blurb: "7 nights · hawkers & Marina Bay",
    image: "https://picsum.photos/seed/pkg-syd-sin/520/300",
  },
  {
    id: "tyo-bkk",
    title: "Tokyo to Bangkok",
    route: "Tokyo → Bangkok",
    origin: "Tokyo",
    destination: "Bangkok",
    region: "asia",
    depart: "2026-08-01T11:00",
    ret: "2026-08-07T09:00",
    blurb: "6 nights · two-city foodie hop",
    image: "https://picsum.photos/seed/pkg-tyo-bkk/520/300",
  },
  {
    id: "bkk-dps",
    title: "Bangkok to Bali",
    route: "Bangkok → Bali",
    origin: "Bangkok",
    destination: "Bali",
    region: "asia",
    depart: "2026-09-03T10:00",
    ret: "2026-09-10T14:00",
    blurb: "7 nights · temples to surf",
    image: "https://picsum.photos/seed/pkg-bkk-dps/520/300",
  },
];

const BUNDLE_REGION_OPTIONS = [
  { value: "all", label: "All regions" },
  { value: "asia", label: "Asia & Pacific" },
  { value: "europe", label: "Europe & UK" },
  { value: "intercontinental", label: "Long-haul hubs" },
];

/** City names in BUNDLE_PRESETS → stable filter slug */
const CITY_COUNTRY_SLUG = {
  Singapore: "singapore",
  Tokyo: "japan",
  Bangkok: "thailand",
  Bali: "indonesia",
  Sydney: "australia",
  London: "uk",
  Paris: "france",
};

const BUNDLE_COUNTRY_LABEL = {
  singapore: "Singapore",
  japan: "Japan",
  thailand: "Thailand",
  indonesia: "Indonesia",
  australia: "Australia",
  uk: "United Kingdom",
  france: "France",
};

function countriesUsedByPresets() {
  const slugs = new Set();
  for (const p of BUNDLE_PRESETS) {
    const a = CITY_COUNTRY_SLUG[p.origin];
    const b = CITY_COUNTRY_SLUG[p.destination];
    if (a) slugs.add(a);
    if (b) slugs.add(b);
  }
  return [...slugs].sort((x, y) => BUNDLE_COUNTRY_LABEL[x].localeCompare(BUNDLE_COUNTRY_LABEL[y]));
}

/** id -> { total?, err?, loading? } for card badges */
const bundleCardPriceCache = new Map();
let bundleCardPriceTimer = null;

/** Demo members — values are internal customer ids; labels are what travellers expect (name + hint). */
const CUSTOMER_OPTIONS = [
  { id: 1, label: "Ava Chen · Singapore" },
  { id: 2, label: "Ben Kumar" },
  { id: 3, label: "Casey Tan" },
  { id: 4, label: "Dana Ng" },
  { id: 5, label: "Evan Lee" },
  { id: 6, label: "Fiona Ong" },
];

const TRIP_WINDOW_OPTIONS = [
  { value: "2026-05-01T10:00|||2026-05-06T11:00", label: "1 May – 6 May 2026 · 5 nights" },
  { value: "2026-06-10T08:00|||2026-06-14T18:00", label: "10 Jun – 14 Jun 2026 · 4 nights" },
  { value: "2026-07-05T09:00|||2026-07-12T10:00", label: "5 Jul – 12 Jul 2026 · 7 nights" },
  { value: "2026-08-02T09:30|||2026-08-09T16:00", label: "2 Aug – 9 Aug 2026 · 7 nights" },
  { value: "2026-05-20T23:55|||2026-05-28T11:00", label: "20 May – 28 May 2026 · 8 nights" },
  { value: "2026-04-18T09:00|||2026-04-22T09:00", label: "18 Apr – 22 Apr 2026 · 4 nights" },
  { value: "2026-09-05T08:00|||2026-09-15T18:00", label: "5 Sep – 15 Sep 2026 · 10 nights" },
  { value: "2026-11-10T10:00|||2026-11-17T12:00", label: "10 Nov – 17 Nov 2026 · 7 nights" },
];

function getFilteredPresets() {
  const reg = document.getElementById("bundleFilterRegion")?.value || "all";
  const country = document.getElementById("bundleFilterCountry")?.value || "all";
  const from = document.getElementById("bundleFilterFrom")?.value || "all";
  const to = document.getElementById("bundleFilterTo")?.value || "all";
  return BUNDLE_PRESETS.filter((p) => {
    if (reg !== "all" && p.region !== reg) return false;
    if (country !== "all") {
      const o = CITY_COUNTRY_SLUG[p.origin];
      const d = CITY_COUNTRY_SLUG[p.destination];
      if (o !== country && d !== country) return false;
    }
    if (from !== "all" && p.origin !== from) return false;
    if (to !== "all" && p.destination !== to) return false;
    return true;
  });
}

function populateBundleFilterSelects() {
  const regSel = document.getElementById("bundleFilterRegion");
  if (regSel) {
    regSel.replaceChildren();
    for (const r of BUNDLE_REGION_OPTIONS) {
      const o = document.createElement("option");
      o.value = r.value;
      o.textContent = r.label;
      regSel.appendChild(o);
    }
    regSel.value = "all";
  }
  const origins = [...new Set(BUNDLE_PRESETS.map((p) => p.origin))].sort();
  const dests = [...new Set(BUNDLE_PRESETS.map((p) => p.destination))].sort();
  const fromSel = document.getElementById("bundleFilterFrom");
  if (fromSel) {
    fromSel.replaceChildren();
    const allO = document.createElement("option");
    allO.value = "all";
    allO.textContent = "Any city";
    fromSel.appendChild(allO);
    for (const city of origins) {
      const o = document.createElement("option");
      o.value = city;
      o.textContent = city;
      fromSel.appendChild(o);
    }
    fromSel.value = "all";
  }
  const toSel = document.getElementById("bundleFilterTo");
  if (toSel) {
    toSel.replaceChildren();
    const allT = document.createElement("option");
    allT.value = "all";
    allT.textContent = "Any city";
    toSel.appendChild(allT);
    for (const city of dests) {
      const o = document.createElement("option");
      o.value = city;
      o.textContent = city;
      toSel.appendChild(o);
    }
    toSel.value = "all";
  }
  const countrySel = document.getElementById("bundleFilterCountry");
  if (countrySel) {
    countrySel.replaceChildren();
    const allC = document.createElement("option");
    allC.value = "all";
    allC.textContent = "Any country";
    countrySel.appendChild(allC);
    for (const slug of countriesUsedByPresets()) {
      const o = document.createElement("option");
      o.value = slug;
      o.textContent = BUNDLE_COUNTRY_LABEL[slug] || slug;
      countrySel.appendChild(o);
    }
    countrySel.value = "all";
  }
}

function populateBundleRouteSelectsFromPresets() {
  const origins = [...new Set(BUNDLE_PRESETS.map((p) => p.origin))].sort();
  const dests = [...new Set(BUNDLE_PRESETS.map((p) => p.destination))].sort();
  const oSel = document.getElementById("bundleOrigin");
  const dSel = document.getElementById("bundleDestination");
  if (oSel && oSel.tagName === "SELECT") {
    oSel.replaceChildren();
    for (const city of origins) {
      const opt = document.createElement("option");
      opt.value = city;
      opt.textContent = city;
      oSel.appendChild(opt);
    }
    if (origins.includes("Singapore")) oSel.value = "Singapore";
    else if (origins.length) oSel.value = origins[0];
  }
  if (dSel && dSel.tagName === "SELECT") {
    dSel.replaceChildren();
    for (const city of dests) {
      const opt = document.createElement("option");
      opt.value = city;
      opt.textContent = city;
      dSel.appendChild(opt);
    }
    if (dests.includes("Tokyo")) dSel.value = "Tokyo";
    else if (dests.length) dSel.value = dests[0];
  }
}

function bundleCardPriceLabel(presetId) {
  const c = bundleCardPriceCache.get(presetId);
  if (!c || c.loading) return "Pricing…";
  if (c.err) return "—";
  if (Number.isFinite(c.total)) return `From SGD ${Math.round(Number(c.total))}`;
  return "—";
}

function updateBundleCardPriceLabels() {
  document.querySelectorAll(".bundle-card__price").forEach((el) => {
    const id = el.getAttribute("data-preset-id");
    if (id) el.textContent = bundleCardPriceLabel(id);
  });
}

async function refreshBundleCardPrices() {
  const customerId = document.getElementById("customerID")?.value?.trim();
  const travellers = document.getElementById("bundleNumberOfTravellers")?.value?.trim();
  if (!customerId || !travellers) return;
  const coinsInput = document.getElementById("coinsToSpendCents");
  const coins = Math.max(0, Number(coinsInput?.value || 0));

  for (const p of BUNDLE_PRESETS) {
    bundleCardPriceCache.set(p.id, { loading: true });
  }
  updateBundleCardPriceLabels();

  await Promise.all(
    BUNDLE_PRESETS.map(async (p) => {
      const qs = new URLSearchParams();
      qs.set("origin", p.origin);
      qs.set("destination", p.destination);
      qs.set("departDate", p.depart);
      qs.set("returnDate", p.ret);
      qs.set("numberOfTravellers", travellers);
      qs.set("customerId", customerId);
      qs.set("loyaltyCoinsToUseCents", String(coins));
      const out = await fetchJson(`${BUNDLE_PRICE_BASE}?${qs.toString()}`);
      if (out.networkError || !out.ok) {
        bundleCardPriceCache.set(p.id, {
          err: out.errorMessage || "unavailable",
          total: null,
        });
        return;
      }
      const data = out.body?.data;
      if (out.body?.code !== 200 || !data) {
        bundleCardPriceCache.set(p.id, { err: "n/a", total: null });
        return;
      }
      bundleCardPriceCache.set(p.id, {
        total: Number(data.finalTotal),
        err: null,
      });
    })
  );
  updateBundleCardPriceLabels();
}

function scheduleBundleCardPriceRefresh() {
  clearTimeout(bundleCardPriceTimer);
  bundleCardPriceTimer = setTimeout(() => void refreshBundleCardPrices(), 450);
}

function onBundleFiltersChanged() {
  const visible = new Set(getFilteredPresets().map((p) => p.id));
  if (selectedBundlePresetId && !visible.has(selectedBundlePresetId)) {
    clearBundleSelectionState();
  }
  populateBundlePackageSelect();
  renderBundleGallery();
  scheduleBundleCardPriceRefresh();
}

function setupBundleFilterListeners() {
  for (const id of ["bundleFilterRegion", "bundleFilterCountry", "bundleFilterFrom", "bundleFilterTo"]) {
    document.getElementById(id)?.addEventListener("change", () => onBundleFiltersChanged());
  }
}

function populateCustomerSelects() {
  for (const id of ["customerID", "travellerCustomerID"]) {
    const sel = document.getElementById(id);
    if (!sel || sel.tagName !== "SELECT") continue;
    sel.replaceChildren();
    for (const c of CUSTOMER_OPTIONS) {
      const o = document.createElement("option");
      o.value = String(c.id);
      o.textContent = c.label;
      sel.appendChild(o);
    }
    sel.value = "1";
  }
}

function populateTravellerCountSelect() {
  const sel = document.getElementById("bundleNumberOfTravellers");
  if (!sel || sel.tagName !== "SELECT") return;
  sel.replaceChildren();
  for (let n = 1; n <= 12; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = n === 1 ? "1 guest" : `${n} guests`;
    sel.appendChild(o);
  }
  sel.value = "2";
}

function populateTripWindowSelect() {
  const sel = document.getElementById("bundleTripWindowSelect");
  if (!sel) return;
  sel.replaceChildren();
  for (const row of TRIP_WINDOW_OPTIONS) {
    const o = document.createElement("option");
    o.value = row.value;
    o.textContent = row.label;
    sel.appendChild(o);
  }
  if (TRIP_WINDOW_OPTIONS[0]) sel.value = TRIP_WINDOW_OPTIONS[0].value;
}

function applyTripWindowFromSelect() {
  const tw = document.getElementById("bundleTripWindowSelect");
  const depEl = document.getElementById("bundleDepartDateTime");
  const retEl = document.getElementById("bundleReturnDateTime");
  if (!tw || !depEl || !retEl) return;
  const raw = tw.value || "";
  const parts = raw.split("|||");
  if (parts.length === 2) {
    depEl.value = parts[0].trim();
    retEl.value = parts[1].trim();
  }
}

function syncTripWindowFromDateInputs() {
  const depEl = document.getElementById("bundleDepartDateTime");
  const retEl = document.getElementById("bundleReturnDateTime");
  if (!depEl || !retEl) return;
  const depart = String(depEl.value || "").trim();
  const ret = String(retEl.value || "").trim();
  if (!depart || !ret) return;
  ensureTripWindowOption(depart, ret);
}

function ensureTripWindowOption(depart, ret) {
  const sel = document.getElementById("bundleTripWindowSelect");
  if (!sel) return;
  const v = `${depart}|||${ret}`;
  const exists = Array.from(sel.options).some((o) => o.value === v);
  if (!exists) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = `${depart.replace("T", " ")} → ${ret.replace("T", " ")}`;
    sel.appendChild(o);
  }
  sel.value = v;
}

function populateBundlePackageSelect() {
  const sel = document.getElementById("bundlePackageSelect");
  if (!sel) return;
  const keep = sel.value;
  sel.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— Select a package —";
  sel.appendChild(ph);
  for (const p of getFilteredPresets()) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = `${p.title} (${p.route})`;
    sel.appendChild(o);
  }
  const valid = keep && Array.from(sel.options).some((o) => o.value === keep);
  sel.value = valid ? keep : "";
}

function onFineTuneDivergeFromPackage() {
  selectedBundlePresetId = null;
  const pkg = document.getElementById("bundlePackageSelect");
  if (pkg) pkg.value = "";
  document.querySelectorAll(".bundle-card").forEach((b) => {
    b.classList.remove("bundle-card--selected");
    b.setAttribute("aria-pressed", "false");
  });
  latestBundlePricing = null;
  lastBundleParams = null;
  setBundleResultVisible(false);
  const st = document.getElementById("bundleStatus");
  if (st) {
    st.textContent =
      "Trip details changed — pick a package again, or open Fine-tune and tap Recalculate bundle price.";
  }
}

function setupBundleFineTuneListeners() {
  document.getElementById("bundleTripWindowSelect")?.addEventListener("change", () => {
    applyTripWindowFromSelect();
    onFineTuneDivergeFromPackage();
  });
  document.getElementById("bundleOrigin")?.addEventListener("change", () => onFineTuneDivergeFromPackage());
  document.getElementById("bundleDestination")?.addEventListener("change", () => onFineTuneDivergeFromPackage());
  document.getElementById("bundlePackageSelect")?.addEventListener("change", (e) => {
    const v = e.target.value;
    if (!v) {
      clearBundleSelectionState();
      return;
    }
    selectBundlePreset(v);
  });
}

/** Demo personas — pick from dropdown to fill the form for presentations */
const DEMO_PROFILES = [
  {
    id: "ava",
    label: "Ava Chen — casual traveller",
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
    label: "Ava + 2 companions (instructors: OS profile Ids 9 & 10 after seed)",
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
    label: "Ben Kumar — business trip",
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
    label: "Elena — corporate (PLAT20)",
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

const DEFAULT_TAKEN_SEATS = new Set(["8A", "8B", "9D", "10F", "12C"]);
let currentTakenSeats = new Set(DEFAULT_TAKEN_SEATS);
let seatRefreshToken = 0;

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

// Bundle pricing composite (Search & Price Bundle step).
let latestBundlePricing = null; // { flightPrice, hotelPrice, discount, loyaltyUsed, finalTotal, ... }
let lastBundleParams = null; // query params used for last bundle call
let selectedBundlePresetId = null;

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

async function fetchGraphql(query, variables = {}) {
  const out = await fetchJson(GRAPHQL_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (out.networkError || !out.ok) return out;
  if (out.body?.errors?.length) {
    return {
      ok: false,
      status: out.status,
      body: out.body,
      networkError: false,
      errorMessage: out.body.errors.map((e) => e.message).join("; "),
    };
  }
  return out;
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
/** In this demo, numeric customer id &gt; 0 means a member with a loyalty wallet; 0 = no wallet (e.g. guest flows). */
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
  // If bundle pricing was run, prefer the diagram-aligned finalTotal.
  const bTotal = latestBundlePricing?.finalTotal;
  if (Number.isFinite(Number(bTotal))) {
    el.textContent = Number(bTotal).toFixed(2);
    return;
  }

  const { finalPaid } = computeFinalPriceBreakdown();
  el.textContent = Number.isFinite(finalPaid) ? finalPaid.toFixed(2) : "-";
}

function setBundleResultVisible(_isVisible) {
  /* Breakdown panel removed — totals live on cards + payment step */
}

function applyBundlePricingResult(bundle, inputsForThisCall) {
  if (!bundle || typeof bundle !== "object") return;
  latestBundlePricing = bundle;
  lastBundleParams = inputsForThisCall || lastBundleParams;

  const statusEl = document.getElementById("bundleStatus");
  if (statusEl) {
    const t = bundle.finalTotal;
    statusEl.textContent = Number.isFinite(Number(t))
      ? `Selected — total SGD ${Number(t).toFixed(2)}. Continue with traveller, hotel & flight steps.`
      : "Bundle applied.";
  }

  if (selectedBundlePresetId) {
    bundleCardPriceCache.set(selectedBundlePresetId, {
      total: Number(bundle.finalTotal),
      err: null,
    });
    updateBundleCardPriceLabels();
  }

  // Fill booking core fields from bundle result.
  const flightIdEl = document.getElementById("flightID");
  if (flightIdEl && bundle.flightNum) flightIdEl.value = String(bundle.flightNum);

  const hotelIdEl = document.getElementById("hotelID");
  if (hotelIdEl && Number.isFinite(Number(bundle.hotelID))) {
    hotelIdEl.value = String(bundle.hotelID);
  }

  // DepartureTime is what Booking uses for refund timing.
  if (inputsForThisCall?.departDate) {
    const depEl = document.getElementById("departureTime");
    if (depEl) depEl.value = String(inputsForThisCall.departDate);
  }

  // Total price charged at payment time.
  const totalEl = document.getElementById("totalPrice");
  if (totalEl && Number.isFinite(Number(bundle.finalTotal))) {
    totalEl.value = String(Number(bundle.finalTotal));
  }

  // Apply chosen room type and hotel selection.
  const hid = Number(bundle.hotelID || 0);
  const chosenRoomType = (bundle.chosenRoomType || bundle.roomType || "").toString().toUpperCase();
  if (hid > 0) {
    void initHotelSelectionById(hid).then(() => {
      const rtSel = document.getElementById("hotelRoomType");
      if (rtSel && chosenRoomType && Array.from(rtSel.options || []).some((o) => o.value === chosenRoomType)) {
        rtSel.value = chosenRoomType;
      }
      updateBreakfastAddonUI();
      // Ensure total includes the room type selection side effects (UI keeps the input as-is).
      refreshPricePreview();
    });
  } else {
    refreshPricePreview();
  }

  // Update seat UI for the chosen flight.
  updateSeatSelectionUI();
  void syncFlightScheduleUI();
}

async function searchBundlePricing(loyaltyCoinsToUseCentsOverride = null) {
  const origin = document.getElementById("bundleOrigin")?.value?.trim();
  const destination = document.getElementById("bundleDestination")?.value?.trim();
  const departDate = document.getElementById("bundleDepartDateTime")?.value?.trim();
  const returnDate = document.getElementById("bundleReturnDateTime")?.value?.trim();
  const travellers = document.getElementById("bundleNumberOfTravellers")?.value?.trim();
  const customerId = document.getElementById("customerID")?.value?.trim();

  const statusEl = document.getElementById("bundleStatus");
  if (statusEl) statusEl.textContent = "Calculating bundle price…";

  if (!origin || !destination || !departDate || !returnDate || !travellers || !customerId) {
    if (statusEl) statusEl.textContent = "Please fill origin, destination, dates, travellers, and who's booking.";
    return;
  }
  const depTs = Date.parse(departDate);
  const retTs = Date.parse(returnDate);
  if (Number.isFinite(depTs) && Number.isFinite(retTs) && retTs <= depTs) {
    if (statusEl) statusEl.textContent = "Return date/time must be after outbound date/time.";
    return;
  }

  const qs = new URLSearchParams();
  qs.set("origin", origin);
  qs.set("destination", destination);
  qs.set("departDate", departDate);
  qs.set("returnDate", returnDate);
  qs.set("numberOfTravellers", travellers);
  qs.set("customerId", customerId);

  const coinsInput = document.getElementById("coinsToSpendCents");
  const coins = loyaltyCoinsToUseCentsOverride ?? coinsInput?.value ?? 0;
  qs.set("loyaltyCoinsToUseCents", String(Math.max(0, Number(coins) || 0)));

  latestBundlePricing = null;
  setBundleResultVisible(false);

  const out = await fetchJson(`${BUNDLE_PRICE_BASE}?${qs.toString()}`);
  if (out.networkError || !out.ok) {
    if (statusEl) statusEl.textContent = out.errorMessage || "Could not reach bundle pricing service.";
    return;
  }

  const data = out.body?.data;
  const code = out.body?.code;
  if (code !== 200 || !data) {
    if (statusEl) statusEl.textContent = out.body?.message || "Bundle pricing returned no data.";
    return;
  }

  applyBundlePricingResult(data, { departDate, returnDate, origin, destination, travellers, customerId });
}

let bundleRefreshToken = 0;
async function refreshBundleForCoins() {
  if (!lastBundleParams) return;
  const token = ++bundleRefreshToken;

  const coinsInput = document.getElementById("coinsToSpendCents");
  const coins = Math.max(0, Number(coinsInput?.value || 0));

  // Use the same base inputs, but override coins.
  const qs = new URLSearchParams();
  qs.set("origin", lastBundleParams.origin);
  qs.set("destination", lastBundleParams.destination);
  qs.set("departDate", lastBundleParams.departDate);
  qs.set("returnDate", lastBundleParams.returnDate);
  qs.set("numberOfTravellers", lastBundleParams.travellers);
  qs.set("customerId", lastBundleParams.customerId);
  qs.set("loyaltyCoinsToUseCents", String(coins));

  const out = await fetchJson(`${BUNDLE_PRICE_BASE}?${qs.toString()}`);
  if (token !== bundleRefreshToken) return;
  if (out.networkError || !out.ok) return;

  const data = out.body?.data;
  const code = out.body?.code;
  if (code !== 200 || !data) return;
  applyBundlePricingResult(data, { ...lastBundleParams, departDate: lastBundleParams.departDate });
}

function clearBundleSelectionState() {
  selectedBundlePresetId = null;
  const pkg = document.getElementById("bundlePackageSelect");
  if (pkg) pkg.value = "";
  latestBundlePricing = null;
  lastBundleParams = null;
  setBundleResultVisible(false);
  const st = document.getElementById("bundleStatus");
  if (st) st.textContent = "";
  document.querySelectorAll(".bundle-card").forEach((b) => {
    b.classList.remove("bundle-card--selected");
    b.setAttribute("aria-pressed", "false");
  });
}

function renderBundleGallery() {
  const track = document.getElementById("bundleGalleryTrack");
  if (!track) return;
  track.replaceChildren();
  const list = getFilteredPresets();
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "muted bundle-gallery__empty";
    empty.textContent =
      "No packages match these filters — set Region / From / To to “Any” to see all trips.";
    track.appendChild(empty);
    return;
  }
  for (const p of list) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bundle-card";
    btn.dataset.presetId = p.id;
    btn.setAttribute("role", "listitem");
    btn.setAttribute("aria-pressed", "false");
    const priceText = bundleCardPriceLabel(p.id);
    btn.innerHTML = `
      <span class="bundle-card__media" style="background-image:url('${escapeHtml(p.image)}')"></span>
      <span class="bundle-card__price" data-preset-id="${escapeHtml(p.id)}">${escapeHtml(priceText)}</span>
      <span class="bundle-card__body">
        <span class="bundle-card__route">${escapeHtml(p.route)}</span>
        <span class="bundle-card__title">${escapeHtml(p.title)}</span>
        <span class="bundle-card__meta">${escapeHtml(p.blurb)}</span>
      </span>
    `;
    btn.addEventListener("click", () => selectBundlePreset(p.id));
    track.appendChild(btn);
  }
}

function setupBundleGalleryNav() {
  const gal = document.getElementById("bundleGallery");
  const prev = document.getElementById("bundleGalleryPrev");
  const next = document.getElementById("bundleGalleryNext");
  if (!gal || !prev || !next) return;
  const step = () => Math.min(360, Math.floor(gal.clientWidth * 0.88) || 320);
  prev.addEventListener("click", () => gal.scrollBy({ left: -step(), behavior: "smooth" }));
  next.addEventListener("click", () => gal.scrollBy({ left: step(), behavior: "smooth" }));
}

function selectBundlePreset(presetId) {
  const preset = BUNDLE_PRESETS.find((x) => x.id === presetId);
  if (!preset) return;
  selectedBundlePresetId = presetId;

  const pkg = document.getElementById("bundlePackageSelect");
  if (pkg) pkg.value = presetId;

  const o = document.getElementById("bundleOrigin");
  const d = document.getElementById("bundleDestination");
  if (o) o.value = preset.origin;
  if (d) o.value = preset.destination;

  ensureTripWindowOption(preset.depart, preset.ret);
  applyTripWindowFromSelect();

  document.querySelectorAll(".bundle-card").forEach((el) => {
    const on = el.dataset.presetId === presetId;
    el.classList.toggle("bundle-card--selected", on);
    el.setAttribute("aria-pressed", on ? "true" : "false");
  });

  void searchBundlePricing();
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
    BA: {
      onlineSeatSelection: false,
      airlineName: "British Airways",
      reason:
        "British Airways (demo): choose seats at online check-in or via the airline.",
    },
    JL: {
      onlineSeatSelection: false,
      airlineName: "Japan Airlines",
      reason: "JAL (demo): seat selection at check-in or partner flows — map disabled here.",
    },
    QF: {
      onlineSeatSelection: false,
      airlineName: "Qantas",
      reason: "Qantas (demo): seat assignment via airline check-in.",
    },
    TG: {
      onlineSeatSelection: false,
      airlineName: "Thai Airways",
      reason: "Thai Airways (demo): advance seat map not enabled — check in online.",
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

function resetSeatMap() {
  const map = document.getElementById("seatMap");
  if (!map) return;
  map.innerHTML = "";
  buildSeatMapOnce();
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

  if (currentTakenSeats.has(id)) {
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
    void refreshTakenSeatsForFlight(flightId);
  } else {
    policyEl.textContent = policy.reason;
    mapWrap.hidden = true;
    blocked.hidden = false;
    blocked.textContent = policy.reason;
    clearSeatSelection();
    currentTakenSeats = new Set(DEFAULT_TAKEN_SEATS);
    resetSeatMap();
  }

  updateSeatGroupSummary();
}

async function syncFlightScheduleUI() {
  const flightId = document.getElementById("flightID")?.value?.trim()?.toUpperCase() || "";
  const depEl = document.getElementById("flightDepartureTime");
  const arrEl = document.getElementById("flightArrivalTime");
  const bookingDepEl = document.getElementById("departureTime");
  if (!depEl || !arrEl || !bookingDepEl) return;

  if (!flightId) {
    depEl.value = "";
    arrEl.value = "";
    bookingDepEl.value = "";
    return;
  }

  const out = await fetchJson(`${FLIGHT_BASE}/flight/${encodeURIComponent(flightId)}`);
  if (out.networkError || !out.ok || !out.body?.data) return;
  const f = out.body.data;
  const dep = String(f.departureTime || "").slice(0, 16);
  const arr = String(f.arrivalTime || "").slice(0, 16);
  if (dep) {
    depEl.value = dep;
    bookingDepEl.value = dep;
  }
  if (arr) arrEl.value = arr;
}

async function refreshTakenSeatsForFlight(flightId) {
  const fid = String(flightId || "").trim().toUpperCase();
  if (!fid) return;

  const token = ++seatRefreshToken;
  const out = await fetchJson(`${API_BASE}/booking/seats/${encodeURIComponent(fid)}`);
  if (token !== seatRefreshToken) return;

  if (out.networkError || !out.ok) {
    currentTakenSeats = new Set(DEFAULT_TAKEN_SEATS);
    resetSeatMap();
    return;
  }

  const seats = out.body?.data?.seats;
  const merged = new Set(DEFAULT_TAKEN_SEATS);
  if (Array.isArray(seats)) {
    seats.forEach((s) => {
      const up = String(s || "").trim().toUpperCase();
      if (up) merged.add(up);
    });
  }
  currentTakenSeats = merged;

  const currentSeat = document.getElementById("seatNumber")?.value?.trim()?.toUpperCase() || "";
  if (currentSeat && currentTakenSeats.has(currentSeat)) {
    clearSeatSelection();
  }
  resetSeatMap();
}

function updateSeatGroupSummary() {
  const seat = document.getElementById("seatNumber")?.value?.trim() || "—";
  const leadPill = document.getElementById("seatLeadPill");
  const compPill = document.getElementById("seatCompanionPill");
  const hintPill = document.getElementById("seatGroupHint");
  const compSel = document.getElementById("companionTravellerSelect");
  const companions = Array.from(compSel?.selectedOptions || []).length;

  if (leadPill) leadPill.textContent = `Lead traveller seat: ${seat === "—" ? "not selected" : seat}`;
  if (compPill) compPill.textContent = `Companions: ${companions}`;

  if (hintPill) {
    hintPill.textContent = companions > 0
      ? "Companions will be auto-assigned nearby in this demo."
      : "No companions selected.";
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
  if (latestBundleParams) void refreshBundleForCoins();
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
  updateHotelRoomDetailsUI();
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
  updateHotelRoomDetailsUI();
}

function updateHotelRoomDetailsUI() {
  const displayEl = document.getElementById("hotelSelectedRoomDisplay");
  if (!displayEl || !selectedHotel) return;

  const roomCode = document.getElementById("hotelRoomType")?.value;
  const cb = document.getElementById("hotelIncludesBreakfast");
  const room = (selectedHotel.roomTypes || []).find((rt) => rt.code === roomCode);

  if (!room) {
    displayEl.textContent = "—";
    return;
  }

  const label = room.label || room.typeName || roomCode || "Room";
  const price = Number.isFinite(Number(room.pricePerNight))
    ? Number(room.pricePerNight).toFixed(2)
    : null;
  const available = Number.isFinite(Number(room.availableRooms)) ? Number(room.availableRooms) : null;
  const breakfastIncluded = room.code === "DLX" || !!cb?.checked;
  const addonText = breakfastIncluded ? "Breakfast included" : "Room only";

  const parts = [
    label,
    price !== null ? `$${price}/night` : null,
    addonText,
    available !== null ? `${available} rooms left` : null,
  ].filter(Boolean);

  displayEl.textContent = parts.join(" · ");
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
    const roomLines = (h.roomTypes || [])
      .map((rt) => {
        const code = rt.code || "";
        const label = rt.label || (code === "DLX" ? "Deluxe" : code === "STD" ? "Standard" : "Room");
        const price = Number.isFinite(Number(rt.pricePerNight)) ? `$${Number(rt.pricePerNight).toFixed(2)}/night` : "";
        const addon = rt.includesBreakfast ? "Breakfast included" : "Room only";
        const available =
          rt.availableRooms !== undefined && rt.availableRooms !== null
            ? `${rt.availableRooms} rooms left`
            : "";
        return `<div class="hotel-card__roomline"><strong>${escapeHtml(
          label
        )}</strong>${code ? ` (${escapeHtml(code)})` : ""}: ${escapeHtml(
          addon
        )}${price ? ` · ${escapeHtml(price)}` : ""}${available ? ` · ${escapeHtml(available)}` : ""}</div>`;
      })
      .join("");
    const totalRooms = (h.roomTypes || []).reduce((sum, rt) => {
      const v = Number(rt?.availableRooms);
      return Number.isFinite(v) && v > 0 ? sum + v : sum;
    }, 0);
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
        <div class="hotel-card__rooms muted">
          ${totalRooms > 0 ? `Rooms available: ${escapeHtml(String(totalRooms))} total` : "Rooms available: —"}
          ${roomLines ? `<div style="margin-top:2px;">Room types:</div>${roomLines}` : ""}
        </div>
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

  const gqlQuery = `
    query SearchHotels($country: String, $city: String, $name: String) {
      hotelSearch(country: $country, city: $city, name: $name) {
        hotelID
        name
        city
        country
        starRating
        imageUrl
        amenities
        availableRooms
        roomTypes {
          code
          label
          pricePerNight
          includesBreakfast
          availableRooms
        }
      }
    }
  `;
  const gqlOut = await fetchGraphql(gqlQuery, { country, city, name });
  let hotels = gqlOut.body?.data?.hotelSearch ?? [];

  // Graceful fallback to REST search for resilience in demos.
  if (!gqlOut.ok) {
    const qs = new URLSearchParams();
    if (country) qs.set("country", country);
    if (city) qs.set("city", city);
    if (name) qs.set("name", name);
    const restOut = await fetchJson(`${HOTEL_BASE}/hotel/search?${qs.toString()}`);
    if (restOut.networkError) {
      if (selectedHintEl) selectedHintEl.textContent = "Could not reach hotel service.";
      if (resultsEl) resultsEl.textContent = restOut.errorMessage || gqlOut.errorMessage || "";
      return;
    }
    hotels = restOut.body?.data ?? [];
  }

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

  clearBundleSelectionState();

  document.getElementById("customerID").value = String(p.customerID);
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
  document.getElementById("flightDepartureTime").value = p.departureTime;
  document.getElementById("departureTime").value = p.departureTime;
  document.getElementById("hotelCheckInTime").value = p.departureTime;
  const pCheckOut = new Date(p.departureTime);
  if (!Number.isNaN(pCheckOut.getTime())) {
    pCheckOut.setDate(pCheckOut.getDate() + 4);
    document.getElementById("hotelCheckOutTime").value = pCheckOut.toISOString().slice(0, 16);
  }
  document.getElementById("totalPrice").value = p.totalPrice;
  document.getElementById("currency").value = "SGD";
  document.getElementById("fareType").value = p.fareType;
  document.getElementById("discountCode").value = p.discountCode || "";
  document.getElementById("coinsToSpendCents").value = p.coinsToSpendCents ?? 0;
  setTravellerProfileIdsInputFromDemo(p);
  updateCoinsOffsetUI();

  updateSeatSelectionUI();
  void syncFlightScheduleUI();
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
  clearBundleSelectionState();
  document.getElementById("demoProfile").value = "";
  document.getElementById("customerID").value = "1";
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
  const bn = document.getElementById("bundleNumberOfTravellers");
  if (bn) bn.value = "2";
  const bo = document.getElementById("bundleOrigin");
  const bd = document.getElementById("bundleDestination");
  if (bo) bo.value = "Singapore";
  if (bd) bd.value = "Tokyo";
  const tw = document.getElementById("bundleTripWindowSelect");
  if (tw && TRIP_WINDOW_OPTIONS[0]) {
    tw.value = TRIP_WINDOW_OPTIONS[0].value;
    applyTripWindowFromSelect();
  }
  const bfr = document.getElementById("bundleFilterRegion");
  const bfc = document.getElementById("bundleFilterCountry");
  const bff = document.getElementById("bundleFilterFrom");
  const bft = document.getElementById("bundleFilterTo");
  if (bfr) bfr.value = "all";
  if (bfc) bfc.value = "all";
  if (bff) bff.value = "all";
  if (bft) bft.value = "all";
  populateBundlePackageSelect();
  renderBundleGallery();
  scheduleBundleCardPriceRefresh();
  document.getElementById("flightID").value = "SQ001";
  document.getElementById("hotelID").value = 1;
  document.getElementById("hotelRoomType").value = "STD";
  document.getElementById("hotelIncludesBreakfast").checked = false;
  updateBreakfastAddonUI();
  void initHotelSelectionById(1);
  document.getElementById("flightDepartureTime").value = "2026-05-01T10:00";
  document.getElementById("flightArrivalTime").value = "2026-05-01T15:30";
  document.getElementById("departureTime").value = "2026-05-01T10:00";
  document.getElementById("hotelCheckInTime").value = "2026-05-01T15:00";
  document.getElementById("hotelCheckOutTime").value = "2026-05-05T11:00";
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
  void syncFlightScheduleUI();
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
    currency: "SGD",
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
    const bTotal = latestBundlePricing?.finalTotal;
    if (Number.isFinite(Number(bTotal))) {
      // Diagram-aligned pricing: use composite bundle finalTotal.
      payload.totalPrice = Number(bTotal);
      const coinsAvailableCents = Number(latestLoyalty?.coins ?? 0);
      const coinsRequestedCents = Math.max(
        0,
        Number(document.getElementById("coinsToSpendCents")?.value || 0)
      );
      payload.coinsToSpendCents = Math.min(coinsAvailableCents, coinsRequestedCents);
      refreshPricePreview();
    } else {
      const breakdown = computeFinalPriceBreakdown();
      refreshPricePreview();
      payload.totalPrice = breakdown.finalPaid;
      payload.coinsToSpendCents = breakdown.coinsToSpendCents;
    }

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

    updateSeatSelectionUI();
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
        msg = `${msg} — use the booking reference from your confirmation, not your name or email.`;
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
    updateSeatSelectionUI();

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
    { tabId: "bookingStep2Tab", panelId: "bookingStep4Panel" },
    { tabId: "bookingStep3Tab", panelId: "bookingStep2Panel" },
    { tabId: "bookingStep4Tab", panelId: "bookingStep3Panel" },
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

    // Step 2 (index 1) includes traveller profile CRUD + selectors.
    if (stepIndex === 1) {
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
      errEl.textContent = "Choose a member under Profiles for.";
      errEl.hidden = false;
    }
    if (listEl) listEl.textContent = "";
    resetTravellerEdit();
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
    resetTravellerEdit();
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
    resetTravellerEdit();
    return;
  }

  const data = out.body?.data ?? [];
  latestTravellerRows = Array.isArray(data) ? data : [];

  if (!listEl) return;
  listEl.innerHTML = "";

  if (!latestTravellerRows.length) {
    listEl.textContent = "No saved traveller profiles for this member yet.";
    resetTravellerEdit();
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
    const selectedId = Number(selectedTravellerRow?.Id ?? selectedTravellerRow?.id ?? 0);
    const isSelected = selectedId > 0 && selectedId === id;
    item.innerHTML = `
      <div class="traveller-item__meta">
        <div class="traveller-item__title">${escapeHtml(title)}</div>
        <div class="traveller-item__sub">${escapeHtml(sub)}</div>
      </div>
      <button type="button" class="${isSelected ? "btn-primary" : "btn-secondary"}" data-action="selectTraveller" data-id="${id}">
        ${isSelected ? "Editing" : "Edit profile"}
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
  if (statusEl) statusEl.textContent = "Select a saved profile to edit, or click New profile.";
  const titleEl = document.getElementById("travellerEditTitle");
  if (titleEl) titleEl.textContent = "Profile details";

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
  const titleEl = document.getElementById("travellerEditTitle");
  const rowName = getOsField(row, ["FullName", "Name", "TravellerName"]);
  if (titleEl) titleEl.textContent = rowName ? `Editing: ${rowName}` : "Editing profile";

  const delBtn = document.getElementById("travellerDeleteBtn");
  if (delBtn) delBtn.disabled = false;
  const statusEl = document.getElementById("travellerEditStatus");
  if (statusEl) statusEl.textContent = "Update fields below, then click Save changes.";
  // Refresh list actions so the active row shows "Editing".
  void loadTravellerProfiles();
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
  const titleEl = document.getElementById("travellerEditTitle");
  if (titleEl) titleEl.textContent = "Create new profile";

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
  void loadTravellerProfiles();
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
      updateSeatGroupSummary();
    });
  }

  const compSel = document.getElementById("companionTravellerSelect");
  if (compSel) {
    compSel.addEventListener("change", () => {
      updateSeatGroupSummary();
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
  const closeEditBtn = document.getElementById("travellerCancelEditBtn");
  if (closeEditBtn) closeEditBtn.addEventListener("click", () => resetTravellerEdit());
}

function initUI() {
  populateDemoProfileOptions();
  buildSeatMapOnce();
  updateSeatSelectionUI();
  populateCustomerSelects();
  populateTravellerCountSelect();
  populateBundleFilterSelects();
  populateBundleRouteSelectsFromPresets();
  populateTripWindowSelect();
  applyTripWindowFromSelect();
  populateBundlePackageSelect();
  setupBundleFineTuneListeners();
  setupBundleFilterListeners();
  renderBundleGallery();
  setupBundleGalleryNav();
  scheduleBundleCardPriceRefresh();

  setupSegmentTabs();
  setupLoyaltyPaymentTabs();
  setupBookingFlowTabs();
  setupTravellerProfilesUI();
  refreshTripContactSummary();
  updateSeatGroupSummary();

  document.getElementById("demoProfile").addEventListener("change", applyDemoProfile);
  document.getElementById("loadDemoBtn").addEventListener("click", applyDemoProfile);
  document.getElementById("newManualBtn").addEventListener("click", () => {
    setManualDefaults();
    showResult({ info: "Ready — edit the form, then confirm & pay when done." }, "Ready to edit");
  });
  document.getElementById("flightID").addEventListener("input", () => {
    updateSeatSelectionUI();
    void syncFlightScheduleUI();
  });
  document.getElementById("flightID").addEventListener("change", () => {
    updateSeatSelectionUI();
    void syncFlightScheduleUI();
  });

  document.getElementById("bundleSearchBtn")?.addEventListener("click", () => {
    selectedBundlePresetId = null;
    const pkg = document.getElementById("bundlePackageSelect");
    if (pkg) pkg.value = "";
    document.querySelectorAll(".bundle-card").forEach((b) => {
      b.classList.remove("bundle-card--selected");
      b.setAttribute("aria-pressed", "false");
    });
    void searchBundlePricing();
  });
  document.getElementById("bundleQuickApplyBtn")?.addEventListener("click", () => {
    selectedBundlePresetId = null;
    const pkg = document.getElementById("bundlePackageSelect");
    if (pkg) pkg.value = "";
    document.querySelectorAll(".bundle-card").forEach((b) => {
      b.classList.remove("bundle-card--selected");
      b.setAttribute("aria-pressed", "false");
    });
    void searchBundlePricing();
  });
  document.getElementById("bundleDepartDateTime")?.addEventListener("change", () => {
    syncTripWindowFromDateInputs();
  });
  document.getElementById("bundleReturnDateTime")?.addEventListener("change", () => {
    syncTripWindowFromDateInputs();
  });
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
  void syncFlightScheduleUI();
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
    scheduleBundleCardPriceRefresh();
    if (id) {
      void updateLoyaltySummary(id).then(() => {
        if (selectedBundlePresetId) void searchBundlePricing();
      });
    } else {
      latestLoyalty = null;
      document.getElementById("loyaltyCoins").textContent = "-";
      document.getElementById("loyaltyTier").textContent = "-";
      refreshPricePreview();
    }
    // Keep Trip-tab traveller selectors in sync with Who's booking?
    if (document.getElementById("leadTravellerSelect")) {
      void loadTravellerProfiles();
    }
  });

  document.getElementById("bundleNumberOfTravellers")?.addEventListener("change", () => {
    scheduleBundleCardPriceRefresh();
    if (selectedBundlePresetId) void searchBundlePricing();
  });

  ["totalPrice", "discountCode"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", refreshPricePreview);
    document.getElementById(id)?.addEventListener("change", refreshPricePreview);
  });

  // When coins change and we already have a bundle price, re-run the bundle
  // so finalTotal stays diagram-aligned.
  document
    .getElementById("coinsToSpendCents")
    ?.addEventListener("input", () => {
      refreshPricePreview();
      scheduleBundleCardPriceRefresh();
      if (latestBundleParams) void refreshBundleForCoins();
    });
  document
    .getElementById("coinsToSpendCents")
    ?.addEventListener("change", () => {
      refreshPricePreview();
      scheduleBundleCardPriceRefresh();
      if (latestBundleParams) void refreshBundleForCoins();
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

