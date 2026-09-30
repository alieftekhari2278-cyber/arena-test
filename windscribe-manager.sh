#!/usr/bin/env bash
# =============================================================================
#  راهنمای سریع (فارسی) — Quick Guide
# =============================================================================
#  این اسکریپت ویندسکرایب را از فایل .deb پوشهٔ دانلودها کامل حذف و دوباره
#  نصب می‌کند؛ برنامه شما را «فراموش می‌کند» ولی فایل .deb شما هرگز
#  حذف/جابه‌جا/تغییر نمی‌کند (فقط خوانده می‌شود).
#
#  روش اجرا / HOW TO RUN:
#
#    chmod +x windscribe-manager.sh            <-- فقط بار اول
#
#  -------------------------------------------
#  دستور همیشگی شما (خودکار و ایمن) — ALWAYS RUN THIS:
#
#    sudo ./windscribe-manager.sh
#
#    همین یک دستور کافی است؛ هر بار که اجرا کنید:
#      ۱) پوشهٔ دانلودها را خودش اسکن می‌کند
#      ۲) اگر فایل .deb جدیدتری باشد  → حذف کامل + نصب تازه انجام می‌دهد
#      ۳) اگر نسخهٔ نصب‌شده جدیدتر یا مساوی باشد → هیچ کاری نمی‌کند
#      ۴) اگر فایل خراب باشد → قبل از هر حذفی متوقف می‌شود
#
#  بقیهٔ حالت‌ها (اختیاری):
#
#    ./windscribe-manager.sh --list            <-- بدون root: کدام فایل انتخاب
#                                                  می‌شود؟ (هیچ تغییری نمی‌دهد)
#    sudo ./windscribe-manager.sh --dry-run    <-- نمایش همهٔ مراحل، بدون تغییر
#    sudo ./windscribe-manager.sh --yes        <-- همیشه حذف+نصب، حتی اگر جدید نباشد
#    sudo ./windscribe-manager.sh --remove     <-- فقط حذف کامل، بدون نصب
#    ./windscribe-manager.sh --help            <-- راهنمای کامل دوزبانه
#
#  نکته‌ها:
#   * فایل .deb باید داخل پوشهٔ Downloads باشد (یا: --dir /مسیر/پوشه)
#   * بعد از اجرا باید دوباره وارد حساب ویندسکرایب شوید (فراموشی لاگین)
#   * لاگین و تنظیمات بماند؟  sudo ./windscribe-manager.sh --yes --keep-user-data
#   * فایل خراب/ناقص = توقف اسکریپت «قبل از هر حذفی»؛ هرگز بی‌برنامه
#     بدون ویندسکرایب نمی‌مانید
#   * کد خروج:  0 = موفق    1 = خطا یا رد شده    130 = قطع با Ctrl+C
# =============================================================================
# =============================================================================
#  windscribe-manager.sh  (v3.0  -  final)
#
#  COMPLETE removal + FRESH install of the Windscribe desktop app, driven by the
#  genuine .deb that lives in the user's Downloads folder.
#
#  The three rules this version is built around
#  --------------------------------------------
#  RULE 1 - "forget me": after a removal the app has NO memory of the user and
#           NO trace in any menu:
#             * per-user data of EVERY human account (not only $SUDO_USER):
#               .config/.local/share/.local/state/.cache/Windscribe{,2},
#               snap + flatpak data, autostart entries, user launcher overrides,
#               GNOME saved-session entries
#             * per-user menu/icon caches: ~/.cache/icon-theme.cache, ksycoca5/6,
#               plank, docky, xfce4 launcher, gnome-shell app-system, unity
#             * the GNOME dash favourite is un-pinned (gsettings favorite-apps)
#               and the KDE kickoff favourite token is dropped (with a backup)
#             * system integration the deb owns but a hardcoded list misses:
#               every path from `dpkg -L` (captured BEFORE the purge), dbus
#               policy, polkit actions/rules, mime packages, metainfo, every
#               icon theme, systemd units/presets/wants, the system user+group
#             * desktop DB, icon cache, XDG menu cache and sycoca are rebuilt
#               AS THE DESKTOP USER with a correct session environment
#  RULE 2 - the download is sacred: the scanned folder is opened READ-ONLY.
#           Every destructive primitive goes through guard_path(), which refuses
#           the scan folder, the chosen .deb, "/" and any bare top-level dir.
#           Identity of the .deb is proven with sha256+size+mtime+inode before
#           and after, and apt's archive cache is redirected to a private temp
#           dir so nothing is ever written next to the user's file.
#  RULE 3 - real version detection: identity comes from deb METADATA (renamed,
#           re-downloaded or "(1)"-suffixed files all work), the scan is
#           bounded-recursive, foreign architectures are accepted, the highest
#           dpkg version wins (ties -> newest mtime, then top level first), the
#           winner is integrity-verified BEFORE anything is removed, and
#           `--list` shows every candidate with the reason it lost.
#
#  USAGE
#    sudo ./windscribe-manager.sh               auto: act only if the .deb is NEWER
#    sudo ./windscribe-manager.sh --yes         always: full remove + fresh install
#    sudo ./windscribe-manager.sh --reinstall   alias of --yes      (--force too)
#    sudo ./windscribe-manager.sh --if-newer    explicit form of the default
#    sudo ./windscribe-manager.sh --remove      remove only (.deb untouched)
#         ./windscribe-manager.sh --list        read-only: show all .deb files found
#    sudo ./windscribe-manager.sh --dry-run     show every step, change nothing
#    sudo ./windscribe-manager.sh --dir PATH    scan PATH instead of Downloads
#    sudo ./windscribe-manager.sh --max-depth N recursive scan depth (default 3)
#    sudo ./windscribe-manager.sh --user NAME   desktop user to forget (auto-detected)
#    sudo ./windscribe-manager.sh --keep-user-data   remove app, keep login/settings
#    sudo ./windscribe-manager.sh --keep-keyring  keep the libsecret entries
#    sudo ./windscribe-manager.sh --no-backup   do not tar the removed user data
#    sudo ./windscribe-manager.sh --no-autoremove
#         ./windscribe-manager.sh --version | --help
#
#  GUARANTEES
#    * The .deb is only ever READ: never deleted, moved, renamed or written.
#    * A damaged/incomplete download aborts the run BEFORE anything is removed,
#      so a failed cycle can never leave the machine without Windscribe.
#    * Only the exact packages "windscribe"/"windscribe-cli" and only paths that
#      are provably Windscribe's are touched (name-prefix match, or substring
#      match confirmed by the file content).
#    * Every mutating step waits for the apt/dpkg lock and honours --dry-run.
#    * Stateless: no config, no lock files, no history. Safe to re-run.
#
#  EXIT CODES  0 ok / 1 refused, bad input or failure / 130 interrupted
#  NEEDS       bash >= 4.3, dpkg, dpkg-deb, dpkg-query, apt-get, getent, find,
#              stat, tar, rm, id.
#  OPTIONAL    systemctl, service, sha256sum, nproc (parallel scan), runuser,
#              loginctl, fuser, nft, gsettings, kbuildsycoca6/5,
#              update-desktop-database, gtk-update-icon-cache, xdg-desktop-menu
# =============================================================================

set -Eeuo pipefail

# =============================================================================
# 1. CONFIGURATION
# =============================================================================
readonly PROG_NAME="windscribe-manager.sh"
readonly PROG_VERSION="3.0"
readonly MIN_BASH_MAJOR=4
readonly MIN_BASH_MINOR=3

# --- package / service identity ---------------------------------------------
readonly PKG_GUI="windscribe"            # exact dpkg name of the GUI build
readonly PKG_CLI="windscribe-cli"        # CLI build - officially conflicts
readonly SVC="windscribe-helper"         # systemd unit shipped in the deb
readonly SVC_UNIT="${SVC}.service"
readonly SYS_ACCT="windscribe"           # system user/group made by the postinst

# --- process names (matched EXACTLY with pkill -x, plus an anchored exe path) --
readonly APP_PROCS=(Windscribe WindscribeEngine windscribe-cli
                    windscribe-helper WindscribeHelper)
readonly APP_EXE_PREFIX="/opt/windscribe/"

# --- per-user footprint ------------------------------------------------------
readonly USER_DATA_ROOTS=(.config .local/share .local/state .cache)
readonly USER_DATA_NAMES=(Windscribe Windscribe2 windscribe windscribe2)
readonly USER_EXTRA_REL=(
  snap/windscribe
  var/app/com.windscribe.Windscribe
  var/app/com.windscribe.Windscribe2
)
# user-side caches that the desktop regenerates on the next login
readonly USER_CACHE_REL=(
  .cache/icon-theme.cache
  .cache/ksycoca6
  .cache/ksycoca5
  .cache/ksycoca
  .cache/plank
  .cache/docky
  .cache/xfce4/panel/launcher
  .cache/gnome-shell/app-system
  .cache/unity/launchers
  .config/gnome-session/saved-session
)
readonly USER_LAUNCHER_FILES=(
  .local/share/applications/windscribe.desktop
  .local/share/applications/Windscribe.desktop
  .local/share/applications/windscribe2.desktop
  .local/share/applications/Windscribe2.desktop
)
readonly USER_AUTOSTART_DIR=.config/autostart
readonly KDE_FAVOURITE_REL=.config/plasma-org.kde.plasma.desktop-appletsrc

# --- system footprint (exact paths) ------------------------------------------
readonly SYSTEM_PATHS=(
  /opt/windscribe
  /etc/windscribe
  /var/log/windscribe
  /var/lib/windscribe
  /var/run/windscribe
  /run/windscribe
  /usr/bin/windscribe
  /usr/bin/windscribe-cli
  /usr/bin/windscribe-helper
  /usr/local/bin/windscribe
  /usr/local/bin/windscribe-cli
  /usr/local/bin/windscribe-helper
  /etc/xdg/autostart/windscribe.desktop
  /etc/xdg/autostart/Windscribe.desktop
  /usr/share/applications/windscribe.desktop
  /usr/share/applications/Windscribe.desktop
  /usr/lib/systemd/system/windscribe-helper.service
  /etc/systemd/system/windscribe-helper.service
  /lib/systemd/system/windscribe-helper.service
  /usr/lib/systemd/system-preset/69-windscribe-helper.preset
  /etc/systemd/system-preset/69-windscribe-helper.preset
  /etc/systemd/system/multi-user.target.wants/windscribe-helper.service
)
# directories in which a windscribe-named file can only belong to this app
readonly NAME_GLOB_DIRS=(
  /etc/dbus-1/system.d
  /usr/share/dbus-1/system-services
  /usr/share/dbus-1/system.d
  /usr/share/polkit-1/actions
  /usr/share/polkit-1/rules.d
  /etc/polkit-1/rules.d
  /usr/share/mime/packages
  /usr/share/metainfo
  /usr/share/appdata
  /usr/share/applications
  /usr/share/pixmaps
  /etc/xdg/autostart
  /usr/lib/systemd/system
  /lib/systemd/system
  /etc/systemd/system
  /usr/lib/systemd/system-preset
  /etc/systemd/system-preset
  /usr/share/icons
  /usr/local/share/applications
  /usr/local/share/icons
)
readonly ICON_THEME_ROOTS=(/usr/share/icons /usr/local/share/icons)
readonly LAUNCHER_ICON_NAME=Windscribe.png

# --- prefixes where dpkg-owned leftovers may be swept -------------------------
readonly SWEEP_PREFIXES=(/etc/ /usr/ /opt/ /var/ /srv/ /lib/ /run/)

# --- what a complete install must provide (the rest comes from the deb itself) -
readonly ESSENTIAL_ARTEFACTS=(
  /usr/lib/systemd/system/windscribe-helper.service
  /usr/share/applications/windscribe.desktop
)
readonly LAUNCHER_SYMLINK=/usr/bin/windscribe-cli

# --- tooling ------------------------------------------------------------------
readonly REQUIRED_TOOLS=(dpkg dpkg-deb dpkg-query apt-get getent find stat tar rm id)
readonly OPTIONAL_TOOLS=(systemctl service sha256sum runuser loginctl fuser nft
                         gsettings kbuildsycoca6 kbuildsycoca5 update-desktop-database
                         gtk-update-icon-cache xdg-desktop-menu pkill pgrep nproc)
readonly APT_LOCK_FILES=(/var/lib/dpkg/lock-frontend /var/lib/dpkg/lock-0
                         /var/lib/dpkg/lock /var/lib/apt/lists/lock
                         /var/cache/apt/archives/lock)
readonly APT_LOCK_ROUNDS=90              # 90 x 2 s = 3 minutes maximum wait
readonly PROCESS_WAIT_ROUNDS=50          # 50 x 0.1 s = 5 s before SIGKILL
readonly MAX_PROBE_FILES=400             # safety cap for pathological folders
readonly PARALLEL_MIN_FILES=8            # below this, forking costs more than it saves
readonly PARALLEL_MAX_WORKERS=4          # dpkg-deb is I/O bound, not CPU bound
readonly MIN_DEB_BYTES=64                # below this it cannot even hold an ar header
readonly MIN_FREE_MB=400                 # warn below this much free space on /
readonly BACKUP_ROOT=/var/backups/windscribe-manager
readonly SEP=$'\x1f'                     # record separator of the scan table

# =============================================================================
# 2. RUNTIME STATE (nothing is persisted between runs)
# =============================================================================
MODE="auto"                  # auto | remove | list
ASSUME_YES="false"
DRY_RUN="false"
NO_AUTOREMOVE="false"
KEEP_USER_DATA="false"
KEEP_KEYRING="false"
MAKE_BACKUP="true"
OPT_DIR=""                   # --dir PATH
OPT_DIR_SET="false"
FORCE_USER=""                # --user NAME
MAX_DEPTH=3
JOBS=0                       # 0 = auto
SELF="$(readlink -f -- "$0" 2>/dev/null || printf '%s' "$0")"

