"""Service‑agnostic shared Python utilities.

Canonical import path: ``fks_shared_python``.
Legacy alias supported (deprecated): ``shared_python``.
"""

from .config import load_config, get_settings, reload_settings_cache  # config
from .logging import init_logging, get_logger  # logging
from .exceptions import (
    RiskLimitExceeded,
    DataFetchError,
    DataValidationError,
    ModelError,
)
from .types import (
    TradeSignal,
    BaselineModelParams,
    RiskParams,
    PositionSizingResult,
    MarketBar,
)
from .utils import (
    get_risk_threshold,
    enforce_risk,
    zscore_outliers,
    kmeans_regimes,
    bid_ask_spread,
    price_divergence,
    cyclical_encode,
)
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
)
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
)
from .simulation import (
    apply_slippage,
    simulate_gbm,
    monte_carlo_pnl,
    ood_score,
)

__all__ = [
    "load_config",
    "get_settings",
    "reload_settings_cache",
    "init_logging",
    "get_logger",
    "RiskLimitExceeded",
    "DataFetchError",
    "DataValidationError",
    "ModelError",
    "TradeSignal",
    "BaselineModelParams",
    "RiskParams",
    "PositionSizingResult",
    "MarketBar",
    "get_risk_threshold",
    "enforce_risk",
    "zscore_outliers",
    "kmeans_regimes",
    "bid_ask_spread",
    "price_divergence",
    "cyclical_encode",
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
    "apply_slippage",
    "simulate_gbm",
    "monte_carlo_pnl",
    "ood_score",
]
