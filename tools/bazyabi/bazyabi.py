#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
بازیابی کامل آرشیو فیزیک کنکور ۱۴۰۶ — نسخهٔ تک‌فایلی و چندسکویی.

اجرای کامل (ویندوز، مک، لینوکس — فقط پایتون ۳.۸ به بالا لازم است):

    python bazyabi.py                 # همه‌چیز (بخش G راهنما)
    python bazyabi.py kotob           # فقط کتاب‌های درسی (بخش A)
    python bazyabi.py nahayi          # فقط امتحان نهایی فیزیک ۳ (بخش B)
    python bazyabi.py konkur          # فقط کنکور تجربی (بخش C)
    python bazyabi.py verify          # فقط راستی‌آزمایی (بخش F)

مسیر ذخیره را می‌توان عوض کرد:
    python bazyabi.py --root "D:\\download"

هیچ کتابخانهٔ بیرونی لازم نیست. اگر pypdf نصب باشد شمار صفحه‌ها هم چک می‌شود.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

# ────────────────────────── پیکربندی ──────────────────────────
DEFAULT_ROOT = Path(os.environ.get("DOWNLOAD_ROOT", "/home/z/my-project/download"))
CHAP_BASE = os.environ.get("CHAP_BASE", "http://chap.sch.ir")
KONKUR_BASE = os.environ.get("KONKUR_BASE", "https://konkur.in")
DL_HOST = os.environ.get("DL_HOST", "dl.konkur.in")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
TIMEOUT = int(os.environ.get("TIMEOUT", "180"))
TRIES = int(os.environ.get("TRIES", "3"))
MIN_SIZE = int(os.environ.get("MIN_SIZE", "51200"))  # ۵۰ کیلوبایت (بخش F)
USE_WAYBACK = os.environ.get("USE_WAYBACK", "1") != "0"

# بخش A — (کد کتاب، پوشهٔ دسته، نام مقصد، صفحات)
KOTOB = [
    ("110210", "1403-1404/40", "شیمی-۱-دهم-تجربی-چاپ-1403-1404.pdf", 136),
    ("110211", "1403-1404/40", "ریاضی-۱-دهم-تجربی-چاپ-1403-1404.pdf", 176),
    ("110216", "1403-1404/40", "زیست-شناسی-۱-دهم-تجربی-چاپ-1403-1404.pdf", 120),
    ("110214", "1403-1404/40", "فیزیک-۱-دهم-تجربی-چاپ-1403-1404.pdf", 136),
    ("111210", "1404-1405/41", "شیمی-۲-یازدهم-تجربی-چاپ-1404-1405.pdf", 136),
    ("111211", "1404-1405/41", "ریاضی-۲-یازدهم-تجربی-چاپ-1404-1405.pdf", 176),
    ("111216", "1404-1405/41", "زیست-شناسی-۲-یازدهم-تجربی-چاپ-1404-1405.pdf", 168),
    ("111237", "1404-1405/41", "زمین-شناسی-یازدهم-چاپ-1404-1405.pdf", 128),
    ("111244", "1404-1405/41", "فیزیک-۲-یازدهم-تجربی-چاپ-1404-1405.pdf", 119),
    ("112210", "1405-1406/712", "شیمی-۳-دوازدهم-تجربی-چاپ-1405-1406.pdf", 136),
    ("112211", "1405-1406/712", "ریاضی-۳-دوازدهم-تجربی-چاپ-1405-1406.pdf", 160),
    ("112216", "1405-1406/712", "زیست-شناسی-۳-دوازدهم-تجربی-چاپ-1405-1406.pdf", 136),
    ("112244", "1405-1406/712", "فیزیک-۳-دوازدهم-تجربی-چاپ-1405-1406.pdf", 143),
    ("110214", "1404-1405/40", "پشتیبان-فیزیک-۱-دهم-تجربی-چاپ-1404-1405.pdf", 0),
]
# آینه‌ها (بخش A و E)
MIRRORS = {
    "فیزیک-۱-دهم-تجربی-چاپ-1403-1404.pdf": [
        "https://physicfa.ir/wp-content/uploads/2024/12/Physic1T-1403-1404-physicfa.pdf",
    ],
}
MIRROR_TMPL = ["https://dl.daneshchi.ir/file/chap-school/C{code}.pdf"]

