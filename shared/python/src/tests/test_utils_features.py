from shared_python.utils import (
    zscore_outliers,
    kmeans_regimes,
    bid_ask_spread,
    price_divergence,
    cyclical_encode,
)


def test_zscore_outliers_basic():
    data = [1, 1, 1, 1, 10]  # 10 is an outlier
    idx = zscore_outliers(data, threshold=2.5)
    assert idx == [4]


def test_kmeans_regimes_shapes():
    data = [0, 0.1, 0.2, 2.0, 2.1, 2.2, 5.0, 5.2]
    labels = kmeans_regimes(data, k=3)
    assert len(labels) == len(data)
    assert set(labels) <= {0, 1, 2}


def test_bid_ask_spread():
    s = bid_ask_spread(99, 101)
    assert 0 < s < 0.025


def test_price_divergence():
    a = [100, 101, 102]
    b = [100, 102, 104]
    d = price_divergence(a, b)
    assert d > 0


def test_cyclical_encode():
    s, c = cyclical_encode(6, period=24)
    assert -1 <= s <= 1
    assert -1 <= c <= 1
