# Changelog

## 0.2.0 - 2025-08-31

### Added

- Canonical namespace `fks_shared_python` with consolidated modules.
- Robust median/MAD fallback in `zscore_outliers`.
- Explicit stdout JSON logging (force reconfigure) when `FKS_JSON_LOGS=1`.

### Changed

- Logging initialization now uses `force=True` to avoid handler duplication during tests.
- Legacy duplicate modules replaced by wrappers re-exporting canonical implementations.

### Removed

- Duplicate mid-file implementations that produced `SyntaxError` (legacy artifacts).

### Deprecated

- `shared_python` alias (will remain until at least 0.4.0). Use `fks_shared_python` instead.

## 0.1.0 - 2025-08-31

- Initial extracted shared primitives (pre-consolidation).
