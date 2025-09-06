class RiskLimitExceeded(Exception):
    def __init__(self, requested: float, max_allowed: float):
        super().__init__(f"Risk limit exceeded: requested={requested:.4f} > max_allowed={max_allowed:.4f}")
        self.requested = requested; self.max_allowed = max_allowed

class DataFetchError(Exception):
    def __init__(self, source: str, detail: str | None = None):
        msg = f"Data fetch failed from source='{source}'" + (f": {detail}" if detail else "")
        super().__init__(msg); self.source = source; self.detail = detail

class DataValidationError(Exception):
    def __init__(self, issue: str, context: dict | None = None):
        super().__init__(f"Data validation error: {issue}"); self.issue = issue; self.context = context or {}

class ModelError(Exception):
    def __init__(self, message: str, context: dict | None = None):
        super().__init__(message); self.context = context or {}

__all__ = ["RiskLimitExceeded","DataFetchError","DataValidationError","ModelError"]
