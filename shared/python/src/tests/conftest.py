import pytest


@pytest.fixture(autouse=True)
def _set_env(monkeypatch):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("RISK_MAX_PER_TRADE", "0.02")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    yield
