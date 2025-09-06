from fks_shared_python.simulation import (
    apply_slippage,
    simulate_gbm,
    monte_carlo_pnl,
    ood_score,
)


def test_simulation_helpers():
    price = apply_slippage(100, volume=500, liquidity_depth=10_000)
    assert price >= 100
    path = simulate_gbm(100, mu=0.05, sigma=0.2, steps=5)
    assert len(path) == 6
    def gen():
        return [100, 101, 102]
    def strat(p):  # simple strategy
        return p[-1] - p[0]
    pnls = monte_carlo_pnl(gen, strat, runs=3)
    assert len(pnls) == 3
    score = ood_score([1,2,3], 2, 1)
    assert score >= 0
