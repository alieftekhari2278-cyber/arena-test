# نقد و گزارش تست — `windscribe-manager.sh` v3.0

**محیط تست:** Debian 12 (bookworm) · bash 5.2.15 · dpkg 1.21 · amd64 · sandbox یک‌بارمصرف با دسترسی root
**تاریخ:** ۲۰۲۶-۰۹-۳۰ · **ابزارها:** `bash -n`, ShellCheck 0.11.0, بستهٔ `.deb` ساختگی با ساختار واقعی Windscribe
**هارنس تست:** `tests/run-tests.sh` (حالت امن) و `sudo ./tests/run-tests.sh --destructive` (چرخهٔ واقعی نصب/حذف)

نتیجهٔ نهایی هارنس: **۲۴ تست سبز، ۲ تست قرمز** (هر دو قرمز = باگ واقعی، در ادامه توضیح داده شده).

---

## ۱) خلاصهٔ داوری / Verdict

این اسکریپت از نظر مهندسی **بالاتر از میانگین اسکریپت‌های نصب/حذف** است: ShellCheck در سطح `style`
صفر ایراد می‌دهد، `set -Eeuo pipefail` درست به‌کار رفته، تابع `guard_path()` واقعاً کار می‌کند
(۱۶/۱۶ تست واحد سبز)، فایل `.deb` واقعاً فقط خوانده می‌شود، و شناسایی نسخه از متادیتای بسته
(نه از نام فایل) انجام می‌شود.

اما سه ادعای بزرگِ بالای فایل، در عمل **کاملاً درست نیستند**:

| ادعا | واقعیت اندازه‌گیری‌شده |
|---|---|
| «فایل دانلود مقدس است؛ فقط خوانده می‌شود» | ✅ **درست** — sha256/size/inode/mtime قبل و بعد یکی بود، apt هم چیزی کنار فایل ننوشت |
| «چرخهٔ ناموفق هرگز شما را بدون ویندسکرایب نمی‌گذارد» | ❌ **نادرست** — با یک `.deb` سالم ولی با وابستگیِ نصب‌نشدنی، سیستم بدون برنامه و بدون لاگین ماند |
| «فقط مسیرهایی که قطعاً مال ویندسکرایب‌اند حذف می‌شوند» | ❌ **نادرست** — فایلِ متعلق به یک بستهٔ دیگر (`wsfriend`) حذف شد و آن بسته خراب شد |
| «پوشه‌های مخفی و Trash نادیده گرفته می‌شوند» | ❌ **نادرست** — یک `.deb` داخل `.Trash-1000` برندهٔ انتخاب شد |

---

## ۲) چه چیزهایی تست شد (و سبز بود)

* **تحلیل ایستا:** `bash -n` سالم؛ `shellcheck -S style` بدون هیچ خطا/هشدار.
  (فقط با `-o all` تذکرهای سخت‌گیرانهٔ SC2250/SC2310/SC2312 می‌آید که سبکی‌اند، نه باگ.)
* **حالت‌های CLI:** `--version`, `--help`, `--list`, `--dir`, `--max-depth`, `--jobs`, `--user`,
  `--keep-user-data`, `--no-backup`, `--remove`, `--dry-run`, `--yes` → همه کار می‌کنند،
  کدهای خروج درست (`0` موفق / `1` خطا).
* **انتخاب نسخه (RULE 3):** از بین ۹ فایل، درست‌ترین انتخاب شد. فایل با نام `windscribe_2.12.1_amd64 (1).deb`
  (پرانتز و فاصله)، فایل تغییرنام‌داده در زیرپوشه، نسخهٔ `i386`، نسخهٔ `-cli`، بستهٔ اپ دیگر و فایل خراب
  همه درست دسته‌بندی شدند.
* **مقدس بودن دانلود (RULE 2):** بعد از چرخهٔ کامل، `diff -r` پوشهٔ دانلود با snapshot **یکسان** بود و
  `Dir::Cache::archives` واقعاً apt را از نوشتن کنار فایل کاربر بازداشت.