SYS_ARCH=""
FOREIGN_ARCH=""
REAL_USER=""
REAL_UID=""
REAL_HOME=""
DBUS_ADDR=""
DOWNLOADS_DIR=""             # canonical path of the folder being scanned
CANDIDATE_PATH=""
CANDIDATE_VER=""
CANDIDATE_ARCH=""
DEB_CONTENTS=""              # payload listing of the winner (dpkg-deb -c)
INSTALLED_VER=""
OLD_VER=""
NEW_VER=""

# identity of the download, for the final proof (RULE 2)
DEB_SHA_BEFORE=""
DEB_SZ_BEFORE=""
DEB_MT_BEFORE=""
DEB_INO_BEFORE=""

WIPE_COUNT=0
WIPE_USERS=0
KEYRING_COUNT=0
BACKUP_FILE=""
REMOVED_LEFTOVERS=0
OWNED_PATHS=()               # `dpkg -L` output captured before the purge
HOME_PREFIXES=()             # every home directory on this machine

# scan table (parallel arrays, filled by scan_downloads)
SCAN_PATH=()
SCAN_DEC=()
SCAN_PKG=()
SCAN_VER=()
SCAN_ARCH=()
SCAN_SIZE=()
SCAN_MTIME=()
TOTAL_DEB=0
COUNT_GOOD=0
COUNT_BAD=0
COUNT_OTHER=0
COUNT_CLI=0
COUNT_ARCH=0

TMPDIR_RUN=""
APT_ARCHIVE_DIR=""
USER_ENV=()

# =============================================================================
# 3. PRESENTATION (colors, output helpers, traps)
# =============================================================================
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_HDR=$'\e[1;36m'; C_OK=$'\e[1;32m'; C_WARN=$'\e[1;33m'
  C_ERR=$'\e[1;31m'; C_DIM=$'\e[2m';  C_OFF=$'\e[0m'
else
  C_HDR=''; C_OK=''; C_WARN=''; C_ERR=''; C_DIM=''; C_OFF=''
fi

say()  { printf '%s\n' "${C_HDR}==>${C_OFF} $1"
         if [[ -n "${2:-}" ]]; then printf '    %s\n' "$2"; fi
         return 0; }
note() { printf '    %s\n' "$1"; return 0; }
ok()   { printf '%s[ OK ]%s %s\n' "$C_OK" "$C_OFF" "$1"; return 0; }
warn() { printf '%s[ !! ]%s %s\n' "$C_WARN" "$C_OFF" "$1"; return 0; }
dry()  { printf '%s[dry-run]%s %s\n' "$C_DIM" "$C_OFF" "$1"; return 0; }
die()  { printf '%s[ERROR]%s %s\n' "$C_ERR" "$C_OFF" "$1" >&2
         if [[ -n "${2:-}" ]]; then printf '    %s\n' "$2" >&2; fi
         trap - ERR                     # an intentional stop is not a crash
         exit 1; }

on_error() {
  printf '%s[ERROR]%s Unexpected failure at line %s - aborting.\n' \
    "$C_ERR" "$C_OFF" "$1" >&2
  printf '    خطای غیرمنتظره در خط %s — اجرا متوقف شد. خروجی بالا را بررسی کنید.\n' \
    "$1" >&2
  return 0
}
on_exit() {
  local rc=$?
  trap - ERR INT TERM EXIT               # cleanup must never look like a crash
  if [[ -n "$TMPDIR_RUN" && -d "$TMPDIR_RUN" ]]; then
    rm -rf -- "$TMPDIR_RUN" 2>/dev/null || true
  fi
  exit "$rc"
}
trap 'on_error $LINENO' ERR
trap 'printf "\nInterrupted - اجرا لغو شد (Ctrl+C)\n" >&2; exit 130' INT TERM
trap on_exit EXIT

# =============================================================================
# 4. UTILITIES
# =============================================================================
have() { command -v "$1" >/dev/null 2>&1; }

is_dry_run() { if [[ "$DRY_RUN" == "true" ]]; then return 0; fi; return 1; }

# dry_would <text>: in dry-run announce the skipped step and return 0 so the
# caller bails out before touching anything; otherwise return 1.
dry_would() {
  if is_dry_run; then dry "would $1"; return 0; fi
  return 1
}

lower() { printf '%s' "${1,,}"; return 0; }

# glob_nul <pattern>...: print every match NUL-terminated (nullglob semantics,
# space-safe: IFS is emptied so a pattern containing spaces is never split).
glob_nul() {
  local p m old_ifs="$IFS" had=0
  if shopt -q nullglob; then had=1; fi
  shopt -s nullglob
  IFS=''
  for p in "$@"; do
    for m in $p; do printf '%s\0' "$m"; done
  done
  IFS="$old_ifs"
  if (( had == 0 )); then shopt -u nullglob; fi
  return 0
}

# read_nul_array <array-name>: fill the named array from NUL-separated stdin.
read_nul_array() {
  local -n __rna_out="$1"
  local item
  __rna_out=()
  while IFS= read -r -d '' item; do __rna_out+=("$item"); done
  return 0
}

# collect_glob <array-name> <pattern>...: safe replacement for the old
# nameref+nullglob helper - the patterns are expanded INSIDE this function, so
# an unmatched pattern can never leak through as a literal path.
collect_glob() {
  local __cg_name="$1"; shift
  read_nul_array "$__cg_name" < <(glob_nul "$@")
  return 0
}

human_size() {
  local b="${1:-0}"
  [[ "$b" =~ ^[0-9]+$ ]] || b=0
  if   (( b >= 1073741824 )); then awk -v x="$b" 'BEGIN{printf "%.2f GiB", x/1073741824}'
  elif (( b >= 1048576 ));    then awk -v x="$b" 'BEGIN{printf "%.1f MiB", x/1048576}'
  elif (( b >= 1024 ));       then awk -v x="$b" 'BEGIN{printf "%.0f KiB", x/1024}'
  else printf '%s B' "$b"
  fi
  return 0
}

# hash_file <path>: sha256, or size.mtime when sha256sum is unavailable
hash_file() {
  local f="$1"
  if have sha256sum; then
    { sha256sum -- "$f" 2>/dev/null || true; } | awk '{print $1}'
  else
    stat -c '%s.%Y' -- "$f" 2>/dev/null || true
  fi
  return 0
}

# ---------------------------------------------------------------------------
# guard_path: the single gate every destructive operation passes through.
# Returns 0 only for a path that is provably safe to delete.
# ---------------------------------------------------------------------------
guard_path() {
  local p="${1:-}" stripped hp
  if [[ -z "$p" || "$p" != /* ]]; then return 1; fi       # absolute only
  case "$p" in /|//|/.|/..) return 1 ;; esac
  # RULE 2: never the scanned folder, nor anything inside it
  if [[ -n "$DOWNLOADS_DIR" ]]; then
    case "$p" in "$DOWNLOADS_DIR"|"$DOWNLOADS_DIR"/*) return 1 ;; esac
  fi
  if [[ -n "$CANDIDATE_PATH" && "$p" == "$CANDIDATE_PATH" ]]; then return 1; fi
  if [[ -n "$TMPDIR_RUN" ]]; then
    case "$p" in "$TMPDIR_RUN"|"$TMPDIR_RUN"/*) return 1 ;; esac
  fi
  case "$p" in "$BACKUP_ROOT"|"$BACKUP_ROOT"/*) return 1 ;; esac
  case "$p" in /*/) return 1 ;; esac
  stripped="${p#/}"; stripped="${stripped%/}"
  if [[ "$stripped" != */* ]]; then return 1; fi           # depth >= 2
  case "/$stripped" in
    /bin|/boot|/dev|/etc|/home|/lib|/lib32|/lib64|/libx32|/media|/mnt|/opt|/proc|\
    /root|/run|/sbin|/srv|/sys|/tmp|/usr|/var|/usr/bin|/usr/lib|/usr/share|\
    /var/lib|/var/log|/var/run|/usr/share/applications|/usr/share/icons) return 1 ;;
  esac
  # anything that IS or LIVES IN a home directory must be a Windscribe path we
  # constructed ourselves - the home directory itself is never removable
  for hp in "${HOME_PREFIXES[@]+"${HOME_PREFIXES[@]}"}"; do
    [[ -n "$hp" ]] || continue
    if [[ "$p" == "$hp" ]]; then return 1; fi
    case "$p" in
      "$hp"/*) if home_path_allowed "$hp" "$p"; then return 0; else return 1; fi ;;
    esac
  done
  return 0
}

# home_path_allowed <home> <abs path under that home>: whitelist check on the
# relative part, so a stray variable can never widen the blast radius. Only the
# XDG data/config/cache roots (plus snap and flatpak) are eligible, and inside
# them one path component must be Windscribe-named. A document such as
# ~/Documents/windscribe-invoice.pdf is therefore always refused.
home_path_allowed() {
  local home="$1" p="$2" rel first rest comp hit=0
  rel="${p#"$home"/}"
  if [[ -z "$rel" || "$rel" == "$p" ]]; then return 1; fi
  case "$rel" in
    .cache/icon-theme.cache|.cache/ksycoca*|.cache/plank|.cache/docky|\
    .cache/xfce4/panel/launcher|.cache/gnome-shell/app-system|\
    .cache/unity/launchers|.config/gnome-session/saved-session) return 0 ;;
  esac
  first="${rel%%/*}"
  case "$first" in
    .config|.cache|.local|snap|var|.kde|.kde4|.gnome) ;;
    *) return 1 ;;
  esac
  rest="$rel"
  while [[ -n "$rest" ]]; do
    comp="${rest%%/*}"
    case "$(lower "$comp")" in windscribe*) hit=1; break ;; esac
    if [[ "$rest" == */* ]]; then rest="${rest#*/}"; else rest=""; fi
  done
  if (( hit == 1 )); then return 0; fi
  return 1
}

# safe_rm <path>: guarded `rm -rf`; returns 0 only when something was removed.
safe_rm() {
  local p="$1"
  if [[ -e "$p" || -L "$p" ]]; then
    if guard_path "$p"; then rm -rf -- "$p"; return 0; fi
    warn "refused to delete (safety guard): $p"
  fi
  return 1
}

# safe_rm_file <path>: guarded `rm -f`, regular files and symlinks only.
safe_rm_file() {
  local p="$1"
  if [[ -f "$p" || -L "$p" ]]; then
    if guard_path "$p"; then rm -f -- "$p"; return 0; fi
    warn "refused to delete (safety guard): $p"
  fi
  return 1
}

# path_is_ours <path>: a windscribe* name is always ours; a mere substring
# match must be confirmed by the file content, so another app is never touched.
path_is_ours() {
  local p="$1" b
  b="$(basename -- "$p")"
  case "$(lower "$b")" in
    windscribe*) return 0 ;;                       # name prefix: always ours
    *windscribe*)                                  # substring: prove it by content
      if [[ -f "$p" && -r "$p" ]] && LC_ALL=C grep -qi 'windscribe' -- "$p" 2>/dev/null; then
        return 0
      fi
      return 1 ;;
  esac
  return 1
}

# run_as_user <cmd...>: run as the desktop user with a real session environment
# (HOME, XDG_RUNTIME_DIR, DBUS_SESSION_BUS_ADDRESS) - without it the per-user
# cache rebuilds silently do nothing.
run_as_user() {
  if [[ "$EUID" -eq 0 && -n "$REAL_USER" && "$REAL_USER" != "root" ]] && have runuser; then
    runuser -u "$REAL_USER" -- env "${USER_ENV[@]}" "$@" >/dev/null 2>&1 || true
  else
    env "${USER_ENV[@]}" "$@" >/dev/null 2>&1 || true
  fi
  return 0
}

# as_user_out <cmd...>: same, but capture stdout (empty on any failure).
as_user_out() {
  if [[ "$EUID" -eq 0 && -n "$REAL_USER" && "$REAL_USER" != "root" ]] && have runuser; then
    runuser -u "$REAL_USER" -- env "${USER_ENV[@]}" "$@" 2>/dev/null || true
  else
    env "${USER_ENV[@]}" "$@" 2>/dev/null || true
  fi
  return 0
}

# =============================================================================
# 5. SYSTEM FACTS (read-only dpkg queries)
# =============================================================================
pkg_state() {
  local st
  st="$(dpkg-query -W -f='${db:Status-Status}' "$1" 2>/dev/null || true)"
  case "$st" in
    installed)                                        printf 'installed' ;;
    config-files)                                     printf 'config' ;;
    half-installed|half-configured|unpacked|triggers-*) printf 'other' ;;
    *)                                                printf 'none' ;;
  esac
  return 0
}

pkg_known()     { if [[ "$(pkg_state "$1")" != "none" ]]; then return 0; fi; return 1; }
pkg_installed() { if [[ "$(pkg_state "$1")" == "installed" ]]; then return 0; fi; return 1; }

pkg_version() { dpkg-query -W -f='${Version}' "$1" 2>/dev/null || true; return 0; }

get_installed_version() {
  local v
  if pkg_installed "$PKG_GUI"; then
    v="$(pkg_version "$PKG_GUI")"
    if [[ -n "$v" ]]; then printf '%s' "$v"; return 0; fi
  fi
  return 1
}

verify_installed() {
  local st v
  st="$(pkg_state "$PKG_GUI")"
  v="$(pkg_version "$PKG_GUI")"
  if [[ "$st" == "installed" && -n "$v" ]]; then printf '%s' "$v"; return 0; fi
  return 1
}

# ver_gt / ver_eq: dpkg version comparison, guarded against empty strings.
ver_gt() { if [[ -n "$1" && -n "$2" ]]; then dpkg --compare-versions "$1" gt "$2"; return $?; fi; return 1; }
ver_eq() { if [[ -n "$1" && -n "$2" ]]; then dpkg --compare-versions "$1" eq "$2"; return $?; fi; return 1; }

