from shared_python.utils import get_risk_threshold, enforce_risk


def test_risk_threshold():
    assert abs(get_risk_threshold(10_000) - 200) < 1e-9  # 2% from fixture env


def test_enforce_risk_ok():
    enforce_risk(100, 10_000)  # below threshold, should not raise
