#!/usr/bin/env python3
"""Download the exact FlyWire proofread_connections_783.feather file.

The download is resumable and verified against the MD5 published by Zenodo.
It intentionally writes to data/ (ignored by git) because the source file is
852 MB and is not suitable for a source-code patch.
"""
from __future__ import annotations

import hashlib
import os
import shutil
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

URL = "https://zenodo.org/records/10676866/files/proofread_connections_783.feather?download=1"
EXPECTED_MD5 = "f48f972d262323a102aed49af1396b8a"
EXPECTED_NAME = "proofread_connections_783.feather"
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
FINAL = DATA_DIR / EXPECTED_NAME
PART = DATA_DIR / (EXPECTED_NAME + ".part")


def digest(path: Path) -> str:
    md5 = hashlib.md5()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            md5.update(block)
    return md5.hexdigest()


def download():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if FINAL.exists():
        current = digest(FINAL)
        if current == EXPECTED_MD5:
            print(f"Already downloaded and verified: {FINAL}")
            return
        print("Existing file has a different MD5; keeping it as .invalid and starting again.")
        FINAL.rename(FINAL.with_suffix(FINAL.suffix + ".invalid"))

    offset = PART.stat().st_size if PART.exists() else 0
    headers = {"User-Agent": "FlyWire-783-viewer/1.0", "Accept": "application/octet-stream"}
    if offset:
        headers["Range"] = f"bytes={offset}-"
        print(f"Resuming at {offset / 1024**2:.1f} MB")
    request = urllib.request.Request(URL, headers=headers)
    try:
        response = urllib.request.urlopen(request, timeout=60)
    except urllib.error.URLError as error:
        print(f"Download could not start: {error}", file=sys.stderr)
        print(f"Official URL: {URL}", file=sys.stderr)
        raise SystemExit(2)

    status = getattr(response, "status", 200)
    if offset and status != 206:
        print("Server did not honour the resume range; restarting from zero.")
        PART.unlink(missing_ok=True)
        offset = 0
        request = urllib.request.Request(URL, headers={"User-Agent": "FlyWire-783-viewer/1.0"})
        response = urllib.request.urlopen(request, timeout=60)

    total = response.headers.get("Content-Length")
    total_bytes = offset + int(total) if total and status == 206 else int(total) if total else None
    mode = "ab" if offset and status == 206 else "wb"
    started = time.time()
    downloaded = offset
    with PART.open(mode) as output:
        while True:
            block = response.read(1024 * 1024)
            if not block:
                break
            output.write(block)
            downloaded += len(block)
            if total_bytes:
                percent = downloaded / total_bytes * 100
                print(f"\r{downloaded / 1024**2:,.1f} / {total_bytes / 1024**2:,.1f} MB ({percent:5.1f}%)", end="", flush=True)
    print()
    os.replace(PART, FINAL)
    actual = digest(FINAL)
    if actual != EXPECTED_MD5:
        print(f"MD5 mismatch: {actual} (expected {EXPECTED_MD5})", file=sys.stderr)
        raise SystemExit(3)
    print(f"Downloaded and verified: {FINAL}")
    print(f"MD5: {actual}")


if __name__ == "__main__":
    download()
