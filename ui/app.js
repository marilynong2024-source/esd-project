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
const DISPLAY_CURRENCY_STORAGE_KEY = "horizonDisplayCurrency";

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

/** After successful Confirm & pay, block steps, seats, and resubmit until Reset form. */
let bookingFlowCompletedLock = false;

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
    blurb:
      "5 nights · Shibuya skyline, Tsukiji-style eats, day trip to Kamakura — curated for first-timers & repeat visitors.",
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
    blurb:
      "4 nights · Riverside temples, Chatuchak market crawl, rooftop bars & Michelin street stalls in one long weekend.",
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
    blurb:
      "7 nights · Ubud rice terraces & spas, Seminyak dining, optional snorkel day — slow travel with pool time.",
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
    blurb:
      "7 nights · Harbour Bridge walk, Bondi to Coogee coastal path, Blue Mountains day — classic Australia intro.",
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
    blurb:
      "8 nights · West End shows, British Museum deep dive, day trips to Windsor or Cambridge — full city immersion.",
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
    blurb:
      "5 nights · Eurostar-ready, Montmartre sunsets, pastry crawl in Le Marais — short Euro hop from London.",
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
    blurb:
      "6 nights · Thames walks, Borough Market, West End shows — reverse hop with full English fuel.",
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
    blurb:
      "8 nights · Jet-lag friendly pacing, Shibuya & Asakusa mix, day trip to Nikkō or Hakone.",
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
    blurb:
      "7 nights · Hawker centres, Gardens by the Bay, Sentosa option — swap harbour cities in one week.",
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
    blurb:
      "6 nights · Konbini mornings to night markets — two capitals, one appetite, maximum contrast.",
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
  {
    id: "paris-romance",
    title: "Paris art & café week",
    route: "Singapore → Paris",
    origin: "Singapore",
    destination: "Paris",
    region: "intercontinental",
    depart: "2026-04-22T09:30",
    ret: "2026-04-29T18:00",
    blurb:
      "7 nights · Louvre & Orsay by day, Marais boutiques, Seine sunset walks — long-haul classic with pastry stops.",
    image: "https://picsum.photos/seed/pkg-par-sin/520/300",
  },
  {
    id: "bali-wellness",
    title: "Bali slow wellness",
    route: "Singapore → Bali",
    origin: "Singapore",
    destination: "Bali",
    region: "asia",
    depart: "2026-09-10T10:00",
    ret: "2026-09-17T12:00",
    blurb:
      "7 nights · Morning yoga, spa afternoons, Jimbaran seafood sunset — same island, quieter rhythm than the surf pack.",
    image: "https://picsum.photos/seed/pkg-bali-well/520/300",
  },
  {
    id: "bkk-weekend",
    title: "Bangkok long weekend",
    route: "Singapore → Bangkok",
    origin: "Singapore",
    destination: "Bangkok",
    region: "asia",
    depart: "2026-12-04T07:00",
    ret: "2026-12-08T20:00",
    blurb:
      "4 nights · Chao Phraya dinner cruise, Chatuchak Saturday, Thonglor café hopping — short break, maximum bites.",
    image: "https://picsum.photos/seed/pkg-bkk-wknd/520/300",
  },
  {
    id: "syd-spring",
    title: "Sydney spring coastal",
    route: "Singapore → Sydney",
    origin: "Singapore",
    destination: "Sydney",
    region: "asia",
    depart: "2026-10-22T08:30",
    ret: "2026-10-29T17:00",
    blurb:
      "7 nights · Coastal walks, Barangaroo dining, optional Hunter Valley — spring light & longer daylight hours.",
    image: "https://picsum.photos/seed/pkg-syd-spr/520/300",
  },
  {
    id: "lon-festive",
    title: "London winter lights",
    route: "Singapore → London",
    origin: "Singapore",
    destination: "London",
    region: "intercontinental",
    depart: "2026-12-10T23:45",
    ret: "2026-12-20T12:00",
    blurb:
      "10 nights · West End, South Bank markets, museum days — festive city glow with cosy pub stops.",
    image: "https://picsum.photos/seed/pkg-lon-win/520/300",
  },
  {
    id: "tyo-sakura",
    title: "Tokyo spring dates",
    route: "Singapore → Tokyo",
    origin: "Singapore",
    destination: "Tokyo",
    region: "asia",
    depart: "2026-03-28T09:00",
    ret: "2026-04-02T16:00",
    blurb:
      "5 nights · Early sakura window, Ueno park picnics, day trip to Kawaguchiko — alternate Tokyo window vs city break.",
    image: "https://picsum.photos/seed/pkg-tyo-sak/520/300",
  },
  {
    id: "dxb-lon",
    title: "Dubai to London",
    route: "Dubai → London",
    origin: "Dubai",
    destination: "London",
    region: "intercontinental",
    depart: "2026-06-04T09:00",
    ret: "2026-06-11T18:00",
    blurb:
      "7 nights · Skyline souks to West End — long-haul mix of desert glam and Thames-side walks.",
    image: "https://picsum.photos/seed/pkg-dxb-lon/520/300",
  },
  {
    id: "ams-lon",
    title: "Amsterdam to London",
    route: "Amsterdam → London",
    origin: "Amsterdam",
    destination: "London",
    region: "europe",
    depart: "2026-07-08T10:30",
    ret: "2026-07-12T17:00",
    blurb:
      "4 nights · Canals, Rijksmuseum mornings, Eurostar-ready hop into theatre and markets.",
    image: "https://picsum.photos/seed/pkg-ams-lon/520/300",
  },
  {
    id: "ams-sin",
    title: "Amsterdam to Singapore",
    route: "Amsterdam → Singapore",
    origin: "Amsterdam",
    destination: "Singapore",
    region: "intercontinental",
    depart: "2026-08-15T13:00",
    ret: "2026-08-24T11:00",
    blurb:
      "9 nights · Schiphol long-haul into hawker centres, heritage shophouses, and Gardens by the Bay.",
    image: "https://picsum.photos/seed/pkg-ams-sin/520/300",
  },
  {
    id: "sfo-sin",
    title: "San Francisco to Singapore",
    route: "San Francisco → Singapore",
    origin: "San Francisco",
    destination: "Singapore",
    region: "intercontinental",
    depart: "2026-09-02T01:00",
    ret: "2026-09-12T23:00",
    blurb:
      "10 nights · Pacific crossing into tropical city rhythm — Marina Bay, Sentosa, and food courts.",
    image: "https://picsum.photos/seed/pkg-sfo-sin/520/300",
  },
  {
    id: "lax-tyo",
    title: "Los Angeles to Tokyo",
    route: "Los Angeles → Tokyo",
    origin: "Los Angeles",
    destination: "Tokyo",
    region: "intercontinental",
    depart: "2026-10-05T12:00",
    ret: "2026-10-14T16:00",
    blurb:
      "9 nights · Transpacific into Shibuya nights, day trips to Kamakura or Disney — jet-lag friendly pacing.",
    image: "https://picsum.photos/seed/pkg-lax-tyo/520/300",
  },
  {
    id: "sgn-sin",
    title: "Ho Chi Minh City to Singapore",
    route: "Ho Chi Minh City → Singapore",
    origin: "Ho Chi Minh City",
    destination: "Singapore",
    region: "asia",
    depart: "2026-11-06T08:00",
    ret: "2026-11-10T20:00",
    blurb:
      "4 nights · Saigon energy to orderly Lion City — short hop, maximum contrast in food and pace.",
    image: "https://picsum.photos/seed/pkg-sgn-sin/520/300",
  },
  {
    id: "han-bkk",
    title: "Hanoi to Bangkok",
    route: "Hanoi → Bangkok",
    origin: "Hanoi",
    destination: "Bangkok",
    region: "asia",
    depart: "2026-05-18T07:00",
    ret: "2026-05-24T12:00",
    blurb:
      "6 nights · Old Quarter pho to Chao Phraya sunsets — two Southeast Asian capitals in one trip.",
    image: "https://picsum.photos/seed/pkg-han-bkk/520/300",
  },
  {
    id: "cgk-sin",
    title: "Jakarta to Singapore",
    route: "Jakarta → Singapore",
    origin: "Jakarta",
    destination: "Singapore",
    region: "asia",
    depart: "2026-04-12T09:00",
    ret: "2026-04-15T18:00",
    blurb:
      "3 nights · Quick Java hop into hawker culture and rooftop bars — ideal add-on weekend.",
    image: "https://picsum.photos/seed/pkg-cgk-sin/520/300",
  },
  {
    id: "maa-sin",
    title: "Chennai to Singapore",
    route: "Chennai → Singapore",
    origin: "Chennai",
    destination: "Singapore",
    region: "asia",
    depart: "2026-07-22T06:00",
    ret: "2026-07-27T22:00",
    blurb:
      "5 nights · Coromandel coast to equatorial city — spice routes meet modern Southeast Asia.",
    image: "https://picsum.photos/seed/pkg-maa-sin/520/300",
  },
  {
    id: "mnl-sin",
    title: "Manila to Singapore",
    route: "Manila → Singapore",
    origin: "Manila",
    destination: "Singapore",
    region: "asia",
    depart: "2026-08-20T10:00",
    ret: "2026-08-26T09:00",
    blurb:
      "6 nights · Luzon gateway into Lion City dining, museums, and green corridors.",
    image: "https://picsum.photos/seed/pkg-mnl-sin/520/300",
  },
  {
    id: "fra-sin",
    title: "Frankfurt to Singapore",
    route: "Frankfurt → Singapore",
    origin: "Frankfurt",
    destination: "Singapore",
    region: "intercontinental",
    depart: "2026-12-01T14:00",
    ret: "2026-12-10T11:00",
    blurb:
      "9 nights · Rhine-Main hub to tropical metropolis — fairs city to food-hall capital.",
    image: "https://picsum.photos/seed/pkg-fra-sin/520/300",
  },
  {
    id: "tyo-syd",
    title: "Tokyo to Sydney",
    route: "Tokyo → Sydney",
    origin: "Tokyo",
    destination: "Sydney",
    region: "asia",
    depart: "2026-06-20T11:00",
    ret: "2026-06-28T09:00",
    blurb:
      "8 nights · Neon to surf — Pacific rim pairing with harbour walks and coastal days.",
    image: "https://picsum.photos/seed/pkg-tyo-syd/520/300",
  },
  {
    id: "lon-sin",
    title: "London to Singapore",
    route: "London → Singapore",
    origin: "London",
    destination: "Singapore",
    region: "intercontinental",
    depart: "2026-05-25T22:00",
    ret: "2026-06-02T18:00",
    blurb:
      "8 nights · After theatre season, swap drizzle for equatorial nights and rooftop pools.",
    image: "https://picsum.photos/seed/pkg-lon-sin/520/300",
  },
  {
    id: "bkk-tyo",
    title: "Bangkok to Tokyo",
    route: "Bangkok → Tokyo",
    origin: "Bangkok",
    destination: "Tokyo",
    region: "asia",
    depart: "2026-09-08T08:00",
    ret: "2026-09-15T17:00",
    blurb:
      "7 nights · Night markets to metro lines — temples, ramen alleys, and orderly Shibuya crossings.",
    image: "https://picsum.photos/seed/pkg-bkk-tyo/520/300",
  },
  {
    id: "par-tyo",
    title: "Paris to Tokyo",
    route: "Paris → Tokyo",
    origin: "Paris",
    destination: "Tokyo",
    region: "intercontinental",
    depart: "2026-10-12T13:00",
    ret: "2026-10-21T11:00",
    blurb:
      "9 nights · Haussmann boulevards to Shinjuku skyscrapers — long-haul culture contrast.",
    image: "https://picsum.photos/seed/pkg-par-tyo/520/300",
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
  "Kuala Lumpur": "malaysia",
  Seoul: "south korea",
  Dubai: "uae",
  "Hong Kong": "hong kong",
  Melbourne: "australia",
  Manila: "philippines",
  Chennai: "india",
  Jakarta: "indonesia",
  Frankfurt: "germany",
  Amsterdam: "netherlands",
  "Los Angeles": "usa",
  "San Francisco": "usa",
  Auckland: "new zealand",
  "Ho Chi Minh City": "vietnam",
  Hanoi: "vietnam",
  Taipei: "taiwan",
  Phuket: "thailand",
  Perth: "australia",
  "New York": "usa",
};

const BUNDLE_COUNTRY_LABEL = {
  singapore: "Singapore",
  japan: "Japan",
  thailand: "Thailand",
  indonesia: "Indonesia",
  australia: "Australia",
  uk: "UK",
  france: "France",
  taiwan: "Taiwan",
  malaysia: "Malaysia",
  "south korea": "South Korea",
  uae: "UAE",
  "hong kong": "Hong Kong SAR",
  philippines: "Philippines",
  india: "India",
  germany: "Germany",
  netherlands: "Netherlands",
  usa: "USA",
  "new zealand": "New Zealand",
  vietnam: "Vietnam",
};

function countryLabelForBundleDestinationCity(destCity) {
  const c = String(destCity || "").trim();
  if (!c) return "";
  const slug = CITY_COUNTRY_SLUG[c];
  return slug ? BUNDLE_COUNTRY_LABEL[slug] : "";
}

function isSameCityRoute(origin, destination) {
  const o = String(origin ?? "").trim().toLowerCase();
  const d = String(destination ?? "").trim().toLowerCase();
  return o.length > 0 && d.length > 0 && o === d;
}

/** Hero + bundle route must differ; block search buttons and show inline copy when they match. */
function syncSameCityRouteUI() {
  const bo = document.getElementById("bundleOrigin")?.value?.trim() || "";
  const bd = document.getElementById("bundleDestination")?.value?.trim() || "";
  const bad = isSameCityRoute(bo, bd);

  const errEl = document.getElementById("packageSameCityError");
  const searchBtn = document.getElementById("packageSearchBtn");
  const bundleSearchBtn = document.getElementById("bundleSearchBtn");
  const routeRow = document.querySelector(".package-search__route");

  if (errEl) {
    errEl.hidden = !bad;
    errEl.textContent = bad
      ? "Origin and destination must be different cities — you can’t book a package from a city to itself."
      : "";
  }
  if (routeRow) routeRow.classList.toggle("package-search__route--invalid", bad);
  if (searchBtn) searchBtn.disabled = bad;
  if (bundleSearchBtn) bundleSearchBtn.disabled = bad;
}

/** Drop cached hotel cards that are not in the current Fine-tune destination city. */
function filterHotelRowsToBundleDestination(rows) {
  const dest = document.getElementById("bundleDestination")?.value?.trim() || "";
  if (!dest || !Array.isArray(rows) || !rows.length) return rows;
  const d = dest.trim().toLowerCase();
  return rows.filter((h) => {
    const c = String(h.city || "").trim().toLowerCase();
    if (!c) return false;
    return c === d || c.includes(d) || d.includes(c);
  });
}

function applyBundleDestinationToHotelSearchInputs() {
  const dest = document.getElementById("bundleDestination")?.value?.trim() || "";
  const cityEl = document.getElementById("hotelSearchCity");
  const countryEl = document.getElementById("hotelSearchCountry");
  if (!cityEl || !countryEl || !dest) return;
  cityEl.value = dest;
  const country = countryLabelForBundleDestinationCity(dest);
  countryEl.value = country || "";
}

async function refreshHotelsForBundleDestination() {
  const o = document.getElementById("bundleOrigin")?.value?.trim() || "";
  const d = document.getElementById("bundleDestination")?.value?.trim() || "";
  if (isSameCityRoute(o, d)) {
    const selectedHintEl = document.getElementById("hotelSelectedHint");
    const resultsEl = document.getElementById("hotelResults");
    if (selectedHintEl) {
      selectedHintEl.textContent =
        "Choose different origin and destination cities to search hotels.";
    }
    if (resultsEl) resultsEl.textContent = "";
    latestHotelRows = [];
    destinationHasHotels = false;
    renderHotelResults([]);
    return;
  }
  applyBundleDestinationToHotelSearchInputs();
  await searchHotels();
}

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

function getPackageDropdownSelectionId() {
  const sel = document.getElementById("bundlePackageSelect");
  if (!sel || sel.tagName !== "SELECT") return "";
  return String(sel.value || "").trim();
}

