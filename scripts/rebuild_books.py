#!/usr/bin/env python3
"""Rebuild the selected Iranian experimental-science textbook archive.

Downloads the 26 textbook editions specified in the recovery note from the
publisher's book-detail pages.  A file is accepted only when it has a PDF
signature and is at least 50 KiB.  It writes a JSON manifest with original
URLs, sizes, and SHA-256 checksums for auditability and safe resumption.

Usage:
    python3 scripts/rebuild_books.py --output /tmp/textbooks
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin

USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
MIN_PDF_BYTES = 50 * 1024
# chap.oerp.ir is the current official host; retain an environment override for
# future migrations or a sanctioned mirror.
BOOK_SITE = os.environ.get("CHAP_BOOK_SITE", "http://chap.oerp.ir").rstrip("/")


@dataclass(frozen=True)
class Book:
    book_id: int
    grade: str
    year: str
    slug: str
    title_fa: str


# The IDs and requested editions come from the supplied recovery guide.
BOOKS: tuple[Book, ...] = (
    Book(12206, "10", "1403-1404", "farsi", "فارسی ۱"),
    Book(12209, "10", "1403-1404", "dini", "دین و زندگی ۱"),
    Book(12211, "10", "1403-1404", "arabi", "عربی، زبان قرآن ۱"),
    Book(12215, "10", "1403-1404", "shimi", "شیمی ۱"),
    Book(12216, "10", "1403-1404", "riyazi", "ریاضی ۱"),
    Book(12219, "10", "1403-1404", "fizik", "فیزیک ۱"),
    Book(12221, "10", "1403-1404", "zist", "زیست‌شناسی ۱"),
    Book(12233, "10", "1403-1404", "english", "زبان انگلیسی ۱"),
    Book(13216, "11", "1404-1405", "shimi", "شیمی ۲"),
    Book(13217, "11", "1404-1405", "riyazi", "ریاضی ۲"),
    Book(13275, "11", "1404-1405", "dini", "دین و زندگی ۲"),
    Book(13277, "11", "1404-1405", "arabi", "عربی، زبان قرآن ۲"),
    Book(13282, "11", "1404-1405", "zist", "زیست‌شناسی ۲"),
    Book(13291, "11", "1404-1405", "english", "زبان انگلیسی ۲"),
    Book(13297, "11", "1404-1405", "zamin", "زمین‌شناسی"),
    Book(13299, "11", "1404-1405", "fizik", "فیزیک ۲"),
    Book(13272, "11", "1404-1405", "farsi", "فارسی ۲"),
    Book(14350, "12", "1405-1406", "farsi", "فارسی ۳"),
    Book(14352, "12", "1405-1406", "dini", "دین و زندگی ۳"),
    Book(14354, "12", "1405-1406", "arabi", "عربی، زبان قرآن ۳"),
    Book(14358, "12", "1405-1406", "shimi", "شیمی ۳"),
    Book(14359, "12", "1405-1406", "riyazi", "ریاضی ۳"),
    Book(14364, "12", "1405-1406", "zist", "زیست‌شناسی ۳"),
    Book(14372, "12", "1405-1406", "english", "زبان انگلیسی ۳"),
    Book(14379, "12", "1405-1406", "fizik", "فیزیک ۳ (تجربی)"),
    Book(14366, "12", "1405-1406", "hoviat", "هویت اجتماعی"),
)


def run_curl(url: str, destination: Path | None, timeout: int) -> bytes | None:
    """Fetch URL with curl, using a browser UA and retrying transient failures."""
    command = [
        "curl",
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--retry",
        "3",
        "--retry-all-errors",
        "--connect-timeout",
        "20",
        "--max-time",
        str(timeout),
        "--user-agent",
        USER_AGENT,
    ]
    if destination is None:
        command.append(url)
        completed = subprocess.run(command, check=True, stdout=subprocess.PIPE)
        return completed.stdout
    command.extend(["--output", str(destination), url])
    subprocess.run(command, check=True)
    return None


def pdf_urls(book_page_url: str, page: bytes) -> list[str]:
    """Collect PDF targets from an HTML book page in source order."""
    source = html.unescape(page.decode("utf-8", errors="replace"))
    urls: list[str] = []
    # Keep IGNORECASE: historic pages include source labels such as [Konkur.in].
    for match in re.finditer(r"(?:href|src)\s*=\s*['\"]([^'\"]+?\.pdf(?:\?[^'\"]*)?)['\"]", source, re.IGNORECASE):
        candidate = urljoin(book_page_url, match.group(1).strip())
        if candidate not in urls:
            urls.append(candidate)
    # Some legacy templates put an escaped PDF URL in a data attribute/string.
    for match in re.finditer(r"https?://[^\s'\"<>]+?\.pdf(?:\?[^\s'\"<>]*)?", source, re.IGNORECASE):
        candidate = match.group(0)
        if candidate not in urls:
            urls.append(candidate)
    return urls


def valid_pdf(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size < MIN_PDF_BYTES:
        return False
    with path.open("rb") as handle:
        return handle.read(5) == b"%PDF-"


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def target_path(output: Path, book: Book) -> Path:
    return output / f"grade-{book.grade}" / f"{book.grade}_{book.year}_{book.slug}_{book.book_id}.pdf"


def rebuild(books: Iterable[Book], output: Path, timeout: int, resume: bool) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    entries: list[dict] = []
    failures: list[dict] = []

    for index, book in enumerate(books, start=1):
        destination = target_path(output, book)
        page_url = f"{BOOK_SITE}/books/{book.book_id}"
        print(f"[{index:02d}/26] {book.title_fa} — {page_url}", flush=True)

        if resume and valid_pdf(destination):
            print("  already verified; skipping", flush=True)
            entries.append({
                **asdict(book),
                "book_page": page_url,
                "file": str(destination.relative_to(output)),
                "bytes": destination.stat().st_size,
                "sha256": checksum(destination),
                "status": "existing",
            })
            continue

        destination.parent.mkdir(parents=True, exist_ok=True)
        try:
            page = run_curl(page_url, None, timeout)
            assert page is not None
            candidates = pdf_urls(page_url, page)
            if not candidates:
                raise RuntimeError("No PDF URL found in book-page HTML")

            selected: str | None = None
            with tempfile.TemporaryDirectory(prefix=f"book-{book.book_id}-") as temporary_dir:
                temp = Path(temporary_dir) / "download.pdf"
                attempted: list[str] = []
                for candidate in candidates:
                    attempted.append(candidate)
                    try:
                        run_curl(candidate, temp, timeout)
                    except subprocess.CalledProcessError:
                        continue
                    if valid_pdf(temp):
                        selected = candidate
                        shutil.move(str(temp), destination)
                        break
                if selected is None:
                    raise RuntimeError(f"No valid PDF from {len(attempted)} candidate URL(s)")

            entries.append({
                **asdict(book),
                "book_page": page_url,
                "source_url": selected,
                "file": str(destination.relative_to(output)),
                "bytes": destination.stat().st_size,
                "sha256": checksum(destination),
                "status": "downloaded",
            })
            print(f"  saved {destination.name} ({destination.stat().st_size / 1024 / 1024:.1f} MiB)", flush=True)
        except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
            failures.append({**asdict(book), "book_page": page_url, "error": str(error)})
            print(f"  ERROR: {error}", file=sys.stderr, flush=True)

    return {"schema": 1, "requested_count": len(BOOKS), "downloaded_count": len(entries), "failed_count": len(failures), "books": entries, "failures": failures}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("textbooks"), help="directory for PDFs (default: textbooks)")
    parser.add_argument("--manifest", type=Path, default=None, help="manifest JSON path (default: <output>/manifest.json)")
    parser.add_argument("--timeout", type=int, default=180, help="per-request timeout in seconds (default: 180)")
    parser.add_argument("--no-resume", action="store_true", help="redownload already-valid files")
    parser.add_argument("--only-id", type=int, action="append", default=[], help="only download this CHAP book ID; repeatable")
    return parser.parse_args()


def main() -> int:
    arguments = parse_args()
    selected = tuple(book for book in BOOKS if not arguments.only_id or book.book_id in arguments.only_id)
    unknown = set(arguments.only_id) - {book.book_id for book in BOOKS}
    if unknown:
        print(f"Unknown book ID(s): {', '.join(map(str, sorted(unknown)))}", file=sys.stderr)
        return 2

    report = rebuild(selected, arguments.output, arguments.timeout, not arguments.no_resume)
    manifest_path = arguments.manifest or arguments.output / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nManifest: {manifest_path}", flush=True)
    print(f"Verified PDFs: {report['downloaded_count']}/{len(selected)}", flush=True)
    if report["failed_count"]:
        print(f"Failures: {report['failed_count']}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
