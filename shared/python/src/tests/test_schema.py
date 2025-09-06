import json
from pathlib import Path
from datetime import datetime, UTC
from jsonschema import validate

from shared_python.types import TradeSignal


def test_trade_signal_schema_valid():
    # tests dir: repo/shared/python/tests -> parents[3] = repo/shared/python, parents[4] = repo/shared
    # Simpler: walk up to project root then append path
    # Current file: fks/repo/shared/python/tests/test_schema.py
    # Want:        fks/repo/shared/schema/trade_signal.schema.json
    # File path: fks/repo/shared/python/tests/test_schema.py
    # Need:      fks/repo/shared/schema/trade_signal.schema.json
    # parents[0]=tests, parents[1]=python, parents[2]=shared, parents[3]=repo
    shared_dir = Path(__file__).parents[2]
    schema_path = (shared_dir / "schema" / "trade_signal.schema.json").resolve()
    with open(schema_path) as f:
        schema = json.load(f)
    model = TradeSignal(
        symbol="AAPL",
        side="LONG",
        strength=0.5,
    timestamp=datetime.now(UTC),
        strategy="mean_revert",
        meta={"source": "unit-test"},
    )
    as_dict = model.model_dump()
    as_dict["timestamp"] = model.timestamp.isoformat()
    validate(instance=as_dict, schema=schema)
