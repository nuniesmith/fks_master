from fks_shared_python.types import RiskParams, PositionSizingResult
from fks_shared_python.risk import (
    kelly_fraction,
    fractional_position,
    volatility_target_position,
    composite_position,
    average_true_range,
    atr_trailing_stop,
    min_variance_weights,
    risk_parity_weights,
)


def test_basic_kelly():
    k = kelly_fraction(0.55, 1.0)
    assert 0 <= k <= 1


def test_fractional_and_vol_target():
    params = RiskParams()
    f_units = fractional_position(10_000, 0.01, 100, 1)
    vt_units = volatility_target_position(10_000, recent_vol=0.5, params=params, price=100, side=1)
    assert f_units > 0
    assert vt_units > 0


def test_composite_position():
    params = RiskParams()
    res = composite_position(
        equity=50_000,
        price=25_000,
        side=1,
        win_prob=0.55,
        win_loss_ratio=1.2,
        recent_vol=0.4,
        avg_correlation=0.9,
        confidence=0.8,
        params=params,
    )
    assert isinstance(res, PositionSizingResult)
    assert res.position_size != 0


def test_atr_and_stop():
    high = [10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]
    low = [9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]
    close = [9.5,10.5,11.5,12.5,13.5,14.5,15.5,16.5,17.5,18.5,19.5,20.5,21.5,22.5,23.5]
    atr = average_true_range(high, low, close, period=5)
    stop = atr_trailing_stop(entry_price=24, atr=atr, atr_mult=2, side=1)
    assert stop < 24


def test_portfolio_weights():
    cov = [
        [0.04, 0.01, 0.0],
        [0.01, 0.09, 0.02],
        [0.0, 0.02, 0.16],
    ]
    w_mv, var_mv = min_variance_weights(cov)
    assert len(w_mv) == 3
    w_rp, it = risk_parity_weights(cov, max_iter=50)
    assert len(w_rp) == 3