* **توقف قبل از حذف روی فایل ناقص:** فایلی که control سالم ولی data خراب داشت → `exit=1`،
  بسته و لاگین کاربر دست‌نخورده. ✅ این مهم‌ترین محافظ است و کار می‌کند.
* **`guard_path()`:** `/`, `/usr`, `/usr/share/applications`, `/home/user`, پوشهٔ دانلود، `~/Documents/windscribe-invoice.pdf`,
  `~/.ssh/id_rsa` → همه رد شدند؛ `/opt/windscribe`, `~/.config/Windscribe`, `/etc/windscribe` → مجاز. **۱۶/۱۶**
* **«فراموش کردن» چندکاربره:** داده‌های `user`, `bob` و `root` هر سه پاک شدند (۴ مسیر، ۳ حساب).
* **`--keep-user-data`:** لاگین همهٔ کاربران سالم ماند.
* **idempotency:** دو بار `--remove` پشت سر هم → هر دو `exit=0`، بدون خطا.
* **مقیاس:** ۴۵۱ فایل `.deb` → ۶.۹ ثانیه (اسکن موازی کار می‌کند).
* **حالت دیزاین خوب:** `if [[ "${BASH_SOURCE[0]}" == "$0" ]]` باعث می‌شود بشود اسکریپت را `source`
  کرد و توابعش را جداگانه تست کرد — این دقیقاً کاری است که در هارنس انجام دادم.

---

## ۳) ایرادها به ترتیب اهمیت

### 🔴 P1 — چرخهٔ ناموفق، سیستم را بدون ویندسکرایب و بدون لاگین رها می‌کند

**بازتولید:** یک `.deb` کاملاً سالم (control و data هر دو سالم، `dpkg-deb -c` کار می‌کند) ولی با
`Depends: libwindscribe-does-not-exist`. اعتبارسنجی **پاس می‌شود** چون فقط ساختار فایل را چک می‌کند،
نه قابلِ‌نصب‌بودن را. بعد purge اجرا می‌شود، داده‌های کاربر پاک می‌شود، و بعد apt شکست می‌خورد:

```
E: Unable to correct problems, you have held broken packages.
[ERROR] Installation failed - see the apt output above
=== exit=1 ===
### AFTER: dpkg-query: no packages found matching windscribe
### /opt/windscribe: No such file or directory
### user login data: No such file or directory
```

این دقیقاً سناریوی دردناک است: کاربری که VPN‌اش کار نمی‌کند اسکریپت را می‌زند، و حالا نه VPN دارد
نه لاگین — و برای نصب وابستگی‌ها به اینترنتی نیاز دارد که شاید بدون VPN در دسترس نباشد.

**راه‌حل (قبل از فاز حذف، در کنار `validate_deb`):**

```bash
# حل‌شدنی بودن وابستگی‌ها را قبل از هر حذفی بسنج
preflight_solvable() {
  local deb="$1"
  if ! apt-get install --simulate --reinstall -o Dir::Cache::archives="$APT_ARCHIVE_DIR" \
        -- "$deb" >"$TMPDIR_RUN/solve.log" 2>&1; then
    warn "apt cannot satisfy this .deb's dependencies - nothing was removed"
    sed -n 's/^ /    /p' "$TMPDIR_RUN/solve.log" | tail -5
    return 1
  fi
  return 0
}
```

و در `main` بلافاصله بعد از `validate_deb`: `preflight_solvable "$CANDIDATE_PATH" || die ...`.
به‌علاوه در مسیر شکستِ نصب، پیام `die` باید مسیر پشتیبان (`$BACKUP_FILE`) و راه بازگردانی را نشان دهد.

---

### 🔴 P2 — فایل‌های متعلق به بسته‌های دیگر حذف می‌شوند

`sweep_named_leftovers()` هر چیزی با نام `windscribe*` را در `/usr/share/applications`,
`/usr/share/icons`, `/etc/systemd/system` و … پاک می‌کند، **بدون اینکه بپرسد dpkg آن را به کدام بسته
نسبت می‌دهد**. یک بستهٔ ثالث ساختم (`wsfriend`) که فایل `windscribe-tray-indicator.desktop` دارد:

