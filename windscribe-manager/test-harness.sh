#!/usr/bin/env bash
# =============================================================================
#  test-harness.sh — reproducible test bed for windscribe-manager.sh
#  هارنس تست برای windscribe-manager.sh
#
#  ⚠  DISPOSABLE MACHINE ONLY. It really installs/purges a fake "windscribe"
#     package, creates a system user, and deletes per-user data.
#     فقط روی ماشین/کانتینر یک‌بارمصرف اجرا شود.
#
#  usage:  sudo ./test-harness.sh /path/to/windscribe-manager.sh
# =============================================================================
set -uo pipefail

SUT="${1:-./windscribe-manager.sh}"
[[ -f "$SUT" ]] || { echo "script not found: $SUT" >&2; exit 1; }
SUT="$(readlink -f -- "$SUT")"
WORK="${WORK:-/tmp/wsmgr-tests}"
DL="$WORK/Downloads"
export NO_COLOR=1
PASS=0; FAIL=0

hdr()  { printf '\n\033[1;36m=== %s\033[0m\n' "$*"; }
chk()  { # chk <label> <expected: yes|no> <path>
  local got=no; [[ -e "$3" || -L "$3" ]] && got=yes
  if [[ "$got" == "$2" ]]; then PASS=$((PASS+1)); printf '  ok   %-52s %s\n' "$1" "$got"
  else FAIL=$((FAIL+1)); printf '  \033[1;31mFAIL\033[0m %-52s got=%s want=%s\n' "$1" "$got" "$2"; fi
}
chkout() { # chkout <label> <regex> <file>
  if grep -qE "$2" "$3"; then PASS=$((PASS+1)); printf '  ok   %s\n' "$1"
  else FAIL=$((FAIL+1)); printf '  \033[1;31mFAIL\033[0m %s (no match: %s)\n' "$1" "$2"; fi
}

# --- fixture builder ---------------------------------------------------------
mkdeb() { # mkdeb <pkg> <ver> <arch> <out> [full]
  local pkg="$1" ver="$2" arch="$3" out="$4" full="${5:-}" d
  d="$WORK/build/$pkg-$ver-$arch-$RANDOM"; rm -rf "$d"; mkdir -p "$d/DEBIAN"
  printf 'Package: %s\nVersion: %s\nArchitecture: %s\nMaintainer: t <t@e.com>\nDescription: fake %s\n' \
    "$pkg" "$ver" "$arch" "$pkg" >"$d/DEBIAN/control"
  if [[ -n "$full" ]]; then
    mkdir -p "$d/opt/windscribe" "$d/usr/bin" "$d/usr/share/applications" \
             "$d/usr/lib/systemd/system" "$d/usr/share/icons/hicolor/128x128/apps" \
             "$d/etc/dbus-1/system.d" "$d/usr/share/polkit-1/actions"
    printf '#!/bin/sh\nsleep 999\n' >"$d/opt/windscribe/Windscribe"
    printf '#!/bin/sh\necho cli\n'   >"$d/opt/windscribe/windscribe-cli"
    chmod 755 "$d/opt/windscribe/"*
    ln -sf /opt/windscribe/windscribe-cli "$d/usr/bin/windscribe-cli"
    printf '[Desktop Entry]\nName=Windscribe\nExec=/opt/windscribe/Windscribe\nIcon=Windscribe\nType=Application\n' \
      >"$d/usr/share/applications/windscribe.desktop"
    printf '[Unit]\nDescription=ws\n[Service]\nExecStart=/bin/sleep 999\n[Install]\nWantedBy=multi-user.target\n' \
      >"$d/usr/lib/systemd/system/windscribe-helper.service"
    printf 'PNGFAKE' >"$d/usr/share/icons/hicolor/128x128/apps/Windscribe.png"
    printf '<busconfig><!-- windscribe --></busconfig>\n' >"$d/etc/dbus-1/system.d/com.windscribe.helper.conf"
    printf '<policyconfig><!-- windscribe --></policyconfig>\n' >"$d/usr/share/polkit-1/actions/com.windscribe.helper.policy"
    cat >"$d/DEBIAN/postinst" <<'EOS'
#!/bin/sh
set -e
getent group windscribe >/dev/null || addgroup --system windscribe || true
getent passwd windscribe >/dev/null || adduser --system --no-create-home \
  --shell /usr/sbin/nologin --ingroup windscribe windscribe || true
mkdir -p /etc/windscribe /var/log/windscribe && echo state >/etc/windscribe/config.ini
exit 0
EOS
    chmod 755 "$d/DEBIAN/postinst"
  else
    mkdir -p "$d/usr/share/doc/$pkg"; echo x >"$d/usr/share/doc/$pkg/README"
  fi
  mkdir -p "$(dirname -- "$out")"
  dpkg-deb --root-owner-group -b "$d" "$out" >/dev/null
}

