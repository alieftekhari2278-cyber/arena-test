#!/usr/bin/env bash
# توابع مشترک بازیابی آرشیو — فارسی
# shellcheck shell=bash

# ---------- پیکربندی قابل بازنویسی با متغیر محیطی ----------
: "${DOWNLOAD_ROOT:=/home/z/my-project/download}"
: "${CHAP_BASE:=http://chap.sch.ir}"
: "${KONKUR_BASE:=https://konkur.in}"
: "${DL_HOST_RE:=dl\.konkur\.in}"
: "${WAYBACK_BASE:=https://web.archive.org}"
: "${UA:=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36}"
: "${MAX_TIME:=180}"
: "${TRIES:=3}"
: "${RETRY_SLEEP:=10}"
: "${MIN_SIZE:=51200}"          # ۵۰ کیلوبایت (بخش F)
: "${USE_WAYBACK:=1}"
: "${DRY_RUN:=0}"

REPORT_TSV="${REPORT_TSV:-$DOWNLOAD_ROOT/گزارش-بازیابی.tsv}"
LOG_FILE="${LOG_FILE:-$DOWNLOAD_ROOT/bazyabi.log}"

C_OK=$'\033[32m'; C_ERR=$'\033[31m'; C_WARN=$'\033[33m'; C_DIM=$'\033[2m'; C_0=$'\033[0m'
[ -t 1 ] || { C_OK=""; C_ERR=""; C_WARN=""; C_DIM=""; C_0=""; }

log()  { printf '%s\n' "$*" | tee -a "$LOG_FILE" >&2; }
ok()   { log "${C_OK}✔${C_0} $*"; }
warn() { log "${C_WARN}⚠${C_0} $*"; }
err()  { log "${C_ERR}✘${C_0} $*"; }
dim()  { log "${C_DIM}· $*${C_0}"; }

# ---------- ابزارها ----------
have() { command -v "$1" >/dev/null 2>&1; }

# شمارش صفحات PDF: اول pdfinfo، بعد pypdf، بعد شمارش خام
pdf_pages() {
  local f="$1"
  if have pdfinfo; then
    pdfinfo "$f" 2>/dev/null | awk '/^Pages:/{print $2; exit}'
    return
  fi
  if have python3 && python3 -c 'import pypdf' 2>/dev/null; then
    python3 - "$f" <<'PY' 2>/dev/null
import sys
from pypdf import PdfReader
try:
    print(len(PdfReader(sys.argv[1], strict=False).pages))
except Exception:
    pass
PY
    return
  fi
  # روش خام: شمارش /Type /Page (تقریبی — فقط وقتی ابزار دیگری نیست)
  grep -a -c '/Type[[:space:]]*/Page[^s]' "$f" 2>/dev/null || true
}

# کد کتاب روی صفحه شناسنامه (بخش F-3)
pdf_book_code() {
  local f="$1"
  have pdftotext || return 0
  pdftotext -f 1 -l 3 "$f" - 2>/dev/null | grep -oE '11[012][0-9]{3}' | head -1
}

# ---------- بررسی سلامت فایل (بخش F) ----------
# verify_pdf <file> <expected_pages|0> <expected_code|-> -> 0 سالم، 1 خراب
verify_pdf() {
  local f="$1" want_pages="${2:-0}" want_code="${3:--}" size hdr pages code
  [ -s "$f" ] || { err "فایل خالی است: $(basename "$f")"; return 1; }
  hdr=$(head -c5 "$f")
  [ "$hdr" = "%PDF-" ] || { err "هدر PDF نیست ($hdr): $(basename "$f")"; return 1; }
  size=$(wc -c <"$f")
  [ "$size" -ge "$MIN_SIZE" ] || { err "حجم کم ($size بایت): $(basename "$f")"; return 1; }

  pages=$(pdf_pages "$f" | tr -dc '0-9')
  if [ -n "$pages" ] && [ "${want_pages:-0}" -gt 0 ] && [ "$pages" != "$want_pages" ]; then
    warn "شمار صفحه $pages است ولی انتظار $want_pages بود: $(basename "$f")"
  fi
  if [ "$want_code" != "-" ] && have pdftotext; then
    code=$(pdf_book_code "$f")
    if [ -n "$code" ] && [ "$code" != "$want_code" ]; then
      warn "کد شناسنامه $code است ولی انتظار $want_code بود: $(basename "$f")"
    fi
  fi
  return 0
}

# ---------- دانلود با زنجیره fallback (بخش E) ----------
_curl() { curl -sL --fail --max-time "$MAX_TIME" -A "$UA" "$@"; }

