# fks_shared_python (service‑agnostic utilities)

Shared, reusable Python primitives for any FKS service (ingestion, training, inference, web, workers) without referencing concrete service packages. Keep this package lean and side‑effect free.

## Provided Modules

| Area | Highlights |
|------|------------|
| config | `load_config()`, `get_settings()`, cached env+`.env` loader |
| logging | `init_logging()` JSON or plain; `get_logger()` |
| exceptions | `RiskLimitExceeded`, `DataFetchError`, `DataValidationError`, `ModelError` |
| types | `TradeSignal`, `RiskParams`, `MarketBar`, etc. |
| utils | Light preprocessing + feature helpers (z-score outliers, k-means 1D, cyclical encode) |
| risk | Position sizing (Kelly, vol targeting, composite), ATR, portfolio (min variance, risk parity), hedging overlay |
| metrics | Win rate, drawdown, Calmar, Sharpe/Sortino, CVaR, info ratio |
| simulation | Slippage, GBM paths, Monte Carlo PnL, OOD score |

## Design Rules

1. No imports from any `fks_*` service.
2. Optional heavy deps are guarded (NumPy optional, falls back to pure Python).
3. Deterministic, stateless helpers (except cached settings & logging init).
4. Backwards compatibility: legacy alias `shared_python` may still work during migration; canonical namespace is `fks_shared_python`.

## Install (editable) inside a service

From a service root (example `fks_data/`):

```bash
pip install -e ../shared/shared_python
```

Or add as git submodule first:

```bash
git submodule add ../../shared/shared_python shared_python  # relative example
pip install -e shared_python
```

## Quick Usage

```python
from fks_shared_python import get_settings, RiskParams, composite_with_hedge

settings = get_settings()
params = RiskParams()
res = composite_with_hedge(
	equity=100_000,
	price=25_000,
	side=1,
	win_prob=0.55,
	win_loss_ratio=1.2,
	recent_vol=0.4,
	avg_correlation=0.5,
	confidence=0.7,
	params=params,
	normalized_vol=0.9,
	ood_score=0.6,
)
print(res.position_size, res.meta["uncertainty_score"])
```

Enable structured JSON logs:

```bash
export FKS_JSON_LOGS=1
```

## Core Environment Variables

| Var | Description | Default |
|-----|-------------|---------|
| APP_ENV | Environment name | dev |
| LOG_LEVEL | Logging level | INFO |
| RISK_MAX_PER_TRADE | Fraction of equity per trade | 0.01 |
| DEBUG_MODE | Extra debug toggles | false |

Settings precedence: process env > nearest `.env` upward search > internal defaults.

## Tests & Optional Extras

```bash
pip install .[num]  # to enable numpy acceleration (optional)
pytest -q
```

## Contributing

Add only primitives used (or planned) across multiple services. If logic is niche to one service place it in that service repo instead.

## Versioning

Tag releases (`v0.x.y`) and have services pin commit hashes or versions. Remove legacy `shared_python` alias when downstream imports fully migrated.

### 0.2.0 (current)

- Introduced canonical package `fks_shared_python` (all core modules consolidated)
- Legacy top-level duplicate modules replaced by thin wrappers
- Removed accidental mid-file duplicate definitions causing SyntaxErrors
- Added robust fallback to `zscore_outliers` (median/MAD) for single extreme detection
- JSON logging now forces stdout handler reliably when `FKS_JSON_LOGS=1`
- Backwards compatibility alias: `import shared_python` still works but will be deprecated; migrate to `fks_shared_python`.

Planned removal of alias: earliest `0.4.0` (announce again in `0.3.x`).
