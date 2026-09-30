#!/usr/bin/env bash
# build a synthetic windscribe-like .deb   usage: mkdeb.sh <pkg> <version> <arch> <outfile>
set -euo pipefail
pkg="$1"; ver="$2"; arch="$3"; out="$4"
root="$(mktemp -d)"
mkdir -p "$root/DEBIAN" "$root/opt/windscribe" "$root/usr/bin" \
         "$root/usr/share/applications" "$root/usr/lib/systemd/system" \
         "$root/usr/share/icons/hicolor/256x256/apps" "$root/etc/windscribe" \
         "$root/usr/share/polkit-1/actions" "$root/etc/dbus-1/system.d"
cat > "$root/DEBIAN/control" <<CTL
Package: $pkg
Version: $ver
Architecture: $arch
Maintainer: Test <test@example.com>
Section: net
Priority: optional
Description: synthetic Windscribe test package
 Fake package used only to exercise windscribe-manager.sh.
CTL
printf '#!/bin/sh\necho windscribe gui stub %s\n' "$ver" > "$root/opt/windscribe/Windscribe"
printf '#!/bin/sh\necho windscribe engine stub\n'        > "$root/opt/windscribe/WindscribeEngine"
printf '#!/bin/sh\necho windscribe cli stub\n'           > "$root/opt/windscribe/windscribe-cli"
chmod 755 "$root/opt/windscribe/"*
ln -s /opt/windscribe/windscribe-cli "$root/usr/bin/windscribe-cli"
cat > "$root/usr/share/applications/windscribe.desktop" <<'DESK'
[Desktop Entry]
Name=Windscribe
Exec=/opt/windscribe/Windscribe
Icon=Windscribe
Type=Application
Categories=Network;
DESK
cat > "$root/usr/lib/systemd/system/windscribe-helper.service" <<'UNIT'
[Unit]
Description=Windscribe Helper (test stub)
[Service]
Type=simple
ExecStart=/opt/windscribe/WindscribeEngine
[Install]
WantedBy=multi-user.target
UNIT
printf 'PNG-STUB-windscribe-icon\n' > "$root/usr/share/icons/hicolor/256x256/apps/Windscribe.png"
printf 'windscribe test config\n'   > "$root/etc/windscribe/config.ini"
printf '<policyconfig>windscribe</policyconfig>\n' > "$root/usr/share/polkit-1/actions/com.windscribe.helper.policy"
printf '<busconfig>windscribe</busconfig>\n'       > "$root/etc/dbus-1/system.d/com.windscribe.helper.conf"
cat > "$root/DEBIAN/postinst" <<'POST'
#!/bin/sh
set -e
if ! getent group windscribe >/dev/null; then addgroup --system windscribe >/dev/null; fi
if ! getent passwd windscribe >/dev/null; then
  adduser --system --no-create-home --ingroup windscribe --shell /usr/sbin/nologin windscribe >/dev/null
fi
exit 0
POST
chmod 755 "$root/DEBIAN/postinst"
dpkg-deb --build --root-owner-group -Zgzip "$root" "$out" >/dev/null
rm -rf "$root"
echo "built: $out  ($pkg $ver $arch)"