```
    removed leftover: /usr/share/applications/windscribe-tray-indicator.desktop
$ dpkg -V wsfriend
missing     /usr/share/applications/windscribe-tray-indicator.desktop
```

یعنی بستهٔ سالم و نصب‌شدهٔ دیگری خراب شد. کامنت خود اسکریپت می‌گوید «فقط مسیرهایی که قطعاً مال
ویندسکرایب‌اند»، ولی معیار فقط «نام» است. چک محتوا (`path_is_ours`) هم کمکی نمی‌کند چون فایل‌های
مربوط به ویندسکرایبِ بسته‌های دیگر طبعاً کلمهٔ windscribe را دارند.

**راه‌حل — قبل از حذف، مالکیت را از dpkg بپرس:**

```bash
owned_by_other_pkg() {          # 0 = یک بستهٔ نصب‌شدهٔ دیگر صاحب آن است
  local p="$1" owner
  owner="$(dpkg -S "$p" 2>/dev/null | cut -d: -f1 | tr ',' '\n' | sed 's/ //g')" || return 1
  [[ -z "$owner" ]] && return 1
  grep -qvE "^(${PKG_GUI}|${PKG_CLI})$" <<<"$owner"
}
# در حلقهٔ sweep_named_leftovers:
if owned_by_other_pkg "$h"; then warn "skipped (owned by another package): $h"; continue; fi
```

---

### 🔴 P3 — فایل `.deb` داخل سطل زباله / پوشهٔ مخفی برنده می‌شود

کامنت می‌گوید «Hidden dirs, trash and package-manager internals are skipped»، ولی:

```
[ OK ] Selected: windscribe 9.9.9 (amd64) - newest of 6 eligible file(s)
    file : /home/user/Downloads/.Trash-1000/files/windscribe_9.9.9_amd64.deb
```

**ریشه:** در `find_deb_files()` عبارت `-mindepth 2` باعث می‌شود `-prune` هرگز روی پوشه‌های سطح ۱
اعمال نشود (تست مستقیم: `find /tmp/fd -mindepth 2 -maxdepth 3 \( -type d -name '.*' -prune \) -o ...`
همچنان `.Trash-1000/files/a.deb` را برمی‌گرداند).

پیامد واقعی: بتای خرابی که کاربر عمداً حذف کرده، دوباره کشف و **با دسترسی root نصب می‌شود**
(maintainer script های آن با root اجرا می‌شوند). هم باگ منطقی است هم یک foot-gun امنیتی کوچک.

**راه‌حل:**

```bash
find "$dir" -mindepth 1 -maxdepth "$MAX_DEPTH" \
  \( -type d \( -name '.*' -o -name node_modules -o -name 'lost+found' \) -prune \) -o \
  \( \( -type f -o -type l \) \( -name '*.deb' -o -name '*.DEB' \) -print0 \)
```
(و سپس نتایج سطح ۱ که قبلاً با glob گرفته شده‌اند، با همان مکانیزم dedup حذف می‌شوند.)

---

### 🟠 P4 — `--list` همیشه می‌گوید «(not installed)»

```
$ dpkg-query -W windscribe   →  windscribe 2.12.1
$ ./windscribe-manager.sh --list
    installed now: (not installed)      ← غلط
```

**ریشه:** در `main()`، مقدار `INSTALLED_VER` **بعد از** بلاک `case "$MODE" in list) ... exit 0` محاسبه
می‌شود. تنها خطی از جدول که کاربر برای تصمیم‌گیری «آیا باید به‌روزرسانی کنم؟» به آن نگاه می‌کند، غلط است.

**راه‌حل:** یک خط جابه‌جایی — محاسبهٔ `INSTALLED_VER` را به قبل از `case "$MODE"` ببرید.

---

### 🟠 P5 — `--remove --dry-run` طوری گزارش می‌دهد که انگار حذف انجام شده

