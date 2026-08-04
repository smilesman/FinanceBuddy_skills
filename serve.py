"""本地启动远程仓库站点（模拟 https://www.financebuddyskills.com/skills）。

用法：python serve.py [--port 5300]
- 以仓库根为文档根，静态提供 site/ api/ packages/
- / 与 /skills 重定向到技能库页面
- 附加 CORS 头，允许服务端跨域拉取目录
"""

from __future__ import annotations

import argparse
import http.server
import socketserver
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent


class WarehouseHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0].rstrip("/")
        if path in ("", "/skills", "/site", "/index.html"):
            self.send_response(302)
            self.send_header("Location", "/site/index.html")
            self.end_headers()
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        print(f"[warehouse] {self.address_string()} - {fmt % args}")


def main():
    parser = argparse.ArgumentParser(description="FinanceBuddy skills warehouse server")
    parser.add_argument("--port", type=int, default=5300)
    args = parser.parse_args()

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("0.0.0.0", args.port), WarehouseHandler) as httpd:
        print(f"FinanceBuddy Skills Warehouse running:")
        print(f"  站点:   http://localhost:{args.port}/skills")
        print(f"  目录API: http://localhost:{args.port}/api/skills.json")
        print(f"  清单:   http://localhost:{args.port}/api/manifest.json")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped.")


if __name__ == "__main__":
    main()