NAHAYI_PAGE = "89691"  # بخش B
KONKUR_PAGES = [  # بخش C
    ("125397", "کنکور-1405-اردیبهشت"), ("117416", "کنکور-1404-نوبت1-اردیبهشت"),
    ("119129", "کنکور-1404-نوبت2-تیر"), ("109465", "کنکور-1403-نوبت1-اردیبهشت"),
    ("111823", "کنکور-1403-نوبت2-تیر"), ("101624", "کنکور-1402-نوبت1"),
    ("104737", "کنکور-1402-نوبت2-تیر"), ("96826", "کنکور-1401"), ("90630", "کنکور-1400"),
]
# بخش D — برای گسترش بعدی
NAHAYI_OTHER = {"شیمی3": "89628", "زیست3": "89960", "ریاضی3": "89867", "فارسی3": "87382",
                "عربی3": "89911", "دینی3": "87315", "انگلیسی3": "89962"}

MONTHS = {"khordad": "خرداد", "dey": "دی", "shahrivar": "شهریور",
          "tir": "تیر", "mordad": "مرداد"}

report: list[tuple] = []


# ────────────────────────── ابزار ──────────────────────────
def log(msg: str, kind: str = "") -> None:
    mark = {"ok": "✔", "err": "✘", "warn": "⚠", "": "·"}[kind]
    print(f"{mark} {msg}", flush=True)


def _ctx() -> ssl.SSLContext:
    c = ssl.create_default_context()
    c.check_hostname = False
    c.verify_mode = ssl.CERT_NONE  # برخی آینه‌های ایرانی زنجیرهٔ ناقص دارند
    return c


def http_get(url: str, timeout: int = TIMEOUT) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               "Accept": "*/*",
                                               "Accept-Language": "fa,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=timeout, context=_ctx()) as r:
        return r.read()


def wayback(url: str) -> str | None:
    """نسخهٔ آرشیوشده با پسوند id_ که بایت خام می‌دهد (بخش E)."""
    try:
        q = "http://archive.org/wayback/available?url=" + urllib.parse.quote(url, safe="")
        data = json.loads(http_get(q, timeout=40).decode("utf-8", "replace"))
        snap = data.get("archived_snapshots", {}).get("closest", {})
        if snap.get("available") and snap.get("timestamp"):
            return f"https://web.archive.org/web/{snap['timestamp']}id_/{url}"
    except Exception:
        pass
    return None