```
----------------------------- SUMMARY -----------------------------
[ !! ] Package records still present - check: dpkg -l | grep ...
    menu caches      : rebuilt (the launcher is gone from the menu)
==> Removal complete.  /  حذف کامل انجام شد.
```

در حالی که هیچ‌چیز حذف نشده. برای مخاطب غیرفنی این متن گمراه‌کننده است (یا فکر می‌کند حذف شد،
یا فکر می‌کند حذف شکست خورد). `flow_remove` باید در dry-run از `verify_removed` و
`final_report_removal` رد شود یا عنوان‌ها را با برچسب «آزمایشی» چاپ کند.

---

### 🟠 P6 — dry-run لیست واقعی حذف‌شدنی‌ها را نشان نمی‌دهد

مهم‌ترین کاربرد dry-run برای یک ابزار مخرب این است که **دقیقاً کدام مسیرها** پاک می‌شوند. ولی
`wipe_user_data` و `sweep_system_leftovers` در dry-run قبل از جمع‌آوری لیست خارج می‌شوند و فقط
یک خط کلی چاپ می‌کنند. همچنین dry-run اصلاً `validate_deb` را اجرا نمی‌کند، پس نمی‌تواند به شما
بگوید «فایلت خراب است». پیشنهاد: جمع‌آوری همیشه انجام شود و فقط `rm` شرطی شود
(`for e in "${targets[@]}"; do dry_would "remove: $e" || safe_rm "$e"; done`). ضمناً dry-run
برای یک حالت کاملاً بی‌خطر، بی‌دلیل root می‌خواهد.

---

### 🟠 P7 — پیام خطای `/dev/tty` در مسیر پیش‌فرض

وقتی نسخهٔ دانلودشده با نسخهٔ نصب‌شده یکی است و ترمینال کنترلی وجود ندارد (cron، pipe، ssh غیرتعاملی):

```
./windscribe-manager.sh: line 1850: /dev/tty: No such device or address
./windscribe-manager.sh: line 1851: /dev/tty: No such device or address
==> No changes were made.
```

رفتار **امن** است (پیش‌فرض = نه)، ولی دو خط خطای خام برای کاربر غیرفنی شبیه کرش است.
اصلاح: `if [[ -r /dev/tty ]] && exec 3<>/dev/tty 2>/dev/null; then read -r answer <&3; ...`
یا حداقل `2>/dev/null` روی هر دو دستور.

---

### 🟠 P8 — سقف ۴۰۰ فایل، جدیدترین نسخه را قربانی می‌کند

با ۴۵۱ فایل در پوشه، برش **قبل از** probe و به ترتیب الفبایی انجام می‌شود، بنابراین
`zzz_newest.deb` (نسخهٔ ۲.۱۲.۱) اصلاً دیده نشد و ۲.۱۰.۱۴ برنده شد:

```
[ !! ] Found 451 .deb files - probing only the first 400
[ OK ] Selected: windscribe 2.10.14 ...
```

در حالت auto این یعنی «به‌روزرسانی موجود نیست» در حالی که هست. اصلاح ساده: قبل از اعمال سقف،
فهرست را بر اساس mtime نزولی مرتب کنید (جدیدترین دانلودها مرتبط‌ترین‌اند).

---

### 🟡 P9 — پاک کردن دادهٔ کاربری که مال ویندسکرایب نیست

در `USER_CACHE_REL` این موارد برای **همهٔ کاربران** حذف می‌شوند:
`.config/gnome-session/saved-session`, `.cache/plank`, `.cache/docky`, `.cache/xfce4/panel/launcher`, `ksycoca*`…

`saved-session` کش نیست؛ **کانفیگ** است و به همهٔ برنامه‌های کاربر مربوط می‌شود. در تست، فایل
دست‌سازِ من با محتوای «saved session of ALL apps» حذف شد و در آمار به‌عنوان «دادهٔ ویندسکرایب»
شمرده شد (`6 location(s) removed`). پیشنهاد: کش‌های عمومی را در آمار جدا کنید و
`saved-session` را به‌جای حذف، ویرایش کنید (فقط سطرهای windscribe).

