#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# بازیابی کامل آرشیو فیزیک کنکور ۱۴۰۶ (کتاب درسی + نهایی فیزیک ۳ + کنکور تجربی)
# پیاده‌سازی مستقیم بخش‌های A تا G سند «راهنمای بازیابی کامل دانلودها»
#
#   bash recover.sh                 # اجرای کامل (کتاب‌ها → نهایی → کنکور → راستی‌آزمایی → گزارش)
#   bash recover.sh --net-check     # فقط تست دسترسی به منابع
#   bash recover.sh --only books    # فقط بخش A
#   bash recover.sh --only nahayi   # فقط بخش B
#   bash recover.sh --only konkur   # فقط بخش C
#   bash recover.sh --verify-only   # فقط راستی‌آزمایی و گزارش روی فایل‌های موجود
#   DL_DIR=/path/to/download bash recover.sh    # تعیین دستی مسیر ذخیره
# ------------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
# shellcheck source=lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

MODE="all"; DRY_RUN=0; DO_NET_CHECK=0; NO_SCRAPE=0; WANT_ZIP=0
MIN_BOOK=100000      # بخش F: کتاب درسی باید > ۱۰۰KB باشد
MIN_EXAM=40000       # نهایی/کنکور: > ۴۰KB
PAGE_TOL=2           # اختلاف مجاز شمار صفحه با جدول بخش A

while [ $# -gt 0 ]; do
  case "$1" in
    --only)        MODE="${2:-all}"; shift 2 ;;
    --only=*)      MODE="${1#*=}"; shift ;;
    --verify-only) MODE="verify"; shift ;;
    --net-check)   DO_NET_CHECK=1; shift ;;
    --no-scrape)   NO_SCRAPE=1; shift ;;
    --zip)         WANT_ZIP=1; shift ;;
    --dry-run)     DRY_RUN=1; shift ;;
    -h|--help)     sed -n '2,20p' "$0"; exit 0 ;;
    *) log_err "گزینه ناشناخته: $1"; exit 2 ;;
  esac
done

# ------------------------------------------------------------ مسیر ذخیره‌سازی
if [ -z "${DL_DIR:-}" ]; then
  if mkdir -p /home/z/my-project/download 2>/dev/null; then
    DL_DIR="/home/z/my-project/download"                       # مسیر رسمی سند
  else
    DL_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)/download"         # جایگزین داخل مخزن
  fi
fi
BOOKS_DIR="$DL_DIR/kotob-darsi"
NAHAYI_DIR="$DL_DIR/nahayi-fizik12"
NAHAYI_R_DIR="$NAHAYI_DIR/فیزیک3-مکمل-رشته-ریاضی"
KONKUR_DIR="$DL_DIR/konkur-fizik"
MANIFEST="$DL_DIR/manifest.tsv"
REPORT="$DL_DIR/گزارش-بازیابی.md"

OK_COUNT=0; FAIL_COUNT=0; SKIP_COUNT=0
FAILED_LIST=""

record() { # بخش | نام فایل | وضعیت | حجم | صفحات | توضیح | منبع
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" "$6" "$7" >>"$MANIFEST"
}

mark_ok()   { OK_COUNT=$((OK_COUNT+1)); }
mark_fail() { FAIL_COUNT=$((FAIL_COUNT+1)); FAILED_LIST="${FAILED_LIST}\n  - $1"; }

# ------------------------------------------------------------- بخش G-۱: پوشه‌ها
make_dirs() {
  log_step "ساخت ساختار پوشه‌ها در: $DL_DIR"
  mkdir -p "$BOOKS_DIR" "$NAHAYI_DIR" "$NAHAYI_R_DIR" "$KONKUR_DIR" || {
    log_err "ساخت پوشه ممکن نشد: $DL_DIR"; exit 1; }
  log_ok "$BOOKS_DIR"
  log_ok "$NAHAYI_DIR"
  log_ok "$NAHAYI_R_DIR"
  log_ok "$KONKUR_DIR"
}

