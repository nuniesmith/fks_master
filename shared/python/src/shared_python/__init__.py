"""Backward compatibility alias for ``shared_python`` (deprecated)."""
import sys as _sys, importlib as _importlib
import shared_python as _real
from shared_python import *  # noqa: F401,F403
__all__ = _real.__all__  # type: ignore
__path__ = _real.__path__
for _m in ["config","logging","exceptions","types","utils","risk","metrics","simulation"]:
    _sys.modules[f"shared_python.{_m}"] = _importlib.import_module(f"shared_python.{_m}")
