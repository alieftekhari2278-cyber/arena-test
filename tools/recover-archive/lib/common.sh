#!/usr/bin/env bash
# توابع مشترک بازیابی آرشیو — بخش‌های E و F سند بازیابی
# shellcheck shell=bash

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
CURL_BASE=(curl -sSL -g --compressed -A "$UA" --connect-timeout 20 --max-time "${MAX_TIME:-300}")

C_RESET=$'\033[0m'; C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_B=$'\033[1m'
if [ ! -t 1 ]; then C_RESET=""; C_OK=""; C_WARN=""; C_ERR=""; C_DIM=""; C_B=""; fi

log()      { printf '%s\n' "$*"; }
log_step() { printf '\n%s▸ %s%s\n' "$C_B" "$*" "$C_RESET"; }
log_ok()   { printf '  %s✓%s %s\n' "$C_OK" "$C_RESET" "$*"; }
log_warn() { printf '  %s!%s %s\n' "$C_WARN" "$C_RESET" "$*"; }
log_err()  { printf '  %s✗%s %s\n' "$C_ERR" "$C_RESET" "$*"; }
log_dim()  { printf '  %s%s%s\n' "$C_DIM" "$*" "$C_RESET"; }

have() { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------- اندازه فایل
file_size() { [ -f "$1" ] || { echo 0; return; }; wc -c <"$1" | tr -d ' '; }

human_size() {
  local b="${1:-0}"
  if   [ "$b" -ge 1048576 ]; then awk -v b="$b" 'BEGIN{printf "%.1fMB", b/1048576}'
  elif [ "$b" -ge 1024 ];    then awk -v b="$b" 'BEGIN{printf "%.0fKB", b/1024}'
  else printf '%sB' "$b"; fi
}

# ------------------------------------------------- بخش F-1: هدر و حجم فایل PDF
is_pdf() {
  local f="$1" min="${2:-50000}"
  [ -f "$f" ] || return 1
  [ "$(file_size "$f")" -ge "$min" ] || return 1
  [ "$(head -c 5 "$f" 2>/dev/null)" = "%PDF-" ] || return 1
  return 0
}

is_zip() {
  local f="$1"
  [ -f "$f" ] || return 1
  [ "$(head -c 2 "$f" 2>/dev/null)" = "PK" ] || return 1
  return 0
}

# ------------------------------------------------------- بخش F-2: شمارش صفحات
# ترتیب: pdfinfo (poppler) ← pypdf ← شمارش خام /Type /Page
pdf_pages() {
  local f="$1" n=""
  if have pdfinfo; then
    n=$(pdfinfo "$f" 2>/dev/null | awk '/^Pages:/{print $2}')
  fi
  if [ -z "$n" ] && have python3; then
    n=$(python3 - "$f" <<'PY' 2>/dev/null
import sys
try:
    from pypdf import PdfReader
except Exception:
    try:
        from PyPDF2 import PdfReader  # type: ignore
    except Exception:
        sys.exit(1)
try:
    print(len(PdfReader(sys.argv[1], strict=False).pages))
except Exception:
    sys.exit(1)
PY
)
  fi
  if [ -z "$n" ]; then
    n=$(LC_ALL=C grep -a -c '/Type[[:space:]]*/Page[^s]' "$f" 2>/dev/null || true)
    [ "${n:-0}" -eq 0 ] && n=""
  fi
  printf '%s' "${n:-?}"
}

# ------------------------------------- بخش F-3: کد کتاب روی صفحه شناسنامه (۲)
pdf_book_code() {
  local f="$1"
  have pdftotext || { printf '%s' "-"; return; }
  pdftotext -f 1 -l 3 "$f" - 2>/dev/null | grep -oE '11[012][0-9]{3}' | head -1
}

# متن صفحه اول (برای تشخیص «فیزیک (3)» و رشته در نهایی/کنکور)
pdf_first_page_text() {
  local f="$1"
  have pdftotext || return 1
  pdftotext -f 1 -l 1 "$f" - 2>/dev/null
}

sha256_of() {
  if have sha256sum; then sha256sum "$1" | awk '{print $1}'
  elif have shasum;  then shasum -a 256 "$1" | awk '{print $1}'
  else printf '%s' "-"; fi
}

# --------------------------------------------------------- بخش E: زنجیره دانلود
# http_code URL  → فقط کد وضعیت
http_code() {
  local out
  out=$("${CURL_BASE[@]}" -o /dev/null -w '%{http_code}' --max-time 30 -r 0-1 "$1" 2>/dev/null)
  printf '%s' "${out:-000}"
}

# try_download URL DEST  → یک تلاش ساده (بدون fallback)
try_download() {
  local url="$1" dest="$2" tmp
  tmp="${dest}.part"
  if "${CURL_BASE[@]}" --retry 2 --retry-delay 5 -o "$tmp" "$url" 2>/dev/null; then
    if [ -s "$tmp" ]; then mv -f "$tmp" "$dest"; return 0; fi
  fi
  rm -f "$tmp" 2>/dev/null
  return 1
}

# نسخه‌ی آرشیو Wayback برای یک آدرس (بایت خام با پسوند id_)
wayback_url() {
  local url="$1" snap=""
  snap=$("${CURL_BASE[@]}" --max-time 45 "http://archive.org/wayback/available?url=${url}" 2>/dev/null |
    python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
    print(d.get("archived_snapshots",{}).get("closest",{}).get("url",""))
except Exception:
    print("")' 2>/dev/null)
  [ -z "$snap" ] && return 1
  # تبدیل https://web.archive.org/web/20240101010101/URL → .../20240101010101id_/URL
  printf '%s' "$snap" | sed -E 's#(/web/[0-9]{14})/#\1id_/#'
}

# fetch_pdf URL DEST MIN_SIZE [EXTRA_MIRROR...]
# زنجیره‌ی بخش E: تلاش مستقیم → تکرار با تأخیر → http/https → آینه‌ها → Wayback → ثبت در Wayback
fetch_pdf() {
  local url="$1" dest="$2" min="${3:-50000}"; shift 3 || true
  local mirrors=("$@") cand alt wb attempt

  if is_pdf "$dest" "$min"; then
    log_ok "از قبل موجود و سالم: $(basename "$dest") ($(human_size "$(file_size "$dest")"))"
    SOURCE_USED="cache"
    return 0
  fi

  for attempt in 1 2 3; do
    if try_download "$url" "$dest" && is_pdf "$dest" "$min"; then
      SOURCE_USED="$url"; return 0
    fi
    rm -f "$dest" 2>/dev/null
    [ "$attempt" -lt 3 ] && { log_dim "تلاش $attempt ناموفق؛ ${RETRY_SLEEP:-12} ثانیه صبر…"; sleep "${RETRY_SLEEP:-12}"; }
  done

  # http ↔ https
  case "$url" in
    http://*)  alt="https://${url#http://}" ;;
    https://*) alt="http://${url#https://}" ;;
    *)         alt="" ;;
  esac
  if [ -n "$alt" ]; then
    log_dim "تلاش با پروتکل جایگزین…"
    if try_download "$alt" "$dest" && is_pdf "$dest" "$min"; then SOURCE_USED="$alt"; return 0; fi
    rm -f "$dest" 2>/dev/null
  fi

  for cand in "${mirrors[@]:-}"; do
    [ -z "$cand" ] || [ "$cand" = "-" ] && continue
    log_dim "آینه: $cand"
    if try_download "$cand" "$dest" && is_pdf "$dest" "$min"; then SOURCE_USED="$cand"; return 0; fi
    rm -f "$dest" 2>/dev/null
  done

  if [ "${USE_WAYBACK:-1}" = "1" ]; then
    log_dim "جستجو در Wayback Machine…"
    if wb=$(wayback_url "$url") && [ -n "$wb" ]; then
      if try_download "$wb" "$dest" && is_pdf "$dest" "$min"; then SOURCE_USED="$wb"; return 0; fi
      rm -f "$dest" 2>/dev/null
    fi
    log_dim "درخواست ثبت نسخه‌ی تازه در Wayback…"
    if try_download "https://web.archive.org/save/${url}" "$dest" && is_pdf "$dest" "$min"; then
      SOURCE_USED="web.archive.org/save"; return 0
    fi
    rm -f "$dest" 2>/dev/null
  fi

  SOURCE_USED=""
  return 1
}

# استخراج لینک‌های dl.konkur.in از یک صفحه‌ی konkur.in
scrape_konkur_links() {
  local page_url="$1"
  "${CURL_BASE[@]}" --max-time 90 "$page_url" 2>/dev/null |
    grep -oE 'https://dl\.konkur\.in/[A-Za-z0-9._%/()-]+\.(pdf|zip|rar)' |
    awk '!seen[$0]++'
}

url_basename() { printf '%s' "${1##*/}"; }

# بررسی در دسترس بودن منابع (تشخیص سریع مشکل شبکه/فیلترینگ)
net_check() {
  local host status
  REACHABLE=0
  log_step "بررسی دسترسی به منابع"
  printf '  %-34s %-8s %s\n' "میزبان" "وضعیت" "توضیح"
  for host in \
    "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/712/C112244.pdf" \
    "https://konkur.in/" \
    "https://dl.konkur.in/2025/07/Khordad-1404-Fizik3T-%5Bwww.konkur.in%5D.pdf" \
    "https://physicfa.ir/wp-content/uploads/2024/12/Physic1T-1403-1404-physicfa.pdf" \
    "http://archive.org/wayback/available?url=chap.sch.ir"
  do
    status=$(http_code "$host")
    case "$status" in
      200|206|30*) REACHABLE=$((REACHABLE+1)); printf '  %-34s %s%-8s%s در دسترس\n'  "$(printf '%s' "$host" | cut -c1-34)" "$C_OK"   "$status" "$C_RESET" ;;
      000)         printf '  %-34s %s%-8s%s بدون پاسخ (فیلتر/عدم دسترسی شبکه)\n' "$(printf '%s' "$host" | cut -c1-34)" "$C_ERR" "$status" "$C_RESET" ;;
      *)           printf '  %-34s %s%-8s%s پاسخ غیرمنتظره\n' "$(printf '%s' "$host" | cut -c1-34)" "$C_WARN" "$status" "$C_RESET" ;;
    esac
  done
}

