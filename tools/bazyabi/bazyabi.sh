#!/usr/bin/env bash
# ============================================================
#  بازیابی کامل آرشیو فیزیک — کنکور ۱۴۰۶ (دوازدهم تجربی)
#  اجرای کامل:  ./bazyabi.sh all
#  راهنما:      ./bazyabi.sh help
# ============================================================
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"

DIR_KOTOB="$DOWNLOAD_ROOT/kotob-darsi"
DIR_NAHAYI="$DOWNLOAD_ROOT/nahayi-fizik12"
DIR_NAHAYI_R="$DIR_NAHAYI/فیزیک3-مکمل-رشته-ریاضی"
DIR_KONKUR="$DOWNLOAD_ROOT/konkur-fizik"

# ---------- گام ۱: ساخت پوشه‌ها ----------
cmd_dirs() {
  mkdir -p "$DIR_KOTOB" "$DIR_NAHAYI" "$DIR_NAHAYI_R" "$DIR_KONKUR"
  : >>"$LOG_FILE"
  ok "پوشه‌ها آماده شد زیر: $DOWNLOAD_ROOT"
}

# ---------- گام ۲: کتاب‌های درسی (بخش A) ----------
mirror_for() {
  local code="$1" mc url
  while IFS=$'\t' read -r mc url; do
    case "$mc" in ''|\#*) continue ;; esac
    if [ "$mc" = "$code" ]; then printf '%s\n' "$url"; fi
    if [ "$mc" = "*" ]; then printf '%s\n' "${url//\{code\}/$code}"; fi
  done <"$HERE/data/mirrors.tsv"
}

cmd_kotob() {
  cmd_dirs
  local code catdir fname pages year title url out mirrors n_ok=0 n_bad=0
  # shellcheck disable=SC2034  # ستون‌های year/title فقط برای خوانایی جدول‌اند
  while IFS=$'\t' read -r code catdir fname pages year title; do
    case "$code" in ''|\#*) continue ;; esac
    url="$CHAP_BASE/sites/default/files/lbooks/$catdir/C$code.pdf"
    out="$DIR_KOTOB/$fname"
    mapfile -t mirrors < <(mirror_for "$code")
    if fetch_pdf "$out" "$url" "${mirrors[@]:-}"; then
      if [ "$DRY_RUN" = "1" ]; then
        report_row "کتاب" "$fname" "DRY" "-" "-" "$url"; n_ok=$((n_ok + 1)); continue
      fi
      if verify_pdf "$out" "${pages:-0}" "$code"; then
        report_row "کتاب" "$fname" "OK" "$(wc -c <"$out")" "$(pdf_pages "$out" | tr -dc '0-9')" "$url"
        n_ok=$((n_ok + 1))
      else
        report_row "کتاب" "$fname" "خراب" "$(wc -c <"$out" 2>/dev/null || echo 0)" "-" "$url"
        n_bad=$((n_bad + 1))
      fi
    else
      report_row "کتاب" "$fname" "ناموفق" "0" "-" "$url"
      n_bad=$((n_bad + 1))
    fi
  done <"$HERE/data/kotob.tsv"
  log "کتاب‌ها: $n_ok موفق، $n_bad ناموفق"
}

# ---------- استخراج لینک PDF از یک صفحه ----------
scrape_files() { # scrape_files <page_url> <ext>  مثلا pdf یا zip
  local ext="${2:-pdf}"
  _curl "$1" 2>/dev/null |
    grep -oiE "https?://$DL_HOST_RE/[^\"'<>[:space:]]+\.$ext" |
    sed 's/&amp;/\&/g' | awk '!seen[$0]++'
}
scrape_pdfs() { scrape_files "$1" pdf; }

# دانلود آرشیو فشرده «همه سال‌ها یکجا» — میان‌بر مطمئن‌تر از تک‌تک PDFها
fetch_zips() { # fetch_zips <page_url> <dest_dir>
  local page="$1" dest="$2" u out n=0
  mkdir -p "$dest"
  while read -r u; do
    [ -n "$u" ] || continue
    out="$dest/$(basename "${u%%\?*}")"
    n=$((n + 1))
    if [ "$DRY_RUN" = "1" ]; then dim "[DRY] zip: $u"; continue; fi
    if _curl -o "$out" "$u" && [ -s "$out" ]; then
      ok "آرشیو فشرده: $(basename "$out") ($(wc -c <"$out") بایت)"
      report_row "آرشیو-zip" "$(basename "$out")" "OK" "$(wc -c <"$out")" "-" "$u"
      have unzip && unzip -qo "$out" -d "${out%.zip}" && dim "استخراج شد در ${out%.zip}"
    else
      rm -f "$out"; err "آرشیو فشرده ناموفق: $u"
      report_row "آرشیو-zip" "$(basename "$out")" "ناموفق" "0" "-" "$u"
    fi
  done < <(scrape_files "$page" zip)
  [ "$n" -gt 0 ] || dim "آرشیو فشرده‌ای در این صفحه نبود"
}

