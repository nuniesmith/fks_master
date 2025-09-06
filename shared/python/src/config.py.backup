from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Dict

from dotenv import dotenv_values
from pydantic import BaseModel, ConfigDict

_DEFAULTS: Dict[str, str] = {
    "APP_ENV": "dev",
    "LOG_LEVEL": "INFO",
    "RISK_MAX_PER_TRADE": "0.01",
    "DEBUG_MODE": "false",
}


def _find_env_file() -> Path | None:
    cur = Path.cwd()
    for _ in range(10):
        candidate = cur / ".env"
        if candidate.exists():
            return candidate
        if cur.parent == cur:
            break
        cur = cur.parent
    return None


def load_config() -> Dict[str, str]:
    data = dict(_DEFAULTS)
    env_file = _find_env_file()
    if env_file:
        data.update({k: v for k, v in dotenv_values(env_file).items() if v is not None})
    data.update({k: v for k, v in os.environ.items() if v is not None})
    return data


class Settings(BaseModel):
    APP_ENV: str
    LOG_LEVEL: str
    RISK_MAX_PER_TRADE: float
    DEBUG_MODE: bool

    model_config = ConfigDict(extra="allow")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    raw = load_config()
    debug_bool = str(raw.get("DEBUG_MODE", "false")).lower() in {"1", "true", "yes", "on"}
    extras = {k: v for k, v in raw.items() if k not in {"APP_ENV", "LOG_LEVEL", "RISK_MAX_PER_TRADE", "DEBUG_MODE"}}
    return Settings(
        APP_ENV=raw["APP_ENV"],
        LOG_LEVEL=raw["LOG_LEVEL"],
        RISK_MAX_PER_TRADE=float(raw["RISK_MAX_PER_TRADE"]),
        DEBUG_MODE=debug_bool,
        **extras,
    )


def reload_settings_cache() -> None:
    get_settings.cache_clear()  # type: ignore[attr-defined]
