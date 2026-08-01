"""
Development server launcher.

Always run this from the backend/ directory:

    # Development (hot-reload)
    python run.py

    # Production (multiple workers, no reload)
    python run.py --prod
"""

import sys
import uvicorn

DEV_CONFIG = {
    "app": "app.main:app",
    "host": "0.0.0.0",
    "port": 8000,
    "reload": True,
    "reload_dirs": ["app"],
    "log_level": "debug",
}

PROD_CONFIG = {
    "app": "app.main:app",
    "host": "0.0.0.0",
    "port": 8000,
    "workers": 4,
    "log_level": "info",
}

if __name__ == "__main__":
    config = PROD_CONFIG if "--prod" in sys.argv else DEV_CONFIG
    uvicorn.run(**config)
