import sys

# Allow legacy absolute imports such as `from app.services import ...`
# when the package is loaded as `backend.app`.
sys.modules.setdefault("app", sys.modules[__name__])
