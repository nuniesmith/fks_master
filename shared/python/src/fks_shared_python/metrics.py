from __future__ import annotations
from dataclasses import dataclass
from typing import Iterable, Sequence, List, Tuple
import math

@dataclass(frozen=True)
class Trade: pnl: float; fees: float = 0.0; capital: float | None = None

def win_rate_with_costs(trades: Sequence[Trade]) -> float:
    if not trades: return 0.0
    return sum(1 for t in trades if (t.pnl - t.fees) > 0)/len(trades)

def cumulative_equity(trades: Sequence[Trade]) -> List[float]:
    eq=[]; run=0.0
    for t in trades: run += (t.pnl - t.fees); eq.append(run)
    return eq

def max_drawdown(equity: Sequence[float]) -> Tuple[float,float,float]:
    peak=float("-inf"); max_dd=0.0; dd_peak=0.0; dd_trough=0.0
    for v in equity:
        if v>peak: peak=v
        dd=v-peak
        if dd<max_dd: max_dd=dd; dd_peak=peak; dd_trough=v
    return max_dd, dd_peak, dd_trough

def calmar_ratio(equity: Sequence[float], annual_return: float | None = None, periods_per_year: int = 252) -> float:
    if not equity: return 0.0
    final=equity[-1]
    if annual_return is None: annual_return=(final if final!=0 else 0.0)*(periods_per_year/max(1,len(equity)))
    max_dd,*_ = max_drawdown(equity)
    if max_dd==0: return 0.0
    return annual_return/abs(max_dd)

def information_ratio(returns: Iterable[float], benchmark_returns: Iterable[float] | None = None) -> float:
    r=list(returns)
    if not r: return 0.0
    if benchmark_returns is None: active=r
    else:
        b=list(benchmark_returns)
        if len(b)!=len(r): raise ValueError("Length mismatch returns vs benchmark")
        active=[ri-bi for ri,bi in zip(r,b)]
    mean=sum(active)/len(active); var=sum((x-mean)**2 for x in active)/(len(active)-1) if len(active)>1 else 0.0; std=math.sqrt(var)
    return 0.0 if std==0 else mean/std

def cvar(returns: Sequence[float], alpha: float = 0.05) -> float:
    if not returns: return 0.0
    losses=sorted(r for r in returns if r<0)
    if not losses: return 0.0
    k=max(1,int(len(losses)*alpha)); tail=losses[:k]; return sum(tail)/len(tail)

def sharpe_ratio(returns: Sequence[float], risk_free: float = 0.0) -> float:
    if not returns: return 0.0
    adj=[r-risk_free for r in returns]; mean=sum(adj)/len(adj)
    if len(adj)<2: return 0.0
    var=sum((x-mean)**2 for x in adj)/(len(adj)-1); std=math.sqrt(var); return 0.0 if std==0 else mean/std

def downside_deviation(returns: Sequence[float], mar: float = 0.0) -> float:
    if not returns: return 0.0
    downs=[min(0.0, r-mar) for r in returns]
    if not any(downs): return 0.0
    sq=sum(d**2 for d in downs)/len(returns); return math.sqrt(sq)

def sortino_ratio(returns: Sequence[float], mar: float = 0.0) -> float:
    if not returns: return 0.0
    mean_excess=sum(r-mar for r in returns)/len(returns); dd=downside_deviation(returns, mar=mar); return 0.0 if dd==0 else mean_excess/dd

__all__=["Trade","win_rate_with_costs","cumulative_equity","max_drawdown","calmar_ratio","information_ratio","cvar","sharpe_ratio","downside_deviation","sortino_ratio"]
