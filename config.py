import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

def load_env():
    """Simple zero-dependency .env loader for standard Python."""
    if not ENV_FILE.exists():
        return
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception as e:
        print(f"[config] Notice: Could not parse .env file: {e}")

load_env()

# Bot Token from @BotFather
BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()

# HTTPS URL where webapp/index.html is hosted (e.g. GitHub Pages, Vercel, or ngrok/cloudflared)
# NOTE: Telegram WebApps require an HTTPS URL.
WEBAPP_URL = os.environ.get("WEBAPP_URL", "https://your-domain.com/arrows").strip()

# Local Web Server Port for hosting webapp
PORT = int(os.environ.get("PORT", "8080"))