DESK_USER="${SUDO_USER:-$(id -un)}"
DESK_HOME="$(getent passwd "$DESK_USER" | cut -d: -f6)"
as_desk() { runuser -u "$DESK_USER" -- "$@"; }

hdr "0. fixtures  (desktop user: $DESK_USER)"
rm -rf "$WORK"; mkdir -p "$DL"
mkdeb windscribe     2.10.10 amd64 "$DL/windscribe_2.10.10_amd64.deb" full
mkdeb windscribe     2.12.1  amd64 "$DL/windscribe (1).deb"           full   # renamed, newest
mkdeb windscribe     2.11.0  amd64 "$DL/nested/deep/ws-old.deb"       full
mkdeb windscribe     2.99.0  arm64 "$DL/windscribe_2.99.0_arm64.deb"
mkdeb windscribe-cli 2.12.1  amd64 "$DL/windscribe-cli_2.12.1_amd64.deb"
mkdeb notwindscribe  9.9.9   amd64 "$DL/some-other-app.deb"
head -c 5000 /dev/urandom >"$DL/windscribe_broken_download.deb"
: >"$DL/empty.deb"
head -c 900 "$DL/windscribe_2.10.10_amd64.deb" >"$DL/windscribe_truncated.deb"
ln -s "windscribe (1).deb" "$DL/link-to-newest.deb"
ln "$DL/windscribe_2.10.10_amd64.deb" "$DL/hardlink-copy.deb"
mkdir -p "$DL/my folder"; cp "$DL/windscribe_2.10.10_amd64.deb" "$DL/my folder/ws copy.deb"
chmod -R a+rX "$WORK"

# user data that MUST go, decoys that MUST stay
as_desk mkdir -p "$DESK_HOME/.config/Windscribe" "$DESK_HOME/.config/autostart" \
                 "$DESK_HOME/Documents" "$DESK_HOME/windscribe-project"
as_desk sh -c "echo authToken=SECRET > '$DESK_HOME/.config/Windscribe/Windscribe.conf'"
as_desk sh -c "printf '[Desktop Entry]\nName=Windscribe\n' > '$DESK_HOME/.config/autostart/windscribe.desktop'"
as_desk sh -c "echo invoice > '$DESK_HOME/Documents/windscribe-invoice.pdf'"
as_desk sh -c "echo notes   > '$DESK_HOME/windscribe-project/notes.txt'"
as_desk sh -c "printf '[Containments][1][General]\nfavorites=dolphin.desktop,windscribe.desktop,firefox.desktop\nfavoritesPorted=true\n' > '$DESK_HOME/.config/plasma-org.kde.plasma.desktop-appletsrc'"
mkdir -p /usr/share/applications
printf '[Desktop Entry]\nName=My VPN log viewer\nComment=unrelated\n' >/usr/share/applications/vpnlog-windscribe-viewer.desktop
echo "  fixtures in $WORK"

hdr "1. --list (read-only, metadata based selection)"
runuser -u "$DESK_USER" -- "$SUT" --list --dir "$DL" >"$WORK/list.log" 2>&1
chkout "newest version wins, filename irrelevant" 'Selected: windscribe 2\.12\.1' "$WORK/list.log"
chkout "cli build skipped"       'windscribe-cli build'        "$WORK/list.log"
chkout "other package skipped"   'different package'           "$WORK/list.log"
chkout "foreign arch skipped"    'foreign architecture'        "$WORK/list.log"
chkout "corrupt files skipped"   'not a valid \.deb'           "$WORK/list.log"
chkout "nothing changed"         'nothing was changed'         "$WORK/list.log"

hdr "2. corrupt newest .deb must abort BEFORE any removal"
mkdir -p "$WORK/D2"; cp "$DL/windscribe_2.10.10_amd64.deb" "$WORK/D2/good.deb"
mkdeb windscribe 2.20.0 amd64 "$WORK/D2/high.deb" full; truncate -s 700 "$WORK/D2/high.deb"
"$SUT" --yes --dir "$WORK/D2" </dev/null >"$WORK/corrupt.log" 2>&1; rc=$?
[[ $rc -eq 1 ]] && { PASS=$((PASS+1)); echo "  ok   exit code 1"; } || { FAIL=$((FAIL+1)); echo "  FAIL exit=$rc"; }
chkout "refuses to continue" 'Refusing to continue' "$WORK/corrupt.log"
chk "nothing installed" no /opt/windscribe

