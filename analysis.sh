#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-.}"
ARGS=("$TARGET_DIR")
if [[ "${ANALYSIS_FULL:-false}" == "true" ]]; then ARGS=(--full "${ARGS[@]}"); fi
if [[ "${ANALYSIS_OUTPUT_DIR:-""}" != "" ]]; then ARGS=(--output="$ANALYSIS_OUTPUT_DIR" "${ARGS[@]}"); fi
ARGS=(--lint "${ARGS[@]}")
if [[ -f "$SCRIPT_DIR/scripts/utils/analyze_codebase.sh" ]]; then
  bash "$SCRIPT_DIR/scripts/utils/analyze_codebase.sh" "${ARGS[@]}"
else
  echo "Base analyzer not found at scripts/utils/analyze_codebase.sh" >&2
  exit 1
fi
