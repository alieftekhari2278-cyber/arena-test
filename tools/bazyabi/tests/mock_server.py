#!/usr/bin/env python3
"""سرور ماک برای تست آفلاین bazyabi.sh — PDF ساختگی و صفحات konkur تقلیدی می‌سازد."""
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
HOST = f"127.0.0.1:{PORT}"


def fake_pdf(pages: int = 3, pad: int = 60_000, code: str = "") -> bytes:
    body = [b"%PDF-1.4\n"]
    if code:
        body.append(f"% code {code}\n".encode())
    for _ in range(pages):
        body.append(b"<< /Type /Page >>\n")
    body.append(b"%" + b"x" * pad + b"\n%%EOF\n")
    return b"".join(body)


NAHAYI_FILES = [
    "Khordad-04-Fizik3T-%5Bwww.konkur.in%5D.pdf",
    "Dey-03-Fizik3T-%5Bwww.konkur.in%5D.pdf",
    "Shahrivar-02-Fizik3T-%5Bwww.konkur.in%5D.pdf",
    "Tir-05-Fizik3T-%5Bwww.konkur.in%5D.pdf",
    "Khordad-97-Fizik3T-%5Bwww.konkur.in%5D.pdf",
    # سبک سال چهاررقمی — شکل واقعی تأییدشده روی dl.konkur.in
    "Shahrivar-1404-Fizik3T-%5Bwww.konkur.in%5D.pdf",
    "Khordad-04-Fizik3R-%5Bwww.konkur.in%5D.pdf",
    "Dey-03-Fizik3R-%5Bwww.konkur.in%5D.pdf",
    "Dey-1405-Fizik3R-%5Bkonkur.in%5D.pdf",
]

KONKUR_FILES = {
    "125397": ["Konkur1405-Tajrobi-%5Bwww.konkur.in%5D.pdf",
               "Konkur1405-Tajrobi-Key-%5Bwww.konkur.in%5D.pdf",
               "Konkur1405-Fizik-Mahdavi-%5Bwww.konkur.in%5D.pdf",
               "Konkur1405-Fizik-Ahmadi-%5Bwww.konkur.in%5D.pdf",
               "Konkur1405-Fizik-Extra-%5Bwww.konkur.in%5D.pdf"],
}
for pid in ("117416", "119129", "109465", "111823", "101624", "104737", "96826", "90630"):
    yy = pid[:2]
    KONKUR_FILES[pid] = [f"Konkur14{yy}-Tajrobi-%5Bwww.konkur.in%5D.pdf",
                         f"Konkur14{yy}-Tajrobi-Key-%5Bwww.konkur.in%5D.pdf",
                         f"Konkur14{yy}-Fizik-A-%5Bwww.konkur.in%5D.pdf",
                         f"Konkur14{yy}-Fizik-B-%5Bwww.konkur.in%5D.pdf"]


ZIP_FILES = ["Fizik3-Tajrobi-Archive-%5Bwww.konkur.in%5D.zip",
             "Fizik3-Riazi-Archive-%5Bwww.konkur.in%5D.zip"]


def page_html(files):
    links = "\n".join(f'<a href="http://{HOST}/dl/{f}">دانلود</a>' for f in files)
    return f"<html><body><h1>صفحه تست</h1>{links}</body></html>".encode()


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, data, ctype):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        p = unquote(self.path)
        m = re.match(r"^/sites/default/files/lbooks/[\d\-]+/\d+/C(\d+)\.pdf$", p)
        if m:
            return self._send(fake_pdf(code=m.group(1)), "application/pdf")
        if p.startswith("/dl/") and p.endswith(".pdf"):
            return self._send(fake_pdf(), "application/pdf")
        if p.startswith("/dl/") and p.endswith(".zip"):
            import io, zipfile
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w") as z:
                z.writestr("Khordad-1404-Fizik3T.pdf", fake_pdf())
            return self._send(buf.getvalue(), "application/zip")
        m = re.match(r"^/(\d+)/?$", p)
        if m:
            pid = m.group(1)
            if pid == "89691":
                return self._send(page_html(NAHAYI_FILES + ZIP_FILES), "text/html; charset=utf-8")
            if pid in KONKUR_FILES:
                return self._send(page_html(KONKUR_FILES[pid]), "text/html; charset=utf-8")
        self.send_error(404)


if __name__ == "__main__":
    print(f"mock server on http://{HOST}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