/** Presets matching the route in Fine-tune / top search (same origin + destination). */
function getRouteFilteredPresets() {
  const o = document.getElementById("bundleOrigin")?.value?.trim() || "";
  const d = document.getElementById("bundleDestination")?.value?.trim() || "";
  if (!o || !d) return BUNDLE_PRESETS;
  return BUNDLE_PRESETS.filter((p) => p.origin === o && p.destination === d);
}

function getFilteredPresets() {
  const routeList = getRouteFilteredPresets();
  const only = getPackageDropdownSelectionId();
  if (!only) return routeList;
  const hit = routeList.find((x) => x.id === only);
  return hit ? [hit] : routeList;
}

/**
 * Legacy helper for bundle filters. The dedicated Region/Country/From/To
 * dropdowns have been removed from the UI to avoid repetition with the
 * main search bar, so this function is now a no-op kept for safety.
 */
function populateBundleFilterSelects() {
  // Intentionally empty.
}

/**
 * Rebuild "Flying to" options from curated packages for the current "Flying from"
 * so you never see impossible pairs (e.g. Singapore → Singapore from inbound-only routes).
 */
function syncBundleDestinationSelectToOrigin() {
  const oSel = document.getElementById("bundleOrigin");
  const dSel = document.getElementById("bundleDestination");
  if (!oSel || !dSel || oSel.tagName !== "SELECT" || dSel.tagName !== "SELECT") return;

  const origin = String(oSel.value || "").trim();
  const prevDest = String(dSel.value || "").trim();
  let dests = [
    ...new Set(
      BUNDLE_PRESETS.filter((p) => p.origin === origin).map((p) => p.destination)
    ),
  ].sort();
  if (!dests.length && origin) {
    dests = [...new Set(BUNDLE_PRESETS.map((p) => p.destination))]
      .filter((c) => !isSameCityRoute(origin, c))
      .sort();
  }

  dSel.replaceChildren();
  for (const city of dests) {
    dSel.appendChild(new Option(city, city));
  }
  if (dests.includes(prevDest)) dSel.value = prevDest;
  else if (dests.includes("Tokyo")) dSel.value = "Tokyo";
  else if (dests.length) dSel.value = dests[0];

  syncSameCityRouteUI();
}

function populateBundleRouteSelectsFromPresets() {
  const origins = [...new Set(BUNDLE_PRESETS.map((p) => p.origin))].sort();
  const oSel = document.getElementById("bundleOrigin");
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
  syncBundleDestinationSelectToOrigin();
}

function storedDisplayCurrency() {
  try {
    const v = localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY);
    if (v && /^[A-Z]{3}$/.test(v)) return v;
  } catch {
    /* ignore */
  }
  return "SGD";
}

function setStoredDisplayCurrency(code) {
  try {
    localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

/**
 * @param {number} sgdAmount
 * @param {{ maxFrac?: number, forceSgd?: boolean }} [opts]
 */
function formatMoneyDisplayFromSgd(sgdAmount, opts) {
  const n = Number(sgdAmount);
  if (!Number.isFinite(n)) return "—";
  const maxFrac = opts?.maxFrac !== undefined ? opts.maxFrac : 2;
  const forceSgd = !!opts?.forceSgd;
  const code = forceSgd ? "SGD" : displayFx.code;
  const rate = forceSgd ? 1 : displayFx.rate;
  const converted = n * rate;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFrac,
    }).format(converted);
  } catch {
    return `${code} ${converted.toFixed(maxFrac)}`;
  }
}

async function fetchDisplayFxRate(code) {
  const c = (code || "SGD").toUpperCase();
  if (c === "SGD") {
    displayFx.code = "SGD";
    displayFx.rate = 1;
    displayFx.source = "fixed";
    return;
  }
  const out = await fetchJson(
    `${API_BASE}/booking/fx-rate?${new URLSearchParams({ to: c }).toString()}`
  );
  if (out.networkError || !out.ok || out.body?.data?.rate == null) {
    displayFx.code = "SGD";
    displayFx.rate = 1;
    displayFx.source = "unavailable";
    const sel = document.getElementById("displayCurrencySelect");
    if (sel && sel.value !== "SGD") {
      sel.value = "SGD";
      setStoredDisplayCurrency("SGD");
    }
    return;
  }
  displayFx.code = c;
  displayFx.rate = Number(out.body.data.rate);
  displayFx.source = String(out.body.data.source || "api");
}

function updatePayStepCurrencyLabels() {
  const el = document.querySelector(".pay-step__due-currency");
  if (el) {
    el.textContent = displayFx.code === "SGD" ? "SGD" : displayFx.code;
  }
  const foot = document.getElementById("payStepFxFootnote");
  if (foot) {
    if (displayFx.code === "SGD") {
      foot.hidden = true;
      foot.textContent = "";
    } else {
      foot.hidden = false;
      foot.textContent =
        "Converted for display using daily rates. Booking and payment amounts are still processed in SGD.";
    }
  }
}

function refreshAllDisplayedPrices() {
  updatePayStepCurrencyLabels();
  updateBundleCardPriceLabels();
  refreshPricePreview();
  void refreshFlightDropdownFromRoute();
  if (Array.isArray(latestHotelRows) && latestHotelRows.length) {
    const filtered = filterHotelRowsToBundleDestination(latestHotelRows);
    if (filtered.length !== latestHotelRows.length) {
      latestHotelRows = filtered;
    }
    renderHotelResults(filtered);
  }
  updateHotelRoomDetailsUI();
  updateCoinsOffsetUI();
  const statusEl = document.getElementById("bundleStatus");
  if (statusEl && latestBundlePricing && Number.isFinite(Number(latestBundlePricing.finalTotal))) {
    const t = Number(latestBundlePricing.finalTotal);
    statusEl.textContent = `Selected — total ${formatMoneyDisplayFromSgd(t)}. Continue with traveller, hotel & flight steps.`;
  }
  if (lastMyBookingsCustomerId) {
    void loadMyBookings(lastMyBookingsCustomerId);
  }
}

async function applyDisplayCurrencyFromUI() {
  const sel = document.getElementById("displayCurrencySelect");
  const code = sel?.value || storedDisplayCurrency();
  setStoredDisplayCurrency(code);
  await fetchDisplayFxRate(code);
  refreshAllDisplayedPrices();
}

async function initDisplayCurrencyUI() {
  const sel = document.getElementById("displayCurrencySelect");
  if (!sel) return;
  const cur = storedDisplayCurrency();
  if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
  else sel.value = "SGD";
  sel.addEventListener("change", () => void applyDisplayCurrencyFromUI());
  await applyDisplayCurrencyFromUI();
}

function bundleCardPriceLabel(presetId) {
  const c = bundleCardPriceCache.get(presetId);
  if (!c || c.loading) {
    return {
      html: `<span class="bundle-price__loading">Pricing…</span>`,
    };
  }
  if (c.err) {
    const t = escapeHtml(String(c.err));
    return {
      html: `<span class="bundle-price__unavailable" title="${t}">—</span>`,
    };
  }
  const list = Number.isFinite(c.listTotal) ? Math.round(Number(c.listTotal)) : null;
  const final = Number.isFinite(c.finalTotal) ? Math.round(Number(c.finalTotal)) : null;
  if (!final) {
    return { html: `<span class="bundle-price__unavailable">—</span>` };
  }
  if (!list || list <= final) {
    // No discount vs list price – keep the simple label.
    return {
      html: `<span class="bundle-price__now">From ${formatMoneyDisplayFromSgd(final, { maxFrac: 0 })}</span>`,
    };
  }
  const savings = Math.max(0, list - final);
  return {
    html: `
      <span class="bundle-price__was">Was ${formatMoneyDisplayFromSgd(list, { maxFrac: 0 })}</span>
      <span class="bundle-price__now bundle-price__now--deal">Now ${formatMoneyDisplayFromSgd(final, { maxFrac: 0 })}</span>
      <span class="bundle-price__save">Save ${formatMoneyDisplayFromSgd(savings, { maxFrac: 0 })}</span>
    `,
  };
}

function updateBundleCardPriceLabels() {
  document.querySelectorAll(".bundle-card__price").forEach((el) => {
    const id = el.getAttribute("data-preset-id");
    if (!id) return;
    const label = bundleCardPriceLabel(id);
    el.innerHTML = label.html;
  });
}

