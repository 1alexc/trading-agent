from google.adk.agents.llm_agent import Agent
from .tools import (
    CoinGeckoMCPTool,
    get_price,
    get_market_data,
    get_trending,
    list_tools,
    find_tool,
)

# Instantiate the CoinGecko MCP tool to provide documentation index access
coingecko_tool = CoinGeckoMCPTool()

crypto_agent = Agent(
    model='gemini-2.5-flash',
    name='crypto_agent',
    description='A helpful assistant for cryptocurrency price, market data, and CoinGecko MCP tool queries.',
    instruction=(
        "You are an expert on cryptocurrency market data. Use the provided tools to fetch current prices, market details, and trending coins. "
        "You can also use `list_tools` or `find_tool` to explore the CoinGecko MCP documentation."
    ),
    tools=[
        get_price,
        get_market_data,
        get_trending,
        list_tools,
        find_tool,
    ],
)
root_agent = crypto_agent
