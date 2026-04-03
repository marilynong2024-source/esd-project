// Travel Booking UI logic

// Same-origin paths (nginx proxies to services — see nginx/ui.conf)
const API_BASE = "/api/booking";
const ACCOUNT_BASE = "/api/account";
const LOYALTY_BASE = "/api/loyalty";
const NOTIFICATION_BASE = "/api/notification";
const GRAPHQL_BASE = "/api/graphql/graphql";
const FLIGHT_BASE = "/api/flight";
const BUNDLE_PRICE_BASE = "/api/bundle-price";

const SESSION_STORAGE_KEY = "horizonPackagesSession";

/** @returns {{ mode: 'guest' } | { mode: 'member', customerID: number, email?: string, displayName?: string } | null} */
function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    return o;
  } catch {
    return null;
  }
}

function setSession(obj) {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(obj));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function isMemberSession() {
  const s = getSession();
  return !!(s && s.mode === "member" && Number(s.customerID) > 0);
}
// Keep REST hotel base as fallback path if GraphQL is down.
const HOTEL_BASE = "/api/hotel";
const HOTEL_FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="300" viewBox="0 0 520 300">
      <rect width="520" height="300" fill="#e2e8f0"/>
      <rect x="24" y="24" width="472" height="252" rx="14" fill="#cbd5e1"/>
      <text x="260" y="146" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#334155">Hotel image unavailable</text>
      <text x="260" y="178" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#475569">Preview will still work</text>
    </svg>`
  );

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

function countriesUsedByPresets(regionFilter = "all") {
  const slugs = new Set();
  for (const p of BUNDLE_PRESETS) {
    if (regionFilter !== "all" && p.region !== regionFilter) continue;
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

/** Demo members — option value is internal id; label is guest-facing (no raw IDs in the UI). */
const CUSTOMER_OPTIONS = [
  { id: 1, label: "Ava Chen" },
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

/**
 * @param {boolean} preserve If true, keep region/country/from/to when options still valid (fixes country not tracking region).
 */
function populateBundleFilterSelects(preserve = true) {
  const regEl = document.getElementById("bundleFilterRegion");
  const prevReg = preserve && regEl ? regEl.value : "all";
  const countryEl = document.getElementById("bundleFilterCountry");
  const prevCountry = preserve && countryEl ? countryEl.value : "all";
  const fromEl = document.getElementById("bundleFilterFrom");
  const prevFrom = preserve && fromEl ? fromEl.value : "all";
  const toEl = document.getElementById("bundleFilterTo");
  const prevTo = preserve && toEl ? toEl.value : "all";

  if (regEl) {
    regEl.replaceChildren();
    for (const r of BUNDLE_REGION_OPTIONS) {
      const o = document.createElement("option");
      o.value = r.value;
      o.textContent = r.label;
      regEl.appendChild(o);
    }
    const regOk = [...regEl.options].some((o) => o.value === prevReg);
    regEl.value = regOk ? prevReg : "all";
  }

  const effectiveReg = regEl?.value || "all";

  if (countryEl) {
    countryEl.replaceChildren();
    const allC = document.createElement("option");
    allC.value = "all";
    allC.textContent = "Any country";
    countryEl.appendChild(allC);
    const countrySlugs = countriesUsedByPresets(effectiveReg);
    for (const slug of countrySlugs) {
      const o = document.createElement("option");
      o.value = slug;
      o.textContent = BUNDLE_COUNTRY_LABEL[slug] || slug;
      countryEl.appendChild(o);
    }
    const countryOk =
      prevCountry === "all" || countrySlugs.includes(prevCountry);
    countryEl.value = countryOk ? prevCountry : "all";
  }

  const effectiveCountry = countryEl?.value || "all";

  const presetsForCities = BUNDLE_PRESETS.filter((p) => {
    if (effectiveReg !== "all" && p.region !== effectiveReg) return false;
    if (effectiveCountry !== "all") {
      const o = CITY_COUNTRY_SLUG[p.origin];
      const d = CITY_COUNTRY_SLUG[p.destination];
      if (o !== effectiveCountry && d !== effectiveCountry) return false;
    }
    return true;
  });

  const origins = [...new Set(presetsForCities.map((p) => p.origin))].sort();
  const dests = [...new Set(presetsForCities.map((p) => p.destination))].sort();

  if (fromEl) {
    fromEl.replaceChildren();
    const allO = document.createElement("option");
    allO.value = "all";
    allO.textContent = "Any city";
    fromEl.appendChild(allO);
    for (const city of origins) {
      const o = document.createElement("option");
      o.value = city;
      o.textContent = city;
      fromEl.appendChild(o);
    }
    const fromOk = prevFrom === "all" || origins.includes(prevFrom);
    fromEl.value = fromOk ? prevFrom : "all";
  }

  if (toEl) {
    let destCandidates = presetsForCities;
    const fromVal = fromEl?.value || "all";
    if (fromVal !== "all") {
      destCandidates = destCandidates.filter((p) => p.origin === fromVal);
    }
    const destsFiltered = [...new Set(destCandidates.map((p) => p.destination))].sort();
    toEl.replaceChildren();
    const allT = document.createElement("option");
    allT.value = "all";
    allT.textContent = "Any city";
    toEl.appendChild(allT);
    for (const city of destsFiltered.length ? destsFiltered : dests) {
      const o = document.createElement("option");
      o.value = city;
      o.textContent = city;
      toEl.appendChild(o);
    }
    const toOk = prevTo === "all" || [...toEl.options].some((o) => o.value === prevTo);
    toEl.value = toOk ? prevTo : "all";
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
  // If region changed, rebuild country options so lists stay consistent (e.g. Europe doesn't show Japan).
  populateBundleFilterSelects();
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
  const bookSel = document.getElementById("customerID");
  if (bookSel?.tagName !== "SELECT") return;

  bookSel.replaceChildren();
  const session = getSession();
  if (!session || session.mode === "guest") {
    const o = document.createElement("option");
    o.value = "0";
    o.textContent = "Guest checkout — no rewards wallet";
    bookSel.appendChild(o);
    bookSel.value = "0";
  } else {
    const o = document.createElement("option");
    o.value = String(session.customerID);
    o.textContent = `${session.displayName || "Member"} (loyalty wallet)`;
    bookSel.appendChild(o);
    bookSel.value = String(session.customerID);
  }

  const travSel = document.getElementById("travellerCustomerID");
  if (travSel?.tagName === "SELECT") {
    travSel.replaceChildren();
    if (!session || session.mode === "guest") {
      const o = document.createElement("option");
      o.value = "0";
      o.textContent = "—";
      travSel.appendChild(o);
    } else {
      const o = document.createElement("option");
      o.value = String(session.customerID);
      o.textContent = session.displayName || `Member #${session.customerID}`;
      travSel.appendChild(o);
      travSel.value = String(session.customerID);
    }
  }
}