async function refreshBundleCardPrices() {
  const customerId = document.getElementById("customerID")?.value?.trim();
  const travellers = document.getElementById("bundleNumberOfTravellers")?.value?.trim();
  if (!customerId || !travellers) return;
  const coinsInput = document.getElementById("coinsToSpendCents");
  const coins = Math.max(0, Number(coinsInput?.value || 0));

  const presetsForPricing = getFilteredPresets();
  for (const p of presetsForPricing) {
    bundleCardPriceCache.set(p.id, { loading: true });
  }
  updateBundleCardPriceLabels();

  await Promise.all(
    presetsForPricing.map(async (p) => {
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
          err:
            out.errorMessage ||
            out.body?.message ||
            `HTTP ${out.status}`,
          listTotal: null,
          finalTotal: null,
        });
        return;
      }
      const data = out.body?.data;
      if (out.body?.code !== 200 || !data) {
        bundleCardPriceCache.set(p.id, {
          err: out.body?.message || "Pricing unavailable",
          listTotal: null,
          finalTotal: null,
        });
        return;
      }
      bundleCardPriceCache.set(p.id, {
        listTotal: Number(
          data.listPriceTotal != null ? data.listPriceTotal : data.finalTotal
        ),
        finalTotal: Number(data.finalTotal),
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
  // Filter controls were removed from the booking form; nothing to wire up.
}

/** Syncs hidden booking `customerID` and Travellers-tab member select from the current session. */
function populateCustomerSelects() {
  const bookEl = document.getElementById("customerID");
  if (!bookEl) return;

  const session = getSession();
  const cidStr =
    !session || session.mode === "guest" ? "0" : String(session.customerID);
  bookEl.value = cidStr;

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

  applyBookingCustomerIdEffects();
}

function applyBookingCustomerIdEffects() {
  const id = Number(document.getElementById("customerID")?.value || 0);
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
    const lc1 = document.getElementById("loyaltyCoins");
    if (lc1) {
      lc1.textContent = "-";
      lc1.removeAttribute("title");
    }
    const lt0 = document.getElementById("loyaltyTier");
    if (lt0) lt0.textContent = "-";
    refreshPricePreview();
  }
  if (id) void loadMyAccount(id);
  if (document.getElementById("leadTravellerSelect")) {
    void loadTravellerProfiles();
  }
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

/** When true, Fine-tune origin/dest changes came from picking a package — do not clear selection. */
let suppressBundleRouteDiverge = false;

/**
 * Curated package cards only when the stack has both outbound flights and destination hotels
 * for the current Fine-tune route (after searches complete).
 */
function curatedPackagesAllowedForCurrentRoute() {
  const presets = getRouteFilteredPresets();
  if (!presets.length) return false;

  const o = document.getElementById("bundleOrigin")?.value?.trim() || "";
  const d = document.getElementById("bundleDestination")?.value?.trim() || "";
  if (!o || !d) return true;

  if (!routeFlightsInventoryChecked || !routeHotelsInventoryChecked) return true;

  return routeHasOutboundFlights && destinationHasHotels;
}

function syncRouteInventoryToPackageUI() {
  populateBundlePackageSelect();
  renderBundleGallery();
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
  const source = curatedPackagesAllowedForCurrentRoute() ? getRouteFilteredPresets() : [];
  for (const p of source) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = `${p.title} (${p.route})`;
    sel.appendChild(o);
  }
  const valid = keep && Array.from(sel.options).some((o) => o.value === keep);
  sel.value = valid ? keep : "";
  updateBundlePackageSectionVisibility();
}

/** Hide curated packages when there are none for the route, or when flight/hotel inventory is missing. */
function updateBundlePackageSectionVisibility() {
  const section = document.getElementById("bundlePackageSection");
  const presetRoutes = getRouteFilteredPresets();
  const hasPresetRoutes = presetRoutes.length > 0;
  const o = document.getElementById("bundleOrigin")?.value?.trim() || "";
  const d = document.getElementById("bundleDestination")?.value?.trim() || "";

  let inventoryBlocked = false;
  let inventoryMsg = "";
  if (
    hasPresetRoutes &&
    o &&
    d &&
    routeFlightsInventoryChecked &&
    routeHotelsInventoryChecked
  ) {
    const noF = !routeHasOutboundFlights;
    const noH = !destinationHasHotels;
    if (noF && noH) {
      inventoryBlocked = true;
      inventoryMsg = `No packages for this trip — no outbound flights with enough seats for these dates, and no hotels in ${d}. Try other dates or cities.`;
    } else if (noF) {
      inventoryBlocked = true;
      inventoryMsg = `No packages for this trip — no outbound flights for ${o} → ${d} with enough seats on these dates. Try different dates or another route.`;
    } else if (noH) {
      inventoryBlocked = true;
      inventoryMsg = `No packages for this trip — no hotels available in ${d} for this search. Try another destination or adjust the hotel search.`;
    }
  }

  const showPackageUi = hasPresetRoutes && !inventoryBlocked;

  const routeDatesSection = document.getElementById("bundleRouteDatesSection");
  const fineTunePriceRow = document.getElementById("bundleFineTunePriceRow");
  const pricingActions = document.getElementById("bundlePricingActions");
  const noPkgMsg = document.getElementById("bundleNoPackagesMsg");
  const st = document.getElementById("bundleStatus");

  if (!showPackageUi) {
    if (routeDatesSection) routeDatesSection.hidden = true;
    if (fineTunePriceRow) fineTunePriceRow.hidden = true;
    if (pricingActions) pricingActions.hidden = true;
    if (noPkgMsg) {
      noPkgMsg.hidden = false;
      noPkgMsg.textContent = !hasPresetRoutes
        ? "No packages available."
        : inventoryMsg || "No packages available.";
    }
    if (st && inventoryBlocked) st.textContent = "";
  } else {
    if (routeDatesSection) routeDatesSection.hidden = false;
    if (fineTunePriceRow) fineTunePriceRow.hidden = false;
    if (pricingActions) pricingActions.hidden = false;
    if (noPkgMsg) {
      noPkgMsg.hidden = true;
      noPkgMsg.textContent = "No packages available.";
    }
  }

  if (!section) return;
  section.hidden = !showPackageUi;

  if (!showPackageUi) {
    selectedBundlePresetId = null;
    const pkg = document.getElementById("bundlePackageSelect");
    if (pkg) pkg.value = "";
    document.querySelectorAll(".bundle-card").forEach((b) => {
      b.classList.remove("bundle-card--selected");
      b.setAttribute("aria-pressed", "false");
    });
    const track = document.getElementById("bundleGalleryTrack");
    if (track) track.replaceChildren();
  }
}

function onFineTuneDivergeFromPackage() {
  if (suppressBundleRouteDiverge) return;
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
  const hasRoutePackages = getRouteFilteredPresets().length > 0;
  if (st) {
    st.textContent = hasRoutePackages
      ? "Trip details changed — pick a package again, or adjust From/To below and tap Recalculate price. Dates follow the banner search."
      : "Trip details changed — adjust From/To below and tap Recalculate price. Dates follow the banner search.";
  }
  populateBundlePackageSelect();
  renderBundleGallery();
  scheduleBundleCardPriceRefresh();
}

function setupBundleFineTuneListeners() {
  document.getElementById("bundleTripWindowSelect")?.addEventListener("change", () => {
    applyTripWindowFromSelect();
    onFineTuneDivergeFromPackage();
    void refreshFlightDropdownFromRoute();
  });
  document.getElementById("bundleOrigin")?.addEventListener("change", () => {
    syncBundleDestinationSelectToOrigin();
    onFineTuneDivergeFromPackage();
    void refreshFlightDropdownFromRoute();
    void refreshHotelsForBundleDestination();
  });
  document.getElementById("bundleDestination")?.addEventListener("change", () => {
    onFineTuneDivergeFromPackage();
    void refreshFlightDropdownFromRoute();
    void refreshHotelsForBundleDestination();
  });
  document.getElementById("bundlePackageSelect")?.addEventListener("change", (e) => {
    const v = e.target.value;
    if (!v) {
      clearBundleSelectionState();
      renderBundleGallery();
      scheduleBundleCardPriceRefresh();
      return;
    }
    selectBundlePreset(v);
  });
}

/** Seats treated as already taken until the flight API refreshes (merged with API on refresh). */
const DEFAULT_TAKEN_SEATS = new Set(["8A", "9D", "9E", "10F", "12C"]);
let currentTakenSeats = new Set(DEFAULT_TAKEN_SEATS);
let seatRefreshToken = 0;
/** Serializes taken-seat fetches so a click never uses a stale `currentTakenSeats` from an in-flight refresh. */
let seatRefreshQueue = Promise.resolve();

function refreshTakenSeatsQueued(flightId) {
  const fid = String(flightId || "").trim().toUpperCase();
  const job = seatRefreshQueue.then(() => refreshTakenSeatsForFlight(fid));
  seatRefreshQueue = job.catch(() => {});
  return job;
}
// Seat selection state for the current booking:
// - codes[0] is the lead traveller seat
// - the rest are companion seats (auto-assigned for the group)
let selectedSeatCodes = [];
const SEAT_HOLD_TOKEN_KEY = "horizonSeatHoldToken";
let seatHoldExpiresAtIso = "";
let seatHoldTimerId = null;

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
/** Ordered IDs for this trip: index 0 = lead (contact + primary seat). */
let tripPartyOrderedIds = [];
/** Bumps on each traveller list fetch so stale responses cannot shrink the trip party. */
let travellerLoadSeq = 0;
let selectedTravellerRow = null; // OutSystems traveller profile row object
let pendingTravellerProfileIds = null;
let selectedHotel = null; // Hotel row from hotel service (for UI only)
let latestHotelRows = [];
/** Last outbound flight search for Fine-tune origin/destination (gates curated packages). */
let routeHasOutboundFlights = false;
let destinationHasHotels = false;
let routeFlightsInventoryChecked = false;
let routeHotelsInventoryChecked = false;
let lastHotelRoomType = null;
let travellerProfilesServiceAvailable = true; // avoids repeated 500 spam when OutSystems is not configured

// Bundle pricing composite (Search & Price Bundle step).
let latestBundlePricing = null; // { flightPrice, hotelPrice, discount, loyaltyUsed, finalTotal, ... }
let lastBundleParams = null; // query params used for last bundle call
let selectedBundlePresetId = null;
let lastMyBookingsCustomerId = null;

/** Multiply SGD amounts for labels; APIs and payment still use SGD. */
const displayFx = { code: "SGD", rate: 1, source: "fixed" };

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
      const gatewayHint =
        res.status === 502 || res.status === 503
          ? " If this is HTML (not JSON), nginx could not reach the booking container: run `docker compose ps` and `docker compose up -d --build booking ui`. The UI must use http://localhost:8080 so `/api/booking` proxies to Docker. If the body is JSON with a message, the booking service could not reach OutSystems from inside Docker (check TRAVELLER_PROFILE_BASE_URL, outbound HTTPS, `docker compose logs booking`)."
          : "";
      body = {
        _raw: text.slice(0, 500),
        _parseError: true,
        code: res.status,
        message: `Non-JSON response (HTTP ${res.status}).${gatewayHint}`,
      };
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
/** Numeric customer id &gt; 0 means a member with a loyalty wallet; 0 = no wallet (e.g. guest flows). */
function hasAccountCustomerId(customerID) {
  return Number(customerID) > 0;
}

function computeFinalPriceBreakdown(basePriceOverride) {
  const basePrice = Number.isFinite(Number(basePriceOverride))
    ? Math.max(0, Number(basePriceOverride))
    : Math.max(0, Number(document.getElementById("totalPrice").value) || 0);
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
  const bTotal = latestBundlePricing?.finalTotal;
  // Bundle `finalTotal` already includes discount-service % and loyalty coins from
  // `/bundle-price`. Do not run tier/promo/coins again on it (that double-counted).
  if (Number.isFinite(Number(bTotal))) {
    el.textContent = formatMoneyDisplayFromSgd(Number(bTotal));
    return;
  }
  const { finalPaid } = computeFinalPriceBreakdown();
  el.textContent = Number.isFinite(finalPaid)
    ? formatMoneyDisplayFromSgd(finalPaid)
    : "-";
}

function validateBookingStepBeforeNext(stepIndex) {
  if (stepIndex === 0) {
    const cid = Number(document.getElementById("customerID")?.value || 0);
    const pkg = String(document.getElementById("bundlePackageSelect")?.value || "").trim();
    if (cid < 1) return "Please sign in and select who this booking is for.";
    if (curatedPackagesAllowedForCurrentRoute() && getRouteFilteredPresets().length > 0 && !pkg) {
      return "Choose a bundle package before continuing.";
    }
    return "";
  }
  if (stepIndex === 1) {
    if (readTravellerProfileIdsFromInput().length < 1) {
      return "Tick “On this trip” for at least one saved traveller before continuing.";
    }
    return "";
  }
  if (stepIndex === 2) {
    const hid = Number(document.getElementById("hotelID")?.value || 0);
    const room = String(document.getElementById("hotelRoomType")?.value || "").trim();
    if (hid < 1 || !room) return "Pick a hotel and room type before continuing.";
    return "";
  }
  if (stepIndex === 3) {
    const flightId = String(document.getElementById("flightID")?.value || "").trim();
    if (!flightId) return "Choose a flight option before continuing.";
    const seatPol = getSeatPolicy(flightId);
    if (seatPol.onlineSeatSelection) {
      const required = getSeatRequiredCount();
      if (required < 1) return "Choose who is on this trip before selecting seats.";
      if (!Array.isArray(selectedSeatCodes) || selectedSeatCodes.length !== required) {
        return `Select seats for ${required} travellers before continuing.`;
      }
    }
    return "";
  }
  return "";
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
      ? `Selected — total ${formatMoneyDisplayFromSgd(Number(t))}. Continue with traveller, hotel & flight steps.`
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
      const depText = String(inputsForThisCall?.departDate || "").replace("T", " ").slice(0, 16);
      const priceText = Number.isFinite(Number(bundle?.flightPrice))
        ? formatMoneyDisplayFromSgd(Number(bundle.flightPrice), { maxFrac: 0 })
        : Number.isFinite(Number(bundle?.finalTotal))
          ? formatMoneyDisplayFromSgd(Number(bundle.finalTotal), { maxFrac: 0 })
          : "price from quote";
      opt.textContent = `${fn} · ${depText || "bundle timing"} · ${priceText}`;
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
  if (isSameCityRoute(origin, destination)) {
    if (statusEl) {
      statusEl.textContent =
        "Origin and destination must be different cities (e.g. Singapore → Bangkok).";
    }
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
    if (statusEl) {
      statusEl.textContent =
        out.errorMessage ||
        out.body?.message ||
        `Bundle pricing failed (HTTP ${out.status}).`;
    }
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
  if (out.networkError || !out.ok) {
    const st = document.getElementById("bundleStatus");
    if (st) {
      st.textContent =
        out.body?.message ||
        out.errorMessage ||
        `Could not refresh bundle price (HTTP ${out.status}).`;
    }
    return;
  }

  const data = out.body?.data;
  const code = out.body?.code;
  if (code !== 200 || !data) {
    const st = document.getElementById("bundleStatus");
    if (st) st.textContent = out.body?.message || "Bundle pricing returned no data.";
    return;
  }
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
  updateBundlePackageSectionVisibility();
  if (!curatedPackagesAllowedForCurrentRoute() || !getRouteFilteredPresets().length) {
    return;
  }
  track.replaceChildren();
  const list = getFilteredPresets();
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "muted bundle-gallery__empty";
    const o = document.getElementById("bundleOrigin")?.value?.trim() || "";
    const d = document.getElementById("bundleDestination")?.value?.trim() || "";
    empty.textContent =
      o && d
        ? `No curated packages for ${o} → ${d}. Change From/To above and search again, or pick another route.`
        : "No packages match the current route. Set origin and destination, then search.";
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
    const priceBlock = bundleCardPriceLabel(p.id);
    btn.innerHTML = `
      <span class="bundle-card__media" style="background-image:url('${escapeHtml(p.image)}')"></span>
      <span class="bundle-card__price" data-preset-id="${escapeHtml(p.id)}">${priceBlock.html}</span>
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
  const o = document.getElementById("bundleOrigin");
  const d = document.getElementById("bundleDestination");

  suppressBundleRouteDiverge = true;
  try {
    if (o) o.value = preset.origin;
    syncBundleDestinationSelectToOrigin();
    if (d) d.value = preset.destination;
  } finally {
    suppressBundleRouteDiverge = false;
  }

  populateBundlePackageSelect();
  if (pkg) pkg.value = presetId;

  populatePackageSearchSelects();
  syncPackageSearchFromBundleFields();

  ensureTripWindowOption(preset.depart, preset.ret);
  applyTripWindowFromSelect();

  renderBundleGallery();
  document.querySelectorAll(".bundle-card").forEach((el) => {
    const on = el.dataset.presetId === presetId;
    el.classList.toggle("bundle-card--selected", on);
    el.setAttribute("aria-pressed", on ? "true" : "false");
  });

  void refreshHotelsForBundleDestination();
  void searchBundlePricing();
  scheduleBundleCardPriceRefresh();
}

function extractAirlineCode(flightId) {
  const m = String(flightId || "")
    .trim()
    .toUpperCase()
    .match(/^([A-Z0-9]{2})/);
  return m ? m[1] : "";
}

/**
 * SQ = full-service style online seat map in this app.
 * AK / AA / TR etc. = must use check-in / counter (policy blocks the map).
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
        "AirAsia: seat assignment at online check-in or at the airport — advance seat map is disabled in this app.",
    },
    AA: {
      onlineSeatSelection: false,
      airlineName: "American Airlines",
      reason:
        "American Airlines: advance seat selection is not available in this app — check in online or at the airport.",
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
        "British Airways: choose seats at online check-in or via the airline.",
    },
    JL: {
      onlineSeatSelection: false,
      airlineName: "Japan Airlines",
      reason: "JAL: seat selection at check-in or partner flows — map disabled here.",
    },
    QF: {
      onlineSeatSelection: false,
      airlineName: "Qantas",
      reason: "Qantas: seat assignment via airline check-in.",
    },
    TG: {
      onlineSeatSelection: false,
      airlineName: "Thai Airways",
      reason: "Thai Airways: advance seat map not enabled — check in online.",
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
    reason: `Airline ${code}: online seat map not enabled in this app — confirm your seat at check-in.`,
  };
}

function clearSeatSelection() {
  selectedSeatCodes = [];
  startSeatHoldTimer("");
  document.getElementById("seatNumber").value = "";
  document.getElementById("seatSelectedDisplay").textContent = "—";
  const detail = document.getElementById("seatSelectedDetail");
  if (detail) detail.textContent = "";
  const blocked = document.getElementById("seatBlockedNote");
  if (blocked) {
    blocked.hidden = true;
    blocked.textContent = "";
  }
  document.querySelectorAll("#seatMap button.seat").forEach((b) => {
    b.classList.remove("picked");
  });
}

function resetSeatMap() {
  const map = document.getElementById("seatMap");
  if (!map) return;
  map.innerHTML = "";
  buildSeatMapOnce();
  syncPickedSeatsUI();
}

async function selectSeat(seatCode) {
  if (bookingFlowCompletedLock) return;
  const leadCode = String(seatCode).toUpperCase();
  const required = getSeatRequiredCount();

  // When traveller profiles aren't picked yet, don't block the user.
  if (required <= 0) {
    return;
  }

  const flightId = String(document.getElementById("flightID")?.value || "").trim().toUpperCase();
  if (flightId && getSeatPolicy(flightId).onlineSeatSelection) {
    await refreshTakenSeatsQueued(flightId);
  }

  if (!currentTakenSeats) currentTakenSeats = new Set(DEFAULT_TAKEN_SEATS);
  if (isSeatUnavailableForSelection(leadCode)) {
    clearSeatSelection();
    return;
  }

  const proposed = computeSeatCodesForGroup(leadCode, required);
  const blocked = document.getElementById("seatBlockedNote");
  if (!proposed || proposed.length !== required) {
    clearSeatSelection();
    if (blocked) {
      blocked.hidden = false;
      blocked.textContent = `Not enough free seats available for ${required} travellers near ${leadCode}. Please pick another seat.`;
    }
    updateSeatGroupSummary();
    return;
  }

  selectedSeatCodes = proposed;
  document.getElementById("seatNumber").value = String(selectedSeatCodes[0]).toUpperCase();

  // Render selection summary.
  const display = document.getElementById("seatSelectedDisplay");
  if (display) display.textContent = selectedSeatCodes.join(", ");
  const detail = document.getElementById("seatSelectedDetail");
  const leadBtn = document.querySelector(`#seatMap button.seat[data-seat="${selectedSeatCodes[0]}"]`);
  if (detail) {
    const leadLabel = leadBtn?.dataset?.seatLabel ? `(${leadBtn.dataset.seatLabel})` : "";
    detail.textContent =
      selectedSeatCodes.length === 1
        ? leadLabel
        : `${leadLabel}${leadLabel ? " " : ""}(+${selectedSeatCodes.length - 1} additional seat(s))`;
  }

  if (blocked) {
    blocked.hidden = true;
    blocked.textContent = "";
  }

  syncPickedSeatsUI();
  updateSeatGroupSummary();
}

async function selectSeatByCode(code) {
  const up = String(code || "").toUpperCase();
  const btn = document.querySelector(`#seatMap button.seat[data-seat="${up}"]`);
  if (!btn || btn.disabled) return;
  await selectSeat(up);
}

function getSeatHoldToken() {
  let t = "";
  try {
    t = sessionStorage.getItem(SEAT_HOLD_TOKEN_KEY) || "";
  } catch {
    t = "";
  }
  if (!t) {
    t = `hold_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    try {
      sessionStorage.setItem(SEAT_HOLD_TOKEN_KEY, t);
    } catch {
      // ignore
    }
  }
  return t;
}

function renderSeatHoldTimer() {
  const el = document.getElementById("seatHoldTimer");
  if (!el) return;
  if (!seatHoldExpiresAtIso) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  const exp = new Date(seatHoldExpiresAtIso).getTime();
  const now = Date.now();
  const remainMs = Math.max(0, exp - now);
  const mins = Math.floor(remainMs / 60000);
  const secs = Math.floor((remainMs % 60000) / 1000);
  el.hidden = false;
  el.textContent = `Seat hold timer: ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")} remaining`;
  if (remainMs <= 0) {
    seatHoldExpiresAtIso = "";
    if (seatHoldTimerId) {
      clearInterval(seatHoldTimerId);
      seatHoldTimerId = null;
    }
    void refreshTakenSeatsQueued(document.getElementById("flightID")?.value || "");
  }
}

function startSeatHoldTimer(expiresAtIso) {
  seatHoldExpiresAtIso = String(expiresAtIso || "").trim();
  if (seatHoldTimerId) {
    clearInterval(seatHoldTimerId);
    seatHoldTimerId = null;
  }
  renderSeatHoldTimer();
  if (seatHoldExpiresAtIso) {
    seatHoldTimerId = setInterval(renderSeatHoldTimer, 1000);
  }
}

async function tryHoldCurrentSeats() {
  const flightId = String(document.getElementById("flightID")?.value || "").trim().toUpperCase();
  const required = getSeatRequiredCount();
  if (!flightId || required < 1) {
    return { ok: false, message: "Choose a flight and who is on this trip first." };
  }
  if (!Array.isArray(selectedSeatCodes) || selectedSeatCodes.length !== required) {
    return { ok: false, message: `Select seats for ${required} travellers first.` };
  }
  const holdToken = getSeatHoldToken();
  const out = await fetchJson(`${FLIGHT_BASE}/seat-holds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      holdToken,
      flightNum: flightId,
      seatNos: selectedSeatCodes.map((s) => String(s).trim().toUpperCase()),
    }),
  });
  if (out.networkError) return { ok: false, message: out.errorMessage || "Network error while holding seats." };
  if (!out.ok || out.body?.code !== 200) {
    return { ok: false, message: out.body?.message || `Could not hold seats (HTTP ${out.status}).` };
  }
  const expiresAt = out.body?.data?.holdExpiresAt || "";
  if (expiresAt) startSeatHoldTimer(expiresAt);
  return { ok: true };
}

function getSeatRequiredCount() {
  const party = readTravellerProfileIdsFromInput().length;
  if (party < 1) return 0;

  // Use the largest of: travellers ticked "on this trip", hero package total, bundle step total
  // (avoids stale hero "2" blocking 3 seats when bundle / party is 3).
  const packageTotal = Number(document.getElementById("packageTotalTravellers")?.value || 0);
  const bundleTotal = Number(document.getElementById("bundleNumberOfTravellers")?.value || 0);
  const fromTotals = Math.max(
    Number.isFinite(packageTotal) && packageTotal > 0 ? packageTotal : 0,
    Number.isFinite(bundleTotal) && bundleTotal > 0 ? bundleTotal : 0
  );
  return Math.max(party, fromTotals || party);
}

function isSeatUnavailableForSelection(seatCode) {
  const up = String(seatCode || "").trim().toUpperCase();
  if (!up) return true;
  const fromSet = (currentTakenSeats || new Set(DEFAULT_TAKEN_SEATS)).has(up);
  const el = document.querySelector(`#seatMap button.seat[data-seat="${up}"]`);
  const fromDom = Boolean(el && (el.disabled || el.classList.contains("taken")));
  return fromSet || fromDom;
}

function computeSeatCodesForGroup(leadCode, requiredCount) {
  const code = String(leadCode || "").toUpperCase();
  const m = code.match(/^(\d+)([A-F])$/);
  if (!m) return [];

  const row = Number(m[1]);
  const leadLetter = m[2];

  const selected = [code];

  const sideLetters = ["A", "B", "C"].includes(leadLetter)
    ? ["A", "B", "C"]
    : ["D", "E", "F"];
  const allLetters = ["A", "B", "C", "D", "E", "F"];

  // First try same-side neighbours (same row).
  const primaryCandidates = sideLetters
    .filter((l) => l !== leadLetter)
    .map((l) => `${row}${l}`);
  // Then fill from both sides in seat-map order.
  const secondaryCandidates = allLetters
    .filter((l) => l !== leadLetter)
    .map((l) => `${row}${l}`);

  const candidates = [...primaryCandidates, ...secondaryCandidates];
  const seenCand = new Set(selected.map((s) => String(s).toUpperCase()));
  for (const c of candidates) {
    if (selected.length >= requiredCount) break;
    const up = String(c).toUpperCase();
    if (seenCand.has(up)) continue;
    seenCand.add(up);
    if (isSeatUnavailableForSelection(up)) continue;
    selected.push(up);
  }

  // If still not enough, scan remaining rows in seat map.
  if (selected.length < requiredCount) {
    const rowsToScan = [6, 7, 8, 9, 10, 11, 12];
    for (const r of rowsToScan) {
      if (selected.length >= requiredCount) break;
      if (r === row) continue;
      for (const l of allLetters) {
        if (selected.length >= requiredCount) break;
        const up = `${r}${l}`;
        if (seenCand.has(up)) continue;
        seenCand.add(up);
        if (isSeatUnavailableForSelection(up)) continue;
        selected.push(up);
      }
    }
  }

  return selected.length === requiredCount ? selected : [];
}

function syncPickedSeatsUI() {
  const picked = new Set((selectedSeatCodes || []).map((s) => String(s).toUpperCase()));
  document.querySelectorAll("#seatMap button.seat").forEach((b) => {
    const code = String(b.dataset.seat || "").toUpperCase();
    const unavailable = b.disabled || b.classList.contains("taken");
    b.classList.toggle("picked", picked.has(code) && !unavailable);
  });
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
    btn.addEventListener("click", () => {
      void selectSeat(id);
    });
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
    policyEl.textContent = `${policy.airlineName}: choose a seat on the map below.`;
    mapWrap.hidden = false;
    blocked.hidden = true;
    blocked.textContent = "";
    void refreshTakenSeatsQueued(flightId);
  } else {
    policyEl.textContent = policy.reason;
    mapWrap.hidden = true;
    clearSeatSelection();
    currentTakenSeats = new Set(DEFAULT_TAKEN_SEATS);
    resetSeatMap();
    if (blocked) {
      blocked.hidden = true;
      blocked.textContent = "";
    }
  }

  updateSeatGroupSummary();
}

function getOutboundDepartDateForFlightSearch() {
  const pd = document.getElementById("packageDepartDate")?.value?.trim();
  if (pd && /^\d{4}-\d{2}-\d{2}$/.test(pd)) return pd;
  const bundle = document.getElementById("bundleDepartDateTime")?.value?.trim();
  if (bundle && bundle.length >= 10) return bundle.slice(0, 10);
  return "";
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
    routeFlightsInventoryChecked = false;
    routeHasOutboundFlights = false;
    if (hint) {
      hint.textContent =
        "Use the trip search at the top, or expand Route & times for this quote, to set both cities.";
    }
    updateSeatSelectionUI();
    syncRouteInventoryToPackageUI();
    return;
  }

  if (isSameCityRoute(origin, dest)) {
    sel.disabled = true;
    routeFlightsInventoryChecked = false;
    routeHasOutboundFlights = false;
    ph.textContent = "— Same city —";
    if (hint) {
      hint.textContent =
        "Origin and destination cannot be the same city. Change one of the cities to search flights.";
    }
    updateSeatSelectionUI();
    syncRouteInventoryToPackageUI();
    return;
  }

  routeFlightsInventoryChecked = false;
  syncRouteInventoryToPackageUI();

  sel.disabled = false;
  const qs = new URLSearchParams();
  qs.set("originCity", origin);
  qs.set("destinationCity", dest);
  const pax = Number(document.getElementById("bundleNumberOfTravellers")?.value || 1);
  qs.set("minSeats", String(Math.max(1, Number.isFinite(pax) ? pax : 1)));
  const depD = getOutboundDepartDateForFlightSearch();
  if (depD) {
    qs.set("departDate", depD);
    qs.set("dateWindowDays", "2");
  }

  try {
    const out = await fetchJson(`${FLIGHT_BASE}/flight/search?${qs.toString()}`);

    if (out.networkError || !out.ok || !Array.isArray(out.body?.data)) {
      if (hint) hint.textContent = "Could not load flights for this route.";
      ph.textContent = "— No flight (could not load) —";
      routeHasOutboundFlights = false;
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
      opt.textContent = `${fn} · ${air} · ${dep} · ${seats} seats · ${formatMoneyDisplayFromSgd(price, { maxFrac: 0 })}`;
      sel.appendChild(opt);
    }

    const dateHint = depD ? ` near ${depD} (±2 days)` : "";
    const bookableCount = Math.max(0, sel.options.length - 1);
    if (sel.options.length <= 1) {
      ph.textContent = "— No flight for this route —";
      routeHasOutboundFlights = false;
      if (hint) {
        hint.textContent = `No flights with enough seats for ${origin} → ${dest}${dateHint}. Try different dates or cities.`;
      }
    } else {
      routeHasOutboundFlights = true;
      if (hint) {
        hint.textContent = `${bookableCount} outbound flight(s)${dateHint}: ${origin} → ${dest}.`;
      }
    }

    if (keep && [...sel.options].some((o) => o.value === keep)) {
      sel.value = keep;
    } else if (sel.options.length > 1) {
      sel.selectedIndex = 1;
    }

    updateSeatSelectionUI();
    void syncFlightScheduleUI();
  } finally {
    routeFlightsInventoryChecked = true;
    syncRouteInventoryToPackageUI();
  }
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
  const outBooked = await fetchJson(`${API_BASE}/booking/seats/${encodeURIComponent(fid)}`);
  if (token !== seatRefreshToken) return;
  if (outBooked.networkError || !outBooked.ok) {
    currentTakenSeats = new Set(DEFAULT_TAKEN_SEATS);
    resetSeatMap();
    return;
  }

  const holdToken = getSeatHoldToken();
  const outHeld = await fetchJson(
    `${FLIGHT_BASE}/seat-holds/${encodeURIComponent(fid)}?excludeToken=${encodeURIComponent(holdToken)}`
  );

  const seats = outBooked.body?.data?.seats;
  const heldSeats = outHeld.ok ? outHeld.body?.data?.seats : [];
  const merged = new Set(DEFAULT_TAKEN_SEATS);
  if (Array.isArray(seats)) {
    seats.forEach((s) => {
      const up = String(s || "").trim().toUpperCase();
      if (up) merged.add(up);
    });
  }
  if (Array.isArray(heldSeats)) {
    heldSeats.forEach((s) => {
      const up = String(s || "").trim().toUpperCase();
      if (up) merged.add(up);
    });
  }
  currentTakenSeats = merged;

  if (
    Array.isArray(selectedSeatCodes) &&
    selectedSeatCodes.some((s) => currentTakenSeats.has(String(s).trim().toUpperCase()))
  ) {
    clearSeatSelection();
  }
  resetSeatMap();
}

function updateSeatGroupSummary() {
  const flightId = String(document.getElementById("flightID")?.value || "").trim();
  const policy = getSeatPolicy(flightId);
  const summaryEl = document.getElementById("seatGroupSummary");
  const leadPill = document.getElementById("seatLeadPill");
  const compPill = document.getElementById("seatCompanionPill");
  const hintPill = document.getElementById("seatGroupHint");

  if (!policy.onlineSeatSelection) {
    if (summaryEl) summaryEl.hidden = true;
    return;
  }

  if (summaryEl) summaryEl.hidden = false;

  const seatCodes = Array.isArray(selectedSeatCodes) ? selectedSeatCodes : [];
  const seat = seatCodes[0] ? String(seatCodes[0]).trim().toUpperCase() : "—";
  const required = getSeatRequiredCount();
  const selectedCount = seatCodes.length;

  if (leadPill) leadPill.textContent = `Lead traveller seat: ${seat === "—" ? "not selected" : seat}`;
  if (compPill)
    compPill.textContent = `Group seats: ${selectedCount}/${required || 0}`;

  if (hintPill) {
    if (!required) {
      hintPill.textContent = "Select who is on this trip to enable seat selection.";
    } else if (selectedCount === required) {
      hintPill.textContent = "All seats for your group are selected.";
    } else {
      hintPill.textContent =
        "Pick the lead seat on the map and nearby seats are auto-assigned for your group.";
    }
  }
}

/** Reconcile in-memory party with visible “On this trip” checkboxes (fixes handler errors / stale loads). */
function syncTripPartyOrderedIdsFromDomCheckboxes() {
  const listEl = document.getElementById("travellerProfilesList");
  if (!listEl) return;
  const boxes = listEl.querySelectorAll('input[type="checkbox"][data-action="toggleTripTraveller"]');
  if (!boxes.length) return;

  const checkedIds = [];
  const seen = new Set();
  for (const cb of boxes) {
    if (!cb.checked) continue;
    const id = Number(cb.getAttribute("data-id"));
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    checkedIds.push(id);
  }

  const nextSet = new Set(checkedIds);
  const ordered = [];
  const used = new Set();
  for (const id of tripPartyOrderedIds) {
    const n = Number(id);
    if (n > 0 && nextSet.has(n) && !used.has(n)) {
      ordered.push(n);
      used.add(n);
    }
  }
  for (const id of checkedIds) {
    if (!used.has(id)) {
      ordered.push(id);
      used.add(id);
    }
  }
  tripPartyOrderedIds = ordered;
}

function dedupeTripPartyOrderedIds() {
  const seen = new Set();
  const out = [];
  for (const id of tripPartyOrderedIds) {
    const n = Number(id);
    if (n > 0 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

function readTravellerProfileIdsFromInput() {
  syncTripPartyOrderedIdsFromDomCheckboxes();
  return dedupeTripPartyOrderedIds();
}

function applyTravellerSelectionFromIds(preferredIds) {
  const ids = Array.isArray(preferredIds)
    ? preferredIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  tripPartyOrderedIds = ids;
  populateTravellerSelectorsFromRows(latestTravellerRows, { allowAutoFirst: false });
  renderTravellerProfileList();
  refreshTripContactSummary();
  updateSeatGroupSummary();
}

/**
 * Loyalty `coins` are integer reward credits: 100 credits = S$1.00 off at checkout.
 * (Not a second currency — the S$ line is the same balance expressed as dollars off.)
 */
function formatLoyaltyWalletSgd(coinsCents) {
  const n = Number(coinsCents);
  if (!Number.isFinite(n)) return "-";
  if (n <= 0) return "S$0.00";
  return `S$${(n / 100).toFixed(2)}`;
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
    if (availEl) {
      availEl.textContent = formatLoyaltyWalletSgd(coinsAvailableCents);
      availEl.title = `${Math.floor(coinsAvailableCents).toLocaleString()} reward credits · 100 = S$1 off`;
    }
    const sgdHint = document.getElementById("coinsAvailableSgd");
    if (sgdHint) {
      sgdHint.textContent =
        coinsAvailableCents > 0
          ? `· ${coinsAvailableCents.toLocaleString()} credits available · enter credits below (100 credits = S$1 off)`
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
  if (lastBundleParams) void refreshBundleForCoins();
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
  syncHotelResultsPickedVisibility();
}

function updateHotelCardSelectButtons() {
  const resultsEl = document.getElementById("hotelResults");
  const collapsed = resultsEl?.classList.contains("hotel-results--one-picked");
  const hid = Number(document.getElementById("hotelID")?.value || 0);
  document.querySelectorAll(".hotel-card[data-hotel-id]").forEach((card) => {
    const id = Number(card.dataset.hotelId || 0);
    const btn = card.querySelector("[data-action='selectHotel']");
    if (!btn) return;
    if (collapsed && id === hid && hid > 0) {
      btn.textContent = "Selected";
      btn.disabled = true;
      btn.classList.add("btn-primary");
      btn.classList.remove("btn-secondary");
    } else {
      btn.textContent = "Select";
      btn.disabled = false;
      btn.classList.add("btn-secondary");
      btn.classList.remove("btn-primary");
    }
  });
}

/** After a choice, hide other hotel cards; use "Change hotel" to show the full list again. */
function syncHotelResultsPickedVisibility() {
  const resultsEl = document.getElementById("hotelResults");
  const toolbar = document.getElementById("hotelResultsPickToolbar");
  if (!resultsEl) return;

  const hid = Number(document.getElementById("hotelID")?.value || 0);
  const cards = resultsEl.querySelectorAll(".hotel-card[data-hotel-id]");
  resultsEl.classList.remove("hotel-results--one-picked");
  cards.forEach((c) => c.classList.remove("hotel-card--picked"));

  if (hid < 1 || cards.length <= 1) {
    if (toolbar) toolbar.hidden = true;
    updateHotelCardSelectButtons();
    return;
  }
  const pickedCard = resultsEl.querySelector(`.hotel-card[data-hotel-id="${Number(hid)}"]`);
  if (!pickedCard) {
    if (toolbar) toolbar.hidden = true;
    updateHotelCardSelectButtons();
    return;
  }
  resultsEl.classList.add("hotel-results--one-picked");
  pickedCard.classList.add("hotel-card--picked");
  if (toolbar) toolbar.hidden = false;
  updateHotelCardSelectButtons();
}

function expandHotelResultsBrowseOthers() {
  document.getElementById("hotelResults")?.classList.remove("hotel-results--one-picked");
  document.querySelectorAll(".hotel-card--picked").forEach((el) => el.classList.remove("hotel-card--picked"));
  const toolbar = document.getElementById("hotelResultsPickToolbar");
  if (toolbar) toolbar.hidden = true;
  updateHotelCardSelectButtons();
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
    ? formatMoneyDisplayFromSgd(Number(room.pricePerNight))
    : null;
  const available = Number.isFinite(Number(room.availableRooms)) ? Number(room.availableRooms) : null;
  const breakfastIncluded = room.code === "DLX" || !!cb?.checked;
  const addonText = breakfastIncluded ? "Breakfast included" : "Room only";

  const parts = [
    label,
    price !== null ? `${price}/night` : null,
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
    card.dataset.hotelId = String(id || 0);
    const roomLines = (h.roomTypes || [])
      .map((rt) => {
        const code = rt.code || "";
        const label = rt.label || (code === "DLX" ? "Deluxe" : code === "STD" ? "Standard" : "Room");
        const price = Number.isFinite(Number(rt.pricePerNight))
          ? `${formatMoneyDisplayFromSgd(Number(rt.pricePerNight))}/night`
          : "";
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
  syncHotelResultsPickedVisibility();
}

async function searchHotels() {
  let country = document.getElementById("hotelSearchCountry")?.value?.trim() || "";
  let city = document.getElementById("hotelSearchCity")?.value?.trim() || "";
  const name = document.getElementById("hotelSearchName")?.value?.trim() || "";
  const dest = document.getElementById("bundleDestination")?.value?.trim() || "";
  if (!city && dest) city = dest;
  if (!country && dest) {
    const inferred = countryLabelForBundleDestinationCity(dest);
    if (inferred) country = inferred;
  }

  routeHotelsInventoryChecked = false;
  syncRouteInventoryToPackageUI();

  const resultsEl = document.getElementById("hotelResults");
  const selectedHintEl = document.getElementById("hotelSelectedHint");
  if (selectedHintEl) selectedHintEl.textContent = "Searching hotels…";
  if (resultsEl) resultsEl.textContent = "Loading…";

  try {
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

    if (!gqlOut.ok || gqlDataLooksEmpty) {
      const qs = new URLSearchParams();
      if (country) qs.set("country", country);
      if (city) qs.set("city", city);
      if (name) qs.set("name", name);
      const restOut = await fetchJson(`${HOTEL_BASE}/hotel/search?${qs.toString()}`);
      if (restOut.networkError) {
        if (selectedHintEl) selectedHintEl.textContent = "Could not reach hotel service.";
        if (resultsEl) resultsEl.textContent = restOut.errorMessage || gqlOut.errorMessage || "";
        latestHotelRows = [];
        destinationHasHotels = false;
        renderHotelResults([]);
        return;
      }
      hotels = restOut.body?.data ?? [];
    }

    latestHotelRows = Array.isArray(hotels) ? hotels : [];
    destinationHasHotels = latestHotelRows.length > 0;
    if (!latestHotelRows.length) {
      if (selectedHintEl) selectedHintEl.textContent = "No hotels match those details.";
      renderHotelResults([]);
      return;
    }

    if (selectedHintEl) selectedHintEl.textContent = "Pick one hotel option below.";
    renderHotelResults(latestHotelRows);
  } finally {
    routeHotelsInventoryChecked = true;
    syncRouteInventoryToPackageUI();
  }
}

async function initHotelSelectionById(hotelId) {
  const hid = Number(hotelId);
  if (!Number.isFinite(hid) || hid < 1) return;

  const out = await fetchJson(`${HOTEL_BASE}/hotel/${hid}`);
  if (out.networkError || !out.ok || !out.body?.data) return;

  setHotelSelection(out.body.data);
}

async function setManualDefaults() {
  clearBundleSelectionState();
  pendingTravellerProfileIds = null;
  tripPartyOrderedIds = [];
  const pn0 = document.getElementById("passengerName");
  const pe0 = document.getElementById("passengerEmail");
  const pp0 = document.getElementById("passengerPhone");
  if (pn0) pn0.value = "";
  if (pe0) pe0.value = "";
  if (pp0) pp0.value = "";
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
  syncBundleDestinationSelectToOrigin();
  if (bd && [...bd.options].some((o) => o.value === "Tokyo")) bd.value = "Tokyo";
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
  populateCustomerSelects();
  if (document.getElementById("packageSearchFrom")) {
    populatePackageSearchSelects();
    syncPackageSearchFromBundleFields();
    updatePackageTripSummary();
    syncSameCityRouteUI();
  }
  void refreshHotelsForBundleDestination();
  if (typeof window.__horizonRefreshBookingFlow === "function") {
    window.__horizonRefreshBookingFlow();
  } else {
    bookingFlowCompletedLock = false;
    syncBookingFlowCompletedLockUI();
  }
}

function showResult(obj, meta = "") {
  latestResult = obj ?? null;
  const statusEl = document.getElementById("resultStatus");
  if (statusEl) statusEl.textContent = meta || "";

  const el = document.getElementById("result");
  if (!el) return;

  const bookingConfirmed =
    meta === "Trip confirmed" && obj && typeof obj === "object" && obj.data && obj.data.id != null;
  if (bookingConfirmed) {
    el.textContent = `Booking #${obj.data.id} confirmed. Open My profile → Technical details for raw JSON.`;
    return;
  }

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
}

function tierProgressCopy(completedBookings) {
  const n = Number(completedBookings) || 0;
  if (n >= 10) return "Top tier — enjoy the best member rates.";
  const next = n < 2 ? 2 : n < 5 ? 5 : 10;
  const need = Math.max(0, next - n);
  const label = next === 2 ? "Silver" : next === 5 ? "Gold" : "Platinum";
  return `${need} more completed trip${need === 1 ? "" : "s"} to reach ${label}.`;
}

function fillAccountLoyaltyFromData(data) {
  if (!data || typeof data !== "object") {
    ["accountPageBalance", "accountPageTier", "accountPageNextTier"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = id === "accountPageNextTier" ? "" : "-";
    });
    const h = document.getElementById("accountPageBalanceHint");
    const th = document.getElementById("accountPageTierHint");
    if (h) h.textContent = "";
    if (th) th.textContent = "";
    return;
  }
  const cents = Number(data.coins ?? data.points ?? NaN);
  const tier = data.tier ?? "-";
  const bc = Number(data.bookingCount ?? 0);
  const balEl = document.getElementById("accountPageBalance");
  const balHint = document.getElementById("accountPageBalanceHint");
  const tierEl = document.getElementById("accountPageTier");
  const tierHint = document.getElementById("accountPageTierHint");
  const nextEl = document.getElementById("accountPageNextTier");
  if (balEl) balEl.textContent = Number.isFinite(cents) ? formatLoyaltyWalletSgd(cents) : "-";
  if (balHint) {
    balHint.textContent = Number.isFinite(cents)
      ? `${Math.floor(cents).toLocaleString()} reward credits (100 = S$1 off on Pay) — same balance as the S$ line. Cancelling restores credits you spent on that trip and removes credits you earned on it, so the total can go up or down.`
      : "";
  }
  if (tierEl) tierEl.textContent = tier;
  const cid =
    Number(getSession()?.customerID) ||
    Number(document.getElementById("customerID")?.value || 0) ||
    0;
  if (tierHint) {
    tierHint.textContent = `Tier follows completed bookings: ${bc} recorded in loyalty.${
      cid > 0
        ? ` Wallet is tied to member ID ${cid} (not your email). Editing your profile email does not create a new account — use Sign up for a separate wallet.`
        : ""
    }`;
  }
  if (nextEl) nextEl.textContent = tierProgressCopy(bc);
}

function openBookingConfirmModal(apiBody, loyaltySnapshot) {
  const modal = document.getElementById("bookingConfirmModal");
  if (!modal) return;
  const d = apiBody?.data || {};
  const set = (id, val) => {
    const n = document.getElementById(id);
    if (n) n.textContent = val;
  };
  set("bookingConfirmId", d.id != null ? String(d.id) : "-");
  set("bookingConfirmFlight", d.flightID ? String(d.flightID) : "-");
  const hotelLabel =
    d.hotelName && String(d.hotelName).trim()
      ? String(d.hotelName).trim()
      : d.hotelID != null && d.hotelID !== ""
        ? `Hotel #${d.hotelID}`
        : "-";
  set("bookingConfirmHotel", hotelLabel);
  set(
    "bookingConfirmTotal",
    d.totalPrice != null && d.totalPrice !== ""
      ? formatMoneyDisplayFromSgd(Number(d.totalPrice))
      : "-"
  );
  set("bookingConfirmDep", d.departureTime ? String(d.departureTime).replace("T", " ") : "-");
  const who = String(d.passengerName || d.travellerDisplayName || "Traveller").trim();
  set(
    "bookingConfirmLede",
    `Thanks, ${who}. Keep your booking reference for changes or cancellation.`
  );
  const lo = document.getElementById("bookingConfirmLoyalty");
  if (lo) {
    if (loyaltySnapshot && typeof loyaltySnapshot === "object") {
      const c = Number(loyaltySnapshot.coins ?? loyaltySnapshot.points ?? NaN);
      const t = loyaltySnapshot.tier ?? "-";
      const b = Number(loyaltySnapshot.bookingCount ?? 0);
      lo.textContent = `Wallet now ${Number.isFinite(c) ? formatLoyaltyWalletSgd(c) : "-"} · Tier ${t} · ${b} completed trip(s). ${tierProgressCopy(b)}`;
    } else {
      lo.textContent = "";
    }
  }
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeBookingConfirmModal() {
  const modal = document.getElementById("bookingConfirmModal");
  if (modal) modal.hidden = true;
  document.body.classList.remove("modal-open");
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
    const lc = document.getElementById("loyaltyCoins");
    if (lc) {
      lc.textContent = "-";
      lc.removeAttribute("title");
    }
    const ltFail = document.getElementById("loyaltyTier");
    if (ltFail) ltFail.textContent = "-";
    const myCoins = document.getElementById("myAccountCoins");
    const myTier = document.getElementById("myAccountTier");
    if (myCoins) {
      myCoins.textContent = "-";
      myCoins.removeAttribute("title");
    }
    if (myTier) myTier.textContent = "-";
    fillAccountLoyaltyFromData(null);
    refreshPricePreview();
    updateCoinsOffsetUI();
    return;
  }
  const data = out.body;
  latestLoyalty = data.data;
  fillAccountLoyaltyFromData(data.data);
  const centsRaw = data.data.coins ?? data.data.points;
  const cents = Number(centsRaw);
  const walletLabel = Number.isFinite(cents) ? formatLoyaltyWalletSgd(cents) : "-";
  const walletTitle = Number.isFinite(cents)
    ? `${Math.floor(cents).toLocaleString()} reward credits (100 = S$1 off at Pay)`
    : "";

  const lc = document.getElementById("loyaltyCoins");
  if (lc) {
    lc.textContent = walletLabel;
    if (walletTitle) lc.title = walletTitle;
    else lc.removeAttribute("title");
  }
  const tierEl = document.getElementById("loyaltyTier");
  if (tierEl) tierEl.textContent = data.data.tier ?? "-";

  const myCoins = document.getElementById("myAccountCoins");
  const myTier = document.getElementById("myAccountTier");
  if (myCoins) {
    myCoins.textContent = walletLabel;
    if (walletTitle) myCoins.title = walletTitle;
    else myCoins.removeAttribute("title");
  }
  if (myTier) myTier.textContent = data.data.tier ?? "-";

  refreshPricePreview();
  updateCoinsOffsetUI();
}

async function refreshNotifications() {
  const logEl = document.getElementById("notifications");
  if (!logEl) return;
  const out = await fetchJson(`${NOTIFICATION_BASE}/notifications`);
  if (out.networkError) {
    logEl.textContent = JSON.stringify({ error: out.errorMessage }, null, 2);
    return;
  }
  logEl.textContent = JSON.stringify(
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
    const smsDest =
      "SMS is sent to the mobile on My profile (or booking contact); you do not set a Twilio “to” number.";
    if (d.hasAccountSid && d.accountSidMasked) {
      hint.textContent = `Current Account SID: ${d.accountSidMasked}. ${smsDest}`;
    } else {
      hint.textContent = `No Account SID saved yet — paste it on first setup. ${smsDest}`;
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
  const rs = document.getElementById("resultStatus");
  try {
    await navigator.clipboard.writeText(JSON.stringify(latestResult, null, 2));
    if (rs) rs.textContent = "Copied";
    setTimeout(() => {
      if (rs) rs.textContent = "";
    }, 1200);
  } catch {
    const uiErr = document.getElementById("uiError");
    if (uiErr) setError(uiErr, "Copy failed (clipboard permission).");
  }
}

async function onCreateBookingSubmit(e) {
  e.preventDefault();
  if (bookingFlowCompletedLock) return;

  const createBtn = document.getElementById("createBtn");
  const createError = document.getElementById("createError");
  const uiError = document.getElementById("uiError");
  clearError(createError);
  clearError(uiError);
  createBtn.disabled = true;

  const flightId = document.getElementById("flightID").value.trim();
  const seatPol = getSeatPolicy(flightId);
  if (seatPol.onlineSeatSelection) {
    const required = getSeatRequiredCount();
    if (required < 1) {
      setError(
        createError,
        "Select who is on this trip before choosing seats."
      );
      createBtn.disabled = false;
      return;
    }

    if (!Array.isArray(selectedSeatCodes) || selectedSeatCodes.length !== required) {
      setError(
        createError,
        `Select seats for ${required} travellers on the map (lead seat drives auto-assignment for the group).`
      );
      createBtn.disabled = false;
      return;
    }
  }

  const passengerName = document.getElementById("passengerName").value.trim();
  if (!passengerName) {
    setError(
      createError,
      "Add your full name in My profile before confirming."
    );
    createBtn.disabled = false;
    return;
  }
  const passengerEmailRaw = document.getElementById("passengerEmail").value.trim();
  const tripPhoneRaw = document.getElementById("passengerPhone")?.value?.trim() || "";
  const profilePhoneRaw =
    document.getElementById("profilePhoneNumber")?.value?.trim() || "";
  const passengerPhoneRaw = tripPhoneRaw || profilePhoneRaw;

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
      ? selectedSeatCodes[0]
        ? String(selectedSeatCodes[0]).trim().toUpperCase()
        : null
      : null,
    seatNumbers: seatPol.onlineSeatSelection
      ? Array.isArray(selectedSeatCodes) && selectedSeatCodes.length
        ? selectedSeatCodes.map((s) => String(s).trim().toUpperCase())
        : []
      : undefined,
    seatHoldToken: seatPol.onlineSeatSelection ? getSeatHoldToken() : undefined,
  };
  if (passengerEmailRaw) payload.passengerEmail = passengerEmailRaw;
  if (passengerPhoneRaw) {
    payload.passengerPhone = passengerPhoneRaw;
    const phEl = document.getElementById("passengerPhone");
    if (phEl) phEl.value = passengerPhoneRaw;
  }
  const tpIds = readTravellerProfileIdsFromInput();
  if (tpIds.length) {
    payload.travellerProfileIds = tpIds;
  }

  try {
    const bTotal = latestBundlePricing?.finalTotal;
    if (Number.isFinite(Number(bTotal))) {
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
      const raw = data?.message || `Request failed (HTTP ${httpStatus})`;
      const msg =
        humanizeTravellerUserMessage(raw) ||
        (raw.length > 160 ? "We couldn’t complete the booking. Check your details and try again." : raw);
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

    document.getElementById("cancelBookingID").value = String(data.data.id);
    startSeatHoldTimer("");

    updateSeatSelectionUI();
    await updateLoyaltySummary(payload.customerID);
    openBookingConfirmModal(data, latestLoyalty);
    showResult(data, "Trip confirmed");
    bookingFlowCompletedLock = true;
    syncBookingFlowCompletedLockUI();
  } catch (err) {
    const msg = formatNetworkError(err);
    setError(createError, msg);
    showResult({ error: msg }, "Couldn't confirm trip");
  } finally {
    if (!bookingFlowCompletedLock) {
      createBtn.disabled = false;
    }
  }
}

function scrollCancelFeedbackIntoView() {
  document.getElementById("cancelFeedback")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * POST cancellation for a booking id (shared by Cancel form and My bookings).
 * @param {string} idRaw digits only
 * @param {string} cancelSource customer | airline | hotel
 */
async function executeBookingCancellation(idRaw, cancelSource) {
  const cancelBtn = document.getElementById("cancelBtn");
  const cancelFeedback = document.getElementById("cancelFeedback");
  const uiError = document.getElementById("uiError");

  const showCancelError = (msg) => {
    if (cancelFeedback) {
      cancelFeedback.className = "alert";
      setError(cancelFeedback, msg);
    } else if (uiError) {
      setError(uiError, msg);
    }
    scrollCancelFeedbackIntoView();
  };
  const showCancelSuccess = (msg) => {
    if (cancelFeedback) {
      cancelFeedback.className = "alert alert--success";
      cancelFeedback.textContent = msg;
      cancelFeedback.style.display = "block";
    }
    scrollCancelFeedbackIntoView();
  };
  const clearCancelPanel = () => {
    if (cancelFeedback) {
      cancelFeedback.className = "alert";
      clearError(cancelFeedback);
    }
    if (uiError) clearError(uiError);
  };

  clearCancelPanel();
  if (cancelBtn) cancelBtn.disabled = true;

  const id = String(idRaw || "").trim();
  try {
    const out = await fetchJson(`${API_BASE}/booking/cancel/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelSource }),
    });

    if (out.networkError) {
      showCancelError(out.errorMessage || "Could not reach the server.");
      showResult({ error: out.errorMessage }, "Can't reach the server");
      return;
    }

    const data = out.body;
    const httpStatus = out.status;

    if (out.parseError && data?._parseError) {
      const msg = "We didn't get a valid response for cancellation — check the booking service.";
      showCancelError(msg);
      showResult(data, "Something went wrong");
      return;
    }

    if (isBookingWelcomePayload(data)) {
      const msg =
        "Couldn't complete cancellation — wrong service or URL. Open the app at http://localhost:8080 (not file://) so /api/booking proxies to Docker, or check Kong/nginx routes.";
      showCancelError(msg);
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
      showCancelError(msg);
      showResult(data ?? { error: msg }, "Couldn't cancel");
      return;
    }

    if (!data?.data) {
      const msg = "Cancellation response was incomplete.";
      showCancelError(msg);
      showResult({ _help: msg, received: data }, "Incomplete response");
      return;
    }

    const doneTitle =
      data.data?.alreadyCancelled === true
        ? "Already cancelled"
        : "Cancellation processed";
    showCancelSuccess(
      `${doneTitle}. If activity shows a Twilio SMS error, the trip is still cancelled — fix Twilio in .env for texts. Details: My profile → Technical details (JSON).`
    );
    showResult(data, doneTitle);

    await refreshNotifications();
    updateSeatSelectionUI();

    const bookingOut = await fetchJson(`${API_BASE}/booking/${id}`);
    if (!bookingOut.networkError && bookingOut.body?.data?.customerID) {
      await updateLoyaltySummary(bookingOut.body.data.customerID);
    }

    const refreshCid =
      lastMyBookingsCustomerId || Number(document.getElementById("customerID")?.value || 0);
    if (refreshCid > 0) {
      void loadMyBookings(refreshCid);
    }
  } catch (err) {
    const msg = formatNetworkError(err);
    showCancelError(msg);
    showResult({ error: msg }, "Couldn't cancel");
  } finally {
    if (cancelBtn) cancelBtn.disabled = false;
  }
}

async function onCancelBookingSubmit(e) {
  e.preventDefault();

  const cancelBtn = document.getElementById("cancelBtn");
  if (!cancelBtn) return;

  const idRaw = document.getElementById("cancelBookingID").value.trim();
  const cancelSource = document.getElementById("cancelSource").value;
  if (!idRaw || !/^\d+$/.test(idRaw) || Number(idRaw) < 1) {
    const cancelFeedback = document.getElementById("cancelFeedback");
    const uiError = document.getElementById("uiError");
    if (cancelFeedback) {
      cancelFeedback.className = "alert";
      setError(cancelFeedback, "Enter a valid booking reference (whole number from your confirmation).");
      scrollCancelFeedbackIntoView();
    } else if (uiError) {
      setError(uiError, "Enter a valid booking reference (whole number from your confirmation).");
    }
    return;
  }

  await executeBookingCancellation(idRaw, cancelSource);
}

function setActiveSegment(segmentKey, opts = {}) {
  const accountSubTab = opts.accountSubTab === "bookings" ? "bookings" : "profile";
  const panels = {
    book: "segment-book",
    manage: "segment-manage",
    account: "segment-account",
  };
  for (const [key, panelId] of Object.entries(panels)) {
    const panel = document.getElementById(panelId);
    const isActive = key === segmentKey;
    if (panel) {
      if (isActive) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    }
  }

  const bookBtn = document.getElementById("bookingNavBtn");
  const cancelBtn = document.getElementById("cancelNavBtn");
  const acctBtn = document.getElementById("myAccountNavBtn");
  const bookingsNavBtn = document.getElementById("myBookingsNavBtn");
  if (bookBtn && cancelBtn) {
    const onBook = segmentKey === "book";
    bookBtn.classList.toggle("btn-primary", onBook);
    bookBtn.classList.toggle("btn-secondary", !onBook);
    cancelBtn.classList.toggle("btn-primary", segmentKey === "manage");
    cancelBtn.classList.toggle("btn-secondary", segmentKey !== "manage");
  }
  if (acctBtn && bookingsNavBtn && isMemberSession()) {
    if (segmentKey === "account") {
      const profileActive = accountSubTab === "profile";
      acctBtn.classList.toggle("btn-primary", profileActive);
      acctBtn.classList.toggle("btn-secondary", !profileActive);
      bookingsNavBtn.classList.toggle("btn-primary", !profileActive);
      bookingsNavBtn.classList.toggle("btn-secondary", profileActive);
    } else {
      acctBtn.classList.remove("btn-primary");
      acctBtn.classList.add("btn-secondary");
      bookingsNavBtn.classList.remove("btn-primary");
      bookingsNavBtn.classList.add("btn-secondary");
    }
  }
}

function goToBookingFlow() {
  setActiveSegment("book");
  document.getElementById("step-book")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupSegmentTabs() {
  document.getElementById("backToBookingBtn")?.addEventListener("click", () => {
    goToBookingFlow();
  });

  document.querySelector(".site-header .brand")?.addEventListener("click", (e) => {
    e.preventDefault();
    goToBookingFlow();
  });
}

function goToMyAccountPage(scrollToBookings = false) {
  setActiveSegment("account", {
    accountSubTab: scrollToBookings ? "bookings" : "profile",
  });
  const accountPanel = document.getElementById("segment-account");
  const cid = Number(document.getElementById("customerID")?.value || 0);
  if (cid) {
    void loadMyAccount(cid);
    void updateLoyaltySummary(cid);
    void loadMyBookings(cid);
  }
  if (scrollToBookings) {
    requestAnimationFrame(() => {
      document.getElementById("accountBookingsSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  } else {
    accountPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

const BOOKING_FLOW_STEPS = [
  { tabId: "bookingStep1Tab", panelId: "bookingStep1Panel", label: "Bundle" },
  { tabId: "bookingStep2Tab", panelId: "bookingStep4Panel", label: "Travellers" },
  { tabId: "bookingStep3Tab", panelId: "bookingStep2Panel", label: "Hotel" },
  { tabId: "bookingStep4Tab", panelId: "bookingStep3Panel", label: "Flights" },
  { tabId: "bookingStep5Tab", panelId: "bookingStep5Panel", label: "Pay" },
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

function syncBookingFlowCompletedLockUI() {
  const card = document.getElementById("step-book");
  if (card) card.classList.toggle("booking-flow--completed", bookingFlowCompletedLock);
  const note = document.getElementById("bookingFlowLockNote");
  if (note) note.hidden = !bookingFlowCompletedLock;

  const createBtn = document.getElementById("createBtn");
  if (createBtn) createBtn.disabled = bookingFlowCompletedLock;

  for (const id of BOOKING_FLOW_ALL_TAB_IDS) {
    const el = document.getElementById(id);
    if (el) el.disabled = bookingFlowCompletedLock;
  }

  const form = document.getElementById("createForm");
  if (form) {
    for (const el of form.querySelectorAll("input, select, textarea, button")) {
      if (el.id === "newManualBtn") continue;
      el.disabled = bookingFlowCompletedLock;
    }
  }

  document.querySelectorAll("#seatMap button.seat").forEach((b) => {
    b.disabled = bookingFlowCompletedLock || b.classList.contains("taken");
  });

  if (typeof window.__horizonBookingStepNavSync === "function") {
    window.__horizonBookingStepNavSync();
  }
}

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
    if (backBtn) backBtn.disabled = bookingFlowCompletedLock || idx <= 0;
    if (nextBtn) {
      const onPayStep = idx >= last;
      nextBtn.hidden = onPayStep;
      nextBtn.disabled = bookingFlowCompletedLock;
      nextBtn.textContent = "Next";
    }
    if (progressEl) {
      const stepMeta = steps[idx];
      progressEl.textContent = `${idx + 1} / ${steps.length} · ${stepMeta?.label ?? ""}`;
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
        const isLocked = i > activeBookingStepIndex;
        tab.classList.toggle("segment-tab--active", isActive);
        tab.classList.toggle("segment-tab--locked", isLocked);
        tab.setAttribute(
          "title",
          isLocked ? "Complete current step before opening this step." : ""
        );
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
      // Always refresh when opening this step so saved travellers match the
      // current Member id (and recover after API errors / empty OutSystems).
      void loadTravellerProfiles();
    }
    if (steps[idx]?.panelId === "bookingStep3Panel") {
      void refreshFlightDropdownFromRoute();
    }
    if (steps[idx]?.panelId === "bookingStep5Panel") {
      const ph = document.getElementById("passengerPhone");
      const prof = document.getElementById("profilePhoneNumber");
      if (ph && !String(ph.value || "").trim() && prof && String(prof.value || "").trim()) {
        ph.value = String(prof.value).trim();
      }
      refreshTripContactSummary();
      refreshPricePreview();
    }

    updateStepNav();
  };

  backBtn?.addEventListener("click", () => {
    if (bookingFlowCompletedLock) return;
    setActiveStep(activeBookingStepIndex - 1);
  });
  nextBtn?.addEventListener("click", async () => {
    if (bookingFlowCompletedLock) return;
    const steps = BOOKING_FLOW_STEPS;
    const last = steps.length - 1;
    if (activeBookingStepIndex >= last) {
      document.getElementById("createBtn")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const stepValidationError = validateBookingStepBeforeNext(activeBookingStepIndex);
    if (stepValidationError) {
      setError(document.getElementById("createError"), stepValidationError);
      return;
    }
    const currentPanel = steps[activeBookingStepIndex]?.panelId;
    if (currentPanel === "bookingStep3Panel") {
      const seatPol = getSeatPolicy(document.getElementById("flightID")?.value || "");
      if (seatPol.onlineSeatSelection) {
        const hold = await tryHoldCurrentSeats();
        if (!hold.ok) {
          setError(document.getElementById("createError"), hold.message || "Seat unavailable, please choose again.");
          await refreshTakenSeatsQueued(document.getElementById("flightID")?.value || "");
          return;
        }
        clearError(document.getElementById("createError"));
      }
    }
    setActiveStep(activeBookingStepIndex + 1);
  });

  for (const id of BOOKING_FLOW_ALL_TAB_IDS) {
    document.getElementById(id)?.addEventListener("click", () => {
      if (bookingFlowCompletedLock) return;
      const steps = BOOKING_FLOW_STEPS;
      const idx = steps.findIndex((s) => s.tabId === id);
      // Don't allow jumping ahead of the current step; only current/past.
      if (idx >= 0 && idx <= activeBookingStepIndex) setActiveStep(idx);
      else if (idx > activeBookingStepIndex) {
        setError(
          document.getElementById("createError"),
          "Complete the current step first, then click Next."
        );
      }
    });
  }

  window.__horizonRefreshBookingFlow = () => {
    bookingFlowCompletedLock = false;
    syncBookingFlowCompletedLockUI();
    syncTabVisibility();
    activeBookingStepIndex = 0;
    setActiveStep(0);
  };

  window.__horizonBookingStepNavSync = updateStepNav;

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
  const adults = Number(document.getElementById("packageAdults")?.value ?? 0);
  const children = Number(document.getElementById("packageChildren")?.value ?? 0);
  const infants = Number(document.getElementById("packageInfants")?.value ?? 0);
  const cabin = document.getElementById("packageCabin");
  const cabinLabel = cabin?.selectedOptions?.[0]?.textContent || "Economy";
  const t = document.getElementById("packageTripSummaryText");
  if (t) {
    t.textContent = `${rooms} room${rooms === "1" ? "" : "s"} · ${adults} adult${adults === 1 ? "" : "s"} · ${children} child${children === 1 ? "" : "ren"} · ${infants} infant${infants === 1 ? "" : "s"} · ${cabinLabel}`;
  }

  updatePackageTotalTravellers(adults, children, infants);
}

function updatePackageTotalTravellers(adults = null, children = null, infants = null) {
  const a =
    adults !== null ? Number(adults) : Number(document.getElementById("packageAdults")?.value ?? 0);
  const c =
    children !== null ? Number(children) : Number(document.getElementById("packageChildren")?.value ?? 0);
  const i =
    infants !== null ? Number(infants) : Number(document.getElementById("packageInfants")?.value ?? 0);

  const total = Math.max(1, (Number(a) || 0) + (Number(c) || 0) + (Number(i) || 0));
  const el = document.getElementById("packageTotalTravellers");
  if (el) el.value = String(total);
  return total;
}

function populatePackageTravellerCountSelect() {
  const adultsSel = document.getElementById("packageAdults");
  const childrenSel = document.getElementById("packageChildren");
  const infantsSel = document.getElementById("packageInfants");
  if (!adultsSel || adultsSel.tagName !== "SELECT") return;

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

  adultsSel.value = "2";
  if (childrenSel) childrenSel.value = "0";
  if (infantsSel) infantsSel.value = "0";

  updatePackageTotalTravellers(2, 0, 0);
}

function applyPackageSearchToBundle() {
  const fromS = document.getElementById("packageSearchFrom");
  const toS = document.getElementById("packageSearchTo");
  const bo = document.getElementById("bundleOrigin");
  const bd = document.getElementById("bundleDestination");
  const wantTo = toS?.value?.trim() || "";
  if (bo && fromS) bo.value = fromS.value;
  syncBundleDestinationSelectToOrigin();
  if (bd && wantTo && [...bd.options].some((o) => o.value === wantTo)) {
    bd.value = wantTo;
  }

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

  const adults = Math.max(0, Number(document.getElementById("packageAdults")?.value ?? 0));
  const children = Math.max(0, Number(document.getElementById("packageChildren")?.value ?? 0));
  const infants = Math.max(0, Number(document.getElementById("packageInfants")?.value ?? 0));
  const adultsSel = document.getElementById("bundleAdults");
  const childrenSel = document.getElementById("bundleChildren");
  const infantsSel = document.getElementById("bundleInfants");
  if (adultsSel) adultsSel.value = String(adults);
  if (childrenSel) childrenSel.value = String(children);
  if (infantsSel) infantsSel.value = String(infants);
  syncBundleTravellerTotals();
}

function runPackageSearch() {
  applyPackageSearchToBundle();
  const bo = document.getElementById("bundleOrigin")?.value?.trim() || "";
  const bd = document.getElementById("bundleDestination")?.value?.trim() || "";
  if (isSameCityRoute(bo, bd)) {
    const st = document.getElementById("bundleStatus");
    if (st) {
      st.textContent =
        "Origin and destination must be different cities. Pick another destination (or origin).";
    }
    void refreshFlightDropdownFromRoute();
    void refreshHotelsForBundleDestination();
    return;
  }
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
        "Browse packages below, or fine-tune From/To under Route & times, then Recalculate price. Change dates in the banner search.";
    }
    scheduleBundleCardPriceRefresh();
  }
  document.getElementById("step-book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  void refreshFlightDropdownFromRoute();
  void refreshHotelsForBundleDestination();
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

  // Keep top package search pax counts in sync with the (hidden) bundle step controls.
  const pAdults = document.getElementById("packageAdults");
  const pChildren = document.getElementById("packageChildren");
  const pInfants = document.getElementById("packageInfants");
  const bAdults = document.getElementById("bundleAdults");
  const bChildren = document.getElementById("bundleChildren");
  const bInfants = document.getElementById("bundleInfants");
  if (pAdults && bAdults) pAdults.value = String(bAdults.value || "0");
  if (pChildren && bChildren) pChildren.value = String(bChildren.value || "0");
  if (pInfants && bInfants) pInfants.value = String(bInfants.value || "0");
  if (pAdults || pChildren || pInfants) updatePackageTotalTravellers();
}

function setupPackageSearchUI() {
  populatePackageTravellerCountSelect();
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
      applyPackageSearchToBundle();
      syncTripWindowFromDateInputs();
      scheduleBundleCardPriceRefresh();
      onFineTuneDivergeFromPackage();
    })
  );

  ["packageDepartDate", "packageReturnDate"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      updatePackageNightsHint();
      applyPackageSearchToBundle();
      syncTripWindowFromDateInputs();
      scheduleBundleCardPriceRefresh();
      onFineTuneDivergeFromPackage();
    });
  });
  ["packageRooms", "packageAdults", "packageChildren", "packageInfants", "packageCabin"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", updatePackageTripSummary);
  });

  document.getElementById("packageSearchBtn")?.addEventListener("click", () => {
    runPackageSearch();
  });

  ["packageSearchFrom", "packageSearchTo"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      applyPackageSearchToBundle();
      populatePackageSearchSelects();
      syncPackageSearchFromBundleFields();
      syncSameCityRouteUI();
      onFineTuneDivergeFromPackage();
      void refreshFlightDropdownFromRoute();
      void refreshHotelsForBundleDestination();
    });
  });

  const bo = document.getElementById("bundleOrigin");
  const bd = document.getElementById("bundleDestination");
  bo?.addEventListener("change", () => {
    populatePackageSearchSelects();
    syncPackageSearchFromBundleFields();
    void refreshFlightDropdownFromRoute();
    syncSameCityRouteUI();
  });
  bd?.addEventListener("change", () => {
    populatePackageSearchSelects();
    syncPackageSearchFromBundleFields();
    void refreshFlightDropdownFromRoute();
    syncSameCityRouteUI();
  });

  syncSameCityRouteUI();

  applyPackageSearchToBundle();
  syncTripWindowFromDateInputs();
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

/** Turn API / dev-facing traveller messages into short copy for real users. */
function humanizeTravellerUserMessage(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  const low = s.toLowerCase();
  if (low.includes("traveller profile service not configured") || low.includes("not configured")) {
    return "Saved travellers aren’t available — check Traveller Profile service configuration.";
  }
  if (
    low.includes("not found for customer") ||
    low.includes("companion profile id=") ||
    low.includes("byaccount list") ||
    (low.includes("not found") && (low.includes("id=") || low.includes("profile id")))
  ) {
    return "We couldn’t find that saved traveller. Refresh the list or add their profile again.";
  }
  if (low.includes("not linked to the given customer") || low.includes("different account")) {
    return "That traveller doesn’t belong to this member account.";
  }
  if (low.includes("traveller profile not found")) {
    return "That traveller profile wasn’t found.";
  }
  if (low.includes("timed out") || low.includes("unreachable") || low.includes("connection")) {
    return "The service is slow or unavailable. Try again in a moment.";
  }
  if (
    low.includes("lookup failed:") ||
    low.includes("traveller profile update failed") ||
    low.includes("create failed") ||
    low.includes("returned no data") ||
    low.includes("outsystems rest")
  ) {
    return "We couldn’t save or load traveller details. Try again in a moment.";
  }
  if (s.startsWith("{") || s.includes('"TravellerProfileId"') || s.includes('"Id":')) {
    return "";
  }
  if (s.length > 220) return "Something went wrong. Please try again.";
  return s;
}

function travellerRowNumericId(row) {
  return Number(row?.Id ?? row?.id ?? row?.TravellerProfileId ?? 0) || 0;
}

/** Collapse spaces/punctuation so "A A" matches saved profile "aa". */
function normalizeTravellerNameKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Traveller profile Id for the signed-in booker when their saved name matches session displayName.
 */
function getBookerTravellerProfileId(safeRows) {
  const sess = getSession();
  if (!sess || sess.mode !== "member") return 0;
  const display = String(sess.displayName || "").trim();
  const want = normalizeTravellerNameKey(display);
  if (!want) return 0;
  const rows = Array.isArray(safeRows) ? safeRows : [];
  for (const row of rows) {
    const id = travellerRowNumericId(row);
    if (!id) continue;
    const fn = String(
      getOsField(row, ["FullName", "Name", "TravellerName", "fullName"]) || ""
    ).trim();
    if (normalizeTravellerNameKey(fn) === want) return id;
  }
  return 0;
}

/** Keep the booker’s profile first in the party (lead seat + contact) when they’re on the trip. */
function ensureBookerFirstInTripParty(safeRows) {
  const bid = getBookerTravellerProfileId(safeRows);
  if (!bid || !tripPartyOrderedIds.includes(bid)) return;
  tripPartyOrderedIds = [bid, ...tripPartyOrderedIds.filter((x) => x !== bid)];
}

function normalizeTripPartyForRows(safeRows, opts = {}) {
  const allowAutoFirst = Boolean(opts.allowAutoFirst);
  const validIds = new Set();
  for (const row of safeRows) {
    const id = travellerRowNumericId(row);
    if (id > 0) validIds.add(id);
  }

  if (Array.isArray(pendingTravellerProfileIds) && pendingTravellerProfileIds.length) {
    tripPartyOrderedIds = pendingTravellerProfileIds
      .map((x) => Number(x))
      .filter((n) => n > 0 && validIds.has(n));
    pendingTravellerProfileIds = null;
  } else {
    tripPartyOrderedIds = tripPartyOrderedIds.filter((id) => validIds.has(id));
  }

  if (!tripPartyOrderedIds.length && safeRows.length > 0 && allowAutoFirst) {
    const first = travellerRowNumericId(safeRows[0]);
    if (first) tripPartyOrderedIds = [first];
  }

  ensureBookerFirstInTripParty(safeRows);
}

function onToggleTripTraveller(id, checked) {
  const nid = Number(id);
  if (!nid) return;
  if (checked) {
    if (!tripPartyOrderedIds.includes(nid)) tripPartyOrderedIds.push(nid);
  } else {
    tripPartyOrderedIds = tripPartyOrderedIds.filter((x) => x !== nid);
  }
  populateTravellerSelectorsFromRows(latestTravellerRows, { allowAutoFirst: false });
  renderTravellerProfileList();
  refreshTripContactSummary();
  updateSeatGroupSummary();
  if (Array.isArray(selectedSeatCodes) && selectedSeatCodes[0]) {
    void selectSeat(selectedSeatCodes[0]);
  }
}

function renderTravellerProfileList() {
  const listEl = document.getElementById("travellerProfilesList");
  if (!listEl) return;

  listEl.innerHTML = "";
  const party = dedupeTripPartyOrderedIds();
  const partySet = new Set(party);

  latestTravellerRows.forEach((row) => {
    const id = travellerRowNumericId(row);
    const fullName = getOsField(row, ["FullName", "Name", "TravellerName", "fullName"]);
    const passport = getOsField(row, ["PassportNumber", "PassportNo", "passportNumber"]);
    const tail = maskPassport(passport);
    const title = fullName || `Traveller #${id}`;
    const sub = tail ? `Passport •••• ${tail}` : "Passport on file";

    const selectedId = travellerRowNumericId(selectedTravellerRow);
    const isSelected = selectedId > 0 && selectedId === id;
    const isOnTrip = partySet.has(id);

    const item = document.createElement("div");
    item.className = "traveller-item";
    item.innerHTML = `
      <div class="traveller-item__pick">
        <label class="traveller-item__on-trip">
          <input type="checkbox" data-action="toggleTripTraveller" data-id="${id}" ${
            isOnTrip ? "checked" : ""
          } />
          <span>On this trip</span>
        </label>
      </div>
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
}

function populateTravellerSelectorsFromRows(rows, opts = {}) {
  const leadSel = document.getElementById("leadTravellerSelect");
  const compSel = document.getElementById("companionTravellerSelect");
  const passengerNameEl = document.getElementById("passengerName");
  const passengerPhoneEl = document.getElementById("passengerPhone");

  if (!leadSel || !compSel) return;

  const safeRows = Array.isArray(rows) ? rows : [];
  normalizeTripPartyForRows(safeRows, opts);

  const makeOptionText = (row) => {
    const id = travellerRowNumericId(row);
    const fullName = String(getOsField(row, ["FullName", "Name", "TravellerName"]) || "").trim();
    const passport = getOsField(row, ["PassportNumber", "PassportNo", "passportNumber"]);
    const tail = maskPassport(passport);
    const title = fullName || `Traveller ${id}`;
    return tail ? `${title} — passport ends in ${tail}` : title;
  };

  const leadPlaceholder = document.createElement("option");
  leadPlaceholder.value = "";
  leadPlaceholder.textContent = "—";

  leadSel.innerHTML = "";
  leadSel.appendChild(leadPlaceholder);
  compSel.innerHTML = "";

  safeRows.forEach((row) => {
    const id = travellerRowNumericId(row);
    if (!id) return;
    const txt = makeOptionText(row);
    leadSel.appendChild(new Option(txt, String(id)));
    compSel.appendChild(new Option(txt, String(id)));
  });

  const leadId = tripPartyOrderedIds[0] || 0;
  leadSel.value = leadId ? String(leadId) : "";
  const companionSet = new Set(tripPartyOrderedIds.slice(1));
  Array.from(compSel.options || []).forEach((opt) => {
    opt.selected = companionSet.has(Number(opt.value));
  });

  const leadRow = safeRows.find((r) => travellerRowNumericId(r) === leadId);
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
}

async function loadTravellerProfiles() {
  if (!travellerProfilesServiceAvailable) return;

  const listEl = document.getElementById("travellerProfilesList");
  const errEl = document.getElementById("travellerProfilesError");
  const emptyHint = document.getElementById("travellerEmptyHint");

  if (errEl) {
    errEl.hidden = true;
    errEl.textContent = "";
  }
  if (emptyHint) {
    emptyHint.hidden = true;
    emptyHint.textContent = "";
  }

  const customerIdRaw = document.getElementById("travellerCustomerID")?.value ?? "";

  const customerID = Number(customerIdRaw || 0);
  if (!customerID || customerID < 1) {
    if (errEl) {
      errEl.textContent = "Pick which member you’re booking for above, then load travellers again.";
      errEl.hidden = false;
    }
    if (listEl) listEl.textContent = "";
    resetTravellerEdit();
    return;
  }

  if (listEl) listEl.textContent = "Loading profiles...";

  const mySeq = ++travellerLoadSeq;
  const out = await fetchJson(`${API_BASE}/travellerprofiles/byaccount/${customerID}`);
  if (mySeq !== travellerLoadSeq) return;
  if (out.networkError) {
    if (errEl) {
      errEl.textContent =
        humanizeTravellerUserMessage(out.errorMessage) || "Couldn’t load saved travellers. Check your connection and tap Refresh list.";
      errEl.hidden = false;
    }
    if (listEl) listEl.textContent = "";
    resetTravellerEdit();
    return;
  }

  if (!out.ok) {
    const raw = out.body?.message || out.errorMessage || `HTTP ${out.status}`;
    const msg = humanizeTravellerUserMessage(raw) || "Couldn’t load saved travellers. Try again in a moment.";
    const lower = String(raw).toLowerCase();
    if (lower.includes("traveller profile service not configured") || lower.includes("not configured")) {
      travellerProfilesServiceAvailable = false;
    }
    if (errEl) {
      errEl.textContent = msg;
      errEl.hidden = false;
    }
    latestTravellerRows = [];
    if (listEl) listEl.textContent = "";
    populateTravellerSelectorsFromRows([], { allowAutoFirst: false });
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
    const friendlyHint = humanizeTravellerUserMessage(apiHint);
    if (errEl) {
      if (friendlyHint) {
        errEl.textContent = friendlyHint;
        errEl.hidden = false;
      } else {
        errEl.hidden = true;
        errEl.textContent = "";
      }
    }
    listEl.textContent = "No saved travellers yet for this member.";
    resetTravellerEdit();
    populateTravellerSelectorsFromRows([], { allowAutoFirst: false });
    if (emptyHint) {
      emptyHint.textContent =
        "Add passport and travel details with New profile below. They’re saved to your account for your next trip too.";
      emptyHint.hidden = false;
    }
    return;
  }

  populateTravellerSelectorsFromRows(latestTravellerRows, { allowAutoFirst: true });
  renderTravellerProfileList();
}

function resetTravellerEdit() {
  selectedTravellerRow = null;
  const wrap = document.getElementById("travellerEditWrap");
  const idEl = document.getElementById("travellerEditId");
  if (wrap) wrap.hidden = true;
  if (idEl) idEl.value = "";
  const statusEl = document.getElementById("travellerEditStatus");
  if (statusEl) statusEl.textContent = "";
  const titleEl = document.getElementById("travellerEditTitle");
  if (titleEl) titleEl.textContent = "Profile details";

  const delBtn = document.getElementById("travellerDeleteBtn");
  if (delBtn) delBtn.disabled = true;
}

function normalizeTravellerPreferenceRaw(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const low = s.toLowerCase();
  if (low === "nil" || low === "none" || low === "n/a" || low === "no preference" || low === "any") return "";
  return s;
}

function setTravellerPreferenceSelect(id, raw) {
  const el = document.getElementById(id);
  if (!el || el.tagName !== "SELECT") return;
  const want = normalizeTravellerPreferenceRaw(raw);
  if (!want) {
    el.value = "";
    return;
  }
  const low = want.toLowerCase();
  const opt = Array.from(el.options).find((o) => o.value.toLowerCase() === low);
  el.value = opt ? opt.value : "";
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
  setTravellerPreferenceSelect("travellerEditSeatPreference", getOsField(row, ["SeatPreference", "seatPreference"]));
  setTravellerPreferenceSelect("travellerEditMealPreference", getOsField(row, ["MealPreference", "mealPreference"]));
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
  if (statusEl) statusEl.textContent = "Change any details below, then Save changes.";
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
  if (statusEl) statusEl.textContent = "Fill in passport details, then Save changes.";

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
  // Don't auto-refresh the list here: when the remote service is slow/unavailable,
  // `loadTravellerProfiles()` can reset/hide the editor, preventing the user from creating.
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

  if (statusEl) {
    if (out.networkError) {
      statusEl.textContent =
        humanizeTravellerUserMessage(out.errorMessage) || "Couldn’t reach the server. Try again.";
    } else if (out.ok) {
      statusEl.textContent = isCreate ? "New traveller saved." : "Changes saved.";
    } else {
      const raw = out.body?.message || out.errorMessage || "";
      statusEl.textContent =
        humanizeTravellerUserMessage(raw) || "Couldn’t save. Check the form and try again.";
    }
  }

  await loadTravellerProfiles();
  if (isCreate && !out.networkError && out.ok) {
    // Auto-pick the newly created traveller as lead when possible.
    const match = latestTravellerRows.find((r) => {
      const name = getOsField(r, ["FullName", "Name", "TravellerName"]).trim().toLowerCase();
      const pass = getOsField(r, ["PassportNumber", "PassportNo"]).trim().toUpperCase();
      return (
        name === required.fullName.trim().toLowerCase() &&
        pass === required.passportNumber.trim().toUpperCase()
      );
    });
    const newId = Number(
      out.body?.data?.TravellerProfileId ??
      out.body?.data?.Id ??
      match?.Id ??
      match?.id ??
      0
    );
    if (newId > 0) {
      applyTravellerSelectionFromIds([newId]);
      updateSeatGroupSummary();
    }
  }
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

  const ok = window.confirm("Delete this traveller profile? This removes it from the traveller profile service.");
  if (!ok) return;

  const payload = { CustomerID: customerID, Id: traveller_profile_id, TravellerProfileId: traveller_profile_id };

  const out = await fetchJson(`${API_BASE}/travellerprofiles/delete/${traveller_profile_id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (statusEl) {
    if (out.networkError) {
      statusEl.textContent =
        humanizeTravellerUserMessage(out.errorMessage) || "Couldn’t reach the server. Try again.";
    } else if (out.ok) {
      statusEl.textContent = "Profile removed.";
    } else {
      const raw = out.body?.message || out.errorMessage || "";
      statusEl.textContent =
        humanizeTravellerUserMessage(raw) || "Couldn’t delete that profile. Try again.";
    }
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

  if (listEl) {
    listEl.addEventListener("change", (e) => {
      const t = e.target;
      if (t?.matches?.("[data-action='toggleTripTraveller']")) {
        const id = Number(t.getAttribute("data-id"));
        onToggleTripTraveller(id, t.checked);
      }
    });
    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      const id = Number(btn.getAttribute("data-id") ?? 0);
      if (action === "selectTraveller") {
        const row = latestTravellerRows.find((r) => travellerRowNumericId(r) === id);
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

    if (loginForm) {
      loginForm.hidden = true;
      loginForm.style.display = "none";
    }
    if (loginDivider) {
      loginDivider.hidden = true;
      loginDivider.style.display = "none";
    }
    if (signupSection) {
      signupSection.hidden = false;
      signupSection.style.display = "block";
      // Focus the first field for a "page switch" feel.
      const first = document.getElementById("signupEmail");
      first?.focus?.();
    }
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

    if (signupSection) {
      signupSection.hidden = true;
      signupSection.style.display = "none";
    }
    if (loginDivider) {
      loginDivider.hidden = false;
      loginDivider.style.display = "";
    }
    if (loginForm) {
      loginForm.hidden = false;
      loginForm.style.display = "";
    }
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
  const password = document.getElementById("signupPassword")?.value ?? "";
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
  if (!phoneNumber) {
    if (errEl) {
      errEl.textContent = "Mobile number is required — we use it for booking SMS when Twilio is on.";
      errEl.hidden = false;
    }
    return;
  }
  const out = await fetchJson(`${ACCOUNT_BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, firstName, lastName, phoneNumber, nationality, dateOfBirth }),
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
  if (gate) {
    gate.hidden = true;
    gate.style.display = "none";
  }
  if (shell) {
    shell.hidden = false;
    shell.style.display = "block";
  }
  initAppShell();
  applySessionToBookingUI();
  // Prevent the user from scrolling back into the auth gate view.
  try {
    window.scrollTo({ top: 0, behavior: "instant" });
  } catch {
    window.scrollTo(0, 0);
  }
}

function onLogout() {
  clearSession();
  location.reload();
}

function applySessionToBookingUI() {
  const member = isMemberSession();
  const accountBtn = document.getElementById("myAccountNavBtn");
  const bookingsBtn = document.getElementById("myBookingsNavBtn");

  if (accountBtn) accountBtn.hidden = !member;
  if (bookingsBtn) bookingsBtn.hidden = !member;

  const badge = document.getElementById("sessionBadge");
  if (badge) {
    badge.hidden = false;
    badge.textContent = getSession()?.displayName || "Member";
  }
  const step5Tab = document.getElementById("bookingStep5Tab");
  if (step5Tab) {
    step5Tab.textContent = "5. Pay";
  }
  populateCustomerSelects();
  if (typeof window.__horizonRefreshBookingFlow === "function") {
    window.__horizonRefreshBookingFlow();
  }
}

function initAppShell() {
  if (appShellInitialized) return;
  appShellInitialized = true;

  void initDisplayCurrencyUI();

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
  setupBookingFlowTabs();
  setupTravellerProfilesUI();
  setupMyAccountBookingsUI();
  refreshTripContactSummary();
  updateSeatGroupSummary();
  void refreshFlightDropdownFromRoute();

  document.getElementById("passengerPhone")?.addEventListener("input", () => {
    refreshTripContactSummary();
  });

  document.getElementById("newManualBtn")?.addEventListener("click", () => {
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
  document.getElementById("bundleDepartDateTime")?.addEventListener("change", () => {
    syncTripWindowFromDateInputs();
    void refreshFlightDropdownFromRoute();
  });
  document.getElementById("bundleReturnDateTime")?.addEventListener("change", () => {
    syncTripWindowFromDateInputs();
    void refreshFlightDropdownFromRoute();
  });
  document
    .getElementById("hotelRoomType")
    .addEventListener("change", updateBreakfastAddonUI);


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

  document.getElementById("hotelBrowseOtherBtn")?.addEventListener("click", () => {
    expandHotelResultsBrowseOthers();
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
  void refreshHotelsForBundleDestination();

  for (const id of ["bundleAdults", "bundleChildren", "bundleInfants"]) {
    document.getElementById(id)?.addEventListener("change", () => {
      syncBundleTravellerTotals();
      scheduleBundleCardPriceRefresh();
      void refreshFlightDropdownFromRoute();
      if (selectedBundlePresetId) void searchBundlePricing();
    });
  }

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
      if (lastBundleParams) void refreshBundleForCoins();
    });
  document
    .getElementById("coinsToSpendCents")
    ?.addEventListener("change", () => {
      refreshPricePreview();
      scheduleBundleCardPriceRefresh();
      if (lastBundleParams) void refreshBundleForCoins();
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

  document.getElementById("copyResultBtn")?.addEventListener("click", () => {
    const uiErr = document.getElementById("uiError");
    if (uiErr) clearError(uiErr);
    copyLatestResult();
  });

  document.getElementById("refreshNotifBtn")?.addEventListener("click", () => {
    const uiErr = document.getElementById("uiError");
    if (uiErr) clearError(uiErr);
    refreshNotifications();
  });

  document.getElementById("createForm").addEventListener("submit", onCreateBookingSubmit);
  document.getElementById("cancelForm").addEventListener("submit", onCancelBookingSubmit);

  document.getElementById("bookingNavBtn")?.addEventListener("click", () => {
    goToBookingFlow();
  });

  document.getElementById("accountBackToBookingBtn")?.addEventListener("click", () => {
    goToBookingFlow();
  });

  document.getElementById("bookingConfirmOkBtn")?.addEventListener("click", () => {
    closeBookingConfirmModal();
  });
  document.getElementById("bookingConfirmAccountBtn")?.addEventListener("click", () => {
    closeBookingConfirmModal();
    goToMyAccountPage(false);
  });
  const confirmModal = document.getElementById("bookingConfirmModal");
  confirmModal?.addEventListener("click", (e) => {
    if (e.target === confirmModal) closeBookingConfirmModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeBookingConfirmModal();
  });

  document.getElementById("cancelNavBtn")?.addEventListener("click", () => {
    setActiveSegment("manage");
    document.getElementById("step-manage")?.scrollIntoView({ behavior: "smooth" });
  });
}

function setupMyAccountBookingsUI() {
  const accountBtn = document.getElementById("myAccountNavBtn");
  const bookingsBtn = document.getElementById("myBookingsNavBtn");
  const refreshBtn = document.getElementById("myBookingsRefreshBtn");
  const bookingsList = document.getElementById("myBookingsList");

  accountBtn?.addEventListener("click", () => goToMyAccountPage(false));
  bookingsBtn?.addEventListener("click", () => goToMyAccountPage(true));

  document.getElementById("profileSaveBtn")?.addEventListener("click", () => {
    void saveAccountProfile();
  });

  refreshBtn?.addEventListener("click", () => {
    const cid = Number(document.getElementById("customerID")?.value || 0);
    if (cid) void loadMyBookings(cid);
  });

  bookingsList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='cancelFromMyBookings']");
    if (!btn || btn.disabled) return;
    const bid = Number(btn.getAttribute("data-booking-id") || 0);
    if (!bid) return;

    const ok = window.confirm(
      `Cancel booking #${bid}? Refunds follow your fare rules. You can’t undo this.`
    );
    if (!ok) return;

    const cancelInput = document.getElementById("cancelBookingID");
    if (cancelInput) cancelInput.value = String(bid);
    const cancelSourceSel = document.getElementById("cancelSource");
    if (cancelSourceSel) cancelSourceSel.value = "customer";

    if (typeof setActiveSegment === "function") setActiveSegment("manage");
    document.getElementById("step-manage")?.scrollIntoView({ behavior: "smooth", block: "start" });

    void executeBookingCancellation(String(bid), "customer");
  });
}

function applyLeadContactFromAccount(accountPayload) {
  if (!accountPayload || typeof accountPayload !== "object") return;
  const nameEl = document.getElementById("passengerName");
  const emailEl = document.getElementById("passengerEmail");
  const phoneEl = document.getElementById("passengerPhone");
  const display = String(
    accountPayload.displayName ||
      `${accountPayload.firstName || ""} ${accountPayload.lastName || ""}`.trim() ||
      ""
  ).trim();
  if (nameEl && display) nameEl.value = display;
  if (emailEl && accountPayload.email) emailEl.value = String(accountPayload.email);
  if (phoneEl && accountPayload.phoneNumber != null && String(accountPayload.phoneNumber).trim() !== "") {
    phoneEl.value = String(accountPayload.phoneNumber);
  }
}

function populateAccountProfileForm(d) {
  if (!d || typeof d !== "object") return;
  const fn = document.getElementById("profileFirstName");
  const ln = document.getElementById("profileLastName");
  const ph = document.getElementById("profilePhoneNumber");
  const nat = document.getElementById("profileNationality");
  const dob = document.getElementById("profileDob");
  if (fn) fn.value = d.firstName != null ? String(d.firstName) : "";
  if (ln) ln.value = d.lastName != null ? String(d.lastName) : "";
  if (ph) ph.value = d.phoneNumber != null ? String(d.phoneNumber) : "";
  if (nat) nat.value = d.nationality != null ? String(d.nationality) : "";
  if (dob) {
    const raw = d.dateOfBirth != null ? String(d.dateOfBirth) : "";
    dob.value = raw ? raw.slice(0, 10) : "";
  }
}

async function saveAccountProfile() {
  const sess = getSession();
  const cid = sess && sess.mode === "member" ? Number(sess.customerID) : 0;
  const statusEl = document.getElementById("profileSaveStatus");
  const uiErr = document.getElementById("uiError");
  if (uiErr) clearError(uiErr);
  if (statusEl) {
    statusEl.hidden = true;
    statusEl.textContent = "";
  }
  if (cid < 1) return;

  const body = {
    firstName: document.getElementById("profileFirstName")?.value?.trim() ?? "",
    lastName: document.getElementById("profileLastName")?.value?.trim() ?? "",
    phoneNumber: document.getElementById("profilePhoneNumber")?.value?.trim() ?? "",
    nationality: document.getElementById("profileNationality")?.value?.trim() ?? "",
    dateOfBirth: document.getElementById("profileDob")?.value?.trim() ?? "",
  };

  const out = await fetchJson(`${ACCOUNT_BASE}/${cid}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!statusEl) return;
  statusEl.hidden = false;
  if (out.networkError || !out.ok || !out.body?.data) {
    statusEl.textContent =
      out.errorMessage || out.body?.message || `Save failed (HTTP ${out.status})`;
    return;
  }

  const d = out.body.data;
  statusEl.textContent = "Profile saved.";
  populateAccountProfileForm(d);

  const display = (
    d.displayName ||
    `${d.firstName || ""} ${d.lastName || ""}`.trim() ||
    d.email ||
    sess.displayName ||
    ""
  ).trim();

  setSession({
    ...sess,
    email: d.email || sess.email,
    displayName: display || sess.displayName,
  });

  if (latestTravellerRows.length) {
    populateTravellerSelectorsFromRows(latestTravellerRows, { allowAutoFirst: false });
    renderTravellerProfileList();
    refreshTripContactSummary();
    updateSeatGroupSummary();
  }

  const nameMain = document.getElementById("accountPageName");
  const emailMain = document.getElementById("accountPageEmail");
  if (nameMain) nameMain.textContent = display || "-";
  if (emailMain) emailMain.textContent = d.email || "-";
  const nameLegacy = document.getElementById("myAccountName");
  const emailLegacy = document.getElementById("myAccountEmail");
  if (nameLegacy) nameLegacy.textContent = display || "-";
  if (emailLegacy) emailLegacy.textContent = d.email || "-";

  const badge = document.getElementById("sessionBadge");
  if (badge) badge.textContent = display || "Member";

  applyLeadContactFromAccount({ ...d, displayName: display });

  window.setTimeout(() => {
    if (statusEl.textContent === "Profile saved.") {
      statusEl.hidden = true;
      statusEl.textContent = "";
    }
  }, 4000);
}

async function loadMyAccount(customerID) {
  const out = await fetchJson(`${ACCOUNT_BASE}/${customerID}`);
  if (out.networkError) return;
  if (!out.ok || !out.body?.data) {
    // Account store is in-memory in Docker unless persisted to a volume. If the
    // container restarts, previously created IDs may disappear and this lookup
    // returns 404 — clear the stale session and ask the user to sign in again.
    if (out.status === 404) {
      clearSession();
      const gate = document.getElementById("loginGate");
      const shell = document.getElementById("appShell");
      if (gate) gate.hidden = false;
      if (shell) shell.hidden = true;
      const errEl = document.getElementById("loginError");
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent =
          "Your session no longer matches an account (e.g. after a container reset). Please sign in or sign up again.";
      }
    }
    return;
  }

  const d = out.body.data;
  populateAccountProfileForm(d);
  applyLeadContactFromAccount(d);

  const display =
    d.displayName || `${d.firstName || ""} ${d.lastName || ""}`.trim() || "-";
  const nameMain = document.getElementById("accountPageName");
  const emailMain = document.getElementById("accountPageEmail");
  if (nameMain) nameMain.textContent = display;
  if (emailMain) emailMain.textContent = d.email || "-";
  const nameLegacy = document.getElementById("myAccountName");
  const emailLegacy = document.getElementById("myAccountEmail");
  if (nameLegacy) nameLegacy.textContent = display;
  if (emailLegacy) emailLegacy.textContent = d.email || "-";
}

async function loadMyBookings(customerID) {
  const listEl = document.getElementById("myBookingsList");
  if (!listEl) return;

  lastMyBookingsCustomerId = customerID;
  listEl.innerHTML = "Loading bookings...";

  const out = await fetchJson(`${API_BASE}/booking/bycustomer/${customerID}`);
  if (out.networkError || !out.ok || !out.body?.data) {
    listEl.innerHTML = "Could not load bookings.";
    return;
  }

  const bookings = out.body.data.bookings || [];
  listEl.innerHTML = "";

  if (!bookings.length) {
    listEl.innerHTML = `<div class="muted">No bookings yet.</div>`;
    return;
  }

  bookings.forEach((b) => {
    const id = b.id;
    const flight = b.flightID || "";
    const hotel = b.hotelID || "";
    const hotelNameRaw = b.hotelName && String(b.hotelName).trim() ? String(b.hotelName).trim() : "";
    const hotelLine = hotelNameRaw
      ? `${escapeHtml(hotelNameRaw)}${hotel != null && hotel !== "" ? ` <span class="muted">(#${escapeHtml(String(hotel))})</span>` : ""}`
      : hotel != null && hotel !== ""
        ? `Hotel #${escapeHtml(String(hotel))}`
        : "—";
    const dep = b.departureTime || "";
    const status = b.status || "";
    const statusUp = String(status || "").toUpperCase();
    const alreadyCancelled = statusUp === "CANCELLED";
    const total = b.totalPrice ?? "";
    const seats = Array.isArray(b.seatNumbers) ? b.seatNumbers.join(", ") : b.seatNumber || "";

    const item = document.createElement("div");
    item.className = "traveller-item";
    item.innerHTML = `
      <div class="traveller-item__meta">
        <div class="traveller-item__title">Booking #${id}</div>
        <div class="traveller-item__sub">
          ${flight ? `Flight ${flight}` : "Flight"} • ${dep ? String(dep).replace("T", " ") : ""}<br/>
          ${hotelLine} • Status ${status}<br/>
          Seats: ${seats || "—"} • Total ${formatMoneyDisplayFromSgd(Number(total || 0))}
        </div>
      </div>
      <button type="button" class="btn-secondary" data-action="${
        alreadyCancelled ? "" : "cancelFromMyBookings"
      }" data-booking-id="${id}" ${alreadyCancelled ? "disabled" : ""}>
        ${alreadyCancelled ? "Cancelled" : "Cancel this booking"}
      </button>
    `;
    listEl.appendChild(item);
  });
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

