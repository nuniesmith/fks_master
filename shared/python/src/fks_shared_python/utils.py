from __future__ import annotations
from .config import get_settings
from .exceptions import RiskLimitExceeded, DataValidationError
from typing import Sequence, List, Tuple
import math, statistics
try: import numpy as _np  # type: ignore
except Exception: _np = None  # pragma: no cover

def get_risk_threshold(equity: float | int) -> float:
    return float(equity) * float(get_settings().RISK_MAX_PER_TRADE)

def enforce_risk(requested: float, equity: float | int) -> float:
    max_allowed = get_risk_threshold(equity)
    if requested > max_allowed: raise RiskLimitExceeded(requested=requested, max_allowed=max_allowed)
    return requested

def zscore_outliers(series: Sequence[float], threshold: float = 3.0) -> List[int]:
    """Identify outliers using standard z-score with a robust fallback.

    Strategy:
    1. Try population z-score (fast, vectorized if numpy available).
    2. If no points exceed threshold, fall back to a robust median/MAD heuristic
       to catch single extreme values in an otherwise tight distribution
       (e.g., [1,1,1,1,10]) that standard z-score can under-emphasize.
    """
    if not series:
        return []
    # Primary (standard z-score)
    if _np is not None:
        arr = _np.asarray(series, dtype=float)
        m = float(arr.mean())
        std = float(arr.std(ddof=0)) or 1e-9
        z = _np.abs((arr - m) / std)
        primary = [int(i) for i, v in enumerate(z) if v > threshold]
        if primary:
            return primary
    else:
        n = len(series)
        m = sum(series) / n
        var = sum((x - m) ** 2 for x in series) / n
        std = math.sqrt(var) or 1e-9
        primary = [i for i, v in enumerate(series) if abs((v - m) / std) > threshold]
        if primary:
            return primary
    # Robust fallback (median & MAD). If MAD==0, use mean absolute deviation.
    med = statistics.median(series)
    abs_dev = [abs(x - med) for x in series]
    mad = statistics.median(abs_dev)
    if mad == 0:
        mean_ad = (sum(abs_dev) / len(abs_dev)) or 1e-9
        return [i for i, dev in enumerate(abs_dev) if (dev / mean_ad) > threshold]
    robust_z = [0.6745 * (x - med) / mad for x in series]
    return [i for i, v in enumerate(robust_z) if abs(v) > threshold]

def kmeans_regimes(series: Sequence[float], k: int = 3, max_iter: int = 50) -> List[int]:
    if not series: return []
    vals = [float(v) for v in series]; uniq = sorted(set(vals))
    if len(uniq) <= k: mapping = {v:i for i,v in enumerate(uniq)}; return [mapping[v] for v in vals]
    step = max(1, len(uniq)//k); centroids = [uniq[min(i*step, len(uniq)-1)] for i in range(k)]
    for _ in range(max_iter):
        labels = [min(range(k), key=lambda ci: abs(val-centroids[ci])) for val in vals]; new_centroids: List[float] = []; changed = False
        for ci in range(k):
            cluster_points = [v for v,lab in zip(vals,labels) if lab==ci]; nc = sum(cluster_points)/len(cluster_points) if cluster_points else centroids[ci]
            if abs(nc-centroids[ci])>1e-12: changed=True
            new_centroids.append(nc)
        centroids = new_centroids
        if not changed: break
    return labels

def bid_ask_spread(bid: float, ask: float) -> float:
    if ask <=0 or bid <=0: raise DataValidationError("Bid/Ask must be > 0", {"bid": bid, "ask": ask})
    if ask < bid: raise DataValidationError("Ask must be >= Bid", {"bid": bid, "ask": ask})
    return (ask - bid)/((ask + bid)/2.0)

def price_divergence(series_a: Sequence[float], series_b: Sequence[float]) -> float:
    if len(series_a)!=len(series_b) or not series_a: raise DataValidationError("Series length mismatch or empty", {"len_a": len(series_a), "len_b": len(series_b)})
    if _np is not None:
        a=_np.asarray(series_a,dtype=float); b=_np.asarray(series_b,dtype=float); return float(_np.mean(_np.abs(a-b)/(_np.abs(b)+1e-9)))
    acc=0.0
    for x,y in zip(series_a, series_b): acc += abs(x-y)/(abs(y)+1e-9)
    return acc/len(series_a)

def cyclical_encode(value: float, period: float) -> Tuple[float,float]:
    if period <= 0: raise DataValidationError("Period must be positive", {"period": period})
    angle = (value % period)/period * 2*math.pi; return math.sin(angle), math.cos(angle)

__all__ = ["get_risk_threshold","enforce_risk","zscore_outliers","kmeans_regimes","bid_ask_spread","price_divergence","cyclical_encode"]
