#!/usr/bin/env bash
# ============================================================================
#  بازیابی کامل آرشیو فیزیک کنکور ۱۴۰۶  —  اجرای خودکار بندهای A تا G
#  استفاده:  bash recover-archive.sh            (پیش‌فرض: /home/z/my-project/download)
#            BASE=/masir/delkhah bash recover-archive.sh
#            bash recover-archive.sh books|nahayi|konkur|verify|report
# ============================================================================
set -uo pipefail

BASE="${BASE:-/home/z/my-project/download}"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
MAXTIME=300
MINSIZE=51200            # ۵۰ کیلوبایت
LOG="$BASE/_recovery.log"
MANIFEST="$BASE/_manifest.tsv"

DIR_BOOKS="$BASE/kotob-darsi"
DIR_NAHAYI="$BASE/nahayi-fizik12"
DIR_NAHAYI_R="$DIR_NAHAYI/فیزیک3-مکمل-رشته-ریاضی"
DIR_KONKUR="$BASE/konkur-fizik"

C_OK=$'\033[32m'; C_ERR=$'\033[31m'; C_WARN=$'\033[33m'; C_OFF=$'\033[0m'
log()  { printf '%s\n' "$*" | tee -a "$LOG" >&2; }
ok()   { log "${C_OK}✔${C_OFF} $*"; }
err()  { log "${C_ERR}✘${C_OFF} $*"; }
warn() { log "${C_WARN}!${C_OFF} $*"; }

need() { command -v "$1" >/dev/null 2>&1; }
need curl || { echo "curl لازم است"; exit 1; }
HAVE_PDFINFO=0; need pdfinfo && HAVE_PDFINFO=1
HAVE_PDFTOTEXT=0; need pdftotext && HAVE_PDFTOTEXT=1

mkdir -p "$DIR_BOOKS" "$DIR_NAHAYI_R" "$DIR_KONKUR"
: >"$LOG"; [ -f "$MANIFEST" ] || printf 'file\tstatus\tbytes\tpages\tsource\n' >"$MANIFEST"

# ---------------------------------------------------------------- ابزارها ---
is_pdf() { [ -f "$1" ] && [ "$(head -c5 "$1" 2>/dev/null)" = "%PDF-" ]; }
fsize()  { wc -c <"$1" 2>/dev/null | tr -d ' '; }

# دانلود با ۳ تلاش + تأخیر، سپس fallback به Wayback (بند E)
fetch() {          # fetch <url> <dest>
  local url="$1" dest="$2" try
  if is_pdf "$dest" && [ "$(fsize "$dest")" -gt "$MINSIZE" ]; then
    ok "از قبل موجود: $(basename "$dest")"; return 0
  fi
  for try in 1 2 3; do
    curl -sL --max-time "$MAXTIME" -A "$UA" -e "https://www.google.com/" \
         --retry 2 --retry-delay 5 -o "$dest.part" "$url" && \
      is_pdf "$dest.part" && [ "$(fsize "$dest.part")" -gt "$MINSIZE" ] && {
        mv -f "$dest.part" "$dest"; ok "دانلود شد ($(fsize "$dest") بایت): $(basename "$dest")"
        printf '%s\tOK\t%s\t-\t%s\n' "$(basename "$dest")" "$(fsize "$dest")" "$url" >>"$MANIFEST"
        return 0; }
    rm -f "$dest.part"; warn "تلاش $try ناموفق: $url"; sleep $((try*10))
  done
  # --- Wayback ---
  local ts
  ts=$(curl -s --max-time 60 "http://archive.org/wayback/available?url=${url#*://}" |
       grep -oE '"timestamp": *"[0-9]+"' | grep -oE '[0-9]+' | head -1)
  if [ -n "${ts:-}" ]; then
    warn "تلاش از Wayback (نسخه $ts)..."
    curl -sL --max-time "$MAXTIME" -A "$UA" -o "$dest.part" \
      "https://web.archive.org/web/${ts}id_/${url}" && is_pdf "$dest.part" && \
      [ "$(fsize "$dest.part")" -gt "$MINSIZE" ] && {
        mv -f "$dest.part" "$dest"; ok "از Wayback بازیابی شد: $(basename "$dest")"
        printf '%s\tOK-WAYBACK\t%s\t-\t%s\n' "$(basename "$dest")" "$(fsize "$dest")" "$url" >>"$MANIFEST"
        return 0; }
    rm -f "$dest.part"
  fi
  err "شکست کامل: $url"
  printf '%s\tFAIL\t0\t-\t%s\n' "$(basename "$dest")" "$url" >>"$MANIFEST"
  return 1
}