systemd_present() { have systemctl; }

repair_dpkg_state() {
  local audit
  audit="$(dpkg --audit 2>/dev/null || true)"
  if [[ -z "$audit" ]]; then return 0; fi
  say "Repairing interrupted package operations (dpkg --configure -a)" \
    "در حال اصلاح عملیات نیمه‌تمام بسته‌ها…"
  if dry_would "run: dpkg --configure -a"; then return 0; fi
  dpkg --configure -a || true
  return 0
}

# collect_owned_paths: remember every path dpkg attributes to our packages.
# MUST run before the purge - afterwards the information is gone. This is what
# catches dbus policies, polkit actions, mime files and icons that a hardcoded
# list would miss.
collect_owned_paths() {
  local pkg f
  OWNED_PATHS=()
  for pkg in "$PKG_GUI" "$PKG_CLI"; do
    if ! pkg_known "$pkg"; then continue; fi
    while IFS= read -r f; do
      [[ -n "$f" && "$f" == /* ]] || continue
      OWNED_PATHS+=("$f")
    done < <(dpkg-query -L "$pkg" 2>/dev/null || true)
  done
  return 0
}

# =============================================================================
# 6. DISCOVERY  (RULE 3: metadata-based, recursive, parallel, version-correct)
# =============================================================================
# probe_deb <file>: classify one .deb and print a single SEP-delimited record:
#   decision SEP pkg SEP ver SEP arch SEP size SEP mtime SEP path
# decision = good | cli | other | arch | bad | unreadable
probe_deb() {
  local f="$1" dec="bad" pkg="" ver="" arch="" size=0 mtime=0 meta=""
  if [[ ! -f "$f" || ! -r "$f" ]]; then
    printf '%s\n' "unreadable${SEP}${SEP}${SEP}${SEP}0${SEP}0${SEP}${f}"
    return 0
  fi
  size="$(stat -c %s -- "$f" 2>/dev/null || printf '0')"
  mtime="$(stat -c %Y -- "$f" 2>/dev/null || printf '0')"
  if (( size < MIN_DEB_BYTES )) || [[ "$(head -c 8 -- "$f" 2>/dev/null || true)" != $'!<arch>' ]]; then
    # an empty/truncated download or a file that is not an ar archive at all
    printf '%s\n' "bad${SEP}${SEP}${SEP}${SEP}${size}${SEP}${mtime}${SEP}${f}"
    return 0
  fi
  # identity comes from the deb's control METADATA, never from the file name
  # shellcheck disable=SC2016  # the format string must reach dpkg-deb literally
  meta="$(dpkg-deb -W --showformat='${Package} ${Version} ${Architecture}' -- "$f" 2>/dev/null || true)"
  read -r pkg ver arch <<<"$meta" || true
  pkg="${pkg:-}"; ver="${ver:-}"; arch="${arch:-}"
  if [[ -z "$pkg" || -z "$ver" ]]; then
    dec="bad"
  elif [[ "$pkg" == "$PKG_CLI" ]]; then
    dec="cli"
  elif [[ "$pkg" != "$PKG_GUI" ]]; then
    dec="other"
  elif [[ "$arch" != "$SYS_ARCH" && "$arch" != "all" ]] && \
       [[ ",$FOREIGN_ARCH," != *",$arch,"* ]]; then
    dec="arch"
  else
    dec="good"
  fi
  printf '%s\n' "${dec}${SEP}${pkg}${SEP}${ver}${SEP}${arch}${SEP}${size}${SEP}${mtime}${SEP}${f}"
  return 0
}

# find_deb_files <dir>: bounded, symlink-safe discovery, NUL-separated.
# Top level first (so ties prefer the file the user actually sees), then
# sub-folders. Hidden dirs, trash and package-manager internals are skipped.
find_deb_files() {
  local dir="$1" f
  local -a top=()
  collect_glob top "$dir/*.deb" "$dir/*.DEB"
  for f in "${top[@]+"${top[@]}"}"; do printf '%s\0' "$f"; done
  if (( MAX_DEPTH >= 2 )); then
    while IFS= read -r -d '' f; do printf '%s\0' "$f"; done < <(
      find "$dir" -mindepth 2 -maxdepth "$MAX_DEPTH" \
        \( -type d \( -name '.*' -o -name node_modules -o -name 'lost+found' \) -prune \) \
        -o \( \( -type f -o -type l \) \( -name '*.deb' -o -name '*.DEB' \) -print0 \) \
        2>/dev/null || true )
  fi
  return 0
}

# scan_downloads <dir>: build the candidate table, then pick the winner.
# Highest dpkg version wins; equal versions -> newest mtime; equal mtime ->
# discovery order (top level before sub-folders).
scan_downloads() {
  local dir="$1"
  SCAN_PATH=(); SCAN_DEC=(); SCAN_PKG=(); SCAN_VER=()
  SCAN_ARCH=(); SCAN_SIZE=(); SCAN_MTIME=()
  TOTAL_DEB=0; COUNT_GOOD=0; COUNT_BAD=0; COUNT_OTHER=0; COUNT_CLI=0; COUNT_ARCH=0
  CANDIDATE_PATH=""; CANDIDATE_VER=""; CANDIDATE_ARCH=""

  if [[ ! -d "$dir" ]]; then return 0; fi

  local -a files=()
  local -A seen=()
  local f rf key prev old depth_old depth_new
  while IFS= read -r -d '' f; do
    if [[ ! -f "$f" ]]; then continue; fi          # dirs, FIFOs, dangling links
    rf="$(readlink -f -- "$f" 2>/dev/null || printf '%s' "$f")"
    key="$(stat -c '%d:%i' -- "$rf" 2>/dev/null || printf '%s' "$rf")"
    prev="${seen[$key]:-}"
    if [[ -n "$prev" ]]; then
      # the same bytes reached twice (hard link / symlink): keep the better
      # representative - a real file beats a symlink, then the shallower path,
      # then whichever was found first
      old="${files[$prev]}"
      if [[ -L "$old" && ! -L "$f" ]]; then
        files[prev]="$f"
      elif [[ ! -L "$old" && ! -L "$f" ]] || [[ -L "$old" && -L "$f" ]]; then
        depth_old="${old//[!\/]/}"; depth_new="${f//[!\/]/}"
        if (( ${#depth_new} < ${#depth_old} )); then files[prev]="$f"; fi
      fi
      continue
    fi
    seen["$key"]="${#files[@]}"
    files+=("$f")
  done < <(find_deb_files "$dir")

  if (( ${#files[@]} == 0 )); then return 0; fi
  if (( ${#files[@]} > MAX_PROBE_FILES )); then
    warn "Found ${#files[@]} .deb files - probing only the first $MAX_PROBE_FILES" \
      "تعداد فایل‌ها زیاد است؛ فقط $MAX_PROBE_FILES مورد اول بررسی می‌شود"
    files=("${files[@]:0:MAX_PROBE_FILES}")
  fi

  local probe_dir="$TMPDIR_RUN/scan"
  mkdir -p -- "$probe_dir"
  local i

  local jobs="$JOBS"
  if (( jobs <= 0 )); then
    jobs="$(nproc 2>/dev/null || printf '2')"
    [[ "$jobs" =~ ^[0-9]+$ ]] || jobs=2
    if (( jobs > 8 )); then jobs=8; fi
    if (( jobs < 1 )); then jobs=1; fi
  fi
  # probing costs one dpkg-deb process per file (~25 ms). Forking only pays off
  # once there are many files, so small folders (the normal case) stay serial.
  local workers=1
  if (( ${#files[@]} >= PARALLEL_MIN_FILES )); then
    workers=$jobs
    if (( workers > PARALLEL_MAX_WORKERS )); then workers=PARALLEL_MAX_WORKERS; fi
    if (( ${#files[@]} < workers )); then workers=${#files[@]}; fi
  fi

  if (( workers > 1 )); then
    # probe in parallel: one FORKED subshell per worker (round-robin over the
    # list), each writing its own record file - no shared state, no race, and
    # no interpreter start-up per file (which costs more than dpkg-deb itself)
    local c
    for (( c = 0; c < workers; c++ )); do
      (
        for (( i = c; i < ${#files[@]}; i += workers )); do
          probe_deb "${files[$i]}" >"$probe_dir/$i.rec" 2>/dev/null || true
        done
      ) &
    done
    wait || true
  else
    for i in "${!files[@]}"; do
      probe_deb "${files[$i]}" >"$probe_dir/$i.rec" 2>/dev/null || true
    done
  fi

  # ---- aggregate in discovery order -----------------------------------------
  local rec dec pkg ver arch size mtime path
  local best_i="" best_ver="" best_mtime=-1
  for i in "${!files[@]}"; do
    rec="$probe_dir/$i.rec"
    if [[ ! -s "$rec" ]]; then
      SCAN_PATH+=("${files[$i]}"); SCAN_DEC+=("unreadable"); SCAN_PKG+=("")
      SCAN_VER+=(""); SCAN_ARCH+=(""); SCAN_SIZE+=("0"); SCAN_MTIME+=("0")
      TOTAL_DEB=$((TOTAL_DEB + 1)); COUNT_BAD=$((COUNT_BAD + 1))
      continue
    fi
    dec=""; pkg=""; ver=""; arch=""; size=0; mtime=0; path=""
    IFS="$SEP" read -r dec pkg ver arch size mtime path <"$rec" || true
    path="${path:-${files[$i]}}"
    SCAN_PATH+=("$path"); SCAN_DEC+=("$dec"); SCAN_PKG+=("$pkg")
    SCAN_VER+=("$ver"); SCAN_ARCH+=("$arch"); SCAN_SIZE+=("$size")
    SCAN_MTIME+=("$mtime")
    TOTAL_DEB=$((TOTAL_DEB + 1))
    case "$dec" in
      good)  COUNT_GOOD=$((COUNT_GOOD + 1)) ;;
      cli)   COUNT_CLI=$((COUNT_CLI + 1));    continue ;;
      other) COUNT_OTHER=$((COUNT_OTHER + 1)); continue ;;
      arch)  COUNT_ARCH=$((COUNT_ARCH + 1));   continue ;;
      *)     COUNT_BAD=$((COUNT_BAD + 1));     continue ;;
    esac
    if [[ -z "$best_i" ]]; then
      best_i="$i"; best_ver="$ver"; best_mtime="$mtime"
    elif ver_gt "$ver" "$best_ver"; then
      best_i="$i"; best_ver="$ver"; best_mtime="$mtime"
    elif ver_eq "$ver" "$best_ver" && (( mtime > best_mtime )); then
      best_i="$i"; best_ver="$ver"; best_mtime="$mtime"
    fi
  done

  if [[ -n "$best_i" ]]; then
    CANDIDATE_PATH="${SCAN_PATH[$best_i]}"
    CANDIDATE_VER="${SCAN_VER[$best_i]}"
    CANDIDATE_ARCH="${SCAN_ARCH[$best_i]}"
  fi
  return 0
}

reason_for() {
  case "$1" in
    good)       printf 'eligible' ;;
    cli)        printf 'skipped: windscribe-cli build (conflicts with the GUI)' ;;
    other)      printf 'skipped: different package (%s)' "${2:-?}" ;;
    arch)       printf 'skipped: foreign architecture (%s)' "${2:-?}" ;;
    unreadable) printf 'skipped: not a readable regular file' ;;
    *)          printf 'skipped: not a valid .deb (damaged or truncated?)' ;;
  esac
  return 0
}

print_scan_summary() {
  if [[ -n "$CANDIDATE_PATH" ]]; then
    ok "Selected: $PKG_GUI $CANDIDATE_VER (${CANDIDATE_ARCH}) - newest of $COUNT_GOOD eligible file(s)"
    note "file : $CANDIDATE_PATH"
    note "size : $(human_size "$(stat -c %s -- "$CANDIDATE_PATH" 2>/dev/null || printf 0)")"
  else
    warn "No usable '$PKG_GUI' .deb found in: $DOWNLOADS_DIR (search depth $MAX_DEPTH)"
  fi
  if (( TOTAL_DEB > 0 )); then
    note "seen $TOTAL_DEB .deb file(s): eligible=$COUNT_GOOD other-apps=$COUNT_OTHER cli=$COUNT_CLI wrong-arch=$COUNT_ARCH unreadable=$COUNT_BAD"
    note "فایل‌های برنامه‌های دیگر و نسخهٔ CLI نادیده گرفته شدند و دست‌نخورده باقی ماندند."
  fi
  return 0
}

print_candidate_table() {
  local i n="${#SCAN_PATH[@]}" mark
  if [[ -n "$INSTALLED_VER" ]]; then
    note "installed now: $PKG_GUI $INSTALLED_VER"
  else
    note "installed now: (not installed)"
  fi
  printf '\n'
  printf '  %-2s %-14s %-8s %-9s %s\n' "" "VERSION" "ARCH" "SIZE" "FILE"
  printf '  %s\n' "---------------------------------------------------------------------------"
  for (( i = 0; i < n; i++ )); do
    mark=" "
    if [[ "${SCAN_DEC[$i]}" == "good" ]]; then mark="*"; fi
    if [[ -n "$CANDIDATE_PATH" && "${SCAN_PATH[$i]}" == "$CANDIDATE_PATH" ]]; then mark=">"; fi
    printf '  %-2s %-14s %-8s %-9s %s\n' "$mark" "${SCAN_VER[$i]:--}" \
      "${SCAN_ARCH[$i]:--}" "$(human_size "${SCAN_SIZE[$i]:-0}")" "${SCAN_PATH[$i]}"
    if [[ "${SCAN_DEC[$i]}" != "good" ]]; then
      local detail=""
      case "${SCAN_DEC[$i]}" in
        other) detail="${SCAN_PKG[$i]}" ;;
        arch)  detail="${SCAN_ARCH[$i]}" ;;
      esac
      printf '       %s%s%s\n' "$C_DIM" "$(reason_for "${SCAN_DEC[$i]}" "$detail")" "$C_OFF"
    fi
  done
  printf '\n'
  note "'>' = the file this script would install    '*' = eligible but not the newest"
  note "Ordering comes from dpkg --compare-versions; equal versions are broken by"
  note "newest mtime, then by the shallowest folder. File NAMES are never used:"
  note "identity is read from the deb's own control metadata."
  note "ترتیب نسخه‌ها از خود dpkg گرفته می‌شود؛ نام فایل هیچ تأثیری ندارد."
  return 0
}

# =============================================================================
# 7. INTEGRITY: a damaged download must never trigger a destructive cycle
# =============================================================================
# validate_deb <file> [deep]: structural + payload check. deep=1 streams the
# whole data member (tar verifies every checksum) and caches the file listing.
validate_deb() {
  local deb="$1" deep_check="${2:-1}"
  local size hdr meta pkg ver arch ctl_dir list

  if [[ ! -f "$deb" ]]; then warn "not a regular file: $deb"; return 1; fi
  if [[ ! -r "$deb" ]]; then warn "not readable: $deb"; return 1; fi
  size="$(stat -c %s -- "$deb" 2>/dev/null || printf 0)"
  if (( size < MIN_DEB_BYTES )); then
    warn "far too small to be a .deb ($(human_size "$size")): $deb"; return 1
  fi
  hdr="$(head -c 8 -- "$deb" 2>/dev/null || true)"
  if [[ "$hdr" != $'!<arch>' ]]; then
    warn "missing ar header - this is not a .deb (partial download?): $deb"
    return 1
  fi
  # shellcheck disable=SC2016  # the format string must reach dpkg-deb literally
  meta="$(dpkg-deb -W --showformat='${Package} ${Version} ${Architecture}' -- "$deb" 2>/dev/null || true)"
  read -r pkg ver arch <<<"$meta" || true
  if [[ -z "${pkg:-}" || -z "${ver:-}" ]]; then
    warn "dpkg-deb cannot read the control member - the .deb is damaged: $deb"
    return 1
  fi
  if [[ "$pkg" != "$PKG_GUI" ]]; then
    warn "control says Package: $pkg (expected $PKG_GUI) - refusing: $deb"
    return 1
  fi

  ctl_dir="$TMPDIR_RUN/ctl"
  rm -rf -- "$ctl_dir"; mkdir -p -- "$ctl_dir"
  if ! dpkg-deb -e -- "$deb" "$ctl_dir" >/dev/null 2>&1; then
    warn "control archive cannot be extracted - the .deb is damaged: $deb"
    return 1
  fi
  if [[ ! -s "$ctl_dir/control" ]]; then
    warn "no usable control file inside the .deb: $deb"; return 1
  fi

  if [[ "$deep_check" == "1" ]]; then
    list="$TMPDIR_RUN/deb-contents.txt"
    if ! dpkg-deb -c -- "$deb" >"$list" 2>/dev/null; then
      warn "data archive is truncated or corrupt - the download is incomplete: $deb"
      note "Re-download the file. Nothing on this system was changed."
      note "فایل ناقص است؛ آن را دوباره دانلود کنید. هیچ تغییری روی سیستم اعمال نشد."
      return 1
    fi
    DEB_CONTENTS="$list"
    if ! grep -qE ' \./(opt/windscribe|usr/bin/windscribe)' "$list" 2>/dev/null; then
      warn "the payload does not look like the Windscribe GUI (no /opt/windscribe)"
    fi
  fi
  return 0
}

# record_deb_identity: remember size+mtime+inode+sha256 so the final report can
# PROVE the download was only read (RULE 2).
record_deb_identity() {
  if [[ -z "$CANDIDATE_PATH" || ! -e "$CANDIDATE_PATH" ]]; then return 0; fi
  DEB_SZ_BEFORE="$(stat -c %s -- "$CANDIDATE_PATH" 2>/dev/null || printf '')"
  DEB_MT_BEFORE="$(stat -c %Y -- "$CANDIDATE_PATH" 2>/dev/null || printf '')"
  DEB_INO_BEFORE="$(stat -c %i -- "$CANDIDATE_PATH" 2>/dev/null || printf '')"
  DEB_SHA_BEFORE="$(hash_file "$CANDIDATE_PATH")"
  return 0
}

check_deb_untouched() {
  if [[ -z "$CANDIDATE_PATH" ]]; then return 0; fi
  if [[ ! -e "$CANDIDATE_PATH" ]]; then
    warn "the .deb is gone from $DOWNLOADS_DIR (this script never deletes it)"
    return 1
  fi
  local sz mt ino sha
  sz="$(stat -c %s -- "$CANDIDATE_PATH" 2>/dev/null || printf '')"
  mt="$(stat -c %Y -- "$CANDIDATE_PATH" 2>/dev/null || printf '')"
  ino="$(stat -c %i -- "$CANDIDATE_PATH" 2>/dev/null || printf '')"
  sha="$(hash_file "$CANDIDATE_PATH")"
  if [[ "$sz" == "$DEB_SZ_BEFORE" && "$mt" == "$DEB_MT_BEFORE" &&
        "$ino" == "$DEB_INO_BEFORE" && "$sha" == "$DEB_SHA_BEFORE" ]]; then
    ok "The .deb was only READ - still in place, byte-for-byte identical"
    note "path  : $CANDIDATE_PATH"
    note "proof : size=$sz mtime=$mt inode=$ino sha256=${sha:0:16}…"
    return 0
  fi
  warn "the .deb changed while this script ran (size ${DEB_SZ_BEFORE:-?} -> ${sz:-?})"
  return 1
}

# =============================================================================
# 8. ENVIRONMENT: who is the desktop user, and where are the downloads
# =============================================================================
# detect_real_user: $SUDO_USER alone is not enough - under pkexec, `su -c`,
# `sudo -i`, a cron job or a polkit prompt it is empty or "root", and then the
# wipe would silently target /root while the real user stays remembered.
detect_real_user() {
  local u="" d owner newest=0 mt

  if [[ -n "$FORCE_USER" ]]; then
    u="$FORCE_USER"
  elif [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    u="$SUDO_USER"
  elif [[ -n "${PKEXEC_UID:-}" ]]; then
    u="$(getent passwd "$PKEXEC_UID" 2>/dev/null | cut -d: -f1 || true)"
  fi

  if [[ -z "$u" || "$u" == "root" ]]; then
    # the most recently active local session directory belongs to the desktop user
    for d in /run/user/*; do
      if [[ ! -d "$d" || "$d" == "/run/user/0" ]]; then continue; fi
      owner="$(stat -c %U -- "$d" 2>/dev/null || true)"
      mt="$(stat -c %Y -- "$d" 2>/dev/null || printf 0)"
      if [[ -n "$owner" && "$owner" != "root" ]] && (( mt > newest )); then
        newest="$mt"; u="$owner"
      fi
    done
  fi
  if [[ -z "$u" || "$u" == "root" ]] && have loginctl; then
    u="$(loginctl list-users --no-legend 2>/dev/null |
         awk 'NF>=2 && $2!="root"{print $2; exit}' || true)"
  fi
  if [[ -z "$u" ]]; then u="$(id -un)"; fi

  REAL_USER="$u"
  REAL_UID="$(id -u -- "$u" 2>/dev/null || printf '')"
  REAL_HOME="$(getent passwd "$u" 2>/dev/null | cut -d: -f6 || true)"
  if [[ -z "$REAL_HOME" || ! -d "$REAL_HOME" ]]; then REAL_HOME="${HOME:-/root}"; fi
  REAL_HOME="${REAL_HOME%/}"

  DBUS_ADDR=""
  if [[ -n "$REAL_UID" && -S "/run/user/$REAL_UID/bus" ]]; then
    DBUS_ADDR="unix:path=/run/user/$REAL_UID/bus"
  fi
  USER_ENV=(HOME="$REAL_HOME" USER="$REAL_USER" LOGNAME="$REAL_USER")
  if [[ -n "$REAL_UID" && -d "/run/user/$REAL_UID" ]]; then
    USER_ENV+=(XDG_RUNTIME_DIR="/run/user/$REAL_UID")
  fi
  if [[ -n "$DBUS_ADDR" ]]; then USER_ENV+=(DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDR"); fi
  if [[ -n "${DISPLAY:-}" ]]; then USER_ENV+=(DISPLAY="$DISPLAY"); fi
  if [[ -n "${WAYLAND_DISPLAY:-}" ]]; then USER_ENV+=(WAYLAND_DISPLAY="$WAYLAND_DISPLAY"); fi

  # every home directory on the box, for the destructive-path guard
  HOME_PREFIXES=()
  if [[ -n "$REAL_HOME" ]]; then HOME_PREFIXES+=("$REAL_HOME"); fi
  local _hu hh
  while IFS=: read -r _hu _pw _uid _gid _gc hh _sh; do
    case "$hh" in
      /home/*|/root|/var/home/*|/Users/*|/data/*)
        if [[ -d "$hh" ]]; then HOME_PREFIXES+=("$hh"); fi ;;
    esac
  done < /etc/passwd
  HOME_PREFIXES+=("/root")
  return 0
}

# list_wipe_homes: every account whose data must be forgotten - the desktop user
# first, then any other human account, then root (in case the GUI was ever
# started from a root shell). Output: "user|home", deduplicated.
list_wipe_homes() {
  local -a out=()
  local u h seen
  __add_home() {
    u="$1"; h="$2"
    if [[ -z "$h" || ! -d "$h" ]]; then return 0; fi
    case "$h" in /|/home|/nonexistent|/dev/null) return 0 ;; esac
    for seen in "${out[@]+"${out[@]}"}"; do
      if [[ "$seen" == "$u|$h" ]]; then return 0; fi
    done
    out+=("$u|$h")
    return 0
  }
  __add_home "$REAL_USER" "$REAL_HOME"
  local pu ph
  while IFS=: read -r pu _pw _uid _gid _gc ph _sh; do
    case "$ph" in
      /home/*|/root|/var/home/*|/Users/*) __add_home "$pu" "$ph" ;;
    esac
  done < /etc/passwd
  __add_home "root" "/root"
  printf '%s\n' "${out[@]+"${out[@]}"}"
  return 0
}

# detect_downloads_dir: XDG DOWNLOAD of the *real* user, so localized folder
# names («دانلودها», "Téléchargements", ...) work. The folder is only read.
detect_downloads_dir() {
  local dir="" cfg="" val=""
  if have xdg-user-dir; then
    if [[ "$EUID" -eq 0 && -n "$REAL_USER" && "$REAL_USER" != "root" ]] && have runuser; then
      dir="$(runuser -u "$REAL_USER" -- env HOME="$REAL_HOME" \
              xdg-user-dir DOWNLOAD 2>/dev/null || true)"
    else
      dir="$(env HOME="$REAL_HOME" xdg-user-dir DOWNLOAD 2>/dev/null || true)"
    fi
  fi
  if [[ -z "$dir" || ! -d "$dir" ]]; then
    # parse the XDG config directly - works without the helper binary
    cfg="$REAL_HOME/.config/user-dirs.dirs"
    if [[ -r "$cfg" ]]; then
      val="$(grep -m1 '^XDG_DOWNLOAD_DIR=' "$cfg" 2>/dev/null || true)"
      val="${val#XDG_DOWNLOAD_DIR=}"
      val="${val%\"}"; val="${val#\"}"
      val="${val%\'}"; val="${val#\'}"
      if [[ "$val" == \$HOME/* ]]; then
        dir="$REAL_HOME/${val#\$HOME/}"
      elif [[ "$val" == /* && -d "$val" ]]; then
        dir="$val"
      fi
    fi
  fi
  if [[ -z "$dir" || ! -d "$dir" ]]; then dir="$REAL_HOME/Downloads"; fi
  printf '%s' "$dir"
  return 0
}

# =============================================================================
# 9. REMOVAL  (RULE 1)
# =============================================================================
kill_app_processes() {
  say "Stopping Windscribe processes (GUI / engine / CLI / helper)" \
    "در حال بستن پروسه‌های ویندسکرایب (گرافیکی، موتور، خط فرمان و سرویس کمکی)…"
  if dry_would "stop the Windscribe processes"; then return 0; fi
  if ! have pkill; then note "pkill not available - skipping process shutdown"; return 0; fi
  local name round=0 alive=0
  if systemd_present; then
    systemctl kill --kill-who=all --signal=SIGTERM "$SVC_UNIT" >/dev/null 2>&1 || true
  fi
  for name in "${APP_PROCS[@]}"; do pkill -TERM -x -- "$name" >/dev/null 2>&1 || true; done
  # anchored on the executable path, so an editor showing /opt/windscribe is safe
  pkill -TERM -f -- "^$APP_EXE_PREFIX" >/dev/null 2>&1 || true
  while :; do
    alive=0
    for name in "${APP_PROCS[@]}"; do
      if pgrep -x -- "$name" >/dev/null 2>&1; then alive=1; fi
    done
    if pgrep -f -- "^$APP_EXE_PREFIX" >/dev/null 2>&1; then alive=1; fi
    if (( alive == 0 )); then break; fi
    round=$((round + 1))
    if (( round >= PROCESS_WAIT_ROUNDS )); then break; fi
    sleep 0.1
  done
  if systemd_present; then
    systemctl kill --kill-who=all --signal=SIGKILL "$SVC_UNIT" >/dev/null 2>&1 || true
  fi
  for name in "${APP_PROCS[@]}"; do pkill -KILL -x -- "$name" >/dev/null 2>&1 || true; done
  pkill -KILL -f -- "^$APP_EXE_PREFIX" >/dev/null 2>&1 || true
  return 0
}

stop_helper_service() {
  say "Stopping and disabling the service: $SVC_UNIT" "در حال توقف و غیرفعال‌سازی سرویس $SVC…"
  if dry_would "stop and disable $SVC_UNIT"; then return 0; fi
  if systemd_present; then
    systemctl stop "$SVC_UNIT" >/dev/null 2>&1 || true
    systemctl disable "$SVC_UNIT" >/dev/null 2>&1 || true
    systemctl stop windscribe-helper.socket >/dev/null 2>&1 || true
  fi
  if have service; then service "$SVC" stop >/dev/null 2>&1 || true; fi
  return 0
}

wait_for_apt_lock() {
  if ! have fuser; then return 0; fi
  local -a existing=()
  local lf round=0
  for lf in "${APT_LOCK_FILES[@]}"; do
    if [[ -e "$lf" ]]; then existing+=("$lf"); fi
  done
  if (( ${#existing[@]} == 0 )); then return 0; fi
  while fuser "${existing[@]}" >/dev/null 2>&1; do
    round=$((round + 1))
    if (( round > APT_LOCK_ROUNDS )); then
      die "apt/dpkg is busy - another package operation is running" \
        "ابزار apt مشغول است (فرایند نصب دیگری در حال اجراست) — کمی بعد دوباره تلاش کنید"
    fi
    if (( round == 1 )); then note "waiting for the apt/dpkg lock to be released…"; fi
    sleep 2
  done
  return 0
}

purge_packages() {
  local pkg st
  for pkg in "$@"; do
    st="$(pkg_state "$pkg")"
    if [[ "$st" == "none" ]]; then
      note "$pkg: not in the dpkg database (nothing to purge)"
      continue
    fi
    if dry_would "purge package: $pkg (dpkg state: $st)"; then continue; fi
    say "Purging package: $pkg" "در حال حذف کامل بستهٔ $pkg…"
    wait_for_apt_lock
    if ! apt-get purge -y -- "$pkg"; then
      warn "apt-get purge failed for $pkg - falling back to dpkg --purge"
      if ! dpkg --purge -- "$pkg"; then
        die "Failed to purge $pkg" "حذف بستهٔ $pkg ناموفق بود"
      fi
    fi
  done
  return 0
}

# sweep_owned_files: remove what dpkg said the packages owned (captured before
# the purge) but is still on disk - exact paths, system prefixes only.
sweep_owned_files() {
  local p prefix ok_pref n=0
  if (( ${#OWNED_PATHS[@]} == 0 )); then return 0; fi
  for p in "${OWNED_PATHS[@]}"; do
    ok_pref=0
    for prefix in "${SWEEP_PREFIXES[@]}"; do
      case "$p" in "$prefix"*) ok_pref=1; break ;; esac
    done
    if (( ok_pref == 0 )); then continue; fi
    if [[ -d "$p" && ! -L "$p" ]]; then
      # A directory can be shared with other packages (dpkg refcounts those, we
      # do not), so only Windscribe-named directories are dropped, and only
      # when they are empty. An empty shared directory is left alone on purpose:
      # it costs nothing and removing it could break another package.
      if path_is_ours "$p" && guard_path "$p"; then
        rmdir --ignore-fail-on-non-empty -- "$p" 2>/dev/null || true
        if [[ ! -d "$p" ]]; then n=$((n + 1)); note "removed empty dir: $p"; fi
      fi
    elif safe_rm_file "$p"; then
      n=$((n + 1)); note "removed package file: $p"
    fi
  done
  REMOVED_LEFTOVERS=$((REMOVED_LEFTOVERS + n))
  return 0
}

# sweep_named_leftovers: files an older/newer build left behind that dpkg no
# longer owns. Only Windscribe-named entries inside Windscribe-only system
# directories, with a content check for mere substring matches.
sweep_named_leftovers() {
  local dir icon theme h n=0
  local -a hits=()
  for dir in "${NAME_GLOB_DIRS[@]}"; do
    if [[ ! -d "$dir" ]]; then continue; fi
    collect_glob hits "$dir"/windscribe* "$dir"/Windscribe* \
                      "$dir"/*windscribe*.desktop "$dir"/*windscribe*.service \
                      "$dir"/*windscribe*.preset  "$dir"/*windscribe*.conf \
                      "$dir"/*windscribe*.policy  "$dir"/*windscribe*.rules \
                      "$dir"/*windscribe*.xml
    for h in "${hits[@]+"${hits[@]}"}"; do
      if [[ ! -e "$h" && ! -L "$h" ]]; then continue; fi
      if [[ -d "$h" && ! -L "$h" ]]; then continue; fi
      if ! path_is_ours "$h"; then continue; fi
      if safe_rm_file "$h"; then note "removed leftover: $h"; n=$((n + 1)); fi
    done
  done
  for theme in "${ICON_THEME_ROOTS[@]}"; do
    if [[ ! -d "$theme" ]]; then continue; fi
    collect_glob hits "$theme"/*/*/apps/Windscribe* "$theme"/*/*/apps/windscribe* \
                      "$theme"/*/*/mimetypes/windscribe* \
                      "$theme"/*/apps/Windscribe*   "$theme"/*/apps/windscribe* \
                      "$theme"/*/*/apps/"$LAUNCHER_ICON_NAME"
    for icon in "${hits[@]+"${hits[@]}"}"; do
      if safe_rm_file "$icon"; then note "removed leftover icon: $icon"; n=$((n + 1)); fi
    done
  done
  REMOVED_LEFTOVERS=$((REMOVED_LEFTOVERS + n))
  return 0
}

sweep_system_leftovers() {
  say "Sweeping system leftovers (paths, dpkg-owned files, icons, firewall, user)" \
    "پاک‌سازی باقی‌مانده‌های سیستمی (مسیرها، فایل‌های بسته، آیکن‌ها، فایروال، کاربر سیستمی)…"
  if dry_would "remove the Windscribe system paths, the dpkg-owned files and the icons"; then
    return 0
  fi

  if systemd_present; then
    systemctl daemon-reload >/dev/null 2>&1 || true
    systemctl reset-failed "$SVC_UNIT" >/dev/null 2>&1 || true
  fi

  # stale firewall tables the engine created (their names contain windscribe)
  if have nft; then
    local family table
    while read -r family table; do
      if [[ -z "${table:-}" ]]; then continue; fi
      if nft delete table "$family" "$table" >/dev/null 2>&1; then
        note "removed stale nftables table: $family $table"
        REMOVED_LEFTOVERS=$((REMOVED_LEFTOVERS + 1))
      fi
    done < <(nft list tables 2>/dev/null | awk '{print $2, $3}' | grep -i windscribe || true)
  fi

  local path n=0
  for path in "${SYSTEM_PATHS[@]}"; do
    if safe_rm "$path"; then note "removed leftover: $path"; n=$((n + 1)); fi
  done
  REMOVED_LEFTOVERS=$((REMOVED_LEFTOVERS + n))

  sweep_owned_files
  sweep_named_leftovers

  # the system account created by the deb's postinst (only if it is a service acct)
  if id -u "$SYS_ACCT" >/dev/null 2>&1; then
    local sh
    sh="$(getent passwd "$SYS_ACCT" 2>/dev/null | cut -d: -f7 || true)"
    case "$sh" in
      */nologin|*/false|"")
        userdel "$SYS_ACCT" >/dev/null 2>&1 || true
        note "removed system user: $SYS_ACCT" ;;
      *) warn "user '$SYS_ACCT' has a login shell - left alone" ;;
    esac
  fi
  if getent group "$SYS_ACCT" >/dev/null 2>&1; then
    groupdel "$SYS_ACCT" >/dev/null 2>&1 || true
    note "removed system group: $SYS_ACCT"
  fi
  return 0
}