# try_url <url> <out> -> 0/1
try_url() {
  local url="$1" out="$2" i
  for ((i = 1; i <= TRIES; i++)); do
    if [ "$DRY_RUN" = "1" ]; then dim "[DRY] $url"; return 0; fi
    if _curl -o "$out.part" "$url" && [ -s "$out.part" ] && [ "$(head -c5 "$out.part")" = "%PDF-" ]; then
      mv -f "$out.part" "$out"; return 0
    fi
    rm -f "$out.part"
    [ "$i" -lt "$TRIES" ] && { dim "تلاش $i ناموفق، $((RETRY_SLEEP * i)) ثانیه صبر…"; sleep $((RETRY_SLEEP * i)); }
  done
  return 1
}

# wayback_url <url> -> چاپ نسخه آرشیوی خام یا هیچ
wayback_url() {
  local url="$1" ts
  ts=$(_curl "http://archive.org/wayback/available?url=${url}" 2>/dev/null |
    grep -oE '"timestamp"[[:space:]]*:[[:space:]]*"[0-9]+"' | grep -oE '[0-9]+' | head -1)
  [ -n "$ts" ] && printf '%s/web/%sid_/%s' "$WAYBACK_BASE" "$ts" "$url"
}

# fetch_pdf <out_path> <primary_url> [fallback_url ...]
fetch_pdf() {
  local out="$1"; shift
  local name; name=$(basename "$out")
  mkdir -p "$(dirname "$out")"

  if [ -f "$out" ] && verify_pdf "$out" 0 - >/dev/null 2>&1; then
    dim "از قبل موجود و سالم: $name"; return 0
  fi

  local u
  for u in "$@"; do
    [ -n "$u" ] || continue
    dim "دانلود: $name ← $u"
    if try_url "$u" "$out"; then ok "$name"; return 0; fi
    if [ "$USE_WAYBACK" = "1" ]; then
      local w; w=$(wayback_url "$u" || true)
      if [ -n "$w" ]; then
        dim "آینه Wayback: $w"
        try_url "$w" "$out" && { ok "$name (از Wayback)"; return 0; }
      fi
      dim "ثبت نسخه جدید در Wayback…"
      try_url "$WAYBACK_BASE/save/$u" "$out" && { ok "$name (Wayback save)"; return 0; }
    fi
  done
  err "ناموفق: $name"
  return 1
}

# ---------- گزارش ----------
report_init() {
  mkdir -p "$(dirname "$REPORT_TSV")"
  printf 'دسته\tفایل\tوضعیت\tحجم\tصفحات\tمنبع\n' >"$REPORT_TSV"
}
report_row() { printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" "$6" >>"$REPORT_TSV"; }

# ---------- کمکی‌های نام‌گذاری ----------
# ماه لاتین → فارسی
month_fa() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    khordad) echo "خرداد" ;;
    dey)     echo "دی" ;;
    shahrivar) echo "شهریور" ;;
    tir)     echo "تیر" ;;
    mordad)  echo "مرداد" ;;
    *)       echo "$1" ;;
  esac
}

# سال → سال کامل شمسی. هم دو رقمی (97→1397 ، 04→1404)
# هم چهار رقمی که همان‌طور برمی‌گردد (1404→1404).
# توجه: konkur.in هر دو شکل را به‌کار می‌برد:
#   Khordad-04-Fizik3T-...  و  Khordad-1404-Fizik3T-...
year_fa() {
  local y="$1"
  if [ "${#y}" -ge 4 ]; then printf '%s' "$y"; return; fi
  local yy="${y#0}"; [ -z "$yy" ] && yy=0
  if [ "$yy" -ge 90 ]; then echo "13$y"; else printf '14%02d' "$yy"; fi
}

# رشته از نام فایل مبدأ: Fizik3T→تجربی ، Fizik3R→ریاضی
branch_fa() {
  case "$1" in
    *Fizik3T*|*fizik3t*) echo "تجربی" ;;
    *Fizik3R*|*fizik3r*) echo "ریاضی" ;;
    *) echo "" ;;
  esac
}

# نام فارسی فایل نهایی از URL مبدأ
nahayi_name() {
  local url="$1" base m y br
  base=$(basename "${url%%\?*}")
  m=$(printf '%s' "$base" | grep -oiE '^(khordad|dey|shahrivar|tir|mordad)' | head -1)
  # سال ممکن است ۲ یا ۴ رقمی باشد — هر دو شکل روی dl.konkur.in دیده شده است
  y=$(printf '%s' "$base" | sed -nE 's/^[A-Za-z]+-([0-9]{2,4}).*/\1/p' | head -1)
  br=$(branch_fa "$base")
  if [ -n "$m" ] && [ -n "$y" ] && [ -n "$br" ]; then
    printf '%s-%s-فیزیک3-%s.pdf' "$(month_fa "$m")" "$(year_fa "$y")" "$br"
  else
    printf '%s' "$base"
  fi
}
