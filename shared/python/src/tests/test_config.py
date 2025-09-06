from shared_python.config import get_settings, reload_settings_cache


def test_settings_load():
    reload_settings_cache()
    s = get_settings()
    assert s.APP_ENV == "test"
    assert abs(s.RISK_MAX_PER_TRADE - 0.02) < 1e-9
