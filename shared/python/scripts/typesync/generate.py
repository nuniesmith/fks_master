#!/usr/bin/env python
"""Typesync generator stub.

Currently validates presence of trade_signal.schema.json and exits 0.
In future, would (re)generate Pydantic models into types.py.
"""
from __future__ import annotations

from pathlib import Path
import sys
import json

ROOT = Path(__file__).parents[2]
schema_path = ROOT / "schema" / "trade_signal.schema.json"
if not schema_path.exists():
    print(f"Schema missing: {schema_path}", file=sys.stderr)
    sys.exit(1)
try:
    with open(schema_path, "r", encoding="utf-8") as f:
        json.load(f)
except Exception as e:  # pragma: no cover
    print(f"Invalid schema JSON: {e}", file=sys.stderr)
    sys.exit(1)
sys.exit(0)
