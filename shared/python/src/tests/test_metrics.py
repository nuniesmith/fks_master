from fks_shared_python.metrics import (
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


def test_basic_metrics_flow():
    trades = [Trade(10, 1), Trade(-5, 0.1), Trade(3, 0.5)]
    wr = win_rate_with_costs(trades)
    assert 0 < wr < 1
    eq = cumulative_equity(trades)
    assert len(eq) == len(trades)
    mdd, peak, trough = max_drawdown(eq)
    assert peak >= trough
    calmar = calmar_ratio(eq)
    assert calmar >= 0
    ir = information_ratio([t.pnl for t in trades])
    assert isinstance(ir, float)
    es = cvar([t.pnl for t in trades], alpha=0.5)
    assert es <= 0
    sr = sharpe_ratio([t.pnl for t in trades])
    assert isinstance(sr, float)
    dd = downside_deviation([t.pnl for t in trades])
    assert dd >= 0
    so = sortino_ratio([t.pnl for t in trades])
    assert isinstance(so, float)
