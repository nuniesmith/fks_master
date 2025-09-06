"""Service‑agnostic shared Python utilities.

This package MUST avoid referencing any concrete service names (fks_api, fks_data, etc.).
Only generic domain concepts are exposed so any service (ingestion, training, web, batch)
can depend on a stable surface.

Public surface aggregated here for ergonomic imports:

from fks_shared_python import get_settings, Trade, composite_position, RiskParams

Add new exports ONLY if they are broadly reusable across >1 service.
"""

from .config import load_config, get_settings, reload_settings_cache  # config
from .logging import init_logging, get_logger  # logging
from .exceptions import (
    RiskLimitExceeded,
    DataFetchError,
    DataValidationError,
    ModelError,
)  # exceptions
from .types import (
    TradeSignal,
    BaselineModelParams,
    RiskParams,
    PositionSizingResult,
    MarketBar,
)  # types
from .utils import (
    get_risk_threshold,
    enforce_risk,
    zscore_outliers,
    kmeans_regimes,
    bid_ask_spread,
    price_divergence,
    cyclical_encode,
)  # light utils
from .risk import (
    kelly_fraction,
    fractional_position,
    volatility_target_position,
    correlation_sizing,
    dynamic_confidence_scale,
    composite_position,
    average_true_range,
    atr_trailing_stop,
    min_variance_weights,
    risk_parity_weights,
    regime_uncertainty_score,
    hedge_position_size,
    composite_with_hedge,
)  # risk & portfolio
from .metrics import (
    Trade,
    win_rate_with_costs,
    cumulative_equity,
    max_drawdown,
    calmar_ratio,
    information_ratio,
    cvar,
    sharpe_ratio,
    downside_deviation,
    sortino_ratio,
)  # metrics
from .simulation import (
    apply_slippage,
    simulate_gbm,
    monte_carlo_pnl,
    ood_score,
)  # simulation

__all__ = [
    # config
    "load_config",
    "get_settings",
    "reload_settings_cache",
    # logging
    "init_logging",
    "get_logger",
    # exceptions
    "RiskLimitExceeded",
    "DataFetchError",
    "DataValidationError",
    "ModelError",
    # types
    "TradeSignal",
    "BaselineModelParams",
    "RiskParams",
    "PositionSizingResult",
    "MarketBar",
    # lightweight utils
    "get_risk_threshold",
    "enforce_risk",
    "zscore_outliers",
    "kmeans_regimes",
    "bid_ask_spread",
    "price_divergence",
    "cyclical_encode",
    # risk & portfolio
    "kelly_fraction",
    "fractional_position",
    "volatility_target_position",
    "correlation_sizing",
    "dynamic_confidence_scale",
    "composite_position",
    "average_true_range",
    "atr_trailing_stop",
    "min_variance_weights",
    "risk_parity_weights",
    "regime_uncertainty_score",
    "hedge_position_size",
    "composite_with_hedge",
    # metrics
    "Trade",
    "win_rate_with_costs",
    "cumulative_equity",
    "max_drawdown",
    "calmar_ratio",
    "information_ratio",
    "cvar",
    "sharpe_ratio",
    "downside_deviation",
    "sortino_ratio",
    # simulation
    "apply_slippage",
    "simulate_gbm",
    "monte_carlo_pnl",
    "ood_score",
]

