#!/usr/bin/env bash
# =============================================================================
#  run-tests.sh - test harness for windscribe-manager.sh
#
#  Safe mode (default):  read-only checks, no package operations, no root.
#      ./tests/run-tests.sh
#  Destructive mode:     really installs/purges a SYNTHETIC "windscribe" package
#      sudo ./tests/run-tests.sh --destructive     <-- THROW-AWAY MACHINE / VM ONLY
#
#  The fixtures are synthetic .deb files built by tests/mkdeb.sh. They are named
#  "windscribe" so the script under test treats them as the real thing, but they
#  contain only shell stubs.
# =============================================================================
set -uo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SUT="$HERE/../windscribe-manager.sh"
WORK="${WORK:-/tmp/wsm-tests}"
DESTRUCTIVE="false"
[[ "${1:-}" == "--destructive" ]] && DESTRUCTIVE="true"

PASS=0; FAIL=0
ok()   { printf '  \033[32mPASS\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }
head_() { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }
check() { if [[ "$2" == "$3" ]]; then ok "$1 ($2)"; else bad "$1 (got '$2', want '$3')"; fi; }
contains() { if grep -qF -- "$2" <<<"$1"; then ok "$3"; else bad "$3"; fi; }
missing()  { if grep -qF -- "$2" <<<"$1"; then bad "$3"; else ok "$3"; fi; }

# ---------------------------------------------------------------- fixtures --
build_fixtures() {
  rm -rf "$WORK"; mkdir -p "$WORK/dl/old" "$WORK/dl/.Trash-1000/files" "$WORK/corrupt" "$WORK/empty"
  local m="$HERE/mkdeb.sh"
  "$m" windscribe      2.10.14 amd64 "$WORK/dl/windscribe_2.10.14_amd64.deb"     >/dev/null
  "$m" windscribe      2.12.1  amd64 "$WORK/dl/windscribe_2.12.1_amd64 (1).deb"  >/dev/null
  "$m" windscribe      2.11.9  amd64 "$WORK/dl/old/renamed-anything.deb"         >/dev/null
  "$m" windscribe      2.99.0  i386  "$WORK/dl/windscribe_2.99.0_i386.deb"       >/dev/null
  "$m" windscribe-cli  2.12.1  amd64 "$WORK/dl/windscribe-cli_2.12.1_amd64.deb"  >/dev/null
  "$m" google-chrome-stable 130.0 amd64 "$WORK/dl/google-chrome-stable.deb"      >/dev/null
  "$m" windscribe      9.9.9   amd64 "$WORK/dl/.Trash-1000/files/deleted.deb"    >/dev/null
  echo "not a deb" > "$WORK/dl/fake.deb"
  # structurally valid control, destroyed data member (incomplete download)
  local big="$WORK/_big"
  mkdir -p "$big/DEBIAN" "$big/opt/windscribe"
  printf 'Package: windscribe\nVersion: 2.13.0\nArchitecture: amd64\nMaintainer: t <t@t>\nDescription: big\n' > "$big/DEBIAN/control"
  head -c 3000000 /dev/urandom > "$big/opt/windscribe/blob.bin"
  dpkg-deb --build --root-owner-group -Zgzip "$big" "$WORK/_big.deb" >/dev/null
  head -c 2000 "$WORK/_big.deb" > "$WORK/corrupt/windscribe_2.13.0_amd64.deb"
  # valid deb whose dependency can never be satisfied
  local dep="$WORK/_dep"; mkdir -p "$dep/DEBIAN" "$dep/opt/windscribe" "$WORK/depdl"
  printf 'Package: windscribe\nVersion: 2.14.0\nArchitecture: amd64\nMaintainer: t <t@t>\nDepends: libwindscribe-does-not-exist (>= 9.9)\nDescription: unmet deps\n' > "$dep/DEBIAN/control"
  printf '#!/bin/sh\ntrue\n' > "$dep/opt/windscribe/Windscribe"; chmod 755 "$dep/opt/windscribe/Windscribe"
  dpkg-deb --build --root-owner-group -Zgzip "$dep" "$WORK/depdl/windscribe_2.14.0_amd64.deb" >/dev/null
}

# ------------------------------------------------------------- safe checks --
head_ "static analysis"
bash -n "$SUT" && ok "bash -n (syntax)" || bad "bash -n (syntax)"
if command -v shellcheck >/dev/null; then
  out="$(shellcheck -s bash -S style "$SUT" 2>&1)"
  [[ -z "$out" ]] && ok "shellcheck (default+style: clean)" || bad "shellcheck: $(head -3 <<<"$out")"
else
  echo "  SKIP shellcheck (not installed)"
fi

head_ "cli / exit codes"
"$SUT" --version >/dev/null 2>&1;            check "--version"        "$?" "0"
"$SUT" --help    >/dev/null 2>&1;            check "--help"           "$?" "0"
"$SUT" --bogus   >/dev/null 2>&1;            check "unknown option"   "$?" "1"
"$SUT" --dir     >/dev/null 2>&1;            check "--dir w/o value"  "$?" "1"
"$SUT" --max-depth 0 >/dev/null 2>&1;        check "--max-depth 0"    "$?" "1"
"$SUT" --max-depth abc >/dev/null 2>&1;      check "--max-depth abc"  "$?" "1"
"$SUT" --jobs x  >/dev/null 2>&1;            check "--jobs x"         "$?" "1"
"$SUT" --dir=/definitely/not/here >/dev/null 2>&1; check "--dir missing" "$?" "1"

head_ "discovery / selection (read-only, --list)"
build_fixtures
L="$("$SUT" --list --dir "$WORK/dl" 2>&1)"
contains "$L" "2.12.1"                              "picks a version from deb metadata, not the name"
contains "$L" "skipped: windscribe-cli build"       "windscribe-cli is skipped"
contains "$L" "skipped: different package"          "other apps are skipped"
contains "$L" "skipped: foreign architecture"       "i386 build is skipped"
contains "$L" "skipped: not a valid .deb"           "non-deb file is skipped"
contains "$L" "old/renamed-anything.deb"            "renamed deb in a sub-folder is found"
# KNOWN BUG: a .deb inside the trash wins the election
if grep -q '^  > .*Trash' <<<"$L"; then
  bad "BUG: a .deb inside .Trash-1000 is selected for installation"
else
  ok "trash / hidden dirs are excluded"
fi
L1="$("$SUT" --list --dir "$WORK/dl" --max-depth 1 2>&1)"
missing "$L1" "renamed-anything.deb"                "--max-depth 1 stays at the top level"

head_ "safety guard (unit test of guard_path)"
guard_out="$(
  # shellcheck disable=SC1090
  source "$SUT"
  DOWNLOADS_DIR="$WORK/dl"; CANDIDATE_PATH="$WORK/dl/x.deb"; TMPDIR_RUN=/tmp/wsmgr.t
  HOME_PREFIXES=(/home/user /root)
  t(){ if guard_path "$1"; then r=ALLOW; else r=REFUSE; fi; [[ "$r" == "$2" ]] || printf 'MISMATCH %s want=%s got=%s\n' "$1" "$2" "$r"; }
  t "/" REFUSE;                    t "/usr" REFUSE
  t "/usr/share" REFUSE;           t "/usr/share/applications" REFUSE
  t "/opt" REFUSE;                 t "/opt/windscribe" ALLOW
  t "/home/user" REFUSE;           t "/home/user/.config/Windscribe" ALLOW
  t "/home/user/Documents/windscribe-invoice.pdf" REFUSE
  t "/home/user/.ssh/id_rsa" REFUSE
  t "$WORK/dl" REFUSE;             t "$WORK/dl/sub/file" REFUSE
  t "/var/backups/windscribe-manager/a.tgz" REFUSE
  t "/etc/windscribe" ALLOW;       t "/root/.config/Windscribe" ALLOW
)"
[[ -z "$guard_out" ]] && ok "guard_path: 16/16 expectations" || bad "guard_path: $guard_out"

