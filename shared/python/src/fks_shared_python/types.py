from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Literal, Optional, Dict, Any

class TradeSignal(BaseModel):
    symbol: str; side: Literal["LONG","SHORT"]; strength: float = Field(ge=0, le=1); timestamp: datetime; strategy: str; meta: dict | None

class BaselineModelParams(BaseModel):
    model_type: Literal["xgboost","catboost"]
    max_depth: Optional[int] = Field(default=None, ge=1, le=32)
    learning_rate: Optional[float] = Field(default=None, gt=0, le=1)
    n_estimators: Optional[int] = Field(default=None, ge=10, le=10000)
    subsample: Optional[float] = Field(default=None, gt=0, le=1)
    colsample_bytree: Optional[float] = Field(default=None, gt=0, le=1)
    random_state: Optional[int] = None
    extra: Dict[str, Any] | None = None
    def effective_params(self) -> Dict[str, Any]:
        out = self.model_dump(exclude_none=True); mt = out.pop("model_type","xgboost"); extra = out.pop("extra", None) or {}; return {"model_type": mt, **out, **extra}

class RiskParams(BaseModel):
    max_risk_per_trade: float = Field(gt=0, le=0.2, default=0.01)
    target_vol: float | None = Field(default=None, gt=0, le=2)
    max_leverage: float = Field(gt=0, le=50, default=5)
    correlation_cap: float = Field(ge=0, le=1, default=0.85)
    confidence_floor: float = Field(gt=0, le=1, default=0.25)
    confidence_ceiling: float = Field(gt=0, le=5, default=2.0)

class PositionSizingResult(BaseModel):
    position_size: float; leverage: float; method: Literal["kelly","fractional","vol_target","correlation_adjusted","composite"]; meta: Dict[str, Any] | None = None

class MarketBar(BaseModel):
    ts: int = Field(ge=0); open: float; high: float; low: float; close: float; volume: float = Field(ge=0); provider: Optional[str] = None
    @property
    def ohlc_tuple(self) -> tuple[float, float, float, float]: return (self.open, self.high, self.low, self.close)

__all__ = ["TradeSignal","BaselineModelParams","RiskParams","PositionSizingResult","MarketBar"]
