import logging, json, os, sys
from datetime import datetime, UTC
from typing import Any, Dict
from .config import get_settings

_LOGGER_INITIALIZED = False

class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:  # type: ignore[override]
        base: Dict[str, Any] = {"ts": datetime.fromtimestamp(record.created, UTC).isoformat().replace("+00:00", "Z"), "level": record.levelname, "logger": record.name, "msg": record.getMessage()}
        if record.exc_info:
            base["exc_info"] = self.formatException(record.exc_info)
        for k, v in record.__dict__.items():
            if k.startswith("_") or k in ("name","msg","args","levelname","levelno","pathname","filename","module","exc_info","exc_text","stack_info","lineno","funcName","created","msecs","relativeCreated","thread","threadName","process","processName"):
                continue
            try:
                json.dumps(v)
                base[k] = v
            except Exception:  # pragma: no cover
                base[k] = repr(v)
        return json.dumps(base, separators=(",", ":"))

def init_logging(force: bool = False) -> None:
    global _LOGGER_INITIALIZED
    if _LOGGER_INITIALIZED and not force:
        return
    settings = get_settings()
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    json_logs = os.getenv("FKS_JSON_LOGS", "0").lower() in {"1", "true", "yes"}
    if json_logs:
        handler = logging.StreamHandler(stream=sys.stdout)
        handler.setFormatter(_JsonFormatter())
        logging.basicConfig(level=level, handlers=[handler], force=True)
    else:
        logging.basicConfig(level=level, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s", force=True, stream=sys.stdout)
    _LOGGER_INITIALIZED = True

def get_logger(name: str) -> logging.Logger:
    if not _LOGGER_INITIALIZED:
        init_logging()
    return logging.getLogger(name)
