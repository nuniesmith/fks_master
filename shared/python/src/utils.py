"""Deprecated duplicate of canonical implementation in fks_shared_python.utils.

Retained temporarily to avoid breaking any legacy direct imports (``import utils``)
that may still exist in downstream code while services migrate fully to
``from fks_shared_python import ...``. All logic delegates to the canonical module.
This file will be removed in a future minor release.
"""

from __future__ import annotations

from fks_shared_python.utils import *  # type: ignore F401,F403 re-export intentionally