# ---------------------------------------------------------------------------
# per-user wipe: collect -> back up once -> delete -> forget the menu pins
# ---------------------------------------------------------------------------
# user_targets <home>: print every literal per-user path this script may remove.
user_targets() {
  local home="$1" root name rel
  for root in "${USER_DATA_ROOTS[@]}"; do
    for name in "${USER_DATA_NAMES[@]}"; do printf '%s\n' "$home/$root/$name"; done
  done
  for rel in "${USER_EXTRA_REL[@]}";      do printf '%s\n' "$home/$rel"; done
  for rel in "${USER_LAUNCHER_FILES[@]}"; do printf '%s\n' "$home/$rel"; done
  return 0
}

# user_glob_targets <home>: entries that must be matched by GLOB are expanded
# here - a literal pattern string would never match anything on disk.
user_glob_targets() {
  local home="$1" h
  local -a hits=()
  collect_glob hits \
    "$home/$USER_AUTOSTART_DIR"/windscribe*.desktop \
    "$home/$USER_AUTOSTART_DIR"/Windscribe*.desktop \
    "$home"/.config/systemd/user/windscribe*.service \
    "$home"/.config/systemd/user/Windscribe*.service \
    "$home"/.config/systemd/user/*.wants/windscribe*.service
  for h in "${hits[@]+"${hits[@]}"}"; do printf '%s\n' "$h"; done
  return 0
}

backup_paths() {
  if [[ "$MAKE_BACKUP" != "true" ]]; then return 0; fi
  if (( $# == 0 )); then return 0; fi
  local stamp out
  stamp="$(date +%Y%m%d-%H%M%S)"
  out="$BACKUP_ROOT/user-data-$stamp.tar.gz"
  if is_dry_run; then dry "would back up $# user-data path(s) to $out"; return 0; fi
  mkdir -p -- "$BACKUP_ROOT" 2>/dev/null || return 0
  if tar -czf "$out" --absolute-names --warning=no-file-changed "$@" >/dev/null 2>&1; then
    BACKUP_FILE="$out"
    chmod 600 -- "$out" 2>/dev/null || true
    note "backup of the removed user data: $out"
  elif [[ -s "$out" ]]; then
    # tar exits 1 on "file changed as we read it"; keep the archive if usable
    BACKUP_FILE="$out"
    chmod 600 -- "$out" 2>/dev/null || true
    note "backup (some files changed while reading): $out"
  else
    rm -f -- "$out" 2>/dev/null || true
    warn "could not create the user-data backup"
  fi
  return 0
}

wipe_user_data() {
  if [[ "$KEEP_USER_DATA" == "true" ]]; then
    say "Keeping user data (--keep-user-data): login and settings survive" \
      "داده‌های کاربری نگه داشته می‌شوند (لاگین و تنظیمات حذف نمی‌شوند)"
    return 0
  fi
  say "Wiping user data so the app forgets login, settings and the menu entry" \
    "پاک‌سازی داده‌های کاربری تا برنامه شما را کاملاً فراموش کند (لاگین قبلی حذف می‌شود)…"
  if dry_would "wipe the Windscribe data of every user + autostart/launcher entries + menu pins + keyring"; then
    return 0
  fi

  local wuser home entry rel removed=0
  local -a targets=()
  local -A homes_with_data=()

  # ---- pass 1: collect what actually exists --------------------------------
  while IFS='|' read -r wuser home; do
    if [[ -z "$home" || ! -d "$home" ]]; then continue; fi
    local found_here=0
    while IFS= read -r entry; do
      if [[ -n "$entry" ]] && { [[ -e "$entry" || -L "$entry" ]]; }; then
        targets+=("$entry"); found_here=1
      fi
    done < <(user_targets "$home")
    while IFS= read -r entry; do
      if [[ -n "$entry" ]] && { [[ -e "$entry" || -L "$entry" ]]; }; then
        targets+=("$entry"); found_here=1
      fi
    done < <(user_glob_targets "$home")
    for rel in "${USER_CACHE_REL[@]}"; do
      entry="$home/$rel"
      if [[ -e "$entry" || -L "$entry" ]]; then targets+=("$entry"); found_here=1; fi
    done
    if (( found_here == 1 )); then homes_with_data["$wuser"]=$home; fi
  done < <(list_wipe_homes)

  if (( ${#targets[@]} == 0 )); then
    WIPE_COUNT=0; WIPE_USERS=0
    note "(no per-user Windscribe data found - already clean)"
    clear_menu_pins
    purge_keyring_entries
    return 0
  fi

  # ---- pass 2: one archive with everything that is about to disappear -------
  backup_paths "${targets[@]}"

  # ---- pass 3: delete (every path re-checked by the safety guard) -----------
  for entry in "${targets[@]}"; do
    if safe_rm "$entry"; then
      note "removed: $entry"
      removed=$((removed + 1))
    fi
  done

  WIPE_COUNT=$removed
  WIPE_USERS=${#homes_with_data[@]}
  note "$removed location(s) removed for $WIPE_USERS user account(s)"
  clear_menu_pins
  purge_keyring_entries
  return 0
}

# clear_menu_pins: un-pin the launcher from the GNOME dash and the KDE kickoff
# so no stale icon survives in a panel after the removal.
clear_menu_pins() {
  if have gsettings && [[ -d /usr/share/glib-2.0/schemas ]]; then
    local cur new item keep="" changed=0
    cur="$(as_user_out gsettings get org.gnome.shell favorite-apps || true)"
    if [[ "$cur" == \[*\]* && "$cur" != "@as []" ]]; then
      while IFS= read -r item; do
        if [[ -z "$item" ]]; then continue; fi
        if [[ "$(lower "$item")" == *windscribe* ]]; then
          changed=1
          note "un-pinned from the GNOME dash: $item"
        else
          if [[ -n "$keep" ]]; then keep="$keep, "; fi
          keep="$keep'$item'"
        fi
      done < <(printf '%s' "$cur" | tr -d '[]' | tr ',' '\n' |
               sed -e 's/^ *//' -e 's/ *$//' -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//')
      if (( changed == 1 )); then
        new="[$keep]"
        if is_dry_run; then
          dry "would set org.gnome.shell favorite-apps to $new"
        else
          run_as_user gsettings set org.gnome.shell favorite-apps "$new"
          ok "GNOME dash favourite removed"
        fi
      fi
    fi
  fi

  # ---- KDE Plasma kickoff favourites ---------------------------------------
  local wuser home kf bak own
  while IFS='|' read -r wuser home; do
    if [[ -z "$home" || ! -d "$home" ]]; then continue; fi
    kf="$home/$KDE_FAVOURITE_REL"
    if [[ ! -f "$kf" || ! -r "$kf" ]]; then continue; fi
    if ! LC_ALL=C grep -qi 'windscribe' "$kf" 2>/dev/null; then continue; fi
    if is_dry_run; then
      dry "would drop the windscribe token from $kf (favorites= lines)"
      continue
    fi
    own="$(stat -c '%u:%g' -- "$kf" 2>/dev/null || printf '')"
    bak="$kf.wsm-bak"
    cp -p -- "$kf" "$bak" 2>/dev/null || true
    # kickoff stores "favorites=a,b,c"; drop only the Windscribe entries and
    # leave every other key (including the boolean favoritesPorted) alone
    awk '
      /^[[:space:]]*favorites[[:space:]]*=/ {
        eq = index($0, "=")
        pre = substr($0, 1, eq)
        n = split(substr($0, eq + 1), parts, ",")
        out = ""
        for (i = 1; i <= n; i++) {
          if (tolower(parts[i]) ~ /windscribe/) continue
          out = (out == "" ? parts[i] : out "," parts[i])
        }
        $0 = pre out
      }
      { print }
    ' "$bak" >"$kf" 2>/dev/null || cp -p -- "$bak" "$kf" 2>/dev/null || true
    if [[ -n "$own" ]]; then chown "$own" -- "$kf" 2>/dev/null || true; fi
    note "KDE kickoff favourite cleaned for $wuser (backup: $bak)"
  done < <(list_wipe_homes)
  return 0
}