function updateCustomerFieldHint() {
  const hint = document.getElementById("customerIDHint");
  if (!hint) return;
  hint.innerHTML =
    "You're signed in as a <strong>loyalty member</strong>. Use coins in the last step; manage saved traveller profiles in step 2.";
}

function updateDemoToolsForAuth() {
  const wrap = document.getElementById("demoQuickExampleWrap");
  if (wrap) wrap.hidden = !isMemberSession();
}

function syncBundleTravellerTotals() {
  const adults = Number(document.getElementById("bundleAdults")?.value || 0);
  const children = Number(document.getElementById("bundleChildren")?.value || 0);
  const infants = Number(document.getElementById("bundleInfants")?.value || 0);
  const total = Math.max(1, adults + children + infants);
  const totalEl = document.getElementById("bundleNumberOfTravellers");
  if (totalEl) totalEl.value = String(total);
}

function populateTravellerCountSelect() {
  const adultsSel = document.getElementById("bundleAdults");
  const childrenSel = document.getElementById("bundleChildren");
  const infantsSel = document.getElementById("bundleInfants");
  const fill = (sel, max, noun) => {
    if (!sel || sel.tagName !== "SELECT") return;
    sel.replaceChildren();
    for (let n = 0; n <= max; n++) {
      const o = document.createElement("option");
      o.value = String(n);
      o.textContent = `${n} ${noun}${n === 1 ? "" : "s"}`;
      sel.appendChild(o);
    }
  };
  fill(adultsSel, 12, "adult");
  fill(childrenSel, 8, "child");
  fill(infantsSel, 4, "infant");
  if (adultsSel) adultsSel.value = "2";
  if (childrenSel) childrenSel.value = "0";
  if (infantsSel) infantsSel.value = "0";
  syncBundleTravellerTotals();
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
  const pd = document.getElementById("packageDepartDate");
  const pr = document.getElementById("packageReturnDate");
  if (pd && depEl?.value) pd.value = sliceDateFromLocal(depEl.value);
  if (pr && retEl?.value) pr.value = sliceDateFromLocal(retEl.value);
  updatePackageNightsHint();
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
    bundleOrigin: "Singapore",
    bundleDestination: "Tokyo",
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
    bundleOrigin: "Singapore",
    bundleDestination: "Tokyo",
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
    bundleOrigin: "Singapore",
    bundleDestination: "Sydney",
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
    bundleOrigin: "Singapore",
    bundleDestination: "Kuala Lumpur",
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
    bundleOrigin: "Singapore",
    bundleDestination: "Bangkok",
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
    bundleOrigin: "Singapore",
    bundleDestination: "Tokyo",
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

async function applyBundlePricingResult(bundle, inputsForThisCall) {
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

  await refreshFlightDropdownFromRoute();
  const flightIdEl = document.getElementById("flightID");
  if (flightIdEl && bundle.flightNum) {
    const fn = String(bundle.flightNum).toUpperCase();
    if (![...flightIdEl.options].some((o) => o.value === fn)) {
      const opt = document.createElement("option");
      opt.value = fn;
      opt.textContent = `${fn} · from bundle quote`;
      flightIdEl.appendChild(opt);
    }
    flightIdEl.value = fn;
  }

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

  await applyBundlePricingResult(data, {
    departDate,
    returnDate,
    origin,
    destination,
    travellers,
    customerId,
  });
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
  await applyBundlePricingResult(data, {
    ...lastBundleParams,
    departDate: lastBundleParams.departDate,
  });
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
      "No packages available for those filters. Try widening Region, From, or To to “Any”.";
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
    .match(/^([A-Z0-9]{2})/);
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
      reason: "Choose a flight from the list for your route.",
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

/**
 * Populate flight dropdown from catalog: only flights with seats on bundle origin → destination cities.
 */
async function refreshFlightDropdownFromRoute() {
  const sel = document.getElementById("flightID");
  if (!sel || sel.tagName !== "SELECT") return;

  const origin = document.getElementById("bundleOrigin")?.value?.trim() || "";
  const dest = document.getElementById("bundleDestination")?.value?.trim() || "";
  const keep = sel.value;

  sel.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent =
    origin && dest
      ? "— Choose a flight (with seats) —"
      : "— Set origin & destination in bundle / search first —";
  sel.appendChild(ph);

  const hint = document.getElementById("flightSelectHint");
  if (!origin || !dest) {
    sel.disabled = true;
    if (hint) {
      hint.textContent =
        "Use the hero search, package filters, or Fine-tune route to set both cities.";
    }
    updateSeatSelectionUI();
    return;
  }

  sel.disabled = false;
  const qs = new URLSearchParams();
  qs.set("originCity", origin);
  qs.set("destinationCity", dest);
  qs.set("minSeats", "1");
  const out = await fetchJson(`${FLIGHT_BASE}/flight/search?${qs.toString()}`);

  if (out.networkError || !out.ok || !Array.isArray(out.body?.data)) {
    if (hint) hint.textContent = "Could not load flights for this route.";
    updateSeatSelectionUI();
    return;
  }

  const flights = [...out.body.data];
  flights.sort((a, b) => {
    const ta = String(a.departureTime || "");
    const tb = String(b.departureTime || "");
    if (ta !== tb) return ta.localeCompare(tb);
    return (Number(a.economyPrice) || 0) - (Number(b.economyPrice) || 0);
  });

  for (const f of flights) {
    const fn = String(f.flightNum || f.flightNumber || "").toUpperCase();
    if (!fn) continue;
    const seats = Number(f.availableSeats ?? 0);
    if (seats < 1) continue;
    const dep = String(f.departureTime || "").replace("T", " ").slice(0, 16);
    const price = Number(f.economyPrice ?? 0);
    const air = String(f.airline || "").slice(0, 28);
    const opt = document.createElement("option");
    opt.value = fn;
    opt.textContent = `${fn} · ${air} · ${dep} · ${seats} seats · S$${price.toFixed(0)}`;
    sel.appendChild(opt);
  }

  if (hint) {
    hint.textContent =
      flights.length === 0
        ? `No flights with seats found for ${origin} → ${dest}. Try another route.`
        : `${flights.length} flight(s) with seats: ${origin} → ${dest}.`;
  }

  if (keep && [...sel.options].some((o) => o.value === keep)) {
    sel.value = keep;
  } else if (sel.options.length > 1) {
    sel.selectedIndex = 1;
  }

  updateSeatSelectionUI();
  void syncFlightScheduleUI();
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
    const sgdHint = document.getElementById("coinsAvailableSgd");
    if (sgdHint) sgdHint.textContent = "";
    if (btnNone) btnNone.disabled = true;
    if (btnAll) btnAll.disabled = true;
  } else {
    wrap.hidden = false;
    input.disabled = false;

    const coinsAvailableCents = Number(latestLoyalty?.coins ?? 0);
    if (availEl) availEl.textContent = String(coinsAvailableCents);
    const sgdHint = document.getElementById("coinsAvailableSgd");
    if (sgdHint) {
      sgdHint.textContent =
        coinsAvailableCents > 0
          ? `(up to S$${(coinsAvailableCents / 100).toFixed(2)} off this trip if you apply them all)`
          : "";
    }
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
    const totalRoomsFromTypes = (h.roomTypes || []).reduce((sum, rt) => {
      const v = Number(rt?.availableRooms);
      return Number.isFinite(v) && v > 0 ? sum + v : sum;
    }, 0);
    const totalRoomsTopLevel = Number(h.availableRooms);
    const totalRooms = totalRoomsFromTypes > 0
      ? totalRoomsFromTypes
      : Number.isFinite(totalRoomsTopLevel) && totalRoomsTopLevel > 0
        ? totalRoomsTopLevel
        : 0;
    card.innerHTML = `
      <div class="hotel-card__img">
        <img
          src="${escapeHtml(h.imageUrl || HOTEL_FALLBACK_IMAGE)}"
          alt="${escapeHtml(h.name || "Hotel")}"
          loading="lazy"
          referrerpolicy="no-referrer"
          onerror="this.onerror=null;this.src='${HOTEL_FALLBACK_IMAGE}'"
        />
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
          ${totalRooms > 0 ? `Rooms available: ${escapeHtml(String(totalRooms))}` : "Rooms available: —"}
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
  const gqlDataLooksEmpty =
    Array.isArray(hotels) &&
    hotels.length > 0 &&
    hotels.every((h) => {
      const id = Number(h?.hotelID ?? 0);
      const hasName = !!String(h?.name || "").trim();
      const hasRoomsArray = Array.isArray(h?.roomTypes) && h.roomTypes.length > 0;
      return (!id || Number.isNaN(id)) && hasName && !hasRoomsArray;
    });

  // Graceful fallback to REST search for resilience in demos.
  if (!gqlOut.ok || gqlDataLooksEmpty) {
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

async function applyDemoProfile() {
  const sel = document.getElementById("demoProfile");
  if (!sel || !sel.value) return;
  const p = DEMO_PROFILES.find((x) => x.id === sel.value);
  if (!p) return;

  const sess = getSession();
  if (
    sess &&
    sess.mode === "member" &&
    Number(p.customerID) !== Number(sess.customerID)
  ) {
    showResult(
      {
        info: `That quick example belongs to another loyalty account. You're signed in as ${sess.displayName || "this member"}.`,
      },
      "Different member"
    );
    return;
  }

  clearBundleSelectionState();

  document.getElementById("customerID").value = String(p.customerID);
  const tc = document.getElementById("travellerCustomerID");
  if (tc) tc.value = String(p.customerID);
  const pn = document.getElementById("passengerName");
  const pe = document.getElementById("passengerEmail");
  const pp = document.getElementById("passengerPhone");
  const bookerCustom = document.getElementById("bookerCustomName");
  if (pn) pn.value = p.passengerName ?? "";
  if (bookerCustom) bookerCustom.value = p.passengerName ?? "";
  if (pe) pe.value = p.passengerEmail ?? "";
  if (pp) pp.value = p.passengerPhone ?? "";
  refreshTripContactSummary();

  const bo = document.getElementById("bundleOrigin");
  const bd = document.getElementById("bundleDestination");
  if (p.bundleOrigin && bo) bo.value = p.bundleOrigin;
  if (p.bundleDestination && bd) bd.value = p.bundleDestination;

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
  const adultsSel = document.getElementById("bundleAdults");
  const childrenSel = document.getElementById("bundleChildren");
  const infantsSel = document.getElementById("bundleInfants");
  const inferredTravellers = 1 + Number(Array.isArray(p.rawTravellerProfileIds) ? p.rawTravellerProfileIds.length : 0);
  if (adultsSel) adultsSel.value = String(Math.max(1, inferredTravellers));
  if (childrenSel) childrenSel.value = "0";
  if (infantsSel) infantsSel.value = "0";
  syncBundleTravellerTotals();
  updateCoinsOffsetUI();

  await refreshFlightDropdownFromRoute();
  const fsel = document.getElementById("flightID");
  if (fsel && p.flightID) {
    const fn = String(p.flightID).toUpperCase();
    if (![...fsel.options].some((o) => o.value === fn)) {
      const opt = document.createElement("option");
      opt.value = fn;
      opt.textContent = `${fn} · demo profile`;
      fsel.appendChild(opt);
    }
    fsel.value = fn;
  }
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
  if (document.getElementById("packageSearchFrom")) {
    populatePackageSearchSelects();
    syncPackageSearchFromBundleFields();
    updatePackageTripSummary();
  }
}