# ------------------------------------------- نام‌گذاری فارسی فایل‌های نهایی
month_fa_of() {
  case "$1" in
    Khordad) printf 'خرداد' ;; Dey) printf 'دی' ;; Shahrivar) printf 'شهریور' ;;
    Tir) printf 'تیر' ;; Mordad) printf 'مرداد' ;; Bahman) printf 'بهمن' ;;
    *) printf '%s' "$1" ;;
  esac
}

# از نام فایل konkur.in نام فارسی مقصد می‌سازد: Khordad-1404-Fizik3T-... → خرداد-1404-فیزیک3-تجربی.pdf
fa_name_from_url() {
  local base month year stream
  base="$(url_basename "$1")"
  month="$(printf '%s' "$base" | sed -nE 's/^([A-Za-z]+)-([0-9]{2,4})-Fizik3([TR]).*/\1/p')"
  year="$( printf '%s' "$base" | sed -nE 's/^([A-Za-z]+)-([0-9]{2,4})-Fizik3([TR]).*/\2/p')"
  stream="$(printf '%s' "$base" | sed -nE 's/^([A-Za-z]+)-([0-9]{2,4})-Fizik3([TR]).*/\3/p')"
  [ -z "$month" ] && return 1
  [ "${#year}" -eq 2 ] && year="13${year}"
  if [ "$stream" = "T" ]; then stream="تجربی"; else stream="ریاضی"; fi
  printf '%s-%s-فیزیک3-%s.pdf' "$(month_fa_of "$month")" "$year" "$stream"
}