# ------------------------------------------------ بخش A: کتاب‌های درسی رسمی
do_books() {
  log_step "بخش A — کتاب‌های درسی (chap.sch.ir)"
  local key code term cat fname pages year override url dest got_pages got_code note
  while IFS=$'\t' read -r key code term cat fname pages year override; do
    case "$key" in ''|\#*) continue ;; esac
    url="http://chap.sch.ir/sites/default/files/lbooks/${term}/${cat}/C${code}.pdf"
    dest="$BOOKS_DIR/$fname"
    log "  → $fname"
    if [ "$DRY_RUN" = 1 ]; then log_dim "$url"; SKIP_COUNT=$((SKIP_COUNT+1)); continue; fi

    if fetch_pdf "$url" "$dest" "$MIN_BOOK" "$override"; then
      got_pages="$(pdf_pages "$dest")"
      got_code="$(pdf_book_code "$dest")"
      note=""
      if [ "$got_pages" != "?" ] && [ -n "$got_pages" ]; then
        if [ "$got_pages" -lt $((pages-PAGE_TOL)) ] || [ "$got_pages" -gt $((pages+PAGE_TOL)) ]; then
          note="صفحات ناهمخوان (انتظار $pages)"
        fi
      fi
      if [ -n "$got_code" ] && [ "$got_code" != "-" ] && [ "$got_code" != "$code" ]; then
        note="${note:+$note؛ }کد کتاب $got_code ≠ $code"
      fi
      if [ -n "$note" ]; then
        log_warn "$fname — $note"
        record "کتاب درسی" "$fname" "مشکوک" "$(human_size "$(file_size "$dest")")" "$got_pages" "$note" "$SOURCE_USED"
        mark_ok
      else
        log_ok "$fname — $(human_size "$(file_size "$dest")") / $got_pages صفحه / کد ${got_code:-?} / چاپ $year"
        record "کتاب درسی" "$fname" "سالم" "$(human_size "$(file_size "$dest")")" "$got_pages" "کد ${got_code:-?}، چاپ $year" "$SOURCE_USED"
        mark_ok
      fi
    else
      log_err "$fname — دانلود ناموفق از همه منابع"
      record "کتاب درسی" "$fname" "ناموفق" "-" "-" "همه منابع شکست خورد" "$url"
      mark_fail "$fname"
    fi
  done <"$DATA_DIR/books.tsv"
}

# --------------------------------------- بخش B: امتحان نهایی فیزیک ۳ (konkur.in)
download_nahayi_one() { # URL  DEST_DIR  FILENAME  BRANCH_LABEL
  local url="$1" dir="$2" fname="$3" label="$4" dest txt note
  dest="$dir/$fname"
  if [ "$DRY_RUN" = 1 ]; then log_dim "$url → $fname"; SKIP_COUNT=$((SKIP_COUNT+1)); return 0; fi
  if fetch_pdf "$url" "$dest" "$MIN_EXAM"; then
    note=""
    txt="$(pdf_first_page_text "$dest" 2>/dev/null)"
    if [ -n "$txt" ]; then
      printf '%s' "$txt" | grep -q "فيزيك\|فیزیک" || note="عنوان «فیزیک» در صفحه ۱ دیده نشد"
    fi
    local status="سالم"
    [ -n "$note" ] && status="مشکوک"
    log_ok "$fname — $(human_size "$(file_size "$dest")") / $(pdf_pages "$dest") صفحه${note:+ ($note)}"
    record "نهایی $label" "$fname" "$status" "$(human_size "$(file_size "$dest")")" "$(pdf_pages "$dest")" "${note:--}" "$SOURCE_USED"
    mark_ok
  else
    log_err "$fname — دانلود ناموفق"
    record "نهایی $label" "$fname" "ناموفق" "-" "-" "دانلود نشد" "$url"
    mark_fail "$fname"
  fi
}