hdr "3. fresh install from the .deb"
"$SUT" --dir "$DL" </dev/null >"$WORK/install.log" 2>&1
chkout "installed"        'Windscribe 2\.12\.1 is installed'      "$WORK/install.log"
chkout ".deb only read"   'byte-for-byte identical'               "$WORK/install.log"
chk "binary dir"        yes /opt/windscribe
chk "launcher"          yes /usr/share/applications/windscribe.desktop
chk "cli symlink"       yes /usr/bin/windscribe-cli
chk "user data wiped"   no  "$DESK_HOME/.config/Windscribe"
chk "autostart wiped"   no  "$DESK_HOME/.config/autostart/windscribe.desktop"
chk "DECOY invoice"     yes "$DESK_HOME/Documents/windscribe-invoice.pdf"
chk "DECOY project"     yes "$DESK_HOME/windscribe-project/notes.txt"
chk "DECOY other .desktop" yes /usr/share/applications/vpnlog-windscribe-viewer.desktop
grep -q 'favorites=dolphin.desktop,firefox.desktop' "$DESK_HOME/.config/plasma-org.kde.plasma.desktop-appletsrc" \
  && { PASS=$((PASS+1)); echo "  ok   KDE favourite un-pinned, other keys intact"; } \
  || { FAIL=$((FAIL+1)); echo "  FAIL KDE favourites"; }
chk "the .deb still there" yes "$DL/windscribe (1).deb"

hdr "4. same version again -> no-op"
"$SUT" --dir "$DL" </dev/null >"$WORK/noop.log" 2>&1
chkout "no changes" 'No changes were made' "$WORK/noop.log"

hdr "5. newer .deb -> full remove + fresh install (with the app running)"
mkdeb windscribe 2.13.0 amd64 "$DL/Windscribe_v2.13.0_FINAL.deb" full
chmod a+r "$DL/Windscribe_v2.13.0_FINAL.deb"
setsid /opt/windscribe/Windscribe >/dev/null 2>&1 &
sleep 0.5
"$SUT" --dir "$DL" </dev/null >"$WORK/update.log" 2>&1
chkout "upgraded"      'Windscribe 2\.13\.0 is installed' "$WORK/update.log"
chkout "previous seen" 'previous version : 2\.12\.1'      "$WORK/update.log"
pgrep -x Windscribe >/dev/null && { FAIL=$((FAIL+1)); echo "  FAIL app still running"; } \
                               || { PASS=$((PASS+1)); echo "  ok   running app was stopped"; }

hdr "6. --remove: system must be clean"
"$SUT" --remove --dir "$DL" </dev/null >"$WORK/remove.log" 2>&1
for p in /opt/windscribe /etc/windscribe /var/log/windscribe \
         /usr/share/applications/windscribe.desktop /usr/bin/windscribe-cli \
         /usr/lib/systemd/system/windscribe-helper.service \
         /etc/dbus-1/system.d/com.windscribe.helper.conf \
         /usr/share/polkit-1/actions/com.windscribe.helper.policy \
         /usr/share/icons/hicolor/128x128/apps/Windscribe.png; do
  chk "gone: $p" no "$p"
done
getent passwd windscribe >/dev/null && { FAIL=$((FAIL+1)); echo "  FAIL system user left"; } \
                                    || { PASS=$((PASS+1)); echo "  ok   system user removed"; }
chk "DECOY survived removal" yes /usr/share/applications/vpnlog-windscribe-viewer.desktop
chk "the .deb survived"      yes "$DL/windscribe (1).deb"

hdr "7. known-bug probes (these are EXPECTED to fail — see REVIEW.md)"
as_desk mkdir -p "$DESK_HOME/.cache/plank" "$DESK_HOME/.config/gnome-session" \
                 "$DESK_HOME/.var/app/com.windscribe.Windscribe"
as_desk sh -c "echo dock    > '$DESK_HOME/.cache/plank/dock.db'"
as_desk sh -c "echo session > '$DESK_HOME/.config/gnome-session/saved-session'"
as_desk sh -c "echo state   > '$DESK_HOME/.var/app/com.windscribe.Windscribe/settings'"
"$SUT" --remove --dir "$DL" </dev/null >"$WORK/bugs.log" 2>&1
chk "B1: unrelated plank cache kept"     yes "$DESK_HOME/.cache/plank"
chk "B1: gnome saved-session kept"       yes "$DESK_HOME/.config/gnome-session/saved-session"
chk "B2: flatpak data removed"           no  "$DESK_HOME/.var/app/com.windscribe.Windscribe"

hdr "8. argument handling"
for a in "--bogus" "--max-depth 0" "--jobs abc" "--dir /nope/nope"; do
  # shellcheck disable=SC2086
  runuser -u "$DESK_USER" -- "$SUT" $a --list >/dev/null 2>&1
  [[ $? -eq 1 ]] && { PASS=$((PASS+1)); echo "  ok   rejected: $a"; } \
                 || { FAIL=$((FAIL+1)); echo "  FAIL accepted: $a"; }
done

hdr "RESULT"
printf '  passed: %s   failed: %s\n' "$PASS" "$FAIL"
printf '  logs:   %s\n' "$WORK"
printf '  cleanup: apt-get purge -y windscribe; rm -rf %s /var/backups/windscribe-manager\n' "$WORK"
[[ "$FAIL" -eq 0 ]]
