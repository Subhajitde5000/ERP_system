"""
Middleware Package Init
"""

from app.middleware.request_id import RequestIDMiddleware

__all__ = ["RequestIDMiddleware"]