def fetch_pdf(dest: Path, *urls: str) -> bool:
    """زنجیرهٔ کامل بخش E: تلاش مجدد پلکانی ← آینه ← Wayback ← save."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size >= MIN_SIZE and dest.open("rb").read(5) == b"%PDF-":
        log(f"از قبل سالم: {dest.name}")
        return True

    candidates: list[str] = []
    for u in urls:
        if not u:
            continue
        candidates.append(u)
        if USE_WAYBACK:
            w = wayback(u)
            if w:
                candidates.append(w)
            candidates.append("https://web.archive.org/save/" + u)

    for url in candidates:
        for attempt in range(1, TRIES + 1):
            try:
                blob = http_get(url)
                if blob[:5] == b"%PDF-" and len(blob) >= MIN_SIZE:
                    dest.write_bytes(blob)
                    log(f"{dest.name}  ({len(blob):,} بایت)", "ok")
                    return True
                break  # پاسخ آمد ولی PDF نبود → سراغ منبع بعدی
            except Exception as e:
                if attempt < TRIES:
                    wait = 10 * attempt
                    log(f"تلاش {attempt} ناموفق ({type(e).__name__}) — {wait} ثانیه صبر")
                    time.sleep(wait)
    log(f"ناموفق: {dest.name}", "err")
    return False


def pdf_pages(path: Path) -> int | None:
    try:
        from pypdf import PdfReader  # type: ignore
        return len(PdfReader(str(path), strict=False).pages)
    except Exception:
        try:
            return len(re.findall(rb"/Type\s*/Page[^s]", path.read_bytes())) or None
        except Exception:
            return None


def verify(path: Path, want_pages: int = 0) -> bool:
    """بخش F راهنما."""
    if not path.exists() or path.stat().st_size < MIN_SIZE:
        return False
    if path.open("rb").read(5) != b"%PDF-":
        return False
    if want_pages:
        got = pdf_pages(path)
        if got and got != want_pages:
            log(f"شمار صفحه {got} است ولی انتظار {want_pages} بود: {path.name}", "warn")
    return True


def scrape(page_url: str, ext: str = "pdf") -> list[str]:
    try:
        html = http_get(page_url, timeout=60).decode("utf-8", "replace")
    except Exception as e:
        log(f"صفحه باز نشد {page_url} → {e}", "err")
        return []
    pat = re.compile(r"https?://" + re.escape(DL_HOST) + r"/[^\"'<>\s]+\." + ext, re.I)
    seen, out = set(), []
    for u in pat.findall(html):
        u = u.replace("&amp;", "&")
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def nahayi_name(url: str) -> str:
    """Khordad-1404-Fizik3T-[...].pdf → خرداد-1404-فیزیک3-تجربی.pdf"""
    base = urllib.parse.unquote(url.split("?")[0].rsplit("/", 1)[-1])
    m = re.match(r"^([A-Za-z]+)-(\d{2,4})", base)
    br = "تجربی" if re.search(r"fizik3t", base, re.I) else (
        "ریاضی" if re.search(r"fizik3r", base, re.I) else "")
    if not (m and br):
        return base
    mon = MONTHS.get(m.group(1).lower())
    if not mon:
        return base
    y = m.group(2)
    if len(y) < 4:
        y = ("13" + y) if int(y) >= 90 else f"14{int(y):02d}"
    return f"{mon}-{y}-فیزیک3-{br}.pdf"


# ────────────────────────── مراحل ──────────────────────────
def step_kotob(root: Path) -> None:
    log("── بخش A: کتاب‌های درسی")
    d = root / "kotob-darsi"
    for code, cat, name, pages in KOTOB:
        urls = [f"{CHAP_BASE}/sites/default/files/lbooks/{cat}/C{code}.pdf"]
        urls += MIRRORS.get(name, [])
        urls += [t.format(code=code) for t in MIRROR_TMPL]
        out = d / name
        okd = fetch_pdf(out, *urls)
        good = okd and verify(out, pages)
        report.append(("کتاب", name, "OK" if good else "ناموفق",
                       out.stat().st_size if out.exists() else 0))


def step_nahayi(root: Path) -> None:
    log("── بخش B: امتحان نهایی فیزیک ۳")
    d, dr = root / "nahayi-fizik12", root / "nahayi-fizik12" / "فیزیک3-مکمل-رشته-ریاضی"
    page = f"{KONKUR_BASE}/{NAHAYI_PAGE}/"

    for z in scrape(page, "zip"):  # میان‌بر: آرشیو «همه سال‌ها یکجا»
        out = d / "آرشیو-فشرده" / urllib.parse.unquote(z.rsplit("/", 1)[-1])
        out.parent.mkdir(parents=True, exist_ok=True)
        try:
            out.write_bytes(http_get(z))
            log(f"آرشیو فشرده: {out.name} ({out.stat().st_size:,} بایت)", "ok")
            with zipfile.ZipFile(out) as zf:
                zf.extractall(out.with_suffix(""))
            report.append(("آرشیو-zip", out.name, "OK", out.stat().st_size))
        except Exception as e:
            log(f"آرشیو فشرده ناموفق: {e}", "err")

    links = scrape(page)
    if not links:
        log("هیچ لینکی از صفحهٔ ۸۹۶۹۱ استخراج نشد", "err")
    for u in links:
        if re.search(r"fizik3t", u, re.I):
            out = d / nahayi_name(u)
        elif re.search(r"fizik3r", u, re.I):
            out = dr / nahayi_name(u)
        else:
            continue
        okd = fetch_pdf(out, u)
        report.append(("نهایی", out.name, "OK" if okd and verify(out) else "ناموفق",
                       out.stat().st_size if out.exists() else 0))


def step_konkur(root: Path) -> None:
    log("── بخش C: کنکور تجربی ۱۴۰۰–۱۴۰۵")
    for pid, label in KONKUR_PAGES:
        sub = root / "konkur-fizik" / label
        links = scrape(f"{KONKUR_BASE}/{pid}/")
        if not links:
            log(f"لینکی در صفحهٔ {pid} نبود", "err")
            continue
        fiz = 0
        for u in links:
            name = urllib.parse.unquote(u.split("?")[0].rsplit("/", 1)[-1])
            low = name.lower()
            if "key" in low or "pasokh" in low:
                out = sub / f"کلید-{name}"
            elif "tajrobi" in low:
                out = sub / f"دفترچه-{name}"
            elif "fizik" in low:
                fiz += 1
                if fiz > 2:
                    continue
                out = sub / f"تشریحی-فیزیک-{fiz}-{name}"
            else:
                continue
            okd = fetch_pdf(out, u)
            report.append(("کنکور", f"{label}/{out.name}",
                           "OK" if okd and verify(out) else "ناموفق",
                           out.stat().st_size if out.exists() else 0))


def step_verify(root: Path) -> int:
    log("── بخش F: راستی‌آزمایی")
    want = {n: p for _, _, n, p in KOTOB}
    total = bad = 0
    for p in sorted(root.rglob("*.pdf")):
        total += 1
        if not verify(p, want.get(p.name, 0)):
            bad += 1
            log(f"خراب: {p.name}", "err")
    log(f"بررسی شد {total} فایل — خراب: {bad}", "ok" if bad == 0 else "warn")
    return bad


def step_report(root: Path) -> None:
    tsv = root / "گزارش-بازیابی.tsv"
    tsv.parent.mkdir(parents=True, exist_ok=True)
    with tsv.open("w", encoding="utf-8") as f:
        f.write("دسته\tفایل\tوضعیت\tحجم\n")
        for row in report:
            f.write("\t".join(str(x) for x in row) + "\n")

    def n(*parts, deep=True):
        d = root.joinpath(*parts)
        g = d.rglob("*.pdf") if deep else d.glob("*.pdf")
        return len(list(g)) if d.exists() else 0

    k = n("kotob-darsi")
    nr = n("nahayi-fizik12", "فیزیک3-مکمل-رشته-ریاضی")
    nt = n("nahayi-fizik12", deep=False)
    c = n("konkur-fizik")
    print(f"""