do_nahayi() {
  log_step "بخش B — امتحان نهایی فیزیک ۳ دوازدهم (konkur.in)"
  local stream month year size url fname dir label
  local -a scraped=()

  if [ "$WANT_ZIP" = 1 ]; then
    log_dim "حالت --zip: آرشیو یکجای هر رشته (رمز فایل: www.konkur.in)"
    try_download "https://dl.konkur.in/2025/12/FinalExam-Fizik3T-Paye12-%5Bkonkur.in%5D.zip" "$NAHAYI_DIR/آرشیو-کامل-فیزیک3-تجربی.zip" \
      && log_ok "آرشیو تجربی دریافت شد" || log_err "آرشیو تجربی دریافت نشد"
    try_download "https://dl.konkur.in/2025/12/FinalExam-Fizik3R-Paye12-%5Bkonkur.in%5D.zip" "$NAHAYI_R_DIR/آرشیو-کامل-فیزیک3-ریاضی.zip" \
      && log_ok "آرشیو ریاضی دریافت شد" || log_err "آرشیو ریاضی دریافت نشد"
  fi

  # ۱) فهرست ثابتِ راستی‌آزمایی‌شده
  while IFS=$'\t' read -r stream month year size url fname; do
    case "$stream" in ''|\#*) continue ;; esac
    if [ "$stream" = "T" ]; then dir="$NAHAYI_DIR"; label="تجربی"; else dir="$NAHAYI_R_DIR"; label="ریاضی"; fi
    download_nahayi_one "$url" "$dir" "$fname" "$label"
  done <"$DATA_DIR/nahayi-fizik3.tsv"

  # ۲) استخراج زنده از صفحه آرشیو + صفحه تیر ۱۴۰۵ (هر فایل تازه‌ای که در فهرست بالا نباشد)
  [ "$NO_SCRAPE" = 1 ] && return 0
  [ "$DRY_RUN" = 1 ] && return 0
  log_dim "استخراج لینک‌های تازه از صفحه‌های ۸۹۶۹۱ و ۱۲۴۹۲۷…"
  mapfile -t scraped < <(
    { scrape_konkur_links "https://konkur.in/89691/"; scrape_konkur_links "https://konkur.in/124927/"; } |
      grep -E 'Fizik3[TR]' | awk '!seen[$0]++'
  )
  [ "${#scraped[@]}" -eq 0 ] && { log_warn "لینکی استخراج نشد (سایت در دسترس نیست یا ساختار عوض شده)"; return 0; }
  log_dim "${#scraped[@]} لینک فیزیک۳ پیدا شد"
  for url in "${scraped[@]}"; do
    fname="$(fa_name_from_url "$url")" || continue
    [ -z "$fname" ] && continue
    case "$url" in *Fizik3T*) dir="$NAHAYI_DIR"; label="تجربی" ;; *) dir="$NAHAYI_R_DIR"; label="ریاضی" ;; esac
    [ -f "$dir/$fname" ] && continue
    log "  → (تازه) $fname"
    download_nahayi_one "$url" "$dir" "$fname" "$label"
  done
}

