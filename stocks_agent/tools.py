# stocks_agent/tools.py
"""AlphaVantage MCP client for the stocks_agent.

Provides a class‑based interface that loads the API key from the
`.env` file (using ``python‑dotenv``) and enforces the free‑tier limit of
25 requests per day.

The client offers:
* ``request`` – low‑level helper that sends a GET request to the Alpha Vantage
  MCP endpoint.
* Convenience methods for the most common endpoints (quote, daily time series,
  technical indicators, etc.).
* ``call`` – a generic method for any other documented endpoint.

Rate‑limit state is persisted in ``.av_rate_limit.json`` located in the
project root (``/Users/home1/Desktop/Stocks-Crypto/trading-agent``).  The file
stores a mapping of ``{"date": "YYYY‑MM‑DD", "count": N}`` and is reset at
midnight UTC.
"""

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import requests
from dotenv import load_dotenv

# Load environment variables from the project's .env (root_agent/.env)
# The .env file is one directory up from this module.
env_path = Path(__file__).resolve().parents[1] / "root_agent" / ".env"
load_dotenv(dotenv_path=env_path)

ALPHAVANTAGE_API_KEY = os.getenv("ALPHAVANTAGE_API_KEY")
if not ALPHAVANTAGE_API_KEY:
    raise RuntimeError("ALPHAVANTAGE_API_KEY not set in .env")

# ---------------------------------------------------------------------------
# Rate‑limit handling
# ---------------------------------------------------------------------------
_RATE_LIMIT_FILE = Path(__file__).resolve().parents[2] / ".av_rate_limit.json"
_RATE_LIMIT_MAX = 25

_lock = threading.Lock()


def _load_rate_limit() -> Dict[str, Any]:
    """Load the rate‑limit JSON file, creating a fresh record if missing."""
    if _RATE_LIMIT_FILE.is_file():
        try:
            with open(_RATE_LIMIT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {}
    else:
        data = {}
    return data


def _save_rate_limit(data: Dict[str, Any]) -> None:
    """Persist the rate‑limit data to disk atomically."""
    tmp_path = _RATE_LIMIT_FILE.with_suffix(".tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    tmp_path.replace(_RATE_LIMIT_FILE)


def _reset_if_new_day(data: Dict[str, Any]) -> Dict[str, Any]:
    today = datetime.now(timezone.utc).date().isoformat()
    if data.get("date") != today:
        return {"date": today, "count": 0}
    return data


def _increment_counter() -> None:
    with _lock:
        data = _reset_if_new_day(_load_rate_limit())
        if data.get("count", 0) >= _RATE_LIMIT_MAX:
            raise RuntimeError(
                f"Alpha Vantage daily request limit of {_RATE_LIMIT_MAX} exceeded"
            )
        data["count"] = data.get("count", 0) + 1
        _save_rate_limit(data)


class RateLimitExceeded(RuntimeError):
    """Raised when the daily request quota has been exhausted."""


# ---------------------------------------------------------------------------
# Client implementation
# ---------------------------------------------------------------------------
class AlphaVantageClient:
    """High‑level client for Alpha Vantage MCP.

    Example::
        client = AlphaVantageClient()
        quote = client.get_global_quote("AAPL")
    """

    _BASE_URL = "https://www.alphavantage.co/query"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or ALPHAVANTAGE_API_KEY
        if not self.api_key:
            raise RuntimeError("Alpha Vantage API key is required")

    # -------------------------------------------------------------------
    # Low‑level request helper
    # -------------------------------------------------------------------
    def _request(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Send a GET request to the MCP endpoint.

        The method automatically adds the ``apikey`` parameter, checks the
        daily quota and returns the parsed JSON response.
        """
        _increment_counter()
        query = {**params, "apikey": self.api_key}
        resp = requests.get(self._BASE_URL, params=query, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        # Alpha Vantage returns a ``Note`` field when the free tier limit is hit.
        if "Note" in data:
            raise RateLimitExceeded(data["Note"])
        return data

    # -------------------------------------------------------------------
    # Generic public method
    # -------------------------------------------------------------------
    def call(self, function: str, **params: Any) -> Dict[str, Any]:
        """Call any Alpha Vantage function directly.

        ``function`` should be the exact API name, e.g. ``"TIME_SERIES_DAILY"``.
        """
        return self._request({"function": function, **params})

    # -------------------------------------------------------------------
    # Convenience wrappers (most common endpoints)
    # -------------------------------------------------------------------
    def get_global_quote(self, symbol: str) -> Dict[str, Any]:
        """Retrieve the real‑time quote for ``symbol``.

        Returns the JSON payload under the ``"Global Quote"`` key.
        """
        data = self._request({"function": "GLOBAL_QUOTE", "symbol": symbol})
        return data.get("Global Quote", {})

    def get_time_series_daily(self, symbol: str, outputsize: str = "compact") -> Dict[str, Any]:
        """Daily time series (adjusted) for ``symbol``.

        ``outputsize`` can be ``"compact"`` (latest 100 points) or ``"full"``.
        """
        return self._request({
            "function": "TIME_SERIES_DAILY_ADJUSTED",
            "symbol": symbol,
            "outputsize": outputsize,
        })

    def get_technical_indicator(
        self,
        symbol: str,
        indicator: str,
        interval: str = "daily",
        time_period: int = 10,
        series_type: str = "close",
    ) -> Dict[str, Any]:
        """Fetch a technical indicator.

        ``indicator`` is the Alpha Vantage technical indicator name, e.g.
        ``"SMA"`` or ``"RSI"``.
        """
        return AlphaVantageClient()._request({
            "function": indicator,
            "symbol": symbol,
            "interval": interval,
            "time_period": time_period,
            "series_type": series_type,
        })

    # Add additional helper methods here as needed.

# End of file
