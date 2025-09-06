#!/usr/bin/env python3
"""Fail if new direct imports of `shared_python` (legacy alias) are added outside allowed wrappers.

Allowed patterns:
 - src/shared_python/** (the compatibility alias itself)
 - Any file matching *test* (tests may still reference for backward compatibility checks)

Usage:
  python scripts/check_no_legacy_imports.py
Returns non-zero exit if violations found.
"""
from __future__ import annotations
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATTERN = re.compile(r"^\s*(from|import)\s+shared_python(\.|\s|$)")
allowed_sub = ROOT / "src" / "shared_python"
violations: list[str] = []
for py in ROOT.rglob("*.py"):
    rel = py.relative_to(ROOT)
    if allowed_sub in py.parents:
        continue
    name_lower = rel.name.lower()
    if "test" in name_lower:
        continue
    try:
        text = py.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        continue
    for i, line in enumerate(text.splitlines(), 1):
        if PATTERN.search(line):
            violations.append(f"{rel}:{i}:{line.strip()}")

if violations:
    print("Found legacy shared_python imports (use fks_shared_python):", file=sys.stderr)
    for v in violations:
        print("  "+v, file=sys.stderr)
    sys.exit(1)
else:
    print("No legacy shared_python imports found.")