async function setManualDefaults() {
  clearBundleSelectionState();
  document.getElementById("demoProfile").value = "";
  const sess = getSession();
  const defCid =
    !sess || sess.mode === "guest" ? "0" : String(sess.customerID);
  document.getElementById("customerID").value = defCid;
  const tc = document.getElementById("travellerCustomerID");
  if (tc) tc.value = defCid;
  pendingTravellerIdsFromDemo = null;
  const pn0 = document.getElementById("passengerName");
  const pe0 = document.getElementById("passengerEmail");
  const pp0 = document.getElementById("passengerPhone");
  const bookerCustom = document.getElementById("bookerCustomName");
  if (pn0) pn0.value = "";
  if (pe0) pe0.value = "";
  if (pp0) pp0.value = "";
  if (bookerCustom) bookerCustom.value = "";
  refreshTripContactSummary();
  const adultsSel = document.getElementById("bundleAdults");
  const childrenSel = document.getElementById("bundleChildren");
  const infantsSel = document.getElementById("bundleInfants");
  if (adultsSel) adultsSel.value = "2";
  if (childrenSel) childrenSel.value = "0";
  if (infantsSel) infantsSel.value = "0";
  syncBundleTravellerTotals();
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
  populateBundleFilterSelects(true);
  populateBundlePackageSelect();
  renderBundleGallery();
  scheduleBundleCardPriceRefresh();
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
  await refreshFlightDropdownFromRoute();
  const fsel = document.getElementById("flightID");
  if (fsel && [...fsel.options].some((o) => o.value === "SQ001")) {
    fsel.value = "SQ001";
  } else if (fsel?.options?.length > 1) {
    fsel.selectedIndex = 1;
  }
  updateSeatSelectionUI();
  void syncFlightScheduleUI();
  void updateLoyaltySummary(1);
  if (document.getElementById("packageSearchFrom")) {
    populatePackageSearchSelects();
    syncPackageSearchFromBundleFields();
    updatePackageTripSummary();
  }
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

async function loadTwilioConfig() {
  const hint = document.getElementById("twilioSidHint");
  const enabledEl = document.getElementById("twilioEnabled");
  const fromEl = document.getElementById("twilioFromNumber");
  const sidEl = document.getElementById("twilioAccountSid");
  const tokenEl = document.getElementById("twilioAuthToken");
  const out = await fetchJson(`${NOTIFICATION_BASE}/twilio/config`);
  if (out.networkError || !out.ok || !out.body?.data) {
    if (hint) {
      hint.textContent =
        "Could not load Twilio status — start the stack (Docker) and ensure /api/notification is reachable.";
    }
    return;
  }
  const d = out.body.data;
  if (enabledEl) enabledEl.checked = !!d.enabled;
  if (fromEl) fromEl.value = d.fromNumber || "";
  if (sidEl) sidEl.value = "";
  if (tokenEl) tokenEl.value = "";
  if (hint) {
    if (d.hasAccountSid && d.accountSidMasked) {
      hint.textContent = `Current Account SID: ${d.accountSidMasked}`;
    } else {
      hint.textContent = "No Account SID saved yet — paste it on first setup.";
    }
  }
}

async function saveTwilioSettings() {
  const status = document.getElementById("twilioSaveStatus");
  const uiError = document.getElementById("uiError");
  clearError(uiError);
  const body = {
    enabled: document.getElementById("twilioEnabled")?.checked ?? false,
    accountSid: document.getElementById("twilioAccountSid")?.value?.trim() || "",
    authToken: document.getElementById("twilioAuthToken")?.value || "",
    fromNumber: document.getElementById("twilioFromNumber")?.value?.trim() || "",
  };
  const out = await fetchJson(`${NOTIFICATION_BASE}/twilio/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!status) return;
  status.hidden = false;
  if (out.networkError || !out.ok) {
    status.textContent =
      out.errorMessage || out.body?.message || `Save failed (HTTP ${out.status})`;
    setError(uiError, status.textContent);
  } else {
    status.textContent = out.body?.message || "Saved.";
    const tokenEl = document.getElementById("twilioAuthToken");
    const sidEl = document.getElementById("twilioAccountSid");
    if (tokenEl) tokenEl.value = "";
    if (sidEl) sidEl.value = "";
    await loadTwilioConfig();
  }
  setTimeout(() => {
    status.hidden = true;
  }, 5000);
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

const BOOKING_FLOW_STEPS = [
  { tabId: "bookingStep1Tab", panelId: "bookingStep1Panel", label: "Choose bundle" },
  { tabId: "bookingStep2Tab", panelId: "bookingStep4Panel", label: "Traveller profiles" },
  { tabId: "bookingStep3Tab", panelId: "bookingStep2Panel", label: "Hotel" },
  { tabId: "bookingStep4Tab", panelId: "bookingStep3Panel", label: "Flights" },
  { tabId: "bookingStep5Tab", panelId: "bookingStep5Panel", label: "Loyalty & payment" },
];

const BOOKING_FLOW_ALL_TAB_IDS = [
  "bookingStep1Tab",
  "bookingStep2Tab",
  "bookingStep3Tab",
  "bookingStep4Tab",
  "bookingStep5Tab",
];

const BOOKING_FLOW_ALL_PANEL_IDS = [
  "bookingStep1Panel",
  "bookingStep4Panel",
  "bookingStep2Panel",
  "bookingStep3Panel",
  "bookingStep5Panel",
];

function setupBookingFlowTabs() {
  let activeBookingStepIndex = 0;

  const backBtn = document.getElementById("bookingStepBack");
  const nextBtn = document.getElementById("bookingStepNext");
  const progressEl = document.getElementById("bookingStepProgress");

  const syncTabVisibility = () => {
    // All steps are always visible when signed-in loyalty is required.
    for (const id of BOOKING_FLOW_ALL_TAB_IDS) {
      const el = document.getElementById(id);
      if (el) el.hidden = false;
    }
  };

  const updateStepNav = () => {
    const steps = BOOKING_FLOW_STEPS;
    const idx = activeBookingStepIndex;
    const last = steps.length - 1;
    if (backBtn) backBtn.disabled = idx <= 0;
    if (nextBtn) {
      nextBtn.hidden = false;
      nextBtn.textContent = idx >= last ? "Go to confirm" : "Next";
    }
    if (progressEl) {
      const stepMeta = steps[idx];
      progressEl.textContent = `Step ${idx + 1} of ${steps.length} — ${stepMeta?.label ?? ""}`;
    }
  };

  const setActiveStep = (stepIndex) => {
    const steps = BOOKING_FLOW_STEPS;
    activeBookingStepIndex = Math.max(0, Math.min(steps.length - 1, stepIndex));
    const idx = activeBookingStepIndex;

    for (let i = 0; i < steps.length; i++) {
      const isActive = i === idx;
      const { tabId, panelId } = steps[i];
      const tab = document.getElementById(tabId);
      const panel = document.getElementById(panelId);
      if (panel) panel.hidden = !isActive;
      if (tab) {
        tab.classList.toggle("segment-tab--active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
        tab.tabIndex = isActive ? 0 : -1;
      }
    }

    const inFlowPanels = new Set(BOOKING_FLOW_STEPS.map((s) => s.panelId));
    for (const pid of BOOKING_FLOW_ALL_PANEL_IDS) {
      if (!inFlowPanels.has(pid)) {
        const p = document.getElementById(pid);
        if (p) p.hidden = true;
      }
    }

    const activePanelId = steps[idx]?.panelId;
    if (activePanelId) {
      document.getElementById(activePanelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (steps[idx]?.panelId === "bookingStep4Panel") {
      const listEl = document.getElementById("travellerProfilesList");
      if (listEl && latestTravellerRows.length === 0) {
        void loadTravellerProfiles();
      }
    }
    if (steps[idx]?.panelId === "bookingStep3Panel") {
      void refreshFlightDropdownFromRoute();
    }

    updateStepNav();
  };

  backBtn?.addEventListener("click", () => setActiveStep(activeBookingStepIndex - 1));
  nextBtn?.addEventListener("click", () => {
    const steps = getBookingFlowSteps();
    const last = steps.length - 1;
    if (activeBookingStepIndex >= last) {
      document.getElementById("createBtn")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setActiveStep(activeBookingStepIndex + 1);
  });

  for (const id of BOOKING_FLOW_ALL_TAB_IDS) {
    document.getElementById(id)?.addEventListener("click", () => {
      const steps = BOOKING_FLOW_STEPS;
      const idx = steps.findIndex((s) => s.tabId === id);
      if (idx >= 0) setActiveStep(idx);
    });
  }

  window.__horizonRefreshBookingFlow = () => {
    syncTabVisibility();
    activeBookingStepIndex = 0;
    setActiveStep(0);
  };

  syncTabVisibility();
  setActiveStep(0);
}

function populatePackageSearchSelects() {
  const fromS = document.getElementById("packageSearchFrom");
  const toS = document.getElementById("packageSearchTo");
  const bo = document.getElementById("bundleOrigin");
  const bd = document.getElementById("bundleDestination");
  if (!fromS || !toS || !bo || !bd) return;
  const preserveFrom = fromS.value;
  const preserveTo = toS.value;
  fromS.replaceChildren();
  toS.replaceChildren();
  Array.from(bo.options).forEach((o) => {
    fromS.appendChild(new Option(o.textContent, o.value));
  });
  Array.from(bd.options).forEach((o) => {
    toS.appendChild(new Option(o.textContent, o.value));
  });
  if ([...fromS.options].some((o) => o.value === preserveFrom)) {
    fromS.value = preserveFrom;
  } else {
    fromS.value = bo.value;
  }
  if ([...toS.options].some((o) => o.value === preserveTo)) {
    toS.value = preserveTo;
  } else {
    toS.value = bd.value;
  }
}

function sliceDateFromLocal(dt) {
  if (!dt) return "";
  const s = String(dt);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function updatePackageNightsHint() {
  const dep = document.getElementById("packageDepartDate")?.value;
  const ret = document.getElementById("packageReturnDate")?.value;
  const isReturn =
    document.querySelector('input[name="packageTripType"]:checked')?.value === "return";
  const el = document.getElementById("packageNightsHint");
  if (!el) return;
  if (!isReturn || !dep || !ret) {
    el.textContent = "—";
    return;
  }
  const d0 = new Date(`${dep}T12:00:00`);
  const d1 = new Date(`${ret}T12:00:00`);
  const nights = Math.max(0, Math.round((d1 - d0) / 86400000));
  el.textContent = nights === 1 ? "1 night" : `${nights} nights`;
}

function updatePackageTripSummary() {
  const rooms = document.getElementById("packageRooms")?.value || "1";
  const adults = document.getElementById("packageAdults")?.value || "2";
  const cabin = document.getElementById("packageCabin");
  const cabinLabel = cabin?.selectedOptions?.[0]?.textContent || "Economy";
  const t = document.getElementById("packageTripSummaryText");
  if (t) {
    t.textContent = `${rooms} room${rooms === "1" ? "" : "s"} · ${adults} adult${adults === "1" ? "" : "s"} · ${cabinLabel}`;
  }
}

function applyPackageSearchToBundle() {
  const fromS = document.getElementById("packageSearchFrom");
  const toS = document.getElementById("packageSearchTo");
  const bo = document.getElementById("bundleOrigin");
  const bd = document.getElementById("bundleDestination");
  if (bo && fromS) bo.value = fromS.value;
  if (bd && toS) bd.value = toS.value;

  const dep = document.getElementById("packageDepartDate")?.value;
  const ret = document.getElementById("packageReturnDate")?.value;
  const isReturn =
    document.querySelector('input[name="packageTripType"]:checked')?.value === "return";
  const depEl = document.getElementById("bundleDepartDateTime");
  const retEl = document.getElementById("bundleReturnDateTime");
  if (dep && depEl) {
    depEl.value = dep.length <= 10 ? `${dep}T10:00` : dep;
  }
  if (isReturn && ret && retEl) {
    retEl.value = ret.length <= 10 ? `${ret}T11:00` : ret;
  } else if (!isReturn && dep && retEl) {
    const d = new Date(`${dep}T12:00:00`);
    d.setDate(d.getDate() + 1);
    retEl.value = d.toISOString().slice(0, 16);
  }

  const adults = Math.max(1, Number(document.getElementById("packageAdults")?.value || 2));
  const adultsSel = document.getElementById("bundleAdults");
  if (adultsSel) adultsSel.value = String(adults);
  syncBundleTravellerTotals();
}

function runPackageSearch() {
  applyPackageSearchToBundle();
  const bfr = document.getElementById("bundleFilterRegion");
  const bfc = document.getElementById("bundleFilterCountry");
  if (bfr) bfr.value = "all";
  if (bfc) bfc.value = "all";
  populateBundleFilterSelects(true);
  const fromS = document.getElementById("packageSearchFrom");
  const toS = document.getElementById("packageSearchTo");
  const bff = document.getElementById("bundleFilterFrom");
  const bft = document.getElementById("bundleFilterTo");
  if (bff && fromS) bff.value = fromS.value;
  if (bft && toS) bft.value = toS.value;
  populateBundleFilterSelects(true);
  onBundleFiltersChanged();
  const flex = document.getElementById("packageFlexibleDates")?.checked;
  if (!flex) {
    void searchBundlePricing();
  } else {
    const st = document.getElementById("bundleStatus");
    if (st) {
      st.textContent =
        "Flexible search on: browse packages below, then use Fine-tune or Recalculate if needed.";
    }
    scheduleBundleCardPriceRefresh();
  }
  document.getElementById("step-book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  void refreshFlightDropdownFromRoute();
}

function syncPackageSearchFromBundleFields() {
  const bo = document.getElementById("bundleOrigin");
  const bd = document.getElementById("bundleDestination");
  const fromS = document.getElementById("packageSearchFrom");
  const toS = document.getElementById("packageSearchTo");
  if (fromS && bo && [...fromS.options].some((o) => o.value === bo.value)) {
    fromS.value = bo.value;
  }
  if (toS && bd && [...toS.options].some((o) => o.value === bd.value)) {
    toS.value = bd.value;
  }
  const depEl = document.getElementById("bundleDepartDateTime");
  const retEl = document.getElementById("bundleReturnDateTime");
  const pd = document.getElementById("packageDepartDate");
  const pr = document.getElementById("packageReturnDate");
  if (pd && depEl?.value) pd.value = sliceDateFromLocal(depEl.value);
  if (pr && retEl?.value) pr.value = sliceDateFromLocal(retEl.value);
  updatePackageNightsHint();
}

function setupPackageSearchUI() {
  populatePackageSearchSelects();
  syncPackageSearchFromBundleFields();
  updatePackageNightsHint();
  updatePackageTripSummary();

  document.querySelectorAll('input[name="packageTripType"]').forEach((r) =>
    r.addEventListener("change", () => {
      const retWrap = document.getElementById("packageReturnWrap");
      const isReturn =
        document.querySelector('input[name="packageTripType"]:checked')?.value === "return";
      if (retWrap) retWrap.hidden = !isReturn;
      updatePackageNightsHint();
    })
  );

  ["packageDepartDate", "packageReturnDate"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", updatePackageNightsHint);
  });
  ["packageRooms", "packageAdults", "packageCabin"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", updatePackageTripSummary);
  });

  document.getElementById("packageSearchBtn")?.addEventListener("click", () => {
    runPackageSearch();
  });

  const bo = document.getElementById("bundleOrigin");
  const bd = document.getElementById("bundleDestination");
  bo?.addEventListener("change", () => {
    populatePackageSearchSelects();
    syncPackageSearchFromBundleFields();
    void refreshFlightDropdownFromRoute();
  });
  bd?.addEventListener("change", () => {
    populatePackageSearchSelects();
    syncPackageSearchFromBundleFields();
    void refreshFlightDropdownFromRoute();
  });
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

  if (errEl) {
    errEl.hidden = true;
    errEl.textContent = "";
  }

  if (isGuestSession()) {
    latestTravellerRows = [];
    populateTravellerSelectorsFromRows([]);
    if (listEl) listEl.textContent = "";
    resetTravellerEdit();
    return;
  }

  const customerIdRaw = document.getElementById("travellerCustomerID")?.value ?? "";

  const customerID = Number(customerIdRaw || 0);
  if (!customerID || customerID < 1) {
    if (errEl) {
      errEl.textContent = "Choose which member’s profiles to load in the traveller step.";
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
  const apiHint = out.body?.message;
  latestTravellerRows = Array.isArray(data) ? data : [];

  if (!listEl) return;
  listEl.innerHTML = "";

  if (!latestTravellerRows.length) {
    const lowerHint = String(apiHint || "").toLowerCase();
    if (lowerHint.includes("not configured")) {
      travellerProfilesServiceAvailable = false;
    }
    if (errEl && apiHint) {
      errEl.textContent = apiHint;
      errEl.hidden = false;
    }
    listEl.textContent = apiHint
      ? ""
      : "No saved traveller profiles for this member yet.";
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
  if (isGuestSession()) {
    const statusEl = document.getElementById("travellerEditStatus");
    if (statusEl) {
      statusEl.textContent =
        "Saved traveller profiles are available after you sign in as a loyalty member.";
    }
    return;
  }
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
      const bid = Number(bookingCustomerInput.value || 0);
      // Guest checkout has no wallet; keep passport profiles on a real member account.
      if (bid > 0) {
        customerInput.value = String(bid);
      }
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

let appShellInitialized = false;

function initLoginAndSessionUI() {
  document.getElementById("loginForm")?.addEventListener("submit", onLoginSubmit);
  document.getElementById("logoutBtn")?.addEventListener("click", onLogout);
  document.getElementById("signupForm")?.addEventListener("submit", onSignupSubmit);

  document.getElementById("showSignupBtn")?.addEventListener("click", () => {
    const gateTitle = document.getElementById("loginGateTitle");
    const gateLead = document.querySelector(".login-gate__lede");
    const loginForm = document.getElementById("loginForm");
    const signupSection = document.getElementById("signupSection");
    const loginDivider = document.getElementById("loginDivider");

    if (gateTitle) gateTitle.textContent = "Sign up";
    if (gateLead)
      gateLead.textContent =
        "Create a loyalty account to book packages, save traveller profiles, and use reward coins.";

    if (loginForm) loginForm.hidden = true;
    if (loginDivider) loginDivider.hidden = true;
    if (signupSection) signupSection.hidden = false;
  });

  document.getElementById("backToSigninBtn")?.addEventListener("click", () => {
    const gateTitle = document.getElementById("loginGateTitle");
    const gateLead = document.querySelector(".login-gate__lede");
    const loginForm = document.getElementById("loginForm");
    const signupSection = document.getElementById("signupSection");
    const loginDivider = document.getElementById("loginDivider");

    if (gateTitle) gateTitle.textContent = "Welcome to Horizon Packages";
    if (gateLead)
      gateLead.textContent =
        "Sign in as a loyalty member to book packages, save traveller passport profiles, and use reward coins.";

    if (signupSection) signupSection.hidden = true;
    if (loginDivider) loginDivider.hidden = false;
    if (loginForm) loginForm.hidden = false;
  });
}

async function onLoginSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById("loginError");
  const email = document.getElementById("loginEmail")?.value?.trim() || "";
  const password = document.getElementById("loginPassword")?.value ?? "";
  if (errEl) {
    errEl.hidden = true;
    errEl.textContent = "";
  }
  const out = await fetchJson(`${ACCOUNT_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (out.networkError) {
    if (errEl) {
      errEl.textContent = out.errorMessage;
      errEl.hidden = false;
    }
    return;
  }
  const body = out.body;
  if (!out.ok || !body || Number(body.code) !== 200 || !body.data) {
    if (errEl) {
      errEl.textContent =
        body?.message || `Sign-in failed (${out.status})`;
      errEl.hidden = false;
    }
    return;
  }
  const d = body.data;
  setSession({
    mode: "member",
    customerID: Number(d.customerID),
    email: d.email,
    displayName:
      d.displayName ||
      `${d.firstName || ""} ${d.lastName || ""}`.trim() ||
      d.email,
  });
  enterAppAfterAuth();
}

async function onSignupSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById("signupError");
  const email = document.getElementById("signupEmail")?.value?.trim() || "";
  const firstName = document.getElementById("signupFirstName")?.value?.trim() || "";
  const lastName = document.getElementById("signupLastName")?.value?.trim() || "";
  const phoneNumber = document.getElementById("signupPhone")?.value?.trim() || "";
  const nationality = document.getElementById("signupNationality")?.value?.trim() || "";
  const dateOfBirth = document.getElementById("signupDob")?.value?.trim() || "";
  if (errEl) {
    errEl.hidden = true;
    errEl.textContent = "";
  }
  if (!email) {
    if (errEl) {
      errEl.textContent = "Email is required to create an account.";
      errEl.hidden = false;
    }
    return;
  }
  const out = await fetchJson(`${ACCOUNT_BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, firstName, lastName, phoneNumber, nationality, dateOfBirth }),
  });
  if (out.networkError) {
    if (errEl) {
      errEl.textContent = out.errorMessage;
      errEl.hidden = false;
    }
    return;
  }
  if (!out.ok || !out.body?.data) {
    if (errEl) {
      errEl.textContent = out.body?.message || `Sign up failed (${out.status})`;
      errEl.hidden = false;
    }
    return;
  }
  const d = out.body.data;
  setSession({
    mode: "member",
    customerID: Number(d.customerID),
    email: d.email,
    displayName:
      d.displayName ||
      `${d.firstName || ""} ${d.lastName || ""}`.trim() ||
      d.email,
  });
  enterAppAfterAuth();
}

function enterAppAfterAuth() {
  const gate = document.getElementById("loginGate");
  const shell = document.getElementById("appShell");
  if (gate) gate.hidden = true;
  if (shell) shell.hidden = false;
  initAppShell();
  applySessionToBookingUI();
}

function onLogout() {
  clearSession();
  location.reload();
}

function applySessionToBookingUI() {
  const badge = document.getElementById("sessionBadge");
  if (badge) {
    badge.hidden = false;
    badge.textContent = getSession()?.displayName || "Member";
  }
  const step5Tab = document.getElementById("bookingStep5Tab");
  if (step5Tab) {
    step5Tab.textContent = "5. Loyalty & payment";
  }
  populateCustomerSelects();
  updateCustomerFieldHint();
  updateDemoToolsForAuth();
  if (typeof window.__horizonRefreshBookingFlow === "function") {
    window.__horizonRefreshBookingFlow();
  }
  updateCoinsOffsetUI();
  const cid = Number(document.getElementById("customerID")?.value || 0);
  if (cid) void updateLoyaltySummary(cid);
  else {
    latestLoyalty = null;
    const lc = document.getElementById("loyaltyCoins");
    const lt = document.getElementById("loyaltyTier");
    if (lc) lc.textContent = "-";
    if (lt) lt.textContent = "-";
    refreshPricePreview();
  }
  void loadTravellerProfiles();
}

function initAppShell() {
  if (appShellInitialized) return;
  appShellInitialized = true;

  populateDemoProfileOptions();
  buildSeatMapOnce();
  updateSeatSelectionUI();
  populateTravellerCountSelect();
  populateBundleFilterSelects(false);
  populateBundleRouteSelectsFromPresets();
  populateTripWindowSelect();
  applyTripWindowFromSelect();
  populateBundlePackageSelect();
  setupBundleFineTuneListeners();
  setupPackageSearchUI();
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
  void refreshFlightDropdownFromRoute();

  document.getElementById("demoProfile").addEventListener("change", () => void applyDemoProfile());
  document.getElementById("loadDemoBtn").addEventListener("click", () => void applyDemoProfile());
  document.getElementById("newManualBtn").addEventListener("click", () => {
    void setManualDefaults().then(() =>
      showResult({ info: "Ready — edit the form, then confirm & pay when done." }, "Ready to edit")
    );
  });
  document.getElementById("flightID")?.addEventListener("change", () => {
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
  void loadTwilioConfig();
  document.getElementById("twilioSaveBtn")?.addEventListener("click", () => {
    clearError(document.getElementById("uiError"));
    void saveTwilioSettings();
  });
  updateBreakfastAddonUI();
  void syncFlightScheduleUI();
  const hotelId = Number(document.getElementById("hotelID")?.value || 0);
  void initHotelSelectionById(hotelId > 0 ? hotelId : 1);

  document.getElementById("customerID").addEventListener("change", () => {
    const id = Number(document.getElementById("customerID").value || 0);
    const travAcc = document.getElementById("travellerCustomerID");
    if (travAcc && travAcc.tagName === "SELECT" && travAcc.options.length) {
      const ids = new Set(
        Array.from(travAcc.options).map((o) => Number(o.value))
      );
      if (id > 0 && ids.has(id)) {
        travAcc.value = String(id);
      } else {
        travAcc.value = travAcc.options[0].value;
      }
    }
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

  for (const id of ["bundleAdults", "bundleChildren", "bundleInfants"]) {
    document.getElementById(id)?.addEventListener("change", () => {
      syncBundleTravellerTotals();
      scheduleBundleCardPriceRefresh();
      if (selectedBundlePresetId) void searchBundlePricing();
    });
  }

  document.getElementById("bookerCustomName")?.addEventListener("input", () => {
    const custom = document.getElementById("bookerCustomName")?.value?.trim() || "";
    const nameEl = document.getElementById("passengerName");
    if (nameEl && custom) nameEl.value = custom;
    refreshTripContactSummary();
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

function initUI() {
  initLoginAndSessionUI();
  const gate = document.getElementById("loginGate");
  const shell = document.getElementById("appShell");
  if (getSession()) {
    if (gate) gate.hidden = true;
    if (shell) shell.hidden = false;
    initAppShell();
    applySessionToBookingUI();
  } else {
    if (gate) gate.hidden = false;
    if (shell) shell.hidden = true;
  }
}

window.addEventListener("DOMContentLoaded", initUI);