ضمناً پاک کردن دادهٔ **همهٔ حساب‌های انسانیِ ماشین** (از جمله خانهٔ همکار/همسر شما) بدون هیچ
تأییدیه‌ای، رفتار پیش‌فرضِ تهاجمی‌ای است؛ حداقل باید در خلاصهٔ فارسیِ بالای فایل صریح گفته شود.

---

### 🟡 P10 — پشتیبان‌ها: توکن لاگین به‌صورت متن ساده، برای همیشه

هر اجرای مخرب یک `tar.gz` تازه در `/var/backups/windscribe-manager/` می‌سازد. بعد از ۴ اجرا:

```
-rw------- root root user-data-20260930-155048.tar.gz → authHash=SECRET-LOGIN-TOKEN
-rw------- root root user-data-20260930-155127.tar.gz → authHash=TOKEN3
-rw------- root root user-data-20260930-155240.tar.gz → authHash=TOKEN4
-rw------- root root user-data-20260930-155305.tar.gz → tok
```

برای ابزاری که شعارش «برنامه شما را فراموش می‌کند» است، باقی ماندن نسخهٔ متن‌سادهٔ توکن احراز هویت
روی دیسک (بدون چرخش، بدون تاریخ انقضا، بدون دستور بازگردانی در راهنما) تناقض است.
پیشنهاد: نگه داشتن حداکثر N پشتیبان اخیر + یک `--restore LAST` + یک خط در راهنمای فارسی.

---

### 🟡 P11 — «verified» یعنی «سالم»، نه «اصل»

`validate_deb` فقط ساختار ar/tar و نام بسته را چک می‌کند. هیچ بررسی sha256 در برابر مقدار منتشرشدهٔ
Windscribe و هیچ امضای GPG در کار نیست، ولی پیام چاپ‌شده «Download verified» است و بعد از آن
maintainer script های همان فایل با root اجرا می‌شوند. حتی وقتی خود اسکریپت هشدار می‌دهد
«payload does not look like the Windscribe GUI»، باز هم purge + install را انجام می‌دهد و در پایان
با `exit 0` می‌گوید «Windscribe 5.0.0 is installed»:

```
[ !! ] the payload does not look like the Windscribe GUI (no /opt/windscribe)
[ !! ] Install incomplete: 5 of 9 artefacts missing
[ OK ] Windscribe 5.0.0 is installed          ← exit=0
```

پیشنهاد: آن هشدار در حالت auto باید توقف/تأیید باشد نه اطلاع؛ و در پایان اگر
`missing > 0` بود کد خروج غیرصفر برگردد.

---

### 🟡 P12 — ترجمه‌های فارسیِ `warn()` هرگز چاپ نمی‌شوند

```bash
warn() { printf '%s[ !! ]%s %s\n' "$C_WARN" "$C_OFF" "$1"; return 0; }   # فقط $1
```

ولی ۵ جا `warn` با آرگومان دوم فارسی صدا زده می‌شود (خطوط ۷۱۳، ۲۱۵۵، ۲۱۶۸، ۲۲۰۲، ۲۲۴۵) —
مثلاً پیام «تعداد فایل‌ها زیاد است…» هرگز دیده نمی‌شود. `say()` و `die()` آرگومان دوم را چاپ می‌کنند،
`warn()` نه. یک خط اصلاح:

```bash
warn() { printf '%s[ !! ]%s %s\n' "$C_WARN" "$C_OFF" "$1"
         [[ -n "${2:-}" ]] && printf '    %s\n' "$2"; return 0; }
```

---

### ⚪ نکات کوچک‌تر

1. **بدون `SUDO_USER`** (مثلاً `su -` یا ترمینال root) روی ماشینی که `/run/user/*` و `loginctl`
   جواب نمی‌دهند، اسکریپت با `Downloads folder not found: /root/Downloads` می‌میرد. پیام خطا
   باید `--user NAME` را هم پیشنهاد دهد (که تست شد و مشکل را کامل حل می‌کند)، نه فقط `--dir`.