# purge_keyring_entries: drop the Windscribe secrets from the session keyring
# (libsecret / GNOME Keyring) so the app cannot silently log back in. Only
# items whose label or attributes mention Windscribe are removed, it runs as the
# desktop user, and a missing python3/gi simply means "nothing to do".
purge_keyring_entries() {
  if [[ "$KEEP_KEYRING" == "true" ]]; then
    note "keyring entries kept (--keep-keyring)"
    return 0
  fi
  if ! have python3 || [[ -z "$REAL_HOME" || "$REAL_USER" == "root" ]]; then
    note "no session keyring to clean (python3 or a desktop user is missing)"
    return 0
  fi
  local script="$TMPDIR_RUN/keyring-clean.py" out
  cat >"$script" <<'PYEOF'
import sys
dry = "--dry" in sys.argv
try:
    import gi
    gi.require_version("Secret", "1")
    from gi.repository import Secret
except Exception:
    sys.exit(0)
try:
    svc = Secret.Service.get_sync(Secret.ServiceFlags.LOAD_COLLECTIONS)
except Exception:
    sys.exit(0)
for coll in svc.get_collections():
    try:
        items = coll.get_items()
    except Exception:
        continue
    for it in items:
        try:
            label = it.get_label() or ""
            attrs = it.get_attributes() or {}
            blob = " ".join([label] + ["%s=%s" % kv for kv in attrs.items()]).lower()
            if "windscribe" not in blob:
                continue
            print(("WOULD-DELETE " if dry else "DELETED ") + (label or "<no label>"))
            if not dry:
                it.delete_sync()
        except Exception:
            continue
PYEOF
  chmod 0644 -- "$script" 2>/dev/null || true
  chmod 0755 -- "$TMPDIR_RUN" 2>/dev/null || true
  if is_dry_run; then
    out="$(as_user_out python3 "$script" --dry || true)"
  else
    out="$(as_user_out python3 "$script" || true)"
  fi
  if [[ -n "$out" ]]; then
    while IFS= read -r line; do
      [[ -n "$line" ]] || continue
      note "keyring: $line"
      KEYRING_COUNT=$((KEYRING_COUNT + 1))
    done <<<"$out"
  else
    note "keyring: no Windscribe secrets found"
  fi
  return 0
}

