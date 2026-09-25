#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# آزمون خودکار ابزار بازیابی — کاملاً آفلاین (سرور محلی + فایل‌های ساختگی)
# هدف: اثبات درستی منطق دانلود، تشخیص فایل خراب، شمارش صفحه، استخراج لینک و نام‌گذاری
#   bash selftest.sh
# ------------------------------------------------------------------------------
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USE_WAYBACK=0 RETRY_SLEEP=0
# shellcheck source=lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[31m✗\033[0m %s — %s\n' "$1" "${2:-}"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "انتظار «$3» ولی «$2»"; fi; }

TMP="$(mktemp -d)"; WWW="$TMP/www"; OUT="$TMP/out"; mkdir -p "$WWW" "$OUT"
trap 'rm -rf "$TMP"; [ -n "${SRV_PID:-}" ] && kill "$SRV_PID" 2>/dev/null' EXIT

# ۱) ساخت یک PDF معتبر ۳ صفحه‌ای با حجم > ۱۰۰KB
python3 - "$WWW/C112244.pdf" <<'PY'
import sys
objs, pad = [], b"% " + b"x"*120000 + b"\n"
def obj(n, body): objs.append((n, body))
obj(1, b"<< /Type /Catalog /Pages 2 0 R >>")
obj(2, b"<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>")
for n in (3, 4, 5):
    obj(n, b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R >>")
stream = b"BT /F1 24 Tf 72 720 Td (kod ketab 112244 - fizik 3) Tj ET"
obj(6, b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream))
out = bytearray(b"%PDF-1.4\n"); offsets = {}
out += pad
for n, body in objs:
    offsets[n] = len(out)
    out += b"%d 0 obj\n" % n + body + b"\nendobj\n"
xref = len(out)
out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs)+1)
for n, _ in objs:
    out += b"%010d 00000 n \n" % offsets[n]
out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs)+1, xref)
open(sys.argv[1], "wb").write(bytes(out))
PY

# ۲) فایل خراب (HTML با پسوند pdf) و صفحه‌ی نمونه‌ی konkur برای تست استخراج لینک
printf '<html><body>صفحه خطای ۵۲۳ سرور</body></html>' >"$WWW/broken.pdf"
cat >"$WWW/page.html" <<'HTML'
<html><body>
<a href="https://dl.konkur.in/2025/07/Khordad-1404-Fizik3T-%5Bwww.konkur.in%5D.pdf">خرداد ۱۴۰۴ تجربی</a>
<a href="https://dl.konkur.in/post/Exam/12/Fizik3R/Dey-97-Fizik3R-%5Bwww.konkur.in%5D.pdf">دی ۹۷ ریاضی</a>
<a href="https://dl.konkur.in/2026/07/Tir-1405-Fizik3T-%5Bwww.konkur.in%5D.pdf">تیر ۱۴۰۵ تجربی</a>
<a href="https://dl.konkur.in/2025/12/FinalExam-Fizik3T-Paye12-%5Bkonkur.in%5D.zip">آرشیو یکجا</a>
<a href="https://konkur.in/help">راهنما</a>
<img src="https://dl.konkur.in/2026/09/banner.gif">
</body></html>
HTML

PORT=8731
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$WWW" >/dev/null 2>&1 &
SRV_PID=$!
sleep 1.5

printf '\n\033[1mآزمون ابزار بازیابی (آفلاین)\033[0m\n'

# --- ۱: دانلود سالم
if fetch_pdf "http://127.0.0.1:$PORT/C112244.pdf" "$OUT/book.pdf" 100000; then
  ok "دانلود فایل سالم (> ۱۰۰KB، هدر %PDF-)"
else bad "دانلود فایل سالم" "fetch_pdf شکست خورد"; fi

# --- ۲: شمارش صفحه (بخش F-2)
check "شمارش صفحه = ۳" "$(pdf_pages "$OUT/book.pdf")" "3"

