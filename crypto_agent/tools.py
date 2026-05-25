import os
from pathlib import Path
import requests


class CoinGeckoMCPTool:
    """Simple MCP tool to expose CoinGecko documentation index.

    The tool loads the full documentation index from the remote
    `llms.txt` file (fetched earlier) and provides helper methods
    for the crypto_agent to discover available endpoints.
    """

    def __init__(self, index_path: str | None = None):
        """Initialize the tool.

        If ``index_path`` is not provided the tool will look for the
        documentation index in the project's root under the filename
        ``llms.txt``. The path is resolved relative to the current file.
        """
        if index_path:
            self.index_path = Path(index_path)
        else:
            self.index_path = Path(__file__).resolve().parents[1] / "llms.txt"
        self._content = None

    @property
    def content(self) -> str:
        """Lazily load and cache the documentation index text.

        Returns the full text of ``llms.txt``. Raises ``FileNotFoundError``
        if the file does not exist.
        """
        if self._content is None:
            if not self.index_path.is_file():
                raise FileNotFoundError(f"CoinGecko index file not found: {self.index_path}")
            self._content = self.index_path.read_text(encoding="utf-8")
        return self._content

    def list_tools(self) -> list[str]:
        """Extract a simple list of tool names from the index.

        The ``llms.txt`` documentation contains sections like ``## Docs``
        and markdown links. This helper scans for lines that start with a
        dash followed by a markdown link and returns the link text, which is
        typically the tool name.
        """
        tools = []
        for line in self.content.splitlines():
            line = line.strip()
            if line.startswith("- ["):
                end_bracket = line.find("]")
                if end_bracket != -1:
                    name = line[2:end_bracket]
                    tools.append(name)
        return tools

    def find_tool(self, name: str) -> str | None:
        """Return the markdown link for a given *name* if present.

        Performs a case‑insensitive search among the extracted tool names.
        """
        for line in self.content.splitlines():
            if line.strip().lower().startswith(f"- [{name.lower()}"):
                return line.strip()
        return None

    def __repr__(self) -> str:
        return f"CoinGeckoMCPTool(index_path={self.index_path})"

# ---------------------------------------------------------------------------
# CoinGecko API wrapper functions
# ---------------------------------------------------------------------------

def _api_get(url: str, params: dict | None = None) -> dict:
    """Helper to perform a GET request to the CoinGecko API.

    Raises ``RuntimeError`` on network errors or non‑200 responses.
    """
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        raise RuntimeError(f"CoinGecko API request failed: {e}")


def get_price(coin_ids: list[str], vs_currencies: list[str] = ["usd"]) -> dict:
    """Return current price information for given ``coin_ids``.

    Example::
        get_price(["bitcoin", "ethereum"], ["usd", "eur"])  # -> {"bitcoin": {"usd": 12345, "eur": 11200}, ...}
    """
    url = "https://api.coingecko.com/api/v3/simple/price"
    params = {
        "ids": ",".join(coin_ids),
        "vs_currencies": ",".join(vs_currencies),
    }
    return _api_get(url, params)


def get_market_data(coin_id: str) -> dict:
    """Retrieve detailed market data for a single ``coin_id``.

    Returns the full JSON payload from the ``/coins/{id}`` endpoint.
    """
    url = f"https://api.coingecko.com/api/v3/coins/{coin_id}"
    return _api_get(url)


def get_trending() -> list[dict]:
    """Fetch the list of trending coins on CoinGecko.
    """
    url = "https://api.coingecko.com/api/v3/search/trending"
    data = _api_get(url)
    return data.get("coins", [])

# Convenience wrappers for the Agent's tool list

def list_tools() -> list[str]:
    """Wrapper that returns the list of available CoinGecko MCP tools.
    """
    return CoinGeckoMCPTool().list_tools()


def find_tool(name: str) -> str | None:
    """Wrapper that finds a tool documentation entry by name.
    """
    return CoinGeckoMCPTool().find_tool(name)

# Exported symbols for Agent import
__all__ = [
    "CoinGeckoMCPTool",
    "get_price",
    "get_market_data",
    "get_trending",
    "list_tools",
    "find_tool",
]
