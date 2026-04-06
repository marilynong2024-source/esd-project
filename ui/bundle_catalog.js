/**
 * Mass bundle catalog aligned with flight service `route_specs` (origin/destination city names).
 * Loaded before app.js. Exposes `BUNDLE_PRESETS` (10k rows) for the gallery and filters.
 */
(function bundleCatalog() {
  const FLIGHT_BUNDLE_ROUTE_PAIRS = [
    ["Singapore", "Tokyo"],
    ["Singapore", "Bangkok"],
    ["Singapore", "Bali"],
    ["Singapore", "Sydney"],
    ["Singapore", "London"],
    ["Singapore", "Paris"],
    ["Singapore", "Kuala Lumpur"],
    ["Tokyo", "Singapore"],
    ["Tokyo", "Bangkok"],
    ["Tokyo", "Sydney"],
    ["London", "Paris"],
    ["London", "Tokyo"],
    ["London", "Singapore"],
    ["Paris", "London"],
    ["Paris", "Tokyo"],
    ["Sydney", "Singapore"],
    ["Sydney", "Melbourne"],
    ["Melbourne", "Sydney"],
    ["Bangkok", "Singapore"],
    ["Bangkok", "Bali"],
    ["Bangkok", "Tokyo"],
    ["Bali", "Singapore"],
    ["Kuala Lumpur", "Singapore"],
    ["Seoul", "Bangkok"],
    ["Seoul", "Tokyo"],
    ["Seoul", "Singapore"],
    ["Manila", "Singapore"],
    ["Manila", "Tokyo"],
    ["Dubai", "London"],
    ["Dubai", "Singapore"],
    ["Frankfurt", "Singapore"],
    ["Amsterdam", "London"],
    ["Amsterdam", "Singapore"],
    ["Los Angeles", "Tokyo"],
    ["San Francisco", "Singapore"],
    ["Ho Chi Minh City", "Singapore"],
    ["Hanoi", "Bangkok"],
    ["Jakarta", "Singapore"],
    ["Chennai", "Singapore"],
    ["Singapore", "Hong Kong"],
    ["Singapore", "Taipei"],
    ["Singapore", "Phuket"],
    ["Singapore", "Perth"],
    ["Singapore", "Auckland"],
    ["Singapore", "New York"],
    ["Hong Kong", "Bangkok"],
    ["Rome", "Paris"],
    ["Madrid", "Barcelona"],
  ];

  const EURO = new Set([
    "London",
    "Paris",
    "Rome",
    "Madrid",
    "Barcelona",
    "Amsterdam",
    "Frankfurt",
  ]);
  const US = new Set(["Los Angeles", "San Francisco", "New York"]);

  function inferRegion(origin, dest) {
    const oE = EURO.has(origin);
    const dE = EURO.has(dest);
    if (oE && dE) return "europe";
    if (US.has(origin) || US.has(dest)) return "intercontinental";
    if (origin === "Dubai" || dest === "Dubai") return "intercontinental";
    if (oE || dE) return "intercontinental";
    return "asia";
  }

  function slugCity(c) {
    return String(c)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  const ADJ = [
    "Essential",
    "Signature",
    "Explorer",
    "Weekender",
    "Premium",
    "Boutique",
    "Classic",
    "Urban",
    "Coastal",
    "Family",
    "Solo",
    "Slow",
    "Express",
    "Hidden",
    "Sunrise",
    "Golden",
    "Night",
    "Market",
    "Riverside",
    "Skyline",
  ];
  const NOUN = [
    "city break",
    "food crawl",
    "culture week",
    "beach escape",
    "shopping sprint",
    "temple trail",
    "harbour loop",
    "night-market hop",
    "museum pass",
    "café circuit",
    "photo route",
    "wellness pause",
    "adventure mix",
    "romantic stay",
    "festival window",
    "long-weekend",
    "deep dive",
    "first-timer",
    "return visit",
    "locals' picks",
  ];

  /** First-lap row index → stable id (aligned with `FLIGHT_BUNDLE_ROUTE_PAIRS` order). */
  const LEGACY_I_TO_ID = {
    0: "tokyo",
    1: "bangkok",
    2: "bali",
    3: "sydney",
    4: "london",
    5: "paris-romance",
    6: "sin-kl",
    8: "tyo-bkk",
    9: "lon-par",
    10: "lon-tyo",
    12: "par-lon",
    14: "syd-sin",
    17: "bkk-dps",
    24: "icn-tyo",
    41: "sin-hkt",
    42: "sin-per",
    45: "hkg-bkk",
    47: "mad-bcn",
  };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  /** @returns {string} YYYY-MM-DDTHH:mm in UTC components (stable demo dates). */
  function utcYMDHM(y, m0, d, hh, mm) {
    const t = Date.UTC(y, m0, d, hh, mm, 0);
    const x = new Date(t);
    return `${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}T${pad2(x.getUTCHours())}:${pad2(x.getUTCMinutes())}`;
  }

  function addDaysUtc(y, m0, d, delta) {
    const t = Date.UTC(y, m0, d, 12, 0, 0) + delta * 86400000;
    return new Date(t);
  }

  function buildBundlePresetCatalog(targetCount) {
    const routes = FLIGHT_BUNDLE_ROUTE_PAIRS;
    const out = [];
    const departHours = [6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 21];
    const returnHours = [9, 10, 11, 14, 16, 18, 20];
    const idPad = Math.max(5, String(targetCount - 1).length);

    for (let i = 0; i < targetCount; i++) {
      const [origin, destination] = routes[i % routes.length];
      const variant = Math.floor(i / routes.length);
      // 2–14 nights so hero “5 nights” etc. matches many rows per route.
      const nights = 2 + (variant % 13);
      // Dense coverage across 2026 so ±14-day depart filters still return plenty of cards.
      const spread =
        (i * 29 + variant * 41 + (i % 11) * 13 + (variant % 5) * 7) % 365;
      const d0 = addDaysUtc(2026, 0, 1, spread);
      const y = d0.getUTCFullYear();
      const m0 = d0.getUTCMonth();
      const d = d0.getUTCDate();
      const dh = departHours[(i + variant) % departHours.length];
      const rh = returnHours[(i + variant * 2) % returnHours.length];
      const depart = utcYMDHM(y, m0, d, dh, (i * 7) % 60);
      const dRet = addDaysUtc(y, m0, d, nights);
      const ry = dRet.getUTCFullYear();
      const rm0 = dRet.getUTCMonth();
      const rd = dRet.getUTCDate();
      const ret = utcYMDHM(ry, rm0, rd, rh, 30 - ((i * 5) % 30));

      const region = inferRegion(origin, destination);
      const so = slugCity(origin);
      const sd = slugCity(destination);
      const id =
        variant === 0 && LEGACY_I_TO_ID[i] != null
          ? LEGACY_I_TO_ID[i]
          : `g-${so}-${sd}-${String(i).padStart(idPad, "0")}`;

      const titleWord = `${ADJ[i % ADJ.length]} ${NOUN[(i + variant) % NOUN.length]}`;
      const title = `${destination} — ${titleWord}`;
      const route = `${origin} → ${destination}`;
      const blurb = `${nights} nights · ${titleWord} · ${route} · depart ${depart.slice(0, 10)}.`;
      const image = `https://picsum.photos/seed/pkg-${so}-${sd}-${i}/520/300`;

      out.push({
        id,
        title,
        route,
        origin,
        destination,
        region,
        depart,
        ret,
        blurb,
        image,
      });
    }
    return out;
  }

  const BUNDLE_PRESETS = buildBundlePresetCatalog(11000);

  /** @type {typeof BUNDLE_PRESETS} */
  window.BUNDLE_PRESETS = BUNDLE_PRESETS;
})();
