"""
Legacy compatibility entrypoint.

The application now runs as four separate services. This module keeps the old
import path working by exposing the reception service app.
"""

from app.service_apps import reception_app as app
