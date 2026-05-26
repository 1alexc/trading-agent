from google.adk.agents.llm_agent import Agent

# Import specialist agents
from crypto_agent.agent import crypto_agent
from stocks_agent.agent import stocks_agent

# Coordinator agent that routes queries to the appropriate sub‑agent
root_agent = Agent(
    model='gemini-2.5-flash',
    name='root_agent',
    description='A coordinator agent for crypto and stock queries.',
    instruction='''You are a coordinator that routes user questions to the appropriate specialist agent.
        If the query is about cryptocurrency prices, market data, or CoinGecko tools, delegate to `crypto_agent`.
        If the query is about stock market data, use `stocks_agent`.
        For general questions, answer directly. Aggregate the response from the sub‑agent and present it clearly to the user.''',
    sub_agents=[
        crypto_agent,
        stocks_agent,
    ],
)

# Export for ADK loader
__all__ = ["root_agent"]