# --- ۳: تشخیص فایل خراب (HTML به‌جای PDF)
if fetch_pdf "http://127.0.0.1:$PORT/broken.pdf" "$OUT/broken.pdf" 1000 >/dev/null 2>&1; then
  bad "رد فایل خراب" "فایل HTML به‌عنوان PDF پذیرفته شد"
else ok "رد فایل خراب (HTML با پسوند pdf)"; fi
[ -f "$OUT/broken.pdf" ] && bad "پاکسازی فایل خراب" "فایل ناقص باقی ماند" || ok "پاکسازی فایل ناقص بعد از شکست"

# --- ۴: آدرس ناموجود → شکست تمیز
if fetch_pdf "http://127.0.0.1:$PORT/nope.pdf" "$OUT/nope.pdf" 1000 >/dev/null 2>&1; then
  bad "شکست تمیز روی ۴۰۴" "موفق گزارش شد"
else ok "شکست تمیز روی آدرس ناموجود (۴۰۴)"; fi

# --- ۵: پرش از فایل سالمِ موجود (اجرای دوباره = ادامه‌پذیری)
if fetch_pdf "http://127.0.0.1:$PORT/nope.pdf" "$OUT/book.pdf" 100000 >/dev/null 2>&1 && [ "$SOURCE_USED" = "cache" ]; then
  ok "فایل سالم موجود دوباره دانلود نمی‌شود (resume)"
else bad "پرش از فایل موجود" "SOURCE_USED=${SOURCE_USED:-}"; fi

# --- ۶: استخراج لینک از صفحه (بخش B/C)
LINKS="$(scrape_konkur_links "http://127.0.0.1:$PORT/page.html")"
check "تعداد لینک استخراج‌شده" "$(printf '%s\n' "$LINKS" | grep -c .)" "4"
printf '%s' "$LINKS" | grep -q 'Tir-1405-Fizik3T' && ok "لینک تیر ۱۴۰۵ پیدا شد" || bad "لینک تیر ۱۴۰۵" "پیدا نشد"
printf '%s' "$LINKS" | grep -q 'banner.gif' && bad "فیلتر تصاویر" "gif وارد فهرست شد" || ok "تصاویر/بنرها فیلتر شدند"

# --- ۷: نام‌گذاری فارسی (بخش B)
check "نام فارسی تیر ۱۴۰۵" "$(fa_name_from_url 'https://dl.konkur.in/2026/07/Tir-1405-Fizik3T-%5Bwww.konkur.in%5D.pdf')" "تیر-1405-فیزیک3-تجربی.pdf"
check "نام فارسی دی ۹۷ ریاضی" "$(fa_name_from_url 'https://dl.konkur.in/post/Exam/12/Fizik3R/Dey-97-Fizik3R-%5Bwww.konkur.in%5D.pdf')" "دی-1397-فیزیک3-ریاضی.pdf"

# --- ۸: سلامت داده‌ها
check "ردیف‌های جدول کتاب‌ها" "$(grep -vc '^#' "$SCRIPT_DIR/data/books.tsv")" "14"
check "لینک‌های نهایی تجربی" "$(awk -F'\t' '$1=="T"' "$SCRIPT_DIR/data/nahayi-fizik3.tsv" | wc -l | tr -d ' ')" "22"
check "لینک‌های نهایی ریاضی"  "$(awk -F'\t' '$1=="R"' "$SCRIPT_DIR/data/nahayi-fizik3.tsv" | wc -l | tr -d ' ')" "22"
check "صفحه‌های کنکور" "$(grep -vc '^#' "$SCRIPT_DIR/data/konkur-pages.tsv")" "9"
check "یکتا بودن نام فایل‌های نهایی" \
  "$(awk -F'\t' '!/^#/{print $6}' "$SCRIPT_DIR/data/nahayi-fizik3.tsv" | sort -u | wc -l | tr -d ' ')" "44"

printf '\n  نتیجه: \033[32m%s موفق\033[0m، \033[31m%s ناموفق\033[0m\n\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
