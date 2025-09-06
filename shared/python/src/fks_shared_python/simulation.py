from __future__ import annotations
from typing import List, Sequence, Callable
import math, random

def apply_slippage(price: float, volume: float, liquidity_depth: float, impact_coef: float = 1.0) -> float:
    if liquidity_depth <=0: return price
    slip = impact_coef * price * math.sqrt(max(0.0, volume)/liquidity_depth); return price + slip

def simulate_gbm(start_price: float, mu: float, sigma: float, steps: int, dt: float = 1/252) -> List[float]:
    prices=[start_price]
    for _ in range(steps): z=random.gauss(0,1); next_p=prices[-1]*math.exp((mu - 0.5 * sigma**2)*dt + sigma*math.sqrt(dt)*z); prices.append(next_p)
    return prices

def monte_carlo_pnl(path_generator: Callable[[], Sequence[float]], strategy: Callable[[Sequence[float]], float], runs: int = 100) -> List[float]:
    pnls=[]
    for _ in range(runs): path=path_generator(); pnls.append(strategy(path))
    return pnls

def ood_score(values: Sequence[float], reference_mean: float, reference_std: float) -> float:
    if reference_std==0 or not values: return 0.0
    acc=0.0
    for v in values: acc += abs((v - reference_mean)/reference_std)
    return acc/len(values)

__all__=["apply_slippage","simulate_gbm","monte_carlo_pnl","ood_score"]