2. **تشخیص «نصب کامل» با `dpkg path-exclude`**: روی سیستم‌هایی که `/usr/share/doc` را حذف می‌کنند
   (کانتینرها و نصب‌های slim)، هشدار کاذب «missing after install» می‌گیرید. بهتر است مسیرهای
   حذف‌شده توسط `dpkg --get-selections`/`dpkg.cfg.d` فیلتر شوند.
3. **`clear_menu_pins`** خروجی `gsettings set` را با `run_as_user` بلعیده و بی‌قیدوشرط
   «GNOME dash favourite removed» را OK اعلام می‌کند، حتی وقتی dconf در دسترس نبوده.
4. **`__add_home`** داخل `list_wipe_homes` تعریف می‌شود ولی تابعی **سراسری** است و در هر فراخوانی
   دوباره ساخته می‌شود؛ بهتر است بیرون و با نام `_wsm_add_home` تعریف شود.
5. **بدون قفل single-instance**: دو اجرای هم‌زمان، قفل apt را رعایت می‌کنند ولی فاز پاک‌سازی
   دادهٔ کاربر و backup را هم‌زمان انجام می‌دهند.
6. **`chmod 0755 "$TMPDIR_RUN"`** (برای اینکه کاربر دسکتاپ اسکریپت پایتون keyring را بخواند) کل
   پوشهٔ موقت را قابل‌خواندن برای همه می‌کند؛ بهتر است فقط همان فایل با `install -m 0644 -o "$REAL_USER"`
   در مسیر جداگانه‌ای گذاشته شود.
7. **`check_disk_space`** فقط `/` را می‌بیند؛ اگر `/opt` یا `/home` پارتیشن جدا باشد بی‌اثر است.
8. **رفتار `--dir /`**: چون `guard_path` هر چیزی داخل `DOWNLOADS_DIR` را رد می‌کند، دادنِ `/` عملاً
   همهٔ حذف‌ها را بی‌صدا لغو می‌کند ولی purge بسته انجام می‌شود — بهتر است `--dir /` صریحاً رد شود.
9. **`MAX_PROBE_FILES`/`PARALLEL_*`**: کارایی خوب است (۴۰۰ فایل ≈ ۷ ثانیه)، ولی هر probe یک
   `dpkg-deb` جداگانه است؛ برای پوشه‌های بزرگ می‌شد اول بر اساس mtime مرتب و زودتر قطع کرد.

---

## ۴) اولویت پیشنهادی اصلاح

| # | ایراد | اثر | هزینهٔ اصلاح |
|---|---|---|---|
| P1 | شکست نصب بعد از purge | 🔴 از دست رفتن VPN و لاگین | ~۱۵ خط (`apt-get --simulate`) |
| P2 | حذف فایل بسته‌های دیگر | 🔴 خراب شدن بستهٔ ثالث | ~۱۰ خط (`dpkg -S`) |
| P3 | انتخاب `.deb` از Trash | 🔴 نصب ناخواسته با root | ۱ خط (`-mindepth 1`) |
| P4 | `--list` نسخهٔ نصب‌شده | 🟠 تصمیم غلط کاربر | جابه‌جایی ۱ خط |
| P5/P6 | گزارش گمراه‌کنندهٔ dry-run | 🟠 اعتماد کاذب | ~۲۰ خط |
| P7 | خطای `/dev/tty` | 🟠 ظاهر کرش | ۲ خط |
| P8 | سقف ۴۰۰ فایل | 🟠 آپدیت نادیده | ۳ خط (sort by mtime) |
| P12 | ترجمه‌های چاپ‌نشده | 🟡 UX دوزبانه ناقص | ۱ خط |

---

## ۵) بازتولید نتایج

```bash
./tests/run-tests.sh                      # امن: static analysis + CLI + انتخاب + guard_path
sudo ./tests/run-tests.sh --destructive   # فقط روی ماشین یک‌بارمصرف/VM
```

خروجی فعلی: `24 passed, 2 failed` — دو شکست عمدی‌اند و باگ‌های P1 و P3 را مستند می‌کنند.