# -------------------------------------------------------- destructive part --
if [[ "$DESTRUCTIVE" != "true" ]]; then
  printf '\n(run with sudo ./tests/run-tests.sh --destructive on a throw-away VM for the\n install/remove cycle tests)\n'
  printf '\n\033[1m%s passed, %s failed\033[0m\n' "$PASS" "$FAIL"; exit $(( FAIL > 0 ? 1 : 0 ))
fi
if [[ "$EUID" -ne 0 ]]; then echo "destructive mode needs root"; exit 1; fi

head_ "destructive: corrupt download must abort BEFORE any removal"
dpkg -i "$WORK/dl/windscribe_2.10.14_amd64.deb" >/dev/null 2>&1
"$SUT" --dir "$WORK/corrupt" </dev/null >/dev/null 2>&1; check "exit code" "$?" "1"
check "package survived" "$(dpkg-query -W -f='${Version}' windscribe 2>/dev/null)" "2.10.14"

head_ "destructive: normal upgrade cycle"
out="$("$SUT" --dir "$WORK/dl" --max-depth 1 </dev/null 2>&1)"
check "installed version" "$(dpkg-query -W -f='${Version}' windscribe 2>/dev/null)" "2.12.1"
contains "$out" "The .deb was only READ" "download proven untouched"

head_ "destructive: install failure after purge (KNOWN ISSUE)"
"$SUT" --dir "$WORK/depdl" </dev/null >/dev/null 2>&1
if dpkg-query -W -f='${db:Status-Status}' windscribe 2>/dev/null | grep -q installed; then
  ok "old build survived a failed install"
else
  bad "BUG: purge happened, install failed -> the machine now has NO Windscribe"
fi

head_ "destructive: --remove is idempotent"
"$SUT" --remove --no-backup </dev/null >/dev/null 2>&1; check "first  --remove" "$?" "0"
"$SUT" --remove --no-backup </dev/null >/dev/null 2>&1; check "second --remove" "$?" "0"

printf '\n\033[1m%s passed, %s failed\033[0m\n' "$PASS" "$FAIL"
exit $(( FAIL > 0 ? 1 : 0 ))
