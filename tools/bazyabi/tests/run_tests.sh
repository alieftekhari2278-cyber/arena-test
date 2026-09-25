#!/usr/bin/env bash
# تست آفلاین کامل bazyabi.sh با سرور ماک (بدون نیاز به اینترنت)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PORT="${PORT:-8099}"
TMP="$(mktemp -d)"
FAIL=0

cleanup() { [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null; rm -rf "$TMP"; }
trap cleanup EXIT

check() { # check <توضیح> <expected> <actual>
  if [ "$2" = "$3" ]; then printf '  ✔ %s (%s)\n' "$1" "$3"
  else printf '  ✘ %s — انتظار %s، دریافت %s\n' "$1" "$2" "$3"; FAIL=1; fi
}

python3 "$HERE/mock_server.py" "$PORT" >/dev/null 2>&1 &
PID=$!
for _ in $(seq 30); do curl -s -o /dev/null "http://127.0.0.1:$PORT/89691/" && break; sleep 0.2; done

export DOWNLOAD_ROOT="$TMP/download"
export CHAP_BASE="http://127.0.0.1:$PORT"
export KONKUR_BASE="http://127.0.0.1:$PORT"
export DL_HOST_RE="127\.0\.0\.1:$PORT"
export USE_WAYBACK=0 TRIES=1 MAX_TIME=20 MIN_SIZE=10000

echo "» اجرای کامل روی سرور ماک"
bash "$ROOT/bazyabi.sh" all >"$TMP/out.txt" 2>&1 || true

check "کتاب‌های درسی" 14 "$(find "$DOWNLOAD_ROOT/kotob-darsi" -name '*.pdf' | wc -l)"
check "نهایی تجربی" 6 "$(find "$DOWNLOAD_ROOT/nahayi-fizik12" -maxdepth 1 -name '*.pdf' | wc -l)"
check "نهایی رشته ریاضی" 3 "$(find "$DOWNLOAD_ROOT/nahayi-fizik12/فیزیک3-مکمل-رشته-ریاضی" -name '*.pdf' | wc -l)"
check "کنکور (۹ دوره × ۴)" 36 "$(find "$DOWNLOAD_ROOT/konkur-fizik" -name '*.pdf' | wc -l)"

echo "» نام‌گذاری فارسی فایل‌های نهایی"
for want in "خرداد-1404-فیزیک3-تجربی.pdf" "دی-1403-فیزیک3-تجربی.pdf" \
            "شهریور-1402-فیزیک3-تجربی.pdf" "تیر-1405-فیزیک3-تجربی.pdf" \
            "خرداد-1397-فیزیک3-تجربی.pdf" "شهریور-1404-فیزیک3-تجربی.pdf"; do
  [ -f "$DOWNLOAD_ROOT/nahayi-fizik12/$want" ] \
    && printf '  ✔ %s\n' "$want" || { printf '  ✘ %s ساخته نشد\n' "$want"; FAIL=1; }
done
for want in "خرداد-1404-فیزیک3-ریاضی.pdf" "دی-1405-فیزیک3-ریاضی.pdf"; do
  [ -f "$DOWNLOAD_ROOT/nahayi-fizik12/فیزیک3-مکمل-رشته-ریاضی/$want" ] \
    && printf '  ✔ %s\n' "$want" || { printf '  ✘ %s ساخته نشد\n' "$want"; FAIL=1; }
done

echo "» تست واحد nahayi_name روی لینک واقعی تأییدشده"
( set +u; source "$ROOT/lib/common.sh" 2>/dev/null
  got=$(nahayi_name "https://dl.konkur.in/2025/07/Khordad-1404-Fizik3T-%5Bwww.konkur.in%5D.pdf")
  [ "$got" = "خرداد-1404-فیزیک3-تجربی.pdf" ] \
    && echo "  ✔ سال چهاررقمی درست تبدیل شد" || { echo "  ✘ سال چهاررقمی: $got"; exit 1; }
  got=$(nahayi_name "https://dl.konkur.in/2022/01/Dey-97-Fizik3T-%5Bwww.konkur.in%5D.pdf")
  [ "$got" = "دی-1397-فیزیک3-تجربی.pdf" ] \
    && echo "  ✔ سال دو رقمی ۹۷ درست تبدیل شد" || { echo "  ✘ سال دو رقمی: $got"; exit 1; } ) || FAIL=1

echo "» میان‌بر آرشیو فشرده (ZIP)"
check "فایل‌های ZIP" 2 "$(find "$DOWNLOAD_ROOT/nahayi-fizik12/آرشیو-فشرده" -name '*.zip' 2>/dev/null | wc -l)"

echo "» سقف ۲ فایل تشریحی فیزیک در هر دوره"
check "تشریحی ۱۴۰۵" 2 "$(find "$DOWNLOAD_ROOT/konkur-fizik/کنکور-1405-اردیبهشت" -name 'تشریحی-فیزیک-*' | wc -l)"

echo "» راستی‌آزمایی و گزارش"
bash "$ROOT/bazyabi.sh" verify >/dev/null 2>&1 && echo "  ✔ verify پاس شد" || { echo "  ✘ verify رد شد"; FAIL=1; }
# ۱۴ کتاب + ۹ نهایی + ۲ زیپ + ۳۶ کنکور = ۶۱ ردیف
check "سطرهای گزارش" 61 "$(( $(wc -l <"$DOWNLOAD_ROOT/گزارش-بازیابی.tsv") - 1 ))"
grep -q "ناموفق" "$DOWNLOAD_ROOT/گزارش-بازیابی.tsv" && { echo "  ✘ ردیف ناموفق در گزارش"; FAIL=1; } || echo "  ✔ بدون ردیف ناموفق"

echo "» رد فایل خراب (هدر غیر PDF)"
printf 'HTML!' >"$DOWNLOAD_ROOT/kotob-darsi/خراب.pdf"
bash "$ROOT/bazyabi.sh" verify >/dev/null 2>&1 && { echo "  ✘ فایل خراب شناسایی نشد"; FAIL=1; } || echo "  ✔ فایل خراب شناسایی شد"
rm -f "$DOWNLOAD_ROOT/kotob-darsi/خراب.pdf"

echo "» حالت DRY_RUN"
DRY_RUN=1 DOWNLOAD_ROOT="$TMP/dry" bash "$ROOT/bazyabi.sh" kotob >/dev/null 2>&1
check "بدون فایل در DRY_RUN" 0 "$(find "$TMP/dry" -name '*.pdf' 2>/dev/null | wc -l)"

echo "» تطابق نسخه پایتون (چندسکویی) با نسخه bash"
PYROOT="$TMP/pydl"
CHAP_BASE="http://127.0.0.1:$PORT" KONKUR_BASE="http://127.0.0.1:$PORT" \
  DL_HOST="127.0.0.1:$PORT" USE_WAYBACK=0 TRIES=1 MIN_SIZE=10000 \
  python3 "$ROOT/bazyabi.py" all --root "$PYROOT" >/dev/null 2>&1
for d in "kotob-darsi" "konkur-fizik"; do
  a=$(find "$DOWNLOAD_ROOT/$d" -name '*.pdf' | wc -l)
  b=$(find "$PYROOT/$d" -name '*.pdf' 2>/dev/null | wc -l)
  check "$d برابر در هر دو نسخه" "$a" "$b"
done
[ -f "$PYROOT/nahayi-fizik12/خرداد-1404-فیزیک3-تجربی.pdf" ] \
  && echo "  ✔ نام‌گذاری فارسی در نسخه پایتون" || { echo "  ✘ نام‌گذاری پایتون"; FAIL=1; }

echo
[ "$FAIL" = 0 ] && { echo "✅ همه تست‌ها سبز"; exit 0; } || { echo "❌ تست‌ها شکست خوردند"; sed -n '1,60p' "$TMP/out.txt"; exit 1; }