# ------------------------------------------------- A) کتاب‌های درسی --------
# ردیف: کدکتاب | دوره(سال/دسته) | صفحات | سال‌چاپ | نام فایل
BOOKS=$(cat <<'EOF'
110210|1403-1404/40|136|1403|شیمی-۱-دهم-تجربی-چاپ-1403-1404.pdf
110211|1403-1404/40|176|1403|ریاضی-۱-دهم-تجربی-چاپ-1403-1404.pdf
110216|1403-1404/40|120|1403|زیست-شناسی-۱-دهم-تجربی-چاپ-1403-1404.pdf
111210|1404-1405/41|136|1404|شیمی-۲-یازدهم-تجربی-چاپ-1404-1405.pdf
111211|1404-1405/41|176|1404|ریاضی-۲-یازدهم-تجربی-چاپ-1404-1405.pdf
111216|1404-1405/41|168|1404|زیست-شناسی-۲-یازدهم-تجربی-چاپ-1404-1405.pdf
111237|1404-1405/41|128|1404|زمین-شناسی-یازدهم-چاپ-1404-1405.pdf
111244|1404-1405/41|119|1404|فیزیک-۲-یازدهم-تجربی-چاپ-1404-1405.pdf
112210|1405-1406/712|136|1405|شیمی-۳-دوازدهم-تجربی-چاپ-1405-1406.pdf
112211|1405-1406/712|160|1405|ریاضی-۳-دوازدهم-تجربی-چاپ-1405-1406.pdf
112216|1405-1406/712|136|1405|زیست-شناسی-۳-دوازدهم-تجربی-چاپ-1405-1406.pdf
112244|1405-1406/712|143|1405|فیزیک-۳-دوازدهم-تجربی-چاپ-1405-1406.pdf
EOF
)

do_books() {
  log "=== A) کتاب‌های درسی (chap.sch.ir) ==="
  local code path pages year name
  while IFS='|' read -r code path pages year name; do
    [ -z "$code" ] && continue
    fetch "http://chap.sch.ir/sites/default/files/lbooks/${path}/C${code}.pdf" "$DIR_BOOKS/$name" ||
      fetch "https://dl.daneshchi.ir/file/chap-school/${path}/C${code}.pdf" "$DIR_BOOKS/$name"
  done <<<"$BOOKS"

  # فیزیک ۱ دهم چاپ ۱۴۰۳ از chap.sch.ir حذف شده → آینه فیزیک‌فا
  fetch "https://physicfa.ir/wp-content/uploads/2024/12/Physic1T-1403-1404-physicfa.pdf" \
        "$DIR_BOOKS/فیزیک-۱-دهم-تجربی-چاپ-1403-1404.pdf"
  # پشتیبان: فیزیک ۱ دهم چاپ ۱۴۰۴
  fetch "http://chap.sch.ir/sites/default/files/lbooks/1404-1405/40/C110214.pdf" \
        "$DIR_BOOKS/پشتیبان-فیزیک-۱-دهم-تجربی-چاپ-1404-1405.pdf"
}

# ----------------------------- استخراج لینک‌های PDF از یک صفحه konkur.in ---
scrape_pdfs() {    # scrape_pdfs <page-url>
  curl -sL --max-time 120 -A "$UA" -e "https://konkur.in/" "$1" |
    grep -oE 'https?://dl\.konkur\.in/[^"'"'"' <>]+\.pdf' | sort -u
}

# شماره‌ی ماه فارسی از نام فایل انگلیسی
fa_month() { case "$1" in
  Khordad|khordad|Khordad*) echo "خرداد";; Dey|dey)  echo "دی";;
  Shahrivar|shahrivar)      echo "شهریور";; Tir|tir) echo "تیر";;
  Mordad|mordad)            echo "مرداد";; Bahman|bahman) echo "بهمن";;
  *) echo "$1";; esac; }

# --------------------------------------- B) امتحان نهایی فیزیک ۳ ----------
do_nahayi() {
  log "=== B) امتحان نهایی فیزیک ۳ (konkur.in/89691) ==="
  local page="https://konkur.in/89691/" u base month yy fa dest
  local links; links=$(scrape_pdfs "$page")
  [ -z "$links" ] && { err "هیچ لینکی از صفحه ۸۹۶۹۱ استخراج نشد (سایت مسدود؟)"; return 1; }
  log "تعداد لینک یافت‌شده: $(wc -l <<<"$links")"
  while read -r u; do
    [ -z "$u" ] && continue
    base=$(basename "$u")
    case "$base" in *Fizik3T*|*Fizik3R*) ;; *) continue;; esac
    month=$(cut -d- -f1 <<<"$base"); yy=$(cut -d- -f2 <<<"$base")
    fa=$(fa_month "$month")
    case "$base" in
      *Fizik3T*) dest="$DIR_NAHAYI/${fa}-14${yy}-فیزیک3-تجربی.pdf";;
      *)         dest="$DIR_NAHAYI_R/${fa}-14${yy}-فیزیک3-ریاضی.pdf";;
    esac
    [[ "$yy" =~ ^[0-9]{2}$ ]] || dest="$DIR_NAHAYI/$base"
    fetch "$u" "$dest"
  done <<<"$links"
}

# ------------------------------------------- C) کنکور تجربی ۱۴۰۰–۱۴۰۵ -----
KONKUR_PAGES=$(cat <<'EOF'
125397|1405
117416|1404-نوبت1
119129|1404-نوبت2
109465|1403-نوبت1
111823|1403-نوبت2
101624|1402-نوبت1
104737|1402-نوبت2
96826|1401
90630|1400
EOF
)