╭──────────── گزارش بازیابی آرشیو ────────────╮
 ریشه: {root}
 کتاب‌های درسی        : {k}  (هدف ۱۴)
 نهایی فیزیک۳ تجربی   : {nt} (هدف ۲۳)
 نهایی فیزیک۳ ریاضی   : {nr} (هدف ۲۳)
 کنکور تجربی          : {c}  (هدف ۳۶)
 جمع                  : {k + nt + nr + c} / ۹۶
 گزارش کامل           : {tsv}
╰─────────────────────────────────────────────╯""")


def main() -> int:
    ap = argparse.ArgumentParser(description="بازیابی آرشیو فیزیک کنکور ۱۴۰۶")
    ap.add_argument("section", nargs="?", default="all",
                    choices=["all", "kotob", "nahayi", "konkur", "verify", "report"])
    ap.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    a = ap.parse_args()
    root: Path = a.root
    for sub in ("kotob-darsi", "nahayi-fizik12/فیزیک3-مکمل-رشته-ریاضی", "konkur-fizik"):
        (root / sub).mkdir(parents=True, exist_ok=True)
    log(f"ریشهٔ ذخیره‌سازی: {root}", "ok")

    if a.section in ("all", "kotob"):
        step_kotob(root)
    if a.section in ("all", "nahayi"):
        step_nahayi(root)
    if a.section in ("all", "konkur"):
        step_konkur(root)
    if a.section in ("all", "verify"):
        step_verify(root)
    step_report(root)
    return 0


if __name__ == "__main__":
    sys.exit(main())
