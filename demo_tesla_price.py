from stocks_agent import AlphaVantageClient

client = AlphaVantageClient()
price_info = client.get_global_quote('TSLA')
print('Tesla Global Quote:')
print(price_info)
