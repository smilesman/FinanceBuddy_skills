"""本地启动远程仓库站点（模拟 https://www.financebuddyskills.com/skills）。

用法：python serve.py [--port 5300]
- 以仓库根为文档根，静态提供 site/ api/ packages/
- / 与 /skills 重定向到技能库页面
- /build/<kind>/<id>.zip 动态打包：优先返回现成安装包，
  无包时从 details/ 即时生成（SKILL.md / README.md + config.json + meta.json），
  供内网环境离线导入使用
- 附加 CORS 头，允许服务端跨域拉取目录
"""

from __future__ import annotations

import argparse
import http.server
import io
import json
import re
import socketserver
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent

_VALID_KINDS = {"skill": "skills.json", "employee": "employees.json", "mcp": "mcps.json"}
_SAFE_ID = re.compile(r"^[0-9A-Za-z_\-\u4e00-\u9fff]+$")


def _load_detail(kind: str, safe_id: str) -> dict | None:
    path = REPO_ROOT / "details" / kind / f"{safe_id}.json"
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _catalog_entry(kind: str, safe_id: str, detail: dict) -> dict:
    """在目录 api/<kind>s.json 中查找条目，补充 description/icon 等字段。"""
    path = REPO_ROOT / "api" / _VALID_KINDS[kind]
    try:
        entries = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return {}
    name = detail.get("name") or ""
    for raw in entries:
        rid = str(raw.get("id") or raw.get("name") or "")
        if rid == detail.get("id") or (name and raw.get("name") == name):
            return raw
    return {}


def _find_existing_package(kind: str, safe_id: str) -> Path | None:
    pkg_dir = REPO_ROOT / "packages" / kind
    if not pkg_dir.is_dir():
        return None
    for p in pkg_dir.glob("*.zip"):
        stem = p.stem
        if stem == safe_id or stem.startswith(safe_id + "-"):
            return p
    return None


def _build_zip(kind: str, safe_id: str, detail: dict) -> bytes | None:
    """从详情即时生成安装包（无现成 zip 的条目）。"""
    entry = _catalog_entry(kind, safe_id, detail)
    readme = detail.get("readme") or ""
    if not readme:
        return None
    meta = {
        "format": "financebuddy-package",
        "package_version": 1,
        "kind": kind,
        "id": str(detail.get("id") or safe_id),
        "name": detail.get("name") or safe_id,
        "category": detail.get("category") or entry.get("category") or "",
        "tags": detail.get("tags") or entry.get("tags") or "",
        "item_version": detail.get("version") or str(entry.get("version") or ""),
        "icon": entry.get("icon") or "",
        "description": (entry.get("description") or "").strip(),
        "source": "official",
        "fingerprint_md5": detail.get("fingerprint_md5") or "",
    }
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("meta.json", json.dumps(meta, ensure_ascii=False, indent=1))
        if kind == "skill":
            zf.writestr("SKILL.md", readme)
        else:
            zf.writestr("README.md", readme)
            config = detail.get("config")
            if config:
                zf.writestr("config.json", json.dumps(config, ensure_ascii=False, indent=1))
    return buf.getvalue()


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
        # 动态打包端点：/build/<kind>/<safe_id>.zip
        m = re.fullmatch(r"/build/(skill|employee|mcp)/([^/]+)\.zip", path)
        if m:
            self._serve_build(m.group(1), m.group(2))
            return
        super().do_GET()

    def _serve_build(self, kind: str, safe_id: str):
        if not _SAFE_ID.match(safe_id):
            self.send_error(400, "invalid id")
            return
        # 优先返回现成安装包
        pkg = _find_existing_package(kind, safe_id)
        if pkg is not None:
            data = pkg.read_bytes()
        else:
            detail = _load_detail(kind, safe_id)
            data = _build_zip(kind, safe_id, detail) if detail else None
        if data is None:
            self.send_error(404, "package unavailable")
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Length", str(len(data)))
        self.send_header(
            "Content-Disposition", f'attachment; filename="{safe_id}.zip"'
        )
        self.end_headers()
        self.wfile.write(data)

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
        print(f"  打包:   http://localhost:{args.port}/build/skill/<id>.zip")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped.")


if __name__ == "__main__":
    main()