# ---------- گام ۳: امتحان نهایی فیزیک ۳ (بخش B) ----------
cmd_nahayi() {
  cmd_dirs
  local page_url u name out n_t=0 n_r=0
  page_url="$KONKUR_BASE/89691/"
  log "استخراج لینک‌ها از صفحه آرشیو نهایی فیزیک ۳ …"
  # میان‌بر: آرشیوهای ZIP «همه سال‌ها یکجا» (تجربی ~۱۱.۶MB ، ریاضی ~۸.۲MB)
  fetch_zips "$page_url" "$DIR_NAHAYI/آرشیو-فشرده"

  local links; links=$(scrape_pdfs "$page_url")
  if [ -z "$links" ]; then err "هیچ لینکی از صفحه ۸۹۶۹۱ استخراج نشد (فیلترینگ یا تغییر ساختار صفحه)"; return 1; fi

  while read -r u; do
    [ -n "$u" ] || continue
    case "$u" in
      *Fizik3T*|*fizik3t*) out="$DIR_NAHAYI/$(nahayi_name "$u")"; n_t=$((n_t + 1)) ;;
      *Fizik3R*|*fizik3r*) out="$DIR_NAHAYI_R/$(nahayi_name "$u")"; n_r=$((n_r + 1)) ;;
      *) continue ;;
    esac
    name=$(basename "$out")
    if fetch_pdf "$out" "$u"; then
      if [ "$DRY_RUN" = "1" ]; then report_row "نهایی" "$name" "DRY" "-" "-" "$u"; continue; fi
      verify_pdf "$out" 0 - &&
        report_row "نهایی" "$name" "OK" "$(wc -c <"$out")" "$(pdf_pages "$out" | tr -dc '0-9')" "$u" ||
        report_row "نهایی" "$name" "خراب" "0" "-" "$u"
    else
      report_row "نهایی" "$name" "ناموفق" "0" "-" "$u"
    fi
  done <<<"$links"
  log "نهایی: $n_t فایل تجربی، $n_r فایل رشته ریاضی"
}

# ---------- گام ۴: کنکور تجربی ۱۴۰۰–۱۴۰۵ (بخش C) ----------
cmd_konkur() {
  cmd_dirs
  local pid label year nobat links u out name sub fiz_n
  # shellcheck disable=SC2034  # ستون‌های year/nobat فقط توصیفی‌اند
  while IFS=$'\t' read -r pid label year nobat; do
    case "$pid" in ''|\#*) continue ;; esac
    sub="$DIR_KONKUR/$label"; mkdir -p "$sub"
    log "— $label (صفحه $pid)"
    links=$(scrape_pdfs "$KONKUR_BASE/$pid/")
    [ -z "$links" ] && { err "لینکی در صفحه $pid پیدا نشد"; continue; }
    fiz_n=0
    while read -r u; do
      [ -n "$u" ] || continue
      name=$(basename "${u%%\?*}")
      case "$name" in
        *Key*|*key*|*Pasokh*)            out="$sub/کلید-$name" ;;
        *Tajrobi*|*tajrobi*)             out="$sub/دفترچه-$name" ;;
        *Fizik*|*fizik*)
          fiz_n=$((fiz_n + 1)); [ "$fiz_n" -gt 2 ] && continue
          out="$sub/تشریحی-فیزیک-$fiz_n-$name" ;;
        *) continue ;;
      esac
      if fetch_pdf "$out" "$u"; then
        if [ "$DRY_RUN" = "1" ]; then report_row "کنکور" "$label/$(basename "$out")" "DRY" "-" "-" "$u"; continue; fi
        verify_pdf "$out" 0 - &&
          report_row "کنکور" "$label/$(basename "$out")" "OK" "$(wc -c <"$out")" "$(pdf_pages "$out" | tr -dc '0-9')" "$u" ||
          report_row "کنکور" "$label/$(basename "$out")" "خراب" "0" "-" "$u"
      else
        report_row "کنکور" "$label/$(basename "$out")" "ناموفق" "0" "-" "$u"
      fi
    done <<<"$links"
  done <"$HERE/data/konkur-pages.tsv"
}