# ------------------------------------------- بخش C: کنکور سراسری تجربی ۱۴۰۰–۱۴۰۵
do_konkur() {
  log_step "بخش C — کنکور سراسری تجربی ۱۴۰۰–۱۴۰۵ (konkur.in)"
  local id year nobat prefix link base n
  local -a links booklet key fizik
  while IFS=$'\t' read -r id year nobat prefix; do
    case "$id" in ''|\#*) continue ;; esac
    log "  → صفحه $id ($year $nobat)"
    if [ "$DRY_RUN" = 1 ]; then log_dim "https://konkur.in/$id/"; SKIP_COUNT=$((SKIP_COUNT+1)); continue; fi

    mapfile -t links < <(scrape_konkur_links "https://konkur.in/$id/")
    if [ "${#links[@]}" -eq 0 ]; then
      log_err "هیچ لینکی از صفحه $id استخراج نشد"
      record "کنکور $year" "صفحه $id" "ناموفق" "-" "-" "استخراج لینک ناموفق" "https://konkur.in/$id/"
      mark_fail "صفحه کنکور $id"
      continue
    fi

    booklet=(); key=(); fizik=()
    for link in "${links[@]}"; do
      base="$(url_basename "$link")"
      case "$base" in
        *.zip|*.rar) continue ;;
      esac
      if printf '%s' "$base" | grep -qiE 'key|pasokh|kelid'; then key+=("$link")
      elif printf '%s' "$base" | grep -qiE 'fizik|physic'; then fizik+=("$link")
      elif printf '%s' "$base" | grep -qiE 'tajrobi|tajrobei'; then booklet+=("$link")
      fi
    done

    if [ "${#booklet[@]}" -gt 0 ]; then
      fetch_one_konkur "${booklet[0]}" "$KONKUR_DIR/${prefix}-دفترچه.pdf" "کنکور $year"
    else
      log_warn "دفترچه پیدا نشد (صفحه $id)"
    fi
    if [ "${#key[@]}" -gt 0 ]; then
      fetch_one_konkur "${key[0]}" "$KONKUR_DIR/${prefix}-کلید.pdf" "کنکور $year"
    else
      log_warn "کلید پیدا نشد (صفحه $id)"
    fi
    n=0
    for link in "${fizik[@]:-}"; do
      [ -z "$link" ] && continue
      n=$((n+1)); [ "$n" -gt 2 ] && break
      fetch_one_konkur "$link" "$KONKUR_DIR/${prefix}-فیزیک-تشریحی-${n}.pdf" "کنکور $year"
    done
    [ "$n" -eq 0 ] && log_warn "حل تشریحی فیزیک پیدا نشد (صفحه $id)"
    sleep 2
  done <"$DATA_DIR/konkur-pages.tsv"
}

fetch_one_konkur() {
  local url="$1" dest="$2" label="$3"
  if fetch_pdf "$url" "$dest" "$MIN_EXAM"; then
    log_ok "$(basename "$dest") — $(human_size "$(file_size "$dest")") / $(pdf_pages "$dest") صفحه"
    record "$label" "$(basename "$dest")" "سالم" "$(human_size "$(file_size "$dest")")" "$(pdf_pages "$dest")" "-" "$SOURCE_USED"
    mark_ok
  else
    log_err "$(basename "$dest") — دانلود ناموفق"
    record "$label" "$(basename "$dest")" "ناموفق" "-" "-" "دانلود نشد" "$url"
    mark_fail "$(basename "$dest")"
  fi
}

# --------------------------------------------------- بخش F: راستی‌آزمایی نهایی
verify_all() {
  log_step "بخش F — راستی‌آزمایی فایل‌های موجود"
  local f bad=0 total=0
  while IFS= read -r -d '' f; do
    total=$((total+1))
    if is_pdf "$f" "$MIN_EXAM"; then
      printf '  %s✓%s %-58s %8s %4s صفحه\n' "$C_OK" "$C_RESET" "$(basename "$f")" \
        "$(human_size "$(file_size "$f")")" "$(pdf_pages "$f")"
    else
      bad=$((bad+1))
      printf '  %s✗%s %-58s خراب یا ناقص\n' "$C_ERR" "$C_RESET" "$(basename "$f")"
    fi
  done < <(find "$DL_DIR" -type f -name '*.pdf' -print0 2>/dev/null | sort -z)
  log_dim "$total فایل PDF بررسی شد؛ $bad مورد مشکل‌دار."
  VERIFY_TOTAL="$total"; VERIFY_BAD="$bad"
}

