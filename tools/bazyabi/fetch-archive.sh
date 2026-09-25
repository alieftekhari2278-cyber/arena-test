#!/usr/bin/env bash
# برداشتن آرشیوِ منتشرشده روی شاخه archive/pdf و چیدن آن در DOWNLOAD_ROOT.
# کاربرد: محیط‌هایی که به chap.sch.ir / konkur.in دسترسی ندارند ولی github.com برایشان باز است.
#
#   tools/bazyabi/fetch-archive.sh [REPO_URL] [BRANCH]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"

REPO_URL="${1:-$(git -C "$HERE" remote get-url origin 2>/dev/null || echo '')}"
BRANCH="${2:-archive/pdf}"
[ -n "$REPO_URL" ] || { err "آدرس مخزن مشخص نیست"; exit 2; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log "برداشت شاخه $BRANCH از $REPO_URL …"
if ! git clone -q --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP/archive" 2>/dev/null; then
  err "شاخه $BRANCH پیدا نشد — اول workflow «بازیابی آرشیو» را در تب Actions اجرا کنید"
  exit 1
fi

mkdir -p "$DOWNLOAD_ROOT"
rm -rf "$TMP/archive/.git"
cp -a "$TMP/archive/." "$DOWNLOAD_ROOT/"
ok "آرشیو در $DOWNLOAD_ROOT چیده شد"

log "راستی‌آزمایی پس از برداشت …"
exec "$HERE/bazyabi.sh" verify
