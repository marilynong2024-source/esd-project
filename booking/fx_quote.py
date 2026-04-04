"""
Optional external FX quote (submission: "at least one external service").

1) optional_fx_snapshot — HTTP snapshot on create-booking when FX_API_ENABLED=true.
   Default URL uses Frankfurter (no key). Override with FX_API_URL if needed.

2) get_sgd_to_currency_rate — for display-currency UI. Prefer ExchangeRate-API
   v6 when EXCHANGE_RATE_API_KEY is set (USD-based conversion_rates table).
   Otherwise Frankfurter (api.frankfurter.app, SGD base) — no key required.
   (exchangerate.host often 404s without APILayer auth; not used here.)

Env:
  FX_API_ENABLED       true/false
  FX_API_URL           optional: override snapshot HTTP URL (else v6 key or Frankfurter)
  EXCHANGE_RATE_API_KEY   v6 API key from https://app.exchangerate-api.com/dashboard
  EXCHANGERATE_API_KEY    alias for EXCHANGE_RATE_API_KEY
"""

from __future__ import annotations

import os
import threading
import time
from typing import Any

import requests

# --- legacy snapshot (create-booking attachment) --------------------------------


def exchange_rate_api_key_from_env() -> str:
    """Key for https://v6.exchangerate-api.com/v6/{key}/latest/USD (dashboard: ExchangeRate-API)."""
    return (
        (os.environ.get("EXCHANGE_RATE_API_KEY") or os.environ.get("EXCHANGERATE_API_KEY") or "")
        .strip()
    )


def optional_fx_snapshot(booking_currency: str) -> dict[str, Any] | None:
    if os.environ.get("FX_API_ENABLED", "").strip().lower() not in ("1", "true", "yes"):
        return None
    base_cur = (booking_currency or "SGD").strip().upper() or "SGD"
    custom_url = (os.environ.get("FX_API_URL") or "").strip()
    api_key = exchange_rate_api_key_from_env()

    if custom_url:
        try:
            r = requests.get(custom_url, timeout=8)
            if not r.ok:
                return {"error": f"HTTP {r.status_code}", "url": custom_url}
            body = r.json()
            return {"source": "custom", "requestUrl": custom_url, "response": body}
        except Exception as e:
            return {"error": str(e), "url": custom_url}

    if api_key:
        try:
            rates, meta = _fetch_exchangerate_api_v6(api_key)
            pick = ("USD", "EUR", "SGD", base_cur)
            subset = {c: rates[c] for c in pick if c in rates}
            return {
                "source": "exchangerate-api.com",
                "requestUrl": "v6/latest/USD (see ExchangeRate-API docs)",
                "bookingBase": base_cur,
                "time_last_update_utc": meta.get("time_last_update_utc"),
                "conversion_rates_subset": subset,
            }
        except Exception as e:
            return {"error": str(e), "source": "exchangerate-api.com"}

    default_url = f"https://api.frankfurter.app/latest?from={base_cur}&to=USD,EUR"
    try:
        r = requests.get(default_url, timeout=8)
        if not r.ok:
            return {"error": f"HTTP {r.status_code}", "url": default_url}
        body = r.json()
        return {"source": "frankfurter.app", "requestUrl": default_url, "response": body}
    except Exception as e:
        return {"error": str(e), "url": default_url}


# --- display currency (SGD → target) --------------------------------------------

_CACHE_LOCK = threading.Lock()
_USD_RATES_CACHE: dict[str, Any] = {"t": 0.0, "rates": None, "meta": None}
_TTL_SEC = 3600.0


def _fetch_exchangerate_api_v6(api_key: str) -> tuple[dict[str, float], dict[str, Any]]:
    url = f"https://v6.exchangerate-api.com/v6/{api_key.strip()}/latest/USD"
    r = requests.get(url, timeout=12)
    r.raise_for_status()
    body = r.json()
    if body.get("result") != "success":
        err = body.get("error-type") or body.get("error_type") or "unknown"
        raise RuntimeError(f"exchangerate-api.com: {err}")
    rates = body.get("conversion_rates") or {}
    meta: dict[str, Any] = {
        "source": "exchangerate-api.com",
        "time_last_update_utc": body.get("time_last_update_utc"),
        "base_code": body.get("base_code") or "USD",
    }
    return rates, meta


def _fetch_frankfurter_sgd_to_target(target: str) -> tuple[float, dict[str, Any]]:
    tgt = target.upper()
    url = f"https://api.frankfurter.app/latest?from=SGD&to={tgt}"
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    body = r.json()
    rates = body.get("rates") or {}
    if tgt not in rates:
        raise RuntimeError(f"frankfurter.app: no rate for {tgt} (check currency is supported)")
    meta: dict[str, Any] = {
        "source": "frankfurter.app",
        "date": body.get("date"),
        "fallback": True,
    }
    return float(rates[tgt]), meta


def get_sgd_to_currency_rate(target_code: str) -> dict[str, Any]:
    """
    Return how many units of `target_code` equal 1 SGD.

    Response includes: from, to, rate, source, and optional time_last_update_utc.
    """
    tgt = (target_code or "SGD").strip().upper()
    if len(tgt) != 3 or not tgt.isalpha():
        raise ValueError("Query parameter 'to' must be a 3-letter currency code")

    if tgt == "SGD":
        return {
            "from": "SGD",
            "to": "SGD",
            "rate": 1.0,
            "source": "fixed",
        }

    api_key = exchange_rate_api_key_from_env()

    if api_key:
        now = time.time()
        with _CACHE_LOCK:
            age = now - float(_USD_RATES_CACHE["t"] or 0)
            cached_rates = _USD_RATES_CACHE["rates"]
            cached_meta = _USD_RATES_CACHE["meta"]
        if cached_rates and age < _TTL_SEC:
            rates = cached_rates
            meta_base = dict(cached_meta or {})
        else:
            try:
                rates, meta_base = _fetch_exchangerate_api_v6(api_key)
                with _CACHE_LOCK:
                    _USD_RATES_CACHE["rates"] = rates
                    _USD_RATES_CACHE["t"] = time.time()
                    _USD_RATES_CACHE["meta"] = meta_base
            except Exception:
                rates = None
                meta_base = None

        if rates:
            sgd_per_usd = rates.get("SGD")
            tgt_per_usd = rates.get(tgt)
            if sgd_per_usd is not None and tgt_per_usd is not None:
                rate = float(tgt_per_usd) / float(sgd_per_usd)
                out = {
                    "from": "SGD",
                    "to": tgt,
                    "rate": rate,
                    **(meta_base or {}),
                }
                return out

    rate, fmeta = _fetch_frankfurter_sgd_to_target(tgt)
    return {"from": "SGD", "to": tgt, "rate": rate, **fmeta}