# ------------------------------------------------------------- بخش G-۶: گزارش
write_report() {
  local now count_books count_nahayi count_nahayi_r count_konkur
  now="$(date '+%Y-%m-%d %H:%M')"
  count_books=$(find "$BOOKS_DIR"    -maxdepth 1 -name '*.pdf' 2>/dev/null | wc -l | tr -d ' ')
  count_nahayi=$(find "$NAHAYI_DIR"  -maxdepth 1 -name '*.pdf' 2>/dev/null | wc -l | tr -d ' ')
  count_nahayi_r=$(find "$NAHAYI_R_DIR" -maxdepth 1 -name '*.pdf' 2>/dev/null | wc -l | tr -d ' ')
  count_konkur=$(find "$KONKUR_DIR"  -maxdepth 1 -name '*.pdf' 2>/dev/null | wc -l | tr -d ' ')

  {
    printf '# گزارش بازیابی آرشیو — %s\n\n' "$now"
    printf 'مسیر آرشیو: `%s`\n\n' "$DL_DIR"
    printf '| پوشه | تعداد فایل | انتظار سند |\n|---|---|---|\n'
    printf '| kotob-darsi | %s | ۱۴ |\n' "$count_books"
    printf '| nahayi-fizik12 | %s | ۲۳ |\n' "$count_nahayi"
    printf '| nahayi-fizik12/فیزیک3-مکمل-رشته-ریاضی | %s | ۲۳ |\n' "$count_nahayi_r"
    printf '| konkur-fizik | %s | ۳۶ |\n\n' "$count_konkur"
    printf -- '- موفق در این اجرا: %s\n- ناموفق: %s\n' "$OK_COUNT" "$FAIL_COUNT"
    if [ -n "$FAILED_LIST" ]; then
      printf '\n## فایل‌های ناموفق\n'
      printf '%b\n' "$FAILED_LIST"
      printf '\nبرای تلاش دوباره فقط همین‌ها کافی است اسکریپت را دوباره اجرا کنید؛ فایل‌های سالم دوباره دانلود نمی‌شوند.\n'
    fi
    printf '\n## فهرست کامل\n\n| بخش | فایل | وضعیت | حجم | صفحات | توضیح |\n|---|---|---|---|---|---|\n'
    if [ -f "$MANIFEST" ]; then
      awk -F'\t' '{printf "| %s | %s | %s | %s | %s | %s |\n", $1,$2,$3,$4,$5,$6}' "$MANIFEST"
    fi
  } >"$REPORT"
  log_ok "گزارش نوشته شد: $REPORT"
}

# ----------------------------------------------------------------------- اجرا
main() {
  have curl || { log_err "curl نصب نیست."; exit 1; }
  log "${C_B}بازیابی آرشیو فیزیک کنکور ۱۴۰۶${C_RESET}"
  log_dim "مقصد: $DL_DIR"
  have pdfinfo || log_warn "poppler-utils نصب نیست؛ شمارش صفحه با pypdf/تخمین انجام می‌شود (apt install poppler-utils)"

  if [ "$DO_NET_CHECK" = 1 ]; then net_check; exit 0; fi

  make_dirs
  : >"$MANIFEST"
  REACHABLE=0
  net_check
  if [ "${REACHABLE:-0}" -eq 0 ] && [ "$MODE" != "verify" ] && [ "$DRY_RUN" = 0 ]; then
    log_err "هیچ‌کدام از منابع از این شبکه در دسترس نیست؛ دانلود انجام نمی‌شود."
    log_dim "علت معمول: فیلترینگ، قطع بودن اینترنت، یا اجرای اسکریپت در محیطی که خروجی شبکه‌اش محدود است."
    log_dim "راه‌حل‌ها: ۱) اجرای همین اسکریپت روی سیستم خودتان  ۲) تنظیم پراکسی:"
    log_dim "         export HTTPS_PROXY=socks5h://127.0.0.1:1080 ; export HTTP_PROXY=\$HTTPS_PROXY"
    log_dim "         سپس دوباره: bash recover.sh"
    exit 3
  fi

  case "$MODE" in
    all)    do_books; do_nahayi; do_konkur ;;
    books)  do_books ;;
    nahayi) do_nahayi ;;
    konkur) do_konkur ;;
    verify) : ;;
    *) log_err "مقدار نامعتبر برای --only: $MODE"; exit 2 ;;
  esac

  verify_all
  write_report

  log_step "خلاصه"
  log_ok "موفق: $OK_COUNT"
  [ "$FAIL_COUNT" -gt 0 ] && log_err "ناموفق: $FAIL_COUNT" || log_ok "ناموفق: 0"
  [ "$DRY_RUN" = 1 ] && log_dim "حالت آزمایشی بود؛ چیزی دانلود نشد ($SKIP_COUNT مورد)"
  log_dim "گزارش: $REPORT"
  [ "$FAIL_COUNT" -gt 0 ] && exit 1
  exit 0
}

main "$@"