do_konkur() {
  log "=== C) کنکور سراسری تجربی (۹ دوره) ==="
  local id label links u base dest n
  while IFS='|' read -r id label; do
    [ -z "$id" ] && continue
    log "— دوره $label (صفحه $id)"
    links=$(scrape_pdfs "https://konkur.in/${id}/")
    [ -z "$links" ] && { err "لینکی از صفحه $id استخراج نشد"; continue; }
    n=0
    while read -r u; do
      base=$(basename "$u")
      case "$base" in
        *Tajrobi*|*Key*|*Fizik*|*fizik*) ;;
        *) continue;;
      esac
      dest="$DIR_KONKUR/${label}-$(sed 's/%5Bwww.konkur.in%5D//; s/--*/-/g; s/-\.pdf/.pdf/' <<<"$base")"
      fetch "$u" "$dest" && n=$((n+1))
      sleep 2
    done <<<"$links"
    log "   فایل‌های گرفته‌شده این دوره: $n"
  done <<<"$KONKUR_PAGES"
}

# ------------------------------------------------ F) راستی‌آزمایی ---------
do_verify() {
  log "=== F) راستی‌آزمایی ==="
  local f sz pg code expect_pages expect_code name
  # ۱و۲) همه فایل‌ها: هدر و حجم
  while IFS= read -r -d '' f; do
    sz=$(fsize "$f")
    if ! is_pdf "$f"; then err "PDF معتبر نیست: ${f#$BASE/}"; continue; fi
    [ "$sz" -lt "$MINSIZE" ] && { err "حجم کم ($sz): ${f#$BASE/}"; continue; }
    pg="-"; [ "$HAVE_PDFINFO" = 1 ] && pg=$(pdfinfo "$f" 2>/dev/null | awk '/^Pages/{print $2}')
    ok "سالم [$sz بایت، $pg صفحه] ${f#$BASE/}"
  done < <(find "$BASE" -name '*.pdf' -print0 | sort -z)

  # ۳) تطبیق صفحه و کد کتاب برای کتاب‌های درسی
  [ "$HAVE_PDFINFO" = 1 ] || { warn "pdfinfo نصب نیست؛ کنترل صفحه انجام نشد (apt install poppler-utils)"; return; }
  local c p pgs yr nm
  while IFS='|' read -r c p pgs yr nm; do
    [ -z "$c" ] && continue
    f="$DIR_BOOKS/$nm"; [ -f "$f" ] || { err "غایب: $nm"; continue; }
    pg=$(pdfinfo "$f" 2>/dev/null | awk '/^Pages/{print $2}')
    [ "$pg" = "$pgs" ] && ok "صفحات درست ($pg) → $nm" || err "صفحات ناهمخوان: $pg ≠ $pgs → $nm"
    if [ "$HAVE_PDFTOTEXT" = 1 ]; then
      code=$(pdftotext -f 2 -l 2 "$f" - 2>/dev/null | grep -oE '11[012][0-9]{3}' | head -1)
      [ "$code" = "$c" ] && ok "کد شناسنامه درست ($code) → $nm" \
                         || warn "کد شناسنامه: «${code:-نامشخص}» انتظار $c → $nm"
    fi
  done <<<"$BOOKS"
}

# --------------------------------------------------- گزارش فارسی ---------
do_report() {
  local b n r k tot
  b=$(find "$DIR_BOOKS"   -name '*.pdf' 2>/dev/null | wc -l)
  n=$(find "$DIR_NAHAYI"  -maxdepth 1 -name '*.pdf' 2>/dev/null | wc -l)
  r=$(find "$DIR_NAHAYI_R" -name '*.pdf' 2>/dev/null | wc -l)
  k=$(find "$DIR_KONKUR"  -name '*.pdf' 2>/dev/null | wc -l)
  tot=$((b+n+r+k))
  cat <<EOF | tee "$BASE/_گزارش.txt"

📦 گزارش بازیابی آرشیو — $(date '+%Y-%m-%d %H:%M')
مسیر پایه: $BASE
────────────────────────────────────────────
کتاب‌های درسی        : $b  فایل  (انتظار: ۱۴)
نهایی فیزیک۳ تجربی   : $n  فایل  (انتظار: ۲۳)
نهایی فیزیک۳ ریاضی   : $r  فایل  (انتظار: ۲۳)
کنکور تجربی ۱۴۰۰–۱۴۰۵: $k  فایل  (انتظار: ۳۶)
────────────────────────────────────────────
مجموع: $tot فایل | حجم: $(du -sh "$BASE" 2>/dev/null | cut -f1)
شکست‌ها: $(grep -c 'FAIL' "$MANIFEST" 2>/dev/null | head -1)  (جزئیات در _manifest.tsv و _recovery.log)
EOF
}

case "${1:-all}" in
  books)  do_books;;
  nahayi) do_nahayi;;
  konkur) do_konkur;;
  verify) do_verify;;
  report) do_report;;
  all)    do_books; do_nahayi; do_konkur; do_verify; do_report;;
  *) echo "usage: $0 [all|books|nahayi|konkur|verify|report]"; exit 1;;
esac
