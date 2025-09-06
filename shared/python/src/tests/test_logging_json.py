import os
import json
from shared_python import load_config  # noqa: F401  (ensures package init)
from shared_python.logging import init_logging, get_logger  # type: ignore

def test_json_logging(monkeypatch, capsys):
    monkeypatch.setenv("FKS_JSON_LOGS", "1")
    init_logging(force=True)
    log = get_logger("test")
    log.info("hello", extra={"foo": "bar"})
    captured = capsys.readouterr().out.strip().splitlines()[-1]
    data = json.loads(captured)
    assert data["msg"] == "hello"
    assert data["foo"] == "bar"
    assert data["level"] == "INFO"
