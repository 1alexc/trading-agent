from google.adk.agents.llm_agent import Agent

# Import the AlphaVantage client tool for market data access
from .tools import AlphaVantageClient

# Create a reusable client instance (optional)
alpha_client = AlphaVantageClient()

stocks_agent_agent = Agent(
    model='gemini-2.5-flash',
    name='stocks_agent',
    description='A helpful assistant for stock market data and analysis. Can retrieve real-time quotes, historical time series, and technical indicators using Alpha Vantage.',
    instruction='You are an expert financial analyst. Answer user questions about stocks and market data. Use the AlphaVantageClient tool (e.g., alpha_client.get_global_quote("AAPL")) to fetch up-to-date information before responding.',
    tools=[
        alpha_client.get_global_quote,
        alpha_client.get_time_series_daily,
        alpha_client.get_technical_indicator,
        alpha_client.call
    ]
)
