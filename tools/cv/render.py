"""Render tools/cv/cv.html jadi public/Nehemiah-Wilhelmus-Junaidi-CV.pdf (A4, satu halaman).

Pakai: python tools/cv/render.py   (butuh playwright + chromium)
Gagal kalau hasilnya lebih dari satu halaman, biar CV gak diam-diam kepotong.
"""
import pathlib
import re
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "tools" / "cv" / "cv.html"
OUT = ROOT / "public" / "Nehemiah-Wilhelmus-Junaidi-CV.pdf"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(SRC.as_uri(), wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    page.pdf(path=str(OUT), format="A4", print_background=True, prefer_css_page_size=True)
    browser.close()

pages = len(re.findall(rb"/Type\s*/Page[^s]", OUT.read_bytes()))
print(f"{OUT.name}: {OUT.stat().st_size // 1024} KB, {pages} page(s)")
if pages != 1:
    sys.exit("CV lebih dari satu halaman, rapiin dulu isinya")