# ---------- گام ۵: راستی‌آزمایی مجدد کل آرشیو (بخش F) ----------
cmd_verify() {
  local f total=0 bad=0 pages want code fname
  log "راستی‌آزمایی همه PDFهای زیر $DOWNLOAD_ROOT …"
  while IFS= read -r -d '' f; do
    total=$((total + 1))
    want=0; code="-"
    fname=$(basename "$f")
      # shellcheck disable=SC2034  # ستون‌های بلااستفادهٔ جدول
      while IFS=$'\t' read -r c cdir fn pg yr ti; do
      case "$c" in ''|\#*) continue ;; esac
      [ "$fn" = "$fname" ] && { want="$pg"; code="$c"; }
    done <"$HERE/data/kotob.tsv"
    verify_pdf "$f" "$want" "$code" >/dev/null || { bad=$((bad + 1)); err "خراب: $fname"; }
  done < <(find "$DOWNLOAD_ROOT" -type f -name '*.pdf' -print0 2>/dev/null)
  log "بررسی شد: $total فایل — خراب: $bad"
  [ "$bad" -eq 0 ]
}

# ---------- گام ۶: گزارش فارسی ----------
cmd_report() {
  local k n nr c
  k=$(find "$DIR_KOTOB" -name '*.pdf' 2>/dev/null | wc -l)
  n=$(find "$DIR_NAHAYI" -maxdepth 1 -name '*.pdf' 2>/dev/null | wc -l)
  nr=$(find "$DIR_NAHAYI_R" -name '*.pdf' 2>/dev/null | wc -l)
  c=$(find "$DIR_KONKUR" -name '*.pdf' 2>/dev/null | wc -l)
  cat <<EOF

╭──────────── گزارش بازیابی آرشیو ────────────╮
 ریشه: $DOWNLOAD_ROOT
 کتاب‌های درسی        : $k  (هدف ۱۴)
 نهایی فیزیک۳ تجربی   : $n  (هدف ۲۳)
 نهایی فیزیک۳ ریاضی   : $nr (هدف ۲۳)
 کنکور تجربی          : $c  (هدف ۳۶)
 جمع                  : $((k + n + nr + c)) / ۹۶
 گزارش سطر‌به‌سطر      : $REPORT_TSV
╰─────────────────────────────────────────────╯
EOF
}

cmd_help() {
  cat <<'EOF'
استفاده: ./bazyabi.sh <دستور>

  all       اجرای کامل: پوشه‌ها ← کتاب‌ها ← نهایی ← کنکور ← راستی‌آزمایی ← گزارش
  dirs      فقط ساخت ساختار پوشه‌ها
  kotob     فقط کتاب‌های درسی (بخش A راهنما)
  nahayi    فقط امتحان نهایی فیزیک ۳ (بخش B)
  konkur    فقط کنکور تجربی ۱۴۰۰–۱۴۰۵ (بخش C)
  verify    راستی‌آزمایی همه PDFهای موجود (بخش F)
  report    گزارش شمارشی فارسی
  help      همین راهنما

متغیرهای محیطی مهم:
  DOWNLOAD_ROOT   ریشه ذخیره‌سازی (پیش‌فرض /home/z/my-project/download)
  DRY_RUN=1       فقط نمایش کارها، بدون دانلود
  USE_WAYBACK=0   غیرفعال کردن fallback آرشیو
  TRIES=5         تعداد تلاش مجدد هر لینک
EOF
}

main() {
  local c="${1:-help}"
  mkdir -p "$DOWNLOAD_ROOT" 2>/dev/null || true
  case "$c" in
    all)
      report_init; cmd_dirs; cmd_kotob; cmd_nahayi; cmd_konkur
      cmd_verify || warn "برخی فایل‌ها خراب‌اند — بخش E راهنما را اجرا کنید"
      cmd_report ;;
    dirs)   cmd_dirs ;;
    kotob)  report_init; cmd_kotob; cmd_report ;;
    nahayi) report_init; cmd_nahayi; cmd_report ;;
    konkur) report_init; cmd_konkur; cmd_report ;;
    verify) cmd_verify ;;
    report) cmd_report ;;
    help|-h|--help) cmd_help ;;
    *) err "دستور ناشناخته: $c"; cmd_help; exit 2 ;;
  esac
}
main "$@"
