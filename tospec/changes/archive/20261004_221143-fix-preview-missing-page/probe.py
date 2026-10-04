# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright>=1.40"]
# ///
"""Feedback loop for fix-preview-missing-page: uv run tospec/changes/fix-preview-missing-page/probe.py

A workspace whose demo project has storyboard.json but no index.html yet (the
state from the storyboard's writing until Build), served by start.mjs and
opened in a headless browser. Exits 1 (RED) while the preview mounts the page
and sits in "loading"; exits 0 (GREEN) once it shows the missing-page hint
instead, and switches to the page by itself when index.html appears.
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parents[3]
STUDIO = REPO / "skills/cinematic-video/studio"
LOADING = "正在載入預覽"
TIMEOUT = "頁面一直沒有準備好"
MISSING = "還沒有畫面"
SETTLE_MS = 4000


def node(script, workspace, *args):
    out = subprocess.run(["node", str(STUDIO / script), "--workspace", str(workspace), *args], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"{script} failed: {out.stderr}")
    return json.loads(out.stdout)


# render.py's order: Playwright's Chromium, then the installed browsers.
def launch(p):
    for kw in ({}, {"channel": "chrome"}, {"channel": "msedge"}):
        try:
            return p.chromium.launch(headless=True, **kw)
        except Exception:
            continue
    sys.exit("no browser to run the probe in")


def preview_state(page):
    text = page.inner_text("body")
    return {
        "loading": LOADING in text,
        "timeout": TIMEOUT in text,
        "missing": MISSING in text,
        "iframe": page.query_selector('iframe[title="demo"]') is not None,
    }


workspace = Path(tempfile.mkdtemp(prefix="preview-probe-"))
(workspace / "studio.config.json").write_text('{"skillVersion":"0.1.0"}')
shutil.copytree(REPO / "fixtures/demo", workspace / "video/demo")
page_html = (workspace / "video/demo/index.html").read_text(encoding="utf8")
(workspace / "video/demo/index.html").unlink()

url = node("start.mjs", workspace, "--no-open")["url"]
failed = False
try:
    with sync_playwright() as p:
        browser = launch(p)
        page = browser.new_page(locale="zh-TW")
        page.goto(url)
        page.wait_for_timeout(SETTLE_MS)
        before = preview_state(page)
        print("without index.html:", before)
        failed |= before["loading"] or before["timeout"] or before["iframe"] or not before["missing"]

        (workspace / "video/demo/index.html").write_text(page_html, encoding="utf8")
        page.wait_for_timeout(SETTLE_MS)
        after = preview_state(page)
        print("after index.html appears:", after)
        failed |= after["loading"] or after["timeout"] or after["missing"] or not after["iframe"]
        browser.close()
finally:
    node("stop.mjs", workspace)
    shutil.rmtree(workspace, ignore_errors=True)

print("RED" if failed else "GREEN")
sys.exit(1 if failed else 0)
