from shared_python.types import MarketBar


def test_market_bar_model_basic():
    bar = MarketBar(ts=1700000000, open=1.0, high=2.0, low=0.5, close=1.5, volume=123.4, provider="binance")
    assert bar.ohlc_tuple == (1.0, 2.0, 0.5, 1.5)
    assert bar.volume == 123.4

