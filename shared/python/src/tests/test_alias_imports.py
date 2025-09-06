from fks_shared_python.config import get_settings  # type: ignore
from fks_shared_python import get_settings as get_settings_alt  # type: ignore
from fks_shared_python.logging import init_logging  # type: ignore


def test_alias_imports():
    s1 = get_settings()
    s2 = get_settings_alt()
    assert s1.APP_ENV == s2.APP_ENV
    init_logging(force=True)
