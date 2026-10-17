import http.server
import socketserver
import os
import sys
from pathlib import Path

# Fix Windows console UTF-8 emoji encoding
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

BASE_DIR = Path(__file__).resolve().parent
WEBAPP_DIR = BASE_DIR / "webapp"
PORT = 8080

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEBAPP_DIR), **kwargs)

    def log_message(self, format, *args):
        # Keep terminal clean with timestamped access
        sys.stdout.write(f"[Server] {self.address_string()} - {format % args}\n")

def run():
    os.chdir(WEBAPP_DIR)
    with socketserver.TCPServer(("", PORT), QuietHandler) as httpd:
        print("\n" + "=" * 65)
        print(f"🌐 Local Game Web Server running at: http://localhost:{PORT}")
        print("=" * 65)
        print("💡 NOTE FOR TELEGRAM MINI APPS:")
        print("Telegram requires an HTTPS URL to open WebApps.")
        print("Aap apne game ko 2 tariko se HTTPS URL de sakte hain:")
        print("\nOption A (Instant Local Tunnel for Testing):")
        print(f"  • Naya terminal kholein aur run karein:")
        print(f"      npx localtunnel --port {PORT}")
        print(f"    ya")
        print(f"      ngrok http {PORT}")
        print("  • Jo `https://...` URL mile usko `.env` me `WEBAPP_URL` par daalein.\n")
        print("Option B (Permanent Free Hosting - Recommended):")
        print("  • `webapp/index.html` ko GitHub Pages ya Vercel par free host karein.")
        print("  • Vercel / GitHub Pages se milne wale permanent HTTPS URL ko `.env` me daalein.")
        print("=" * 65 + "\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped.")

if __name__ == "__main__":
    run()