# refresh_desktop_caches: rebuild every menu/icon cache that can hold a stale
# launcher - system wide AND for the desktop user, with a real session env.
refresh_desktop_caches() {
  say "Rebuilding the desktop menu, icon and XDG caches" \
    "بازسازی کش منوی برنامه‌ها و آیکن‌ها (تا آیکن حذف‌شده واقعاً ناپدید شود)…"
  if dry_would "rebuild the desktop, icon, XDG menu and KDE sycoca caches"; then return 0; fi

  if have update-desktop-database && [[ -d /usr/share/applications ]]; then
    update-desktop-database -q /usr/share/applications >/dev/null 2>&1 || true
  fi
  if have gtk-update-icon-cache; then
    local theme t
    for theme in "${ICON_THEME_ROOTS[@]}"; do
      if [[ ! -d "$theme" ]]; then continue; fi
      for t in "$theme"/*; do
        if [[ ! -d "$t" ]]; then continue; fi
        gtk-update-icon-cache -q -t -f "$t" >/dev/null 2>&1 || true
      done
    done
  fi

  # per-user side: must run AS the user with XDG_RUNTIME_DIR / DBUS set
  local udir="$REAL_HOME/.local/share/applications"
  if have update-desktop-database && [[ -d "$udir" ]]; then
    run_as_user update-desktop-database -q "$udir"
  fi
  if have xdg-desktop-menu; then run_as_user xdg-desktop-menu forceupdate; fi

  # kbuildsycoca is usually NOT on PATH - look in the usual libexec places too
  local kb bin cand
  for kb in kbuildsycoca6 kbuildsycoca5; do
    bin=""
    if have "$kb"; then
      bin="$kb"
    else
      for cand in "/usr/lib/qt6/bin/$kb" "/usr/lib/qt5/bin/$kb" \
                  "/usr/lib/x86_64-linux-gnu/libexec/kf6/$kb" \
                  "/usr/lib/x86_64-linux-gnu/libexec/kf5/$kb" \
                  "/usr/libexec/$kb" "/usr/lib/kf6/$kb" "/usr/lib/kf5/$kb"; do
        if [[ -x "$cand" ]]; then bin="$cand"; break; fi
      done
    fi
    if [[ -n "$bin" ]]; then
      run_as_user "$bin" --noincremental
      note "KDE menu cache rebuilt ($kb)"
      break
    fi
  done
  return 0
}

run_autoremove() {
  if [[ "$NO_AUTOREMOVE" == "true" ]]; then
    say "Skipping dependency cleanup (--no-autoremove)" \
      "پاک‌سازی وابستگی‌ها رد شد (--no-autoremove)"
    return 0
  fi
  say "Cleaning orphaned dependencies (apt-get autoremove --purge)" \
    "پاک‌سازی بسته‌های وابستهٔ بی‌استفاده…"
  if dry_would "run: apt-get autoremove --purge -y"; then return 0; fi
  wait_for_apt_lock
  apt-get autoremove --purge -y || true
  return 0
}

remove_phase() {
  collect_owned_paths
  kill_app_processes
  stop_helper_service
  purge_packages "$PKG_GUI" "$PKG_CLI"
  sweep_system_leftovers
  wipe_user_data
  refresh_desktop_caches
  return 0
}

# =============================================================================
# 10. INSTALLATION + PROOF OF COMPLETENESS
# =============================================================================
install_candidate() {
  local deb="$1" apt_ver
  local -a apt_opts=(-o "Dir::Cache::archives=$APT_ARCHIVE_DIR")
  if is_dry_run; then
    say "Installing $PKG_GUI $CANDIDATE_VER (dry run)" \
      "حالت آزمایشی: هیچ نصبی انجام نمی‌شود"
    note "source file (kept in place): $deb"
    return 0
  fi
  say "Installing $PKG_GUI $CANDIDATE_VER" \
    "در حال نصب ویندسکرایب $CANDIDATE_VER (وابستگی‌ها خودکار نصب می‌شوند)…"
  note "source file (kept in place): $deb"

  # apt would otherwise copy the .deb into its own archive cache; point that
  # cache at our private temp dir so nothing is written next to the download
  apt_ver="$( { apt-get --version 2>/dev/null || true; } | awk 'NR==1{print $2}')"
  if [[ -n "$apt_ver" ]] && dpkg --compare-versions "$apt_ver" ge "1.1" 2>/dev/null; then
    apt_opts+=(--allow-downgrades)
  fi

  repair_dpkg_state
  wait_for_apt_lock
  if ! apt-get install -y --reinstall "${apt_opts[@]}" -- "$deb"; then
    say "First attempt failed - refreshing the package lists and retrying" \
      "تلاش اول ناموفق بود؛ فهرست بسته‌ها تازه‌سازی و دوباره تلاش می‌شود"
    wait_for_apt_lock
    apt-get update || true
    repair_dpkg_state
    wait_for_apt_lock
    apt-get install -y --reinstall "${apt_opts[@]}" -- "$deb" || \
      die "Installation failed - see the apt output above" \
        "نصب شکست خورد — پیام‌های apt در بالا را ببینید (اینترنت و مخازن را بررسی کنید)"
  fi
  return 0
}

# deb_listing_paths: print the on-disk paths contained in the .deb payload.
deb_listing_paths() {
  [[ -n "$DEB_CONTENTS" && -s "$DEB_CONTENTS" ]] || return 0
  sed -E -e 's/^[^ ]+ [^ ]+ +[0-9]+ +[0-9]{4}-[0-9]{2}-[0-9]{2} +[0-9]{2}:[0-9]{2} +//' \
         -e 's/ -> .*$//' "$DEB_CONTENTS" 2>/dev/null || true
  return 0
}

# verify_install_completeness: prove the install is COMPLETE, not merely
# recorded by dpkg - the service is enabled and every file the .deb itself
# lists is on disk (ground truth taken from the deb, not from a hardcoded list
# that may not match another build).
verify_install_completeness() {
  if is_dry_run; then dry "would verify the installation"; return 0; fi
  say "Verifying that the install is complete" "بررسی کامل بودن نصب…"

  if systemd_present; then
    systemctl enable --now "$SVC_UNIT" >/dev/null 2>&1 || true
  fi

  local total=0 missing=0 checked=0 p
  local -a absent=()
  if [[ -n "$DEB_CONTENTS" && -s "$DEB_CONTENTS" ]]; then
    while IFS= read -r p; do
      if [[ -z "$p" || "$p" == "./" || "$p" == "." || "$p" == "/" ]]; then continue; fi
      p="${p#.}"
      if [[ "$p" != /* ]]; then continue; fi
      total=$((total + 1))
      if [[ -e "$p" || -L "$p" ]]; then
        checked=$((checked + 1))
      else
        missing=$((missing + 1))
        if (( ${#absent[@]} < 5 )); then absent+=("$p"); fi
      fi
    done < <(deb_listing_paths)
    if (( ${#absent[@]} > 0 )); then
      for p in "${absent[@]}"; do warn "missing after install: $p"; done
      if (( missing > ${#absent[@]} )); then warn "…and $((missing - ${#absent[@]})) more"; fi
    fi
  fi

  for p in "${ESSENTIAL_ARTEFACTS[@]}"; do
    total=$((total + 1))
    if [[ -e "$p" ]]; then checked=$((checked + 1)); else
      missing=$((missing + 1)); warn "missing essential file: $p"
    fi
  done

  total=$((total + 1))
  if [[ -e "$LAUNCHER_SYMLINK" || -L "$LAUNCHER_SYMLINK" ]]; then
    checked=$((checked + 1)); note "launcher present: $LAUNCHER_SYMLINK"
  else
    missing=$((missing + 1)); warn "missing launcher: $LAUNCHER_SYMLINK"
  fi

  total=$((total + 1))
  local -a icons=()
  collect_glob icons "${ICON_THEME_ROOTS[0]}"/*/*/apps/"$LAUNCHER_ICON_NAME" \
                     "${ICON_THEME_ROOTS[0]}"/*/apps/"$LAUNCHER_ICON_NAME"
  if (( ${#icons[@]} > 0 )); then
    checked=$((checked + 1)); note "menu icon present: ${icons[0]}"
  else
    missing=$((missing + 1)); warn "no launcher icon in the icon themes ($LAUNCHER_ICON_NAME)"
  fi

  refresh_desktop_caches

  local svc_state="n/a"
  if systemd_present; then
    svc_state="$(systemctl is-active "$SVC_UNIT" 2>/dev/null || true)"
    if [[ -z "$svc_state" ]]; then svc_state="inactive"; fi
    if [[ "$svc_state" != "active" ]]; then
      warn "service $SVC_UNIT is '$svc_state' (the app starts it on first launch)"
    fi
  fi
  if (( missing == 0 )); then
    ok "Install verified: $checked/$total items from the .deb are on disk, service=$svc_state"
  else
    warn "Install incomplete: $missing of $total artefacts missing (the .deb may be damaged)"
  fi
  return 0
}

# verify_removed: the closing proof of RULE 1.
verify_removed() {
  say "Verifying that Windscribe is really gone" "بررسی اینکه برنامه کاملاً حذف شده است…"
  local leftover=0 p
  local -a hits=()

  if pkg_known "$PKG_GUI" || pkg_known "$PKG_CLI"; then
    warn "dpkg still knows about the package (state: $(pkg_state "$PKG_GUI"))"
    leftover=$((leftover + 1))
  else
    ok "package records removed ($PKG_GUI, $PKG_CLI)"
  fi

  for p in /usr/share/applications/windscribe.desktop \
           /usr/share/applications/Windscribe.desktop \
           /etc/xdg/autostart/windscribe.desktop; do
    if [[ -e "$p" ]]; then warn "launcher still present: $p"; leftover=$((leftover + 1)); fi
  done
  collect_glob hits "${ICON_THEME_ROOTS[0]}"/*/*/apps/Windscribe* \
                    "${ICON_THEME_ROOTS[0]}"/*/apps/Windscribe*
  if (( ${#hits[@]} > 0 )); then
    warn "menu icon still present: ${hits[0]}"; leftover=$((leftover + 1))
  fi
  if (( leftover == 0 )); then
    ok "no system launcher, no autostart entry, no menu icon left"
  fi

  if [[ -d /opt/windscribe || -d /etc/windscribe ]]; then
    warn "application directories still present"
  else
    ok "application directories removed (/opt/windscribe, /etc/windscribe)"
  fi

  if [[ "$KEEP_USER_DATA" == "true" ]]; then
    note "user data kept on request (--keep-user-data) - the app still remembers you"
  elif (( WIPE_COUNT > 0 )); then
    ok "user data wiped: $WIPE_COUNT location(s), $WIPE_USERS account(s) - login required again"
  else
    ok "no per-user Windscribe data left"
  fi
  return 0
}

# =============================================================================
# 11. FLOWS
# =============================================================================
install_and_verify() {
  install_candidate "$CANDIDATE_PATH"
  if ! NEW_VER="$(verify_installed)"; then
    die "Post-install verification failed - dpkg does not report $PKG_GUI as installed" \
      "تایید نصب ناموفق بود — با «dpkg -l windscribe» بررسی کنید"
  fi
  if [[ -n "$CANDIDATE_VER" && "$NEW_VER" != "$CANDIDATE_VER" ]]; then
    warn "installed version ($NEW_VER) differs from the .deb ($CANDIDATE_VER)"
  fi
  verify_install_completeness
  check_deb_untouched
  final_report_install
  return 0
}

flow_update() {
  OLD_VER="$INSTALLED_VER"
  say "PHASE 1/2: complete removal" "مرحلهٔ ۱ از ۲: حذف کامل برنامه"
  remove_phase
  say "PHASE 2/2: fresh install" "مرحلهٔ ۲ از ۲: نصب تازه"
  install_and_verify
  return 0
}

flow_install_fresh() {
  say "Windscribe is not installed - clean install from the download" \
    "برنامه نصب نیست؛ نصب تازه و تمیز از فایل دانلودشده"
  OLD_VER=""
  say "PHASE 1/2: clean the ground" "مرحلهٔ ۱ از ۲: پاک‌سازی زمینه"
  remove_phase
  say "PHASE 2/2: fresh install" "مرحلهٔ ۲ از ۲: نصب تازه"
  install_and_verify
  return 0
}

flow_remove() {
  say "Full removal mode" "حالت حذف کامل"
  remove_phase
  run_autoremove
  verify_removed
  check_deb_untouched
  final_report_removal
  return 0
}

flow_list() {
  print_candidate_table
  ok "Read-only listing - nothing was changed"
  return 0
}

flow_dry_run() {
  say "PHASE 1/2: complete removal (dry run)" "مرحلهٔ ۱ از ۲: حذف کامل (آزمایشی)"
  remove_phase
  say "PHASE 2/2: fresh install (dry run)" "مرحلهٔ ۲ از ۲: نصب تازه (آزمایشی)"
  install_candidate "$CANDIDATE_PATH"
  run_autoremove
  printf '\n'
  ok "Dry run finished - nothing was removed, installed or modified"
  check_deb_untouched
  say "Re-run without --dry-run to apply." \
    "برای اجرای واقعی، اسکریپت را بدون --dry-run اجرا کنید."
  return 0
}

run_cycle() {
  if is_dry_run; then
    flow_dry_run
  elif [[ -z "$INSTALLED_VER" ]]; then
    flow_install_fresh
  else
    flow_update
  fi
  return 0
}

# confirm_force: ask before forcing the cycle. EOF / no tty means NO, which
# keeps the safe default safe even under cron or inside a pipe.
confirm_force() {
  if [[ "$ASSUME_YES" == "true" ]]; then return 0; fi
  local answer=""
  if [[ -r /dev/tty ]]; then
    printf '%s' "Force remove + reinstall anyway? [y/N] " >/dev/tty
    read -r answer </dev/tty || answer=""
  else
    printf '%s' "Force remove + reinstall anyway? [y/N] "
    read -r answer || answer=""
  fi
  answer="$(lower "$answer")"
  if [[ "$answer" == "y" || "$answer" == "yes" ]]; then return 0; fi
  return 1
}

decide_flow() {
  if [[ -n "$INSTALLED_VER" ]] && ver_gt "$CANDIDATE_VER" "$INSTALLED_VER"; then
    say "Update found: $INSTALLED_VER -> $CANDIDATE_VER (full remove + fresh install)" \
      "نسخهٔ جدید پیدا شد: از $INSTALLED_VER به $CANDIDATE_VER — چرخهٔ حذف و نصب آغاز می‌شود"
    run_cycle
    return 0
  fi
  if [[ -z "$INSTALLED_VER" ]]; then
    run_cycle
    return 0
  fi
  if ver_eq "$CANDIDATE_VER" "$INSTALLED_VER"; then
    say "Same version as the one installed ($INSTALLED_VER)" \
      "فایل دانلودشده همان نسخهٔ نصب‌شده است ($INSTALLED_VER)"
  else
    say "The download is OLDER than the installed build (installed: $INSTALLED_VER | file: $CANDIDATE_VER)" \
      "فایل دانلودشده قدیمی‌تر از نسخهٔ نصب‌شده است"
  fi
  if is_dry_run; then
    flow_dry_run
  elif [[ "$ASSUME_YES" == "true" ]] || confirm_force; then
    say "Forced remove + reinstall" "نصب مجدد اجباری انجام می‌شود"
    flow_update
  else
    say "No changes were made." "هیچ تغییری انجام نشد."
    note "To force the full remove + reinstall cycle: sudo $SELF --yes"
    note "برای حذف و نصب مجدد اجباری: sudo $SELF --yes"
  fi
  return 0
}

# =============================================================================
# 12. REPORTS
# =============================================================================
final_report_install() {
  local svc_state="n/a"
  if systemd_present; then
    svc_state="$(systemctl is-active "$SVC_UNIT" 2>/dev/null || true)"
    if [[ -z "$svc_state" ]]; then svc_state="unknown"; fi
  fi
  printf '\n'
  printf '%s\n' "${C_HDR}----------------------------- SUMMARY -----------------------------${C_OFF}"
  ok "Windscribe $NEW_VER is installed"
  note "previous version : ${OLD_VER:-none}"
  note "installed from   : $CANDIDATE_PATH"
  note "service state    : $SVC_UNIT = $svc_state"
  if [[ "$KEEP_USER_DATA" == "true" ]]; then
    note "user data        : kept (--keep-user-data)"
  else
    note "user data wiped  : $WIPE_COUNT location(s), $WIPE_USERS account(s) - login required again"
    note "keyring secrets  : $KEYRING_COUNT removed (libsecret)"
  fi
  if [[ -n "$BACKUP_FILE" ]]; then note "backup of it     : $BACKUP_FILE"; fi
  note "leftovers swept  : $REMOVED_LEFTOVERS system path(s)/file(s)"
  printf '%s\n' "${C_HDR}---------------------------------------------------------------------${C_OFF}"
  say "Done. Launch Windscribe from your app menu and log in again." \
    "تمام شد. برنامه را از منوی اپلیکیشن‌ها باز کنید و دوباره وارد شوید (لاگین قبلی پاک شده است)."
  return 0
}

final_report_removal() {
  printf '\n'
  printf '%s\n' "${C_HDR}----------------------------- SUMMARY -----------------------------${C_OFF}"
  if pkg_known "$PKG_GUI" || pkg_known "$PKG_CLI"; then
    warn "Package records still present - check: dpkg -l | grep -E '^ii.*windscribe'"
  else
    ok "Windscribe packages fully removed"
  fi
  if [[ "$KEEP_USER_DATA" == "true" ]]; then
    note "user data        : kept (--keep-user-data)"
  else
    note "user data wiped  : $WIPE_COUNT location(s), $WIPE_USERS account(s)"
    note "keyring secrets  : $KEYRING_COUNT removed (libsecret)"
  fi
  if [[ -n "$BACKUP_FILE" ]]; then note "backup of it     : $BACKUP_FILE"; fi
  note "leftovers swept  : $REMOVED_LEFTOVERS system path(s)/file(s)"
  note "menu caches      : rebuilt (the launcher is gone from the menu)"
  printf '%s\n' "${C_HDR}---------------------------------------------------------------------${C_OFF}"
  say "Removal complete." "حذف کامل انجام شد."
  note "The .deb in Downloads was not touched - re-run without --remove to install it."
  return 0
}

# =============================================================================
# 13. COMMAND LINE
# =============================================================================
version() {
  printf '%s %s\n' "$PROG_NAME" "$PROG_VERSION"
  printf '    complete removal + fresh install of Windscribe (Ubuntu/Debian)\n'
  printf '    forgets the user, keeps the download, picks the newest .deb\n'
  return 0
}

usage() {
  cat <<'EOF'
windscribe-manager.sh -- full remove & fresh install of Windscribe (Ubuntu/Debian)
حذف کامل و نصب تازهٔ ویندسکرایب از فایل deb داخل پوشهٔ دانلودها

Usage / روش اجرا:
  sudo ./windscribe-manager.sh
      Auto (safe default): scan Downloads; act only when the .deb there is
      NEWER than the installed build -> complete removal + fresh install.
      حالت خودکار: فقط اگر فایل دانلودشده جدیدتر باشد، حذف کامل و نصب تازه انجام می‌شود.
  sudo ./windscribe-manager.sh --yes     (aliases: --reinstall, --force, -y)
      ALWAYS run the cycle: full removal (the app forgets you; the launcher and
      the dash icon disappear) + fresh install from the .deb, which is kept.
      همیشه حذف کامل + نصب تازه از همان فایل دانلودشده (فایل حفظ می‌شود).
  sudo ./windscribe-manager.sh --if-newer
      Explicit form of the default mode. / شکل صریح حالت پیش‌فرض.
  sudo ./windscribe-manager.sh --remove
      Clean removal only: purge + leftovers + user data + autoremove.
      حذف کامل بدون نصب؛ فایل deb هرگز دست‌نخورده می‌ماند.
  ./windscribe-manager.sh --list         (no root needed)
      Read-only: list every .deb found, its version, and which one wins.
      فقط نمایش: فهرست فایل‌های deb، نسخهٔ هرکدام و اینکه کدام انتخاب می‌شود.
  sudo ./windscribe-manager.sh --dry-run
      Show every step without changing anything (combine with --yes/--remove).
      نمایش همهٔ مراحل بدون هیچ تغییری روی سیستم.
  sudo ./windscribe-manager.sh --dir PATH
      Scan PATH instead of the Downloads folder. / اسکن مسیر دلخواه.
  sudo ./windscribe-manager.sh --max-depth N
      How deep to look for .deb files (default 3; 1 = top level only).
      عمق جست‌وجوی فایل‌ها (پیش‌فرض ۳؛ عدد ۱ یعنی فقط همان پوشه).
  sudo ./windscribe-manager.sh --user NAME
      Which desktop user must forget the app (default: auto-detected).
      کدام کاربر دسکتاپ باید فراموش شود (پیش‌فرض: تشخیص خودکار).
  sudo ./windscribe-manager.sh --keep-user-data
      Remove/reinstall the app but keep login + settings.
      برنامه حذف/نصب شود ولی لاگین و تنظیمات باقی بماند.
  sudo ./windscribe-manager.sh --keep-keyring
      Do not delete the Windscribe entries from the desktop keyring (libsecret).
      ورودی‌های ویندسکرایب از keyring حذف نشوند.
  sudo ./windscribe-manager.sh --no-backup
      Do not tar the removed user data into /var/backups/windscribe-manager.
      از داده‌های کاربری پشتیبان گرفته نشود.
  sudo ./windscribe-manager.sh --jobs N
      Parallel .deb probing workers (default: auto, max 4, only used when many
      files are found). / تعداد پردازش موازی برای بررسی فایل‌ها.
  sudo ./windscribe-manager.sh --no-autoremove
      Skip the dependency cleanup (only relevant with --remove).
      رد کردن پاک‌سازی خودکار وابستگی‌ها.
  ./windscribe-manager.sh --version | --help
      Version / this help. / نمایش نسخه یا همین راهنما.

  --  End of options: anything after it is an argument, never an option.

Guarantees / تضمین‌ها:
  * The .deb is NEVER deleted, moved or modified. Its sha256+size+mtime+inode
    are verified again at the end, and apt's archive cache is redirected to a
    temp dir so nothing is written next to your download.
    فایل deb هرگز حذف/جابه‌جا/تغییر نمی‌کند و در پایان با sha256 بررسی می‌شود.
  * A damaged or truncated download aborts BEFORE anything is removed, so a
    failed cycle can never leave you without Windscribe.
    اگر فایل ناقص باشد، پیش از هر حذفی اجرا متوقف می‌شود (برنامه حذف نمی‌شود).
  * Detection uses deb metadata, not filenames: renamed files, "(1)" copies and
    files in sub-folders are all handled; the highest dpkg version wins.
    تشخیص فقط از درون فایل است؛ نام فایل و پوشهٔ فرعی مهم نیست.
  * Only the exact packages windscribe / windscribe-cli are touched, and only
    paths that are provably Windscribe's (name-prefix match, or substring match
    confirmed by the file content). Every delete passes a safety guard that
    refuses the Downloads folder, "/" and bare top-level directories.
    فقط بسته‌های دقیق و مسیرهای قطعاً مربوط به ویندسکرایب حذف می‌شوند.
  * The app forgets every user account, the dash/dock pin is removed and all
    menu caches are rebuilt, so the launcher really disappears.
    برنامه همهٔ کاربران را فراموش می‌کند و آیکن از منو واقعاً حذف می‌شود.
  * --dry-run changes nothing; every mutating step waits for the apt lock.
EOF
  return 0
}

need_value() {  # need_value <option> <value>
  if [[ -z "${2:-}" ]]; then
    die "$1 needs an argument" "گزینهٔ $1 نیاز به مقدار دارد"
  fi
  if [[ "${2:-}" == -* && "$2" != "--" ]]; then
    die "$1 needs a value, not an option: $2" "مقدار $1 باید معتبر باشد نه گزینه: $2"
  fi
  return 0
}

parse_args() {
  local end_of_options=0 arg val
  while (( $# > 0 )); do
    if (( end_of_options == 1 )); then
      die "Unexpected argument: $1 (see --help)" "آرگومان ناشناخته: $1 (راهنما: --help)"
    fi
    arg="$1"
    case "$arg" in
      --)                           end_of_options=1 ;;
      --remove)                     MODE="remove" ;;
      --list|-l)                    MODE="list" ;;
      --yes|-y|--reinstall|--force) ASSUME_YES="true" ;;
      --if-newer)                   ASSUME_YES="false" ;;
      --dry-run|-n)                 DRY_RUN="true" ;;
      --no-autoremove)              NO_AUTOREMOVE="true" ;;
      --keep-user-data)             KEEP_USER_DATA="true" ;;
      --keep-keyring)               KEEP_KEYRING="true" ;;
      --no-backup)                  MAKE_BACKUP="false" ;;
      --version|-V)                 version; exit 0 ;;
      --help|-h)                    usage; exit 0 ;;
      --dir|--dir=*)
        if [[ "$arg" == --dir=* ]]; then val="${arg#--dir=}"
        else need_value "--dir" "${2:-}"; val="$2"; shift; fi
        if [[ -z "$val" ]]; then die "--dir needs a non-empty path" "مسیر --dir نباید خالی باشد"; fi
        OPT_DIR="$val"; OPT_DIR_SET="true" ;;
      --max-depth|--max-depth=*)
        if [[ "$arg" == --max-depth=* ]]; then val="${arg#--max-depth=}"
        else need_value "--max-depth" "${2:-}"; val="$2"; shift; fi
        if ! [[ "$val" =~ ^[0-9]+$ ]]; then
          die "--max-depth needs a number: $val" "مقدار --max-depth باید عدد باشد"; fi
        if (( val < 1 || val > 8 )); then
          die "--max-depth must be between 1 and 8" "--max-depth باید بین ۱ و ۸ باشد"; fi
        MAX_DEPTH="$val" ;;
      --user|--user=*)
        if [[ "$arg" == --user=* ]]; then val="${arg#--user=}"
        else need_value "--user" "${2:-}"; val="$2"; shift; fi
        FORCE_USER="$val" ;;
      --jobs|--jobs=*)
        if [[ "$arg" == --jobs=* ]]; then val="${arg#--jobs=}"
        else need_value "--jobs" "${2:-}"; val="$2"; shift; fi
        if ! [[ "$val" =~ ^[0-9]+$ ]]; then
          die "--jobs needs a number" "مقدار --jobs باید عدد باشد"; fi
        JOBS="$val" ;;
      -*)          die "Unknown option: $arg (see --help)" "گزینهٔ ناشناخته: $arg (راهنما: --help)" ;;
      *)           die "Unexpected argument: $arg (see --help)" "آرگومان ناشناخته: $arg (راهنما: --help)" ;;
    esac
    shift
  done
  return 0
}

# =============================================================================
# 14. PREFLIGHT & ENTRY POINTS
# =============================================================================
require_root() {
  if [[ "$EUID" -eq 0 ]]; then return 0; fi
  if ! have sudo; then
    die "This script must run as root. Try: sudo $0" \
      "این اسکریپت باید با دسترسی روت اجرا شود: sudo $0"
  fi
  say "Root privileges needed - restarting with sudo" \
    "نیاز به دسترسی روت؛ اجرای مجدد با sudo…"
  exec sudo -- "$SELF" "$@"
}

setup_runtime() {
  if (( BASH_VERSINFO[0] < MIN_BASH_MAJOR )) || \
     { (( BASH_VERSINFO[0] == MIN_BASH_MAJOR )) && (( BASH_VERSINFO[1] < MIN_BASH_MINOR )); }; then
    die "bash >= ${MIN_BASH_MAJOR}.${MIN_BASH_MINOR} is required (running $BASH_VERSION)" \
      "به bash نسخهٔ ${MIN_BASH_MAJOR}.${MIN_BASH_MINOR} یا جدیدتر نیاز است"
  fi
  TMPDIR_RUN="$(mktemp -d -t wsmgr.XXXXXX 2>/dev/null || true)"
  if [[ -z "$TMPDIR_RUN" || ! -d "$TMPDIR_RUN" ]]; then
    TMPDIR_RUN="/tmp/wsmgr.$$"
    mkdir -p -- "$TMPDIR_RUN" || die "cannot create a temporary directory" \
      "ایجاد پوشهٔ موقت ممکن نشد"
  fi
  APT_ARCHIVE_DIR="$TMPDIR_RUN/apt-archives"
  mkdir -p -- "$APT_ARCHIVE_DIR" 2>/dev/null || true
  return 0
}

preflight() {
  local tool missing=0 os_name=""
  local -a opt_missing=()
  for tool in "${REQUIRED_TOOLS[@]}"; do
    if ! have "$tool"; then warn "required command not found: $tool"; missing=$((missing + 1)); fi
  done
  if (( missing > 0 )); then
    die "Missing required commands - cannot continue" "فرمان‌های لازم پیدا نشد؛ ادامه ممکن نیست"
  fi
  for tool in "${OPTIONAL_TOOLS[@]}"; do
    if ! have "$tool"; then opt_missing+=("$tool"); fi
  done
  if (( ${#opt_missing[@]} > 0 )); then
    note "optional tools not found (features degrade gracefully): ${opt_missing[*]}"
  fi

  SYS_ARCH="$(dpkg --print-architecture 2>/dev/null || true)"
  if [[ -z "$SYS_ARCH" ]]; then
    die "cannot determine the dpkg architecture" "معماری dpkg تشخیص داده نشد"
  fi
  FOREIGN_ARCH="$(dpkg --print-foreign-architectures 2>/dev/null | tr '\n' ',' | sed 's/,$//' || true)"

  detect_real_user
  if [[ -n "$FORCE_USER" ]] && ! id -u "$FORCE_USER" >/dev/null 2>&1; then
    die "--user: no such account: $FORCE_USER" "کاربر $FORCE_USER وجود ندارد"
  fi

  # removal does not need the folder, but the guard still protects it
  if [[ "$OPT_DIR_SET" == "true" ]]; then
    DOWNLOADS_DIR="$OPT_DIR"
    if [[ ! -e "$DOWNLOADS_DIR" ]]; then
      if [[ "$MODE" == "remove" ]]; then
        warn "Scan folder does not exist: $DOWNLOADS_DIR (removal does not need it)" \
          "پوشهٔ اسکن وجود ندارد؛ برای حذف نیازی به آن نیست"
        DOWNLOADS_DIR=""
      else
        die "Scan folder not found: $DOWNLOADS_DIR" "پوشهٔ اسکن پیدا نشد: $DOWNLOADS_DIR"
      fi
    elif [[ ! -d "$DOWNLOADS_DIR" ]]; then
      die "Not a directory: $DOWNLOADS_DIR" "این مسیر پوشه نیست: $DOWNLOADS_DIR"
    fi
  else
    DOWNLOADS_DIR="$(detect_downloads_dir)"
    if [[ ! -d "$DOWNLOADS_DIR" ]]; then
      if [[ "$MODE" == "remove" ]]; then
        warn "Downloads folder not found: $DOWNLOADS_DIR (removal does not need it)" \
          "پوشهٔ دانلودها پیدا نشد (برای حذف لازم نیست)"
        DOWNLOADS_DIR=""
      else
        die "Downloads folder not found: $DOWNLOADS_DIR (use --dir PATH)" \
          "پوشهٔ دانلودها پیدا نشد: $DOWNLOADS_DIR (می‌توانید --dir PATH بدهید)"
      fi
    fi
  fi
  # apt-get needs an ABSOLUTE path: a bare "dir/file.deb" would be parsed as a
  # package NAME, so the folder is canonicalised before anything uses it
  if [[ -n "$DOWNLOADS_DIR" && -d "$DOWNLOADS_DIR" ]]; then
    DOWNLOADS_DIR="$(readlink -f -- "$DOWNLOADS_DIR")"
  fi

  if [[ -r /etc/os-release ]]; then
    # shellcheck source=/dev/null disable=SC1091
    os_name="$( . /etc/os-release 2>/dev/null; printf '%s' "${PRETTY_NAME:-Linux}" )"
  fi
  if [[ -z "$os_name" ]]; then os_name="Linux"; fi
  say "System: $os_name ($SYS_ARCH${FOREIGN_ARCH:+, foreign: $FOREIGN_ARCH})" "سیستم شناسایی شد"
  note "desktop user : $REAL_USER ($REAL_HOME)"
  note "scan folder  : ${DOWNLOADS_DIR:-<not needed in this mode>} (max depth $MAX_DEPTH)"
  if ! systemd_present; then note "systemd not available - service steps are skipped"; fi
  return 0
}

check_disk_space() {
  if ! have df; then return 0; fi
  local avail_kb avail_mb
  avail_kb="$( { df -Pk / 2>/dev/null || true; } | awk 'NR==2{print $4}')"
  if ! [[ "$avail_kb" =~ ^[0-9]+$ ]]; then return 0; fi
  avail_mb=$((avail_kb / 1024))
  if (( avail_mb < MIN_FREE_MB )); then
    warn "Only ${avail_mb} MB free on / - the install may fail for lack of space" \
      "فضای آزاد کمتر از ${MIN_FREE_MB} مگابایت است؛ نصب ممکن است ناموفق باشد"
  fi
  return 0
}

banner() {
  printf '%s\n' "${C_HDR}------------------------------------------------------------${C_OFF}"
  printf '%s\n' " Windscribe Manager v$PROG_VERSION - full remove & fresh install"
  printf '%s\n' " مدیریت کامل حذف و نصب ویندسکرایب"
  printf '%s\n' "${C_HDR}------------------------------------------------------------${C_OFF}"
  return 0
}

main() {
  parse_args "$@"
  if [[ "$MODE" != "list" ]]; then require_root "$@"; fi
  setup_runtime
  export DEBIAN_FRONTEND=noninteractive
  export APT_LISTBUGS_FRONTEND=none APT_LISTCHANGES_FRONTEND=none
  banner
  preflight
  check_disk_space

  if [[ -n "$DOWNLOADS_DIR" && "$MODE" != "remove" ]]; then
    scan_downloads "$DOWNLOADS_DIR"
    print_scan_summary
  fi

  case "$MODE" in
    list)
      if (( TOTAL_DEB == 0 )); then warn "No .deb files found in: ${DOWNLOADS_DIR:-<none>}"; fi
      flow_list
      exit 0 ;;
    remove)
      record_deb_identity
      flow_remove
      exit 0 ;;
  esac

  if INSTALLED_VER="$(get_installed_version)"; then :; else INSTALLED_VER=""; fi

  if pkg_installed "$PKG_CLI"; then
    warn "windscribe-cli is installed - it officially conflicts with the GUI app" \
      "نسخهٔ ترمینالی (windscribe-cli) نصب است و با نسخهٔ گرافیکی تضاد دارد؛ در این چرخه حذف می‌شود"
  elif pkg_known "$PKG_CLI"; then
    note "windscribe-cli has leftover dpkg records - they will be purged"
  fi

  if [[ -z "$CANDIDATE_PATH" ]]; then
    if [[ -n "$INSTALLED_VER" ]]; then
      say "Nothing to do - the installed version ($INSTALLED_VER) stays." \
        "کاری برای انجام نیست؛ نسخهٔ نصب‌شده ($INSTALLED_VER) باقی می‌ماند."
      note "No usable .deb in: ${DOWNLOADS_DIR:-<none>} (try --list or --dir PATH)"
    else
      say "Windscribe is not installed and no genuine .deb was found in:" \
        "برنامه نصب نیست و فایل deb معتبری پیدا نشد:"
      note "${DOWNLOADS_DIR:-<none>}"
      note "Download the .deb from windscribe.com, then re-run (or use --dir PATH)."
      note "فایل deb را از windscribe.com دانلود کنید و دوباره اجرا کنید."
    fi
    exit 0
  fi

  # integrity FIRST: a damaged download must never trigger a destructive cycle
  say "Checking the download before touching the system" \
    "بررسی سلامت فایل پیش از هر تغییری روی سیستم"
  if dry_would "validate the .deb (control member + full data archive)"; then
    note "file: $CANDIDATE_PATH"
  else
    if ! validate_deb "$CANDIDATE_PATH" 1; then
      die "Refusing to continue: the selected .deb is not usable" \
        "ادامه ممکن نیست: فایل deb انتخاب‌شده سالم نیست (سیستم دست‌نخورده باقی ماند)"
    fi
    ok "Download verified: control member + full data archive are intact"
    if [[ -n "$DEB_CONTENTS" && -s "$DEB_CONTENTS" ]]; then
      note "payload: $(wc -l <"$DEB_CONTENTS" 2>/dev/null || printf '?') files/dirs listed in the .deb"
    fi
  fi

  record_deb_identity
  decide_flow
  exit 0
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
