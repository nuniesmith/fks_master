from fks_shared_python.types import RiskParams
from fks_shared_python.risk import composite_with_hedge, regime_uncertainty_score, hedge_position_size


def test_uncertainty_and_hedge_integration():
    params = RiskParams()
    # base composite side long
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
        ood_score=0.7,
    )
    assert "uncertainty_score" in (res.meta or {})
    assert (res.meta or {})["hedge_size"] <= 0  # hedge reduces exposure

    u_low = regime_uncertainty_score(0.1, 0.1)
    u_high = regime_uncertainty_score(0.95, 0.95)
    assert u_high > u_low

    hedge = hedge_position_size(100, 0.5)
    assert hedge == -25  # 100 * 0.5 * 0.5
