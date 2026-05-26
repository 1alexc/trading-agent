from google.adk.agents.llm_agent import Agent

# Import the AlphaVantage client tool for market data access
from .tools import AlphaVantageClient

# Create a reusable client instance (optional)
try:
    alpha_client = AlphaVantageClient()
except Exception as e:
    # If the API key is missing or any error occurs, log and continue without tools
    import logging
    logging.getLogger(__name__).warning("AlphaVantageClient initialization failed: %s", e)
    alpha_client = None

stocks_agent = Agent(
    model='gemini-2.5-flash',
    name='stocks_agent',
    description='A helpful assistant for stock market data and analysis. Can retrieve real-time quotes, historical time series, and technical indicators using Alpha Vantage.',
    instruction='You are an expert financial analyst. Answer user questions about stocks and market data. Use the AlphaVantageClient tool (e.g., alpha_client.get_global_quote("AAPL")) to fetch up-to-date information before responding.',
    tools=[
        func for func in (
            alpha_client.get_global_quote if alpha_client else None,
            alpha_client.get_time_series_daily if alpha_client else None,
            alpha_client.get_technical_indicator if alpha_client else None,
            alpha_client.call if alpha_client else None,
        )
        if func is not None
    ]
)
