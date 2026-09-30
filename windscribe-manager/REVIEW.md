# نقد و گزارش تست — `windscribe-manager.sh` v3.0

> تست واقعی روی Debian 12 (bookworm)، amd64، bash 5.2، dpkg/apt واقعی، systemd فعال.
> بسته‌های جعلیِ `windscribe` (با postinst واقعی، سرویس systemd، آیکن، dbus، polkit)
> ساخته و واقعاً نصب/حذف شدند. ShellCheck در دسترس نبود (مخزن آفلاین)، بنابراین
> همهٔ یافته‌ها **تجربی** است، نه حدسی.

---

## ۱. خلاصهٔ مدیریتی

اسکریپت **کار می‌کند** و در کارهای سختِ اصلی واقعاً خوب است: انتخاب نسخه از روی
متادیتای deb، دست‌نزدن به فایل دانلودی، توقف قبل از حذف وقتی فایل خراب است، و
پاک‌سازی کاملِ ردپای سیستمی. هیچ‌کدام از «طعمه»هایی که گذاشتم (فایل‌های کاربر و
برنامه‌های دیگر با نام مشابه) حذف نشدند.

اما سه ادعای مهمِ سرصفحهٔ فایل در عمل **نقض می‌شود**:

| ادعا | واقعیت اندازه‌گیری‌شده |
|---|---|
| «فقط مسیرهایی که قطعاً مالِ Windscribe‌اند لمس می‌شوند» | ❌ `~/.cache/plank`، `~/.cache/docky` و `~/.config/gnome-session/saved-session` **حتی وقتی هیچ ردی از ویندسکرایب نیست** حذف شدند |
| «دادهٔ snap + flatpak پاک می‌شود» | ❌ مسیر flatpak هم غلط نوشته شده و هم خودِ guard آن را رد می‌کند؛ هرگز پاک نمی‌شود |
| «هر مرحلهٔ تغییردهنده منتظر قفل apt می‌ماند» | ❌ بدون بستهٔ `psmisc` (یعنی بدون `fuser`) این تابع بی‌صدا هیچ کاری نمی‌کند |

نمرهٔ کلی: **۷٫۵ از ۱۰** — مهندسی‌شده و امن، ولی چند باگ واقعی + مستنداتی که از
کد جلو زده‌اند.

---

## ۲. چیزهایی که واقعاً تست شد و درست کار کرد ✅

| سناریو | نتیجه |
|---|---|
| انتخاب نسخه از متادیتا، نه نام فایل | ✅ فایل `windscribe (1).deb` (نسخهٔ 2.12.1) بر `windscribe_2.10.10_amd64.deb` برنده شد |
| نام فایل/پوشهٔ دارای فاصله | ✅ `my folder/ws copy.deb` و `windscribe (1).deb` هم اسکن و هم با apt نصب شدند |
| پوشه‌های تودرتو تا عمق ۳ | ✅ `nested/deep/ws-old.deb` پیدا شد |
| فیلتر معماری / CLI / بستهٔ دیگر | ✅ `arm64`، `windscribe-cli`، `notwindscribe` با دلیل صحیح رد شدند |
| حذف تکراری‌ها (symlink + hardlink) | ✅ ۱۲ فایل روی دیسک → ۱۰ رکورد یکتا |
| فایل خراب = توقف **قبل از** حذف | ✅ `exit 1`، بسته نصب‌شده دست‌نخورده ماند |
| اثبات دست‌نخوردگی deb | ✅ `size/mtime/inode/sha256` بعد از نصب یکسان بود |
| ریدایرکت کش apt | ✅ هیچ فایلی کنار دانلود نوشته نشد |
| کشتن پروسهٔ در حال اجرا | ✅ `/opt/windscribe/Windscribe` قبل از purge کشته شد |
| پاک‌سازی سیستمی | ✅ `/opt`, `/etc/windscribe`, `/var/log`, desktop, آیکن، **dbus conf**، **polkit policy**، unit، و کاربر/گروه سیستمی `windscribe` همه رفتند |
| طعمه‌ها | ✅ `~/Documents/windscribe-invoice.pdf`، `~/windscribe-project/`، `firefox.desktop` و `vpnlog-windscribe-viewer.desktop` (نامش شامل windscribe ولی محتوایش نه) سالم ماندند |
| علاقه‌مندی‌های KDE | ✅ فقط توکن windscribe از `favorites=` حذف شد، `favoritesPorted=true` دست‌نخورد |
| پشتیبان‌گیری | ✅ tar با `chmod 600` ساخته شد؛ `--no-backup` واقعاً چیزی نساخت |
| `--keep-user-data` | ✅ لاگین باقی ماند |
| اجرای تکراری (idempotency) | ✅ نسخهٔ مساوی/قدیمی‌تر → هیچ تغییری |
| پارس آرگومان‌ها | ✅ ۱۰ حالت خطا (`--bogus`, `--max-depth 0/99`, `--jobs abc`, `--dir` روی فایل، کاربر ناموجود…) همه با `exit 1` و پیام دوزبانه |
| پاک‌سازی موقت‌ها | ✅ هیچ `/tmp/wsmgr.*` باقی نماند |

---

## ۳. باگ‌ها (به ترتیب اهمیت)

### 🔴 B1 — دادهٔ برنامه‌های *دیگر* پاک می‌شود، حتی وقتی ویندسکرایب هیچ ردی ندارد

آزمایش: همهٔ دادهٔ ویندسکرایب را پاک کردم، فقط `~/.cache/plank`، `~/.cache/docky` و
`~/.config/gnome-session/saved-session` را گذاشتم و `--remove` زدم:

```
    removed: /home/user/.cache/plank
    removed: /home/user/.cache/docky
    removed: /home/user/.config/gnome-session/saved-session
    3 location(s) removed for 1 user account(s)
[ OK ] user data wiped: 3 location(s), 1 account(s) - login required again
```

سه مشکل در یک باگ:

1. `USER_CACHE_REL` بدون هیچ شرطی برای **همهٔ کاربران ماشین** حذف می‌شود.
2. `~/.config/gnome-session/saved-session` **کش نیست** — «جلسهٔ ذخیره‌شدهٔ» کاربر
   است (چه برنامه‌هایی موقع لاگین باز شوند). پاک کردنش خارج از محدودهٔ این ابزار است.
3. چون این فایل‌ها روی هر دسکتاپ واقعی همیشه وجود دارند، `found_here=1` همیشه
   درست می‌شود ⇒ اسکریپت **همیشه** می‌گوید «N مکان پاک شد» و همیشه یک tar می‌سازد،
   حتی وقتی ویندسکرایب اصلاً چیزی نگذاشته بود. عدد گزارش نهایی بی‌معنا می‌شود.

**اصلاح پیشنهادی:** کش‌ها را جزو «دادهٔ کاربر» نشمار و فقط وقتی واقعاً چیزی حذف شد
سراغشان برو — و `saved-session`/`plank`/`docky` را اصلاً حذف نکن؛ بازسازی کش منو
(که همین حالا انجام می‌دهی) کافی است:

```bash
# در wipe_user_data: کش‌ها را در یک آرایهٔ جدا جمع کن
if (( found_here == 1 )); then
  for rel in "${USER_CACHE_REL[@]}"; do ... targets+=... ; done   # فقط اگر داده‌ای بود
fi
# و در شمارش:
WIPE_COUNT=$removed_real_data     # بدون کش‌ها
```

---

### 🟠 B2 — دادهٔ flatpak هرگز پاک نمی‌شود و به‌جایش هشدار ترسناک می‌دهد

```
[ !! ] refused to delete (safety guard): /home/user/var/app/com.windscribe.Windscribe
```

دو خطا روی هم:

* مسیر واقعی flatpak `~/.var/app/...` است (با نقطه)، ولی `USER_EXTRA_REL` نوشته
  `var/app/...` ⇒ مسیر واقعی اصلاً بررسی نمی‌شود.
* حتی اگر اصلاح شود، `home_path_allowed()` ردش می‌کند: `.var` در لیست
  `first` نیست، و شرطِ کامپوننت `case ... in windscribe*)` است — یعنی کامپوننت باید
  **با** windscribe شروع شود، در حالی که نامش `com.windscribe.Windscribe` است.

**اصلاح:**

```bash
readonly USER_EXTRA_REL=(
  snap/windscribe
  .var/app/com.windscribe.Windscribe
  .var/app/com.windscribe.Windscribe2
)
# home_path_allowed:
case "$first" in .config|.cache|.local|.var|snap|var|.kde|.kde4|.gnome) ;; *) return 1 ;; esac
case "$(lower "$comp")" in *windscribe*) hit=1; break ;; esac   # به‌جای windscribe*
```

---

### 🟠 B3 — وقتی guard جلوی حذف را می‌گیرد، گزارش نهایی **دروغ** می‌گوید

اگر پوشهٔ اسکن همان خانهٔ کاربر باشد (`--dir ~`، یا `XDG_DOWNLOAD_DIR=$HOME`)، guard
درست عمل می‌کند و همه‌چیز را رد می‌کند — ولی خلاصه ادعای پاکی می‌کند:

```
[ !! ] refused to delete (safety guard): /home/user/.config/Windscribe
    0 location(s) removed for 1 user account(s)
[ OK ] no per-user Windscribe data left      <-- دروغ: توکن لاگین هنوز روی دیسک است
```

**اصلاح:** شمارندهٔ `REFUSED` اضافه کن؛ اگر `>0` بود، به‌جای `[ OK ]` هشدار بده و
کد خروج را غیرصفر کن.

---

### 🟠 B4 — بعد از نصب موفق، اسکریپت «کرش» می‌کند اگر فایل deb تغییر کرده باشد

`check_deb_untouched` در حالت اختلاف `return 1` می‌دهد و چون بدون `|| true` صدا زده
می‌شود، `set -Eeuo pipefail` + تله ERR فعال می‌شود:

```
[ !! ] the .deb changed while this script ran (size 6 -> 20)
[ERROR] Unexpected failure at line 13 - aborting.
EXIT=1
```

یعنی نصب **موفق** بوده ولی کاربر پیام کرش می‌بیند و خلاصهٔ نهایی اصلاً چاپ نمی‌شود.
کافی است مرورگر همان لحظه فایل را دوباره دانلود کند تا این اتفاق بیفتد.
**اصلاح:** `check_deb_untouched || true` در هر سه جای صدازدن.

---

### 🟡 B5 — هشدار «نصب ناقص» روی یک نصب کاملاً سالمِ واقعی

`ESSENTIAL_ARTEFACTS` مسیر `/usr/lib/systemd/system/windscribe-helper.service` را
الزامی کرده، در حالی که بستهٔ واقعی ویندسکرایب یونیت را در
`/etc/systemd/system/` می‌گذارد (لاگ نصب واقعی کاربران:
`Created symlink /etc/systemd/system/multi-user.target.wants/windscribe-helper.service → /etc/systemd/system/windscribe-helper.service`).
همین‌طور `LAUNCHER_ICON_NAME=Windscribe.png` و `LAUNCHER_SYMLINK=/usr/bin/windscribe-cli`
فرض‌های تأییدنشده‌اند.

نتیجه: احتمال زیاد روی بستهٔ واقعی پیام
`Install incomplete: 1 of N artefacts missing (the .deb may be damaged)` می‌گیری،
در حالی که هیچ ایرادی نیست.

**اصلاح:** تو همین حالا **همهٔ** مسیرهای payload را از خود deb می‌گیری؛ همان کافی
است. لیست ثابت را یا حذف کن یا به «اگر در payload بود، وجودش را چک کن» تبدیل کن:

```bash
for p in "${ESSENTIAL_ARTEFACTS[@]}"; do
  grep -q " \.${p}\$" "$DEB_CONTENTS" || continue     # این بیلد اصلاً آن را ندارد
  ...
done
```

---

### 🟡 B6 — فایل خرابِ «جدیدترین» ⇒ هیچ نصبی، حتی وقتی نسخهٔ سالم موجود است

پوشه: `good-2.10.10.deb` (سالم) + `windscribe_2.20.0_amd64.deb` (ناقص، فقط data
member خراب). اسکریپت 2.20.0 را برنده اعلام می‌کند، بعد در اعتبارسنجی `die` می‌کند و
**سراغ کاندیدای بعدی نمی‌رود**:

```
[ OK ] Selected: windscribe 2.20.0 ...
[ !! ] data archive is truncated or corrupt ...
[ERROR] Refusing to continue: the selected .deb is not usable
```

امن هست (چیزی حذف نشد ✅)، ولی مفید نیست. ضمناً در `--list` همان فایل خراب با
علامت `>` و بدون هیچ هشداری «eligible» نشان داده می‌شود، چون probe فقط control را
می‌خواند.

**اصلاح:** حلقهٔ fallback روی کاندیداها به ترتیب نسخه + در `--list` یک ستون
«integrity» (حداقل برای برنده).

---

### 🟡 B7 — `--dry-run` نمایندهٔ اجرای واقعی نیست

دو اختلاف اندازه‌گیری‌شده:

1. اعتبارسنجی deb در dry-run **رد می‌شود** (`would validate the .deb`) — با اینکه
   کاملاً read-only است. نتیجه: dry-run روی یک فایل خراب، مسیر کاملاً موفق نشان می‌دهد.
   دقیقاً برعکس کاری که کاربر از dry-run می‌خواهد.
2. `flow_dry_run` مرحلهٔ `apt-get autoremove --purge` را نشان می‌دهد، ولی مسیر واقعیِ
   `flow_update`/`flow_install_fresh` هرگز autoremove را اجرا نمی‌کند (فقط `--remove` می‌کند).

---

### 🟡 B8 — انتظار برای قفل apt وابسته به یک ابزار «اختیاری» است

```bash
wait_for_apt_lock() { if ! have fuser; then return 0; fi   # ← بی‌صدا هیچ کاری نمی‌کند
```

`fuser` از بستهٔ `psmisc` می‌آید که روی خیلی از نصب‌های مینیمال نیست (روی همین
ماشین تست نبود). پس «تضمین ۵» عملاً وجود ندارد. تست همزمانیِ دو اجرا:

```
E: Could not get lock /var/lib/dpkg/lock-frontend. It is held by process 14942 (apt-get)
```

فقط به‌لطف مسیر retry جان سالم به‌در برد. **اصلاح:** `flock` روی
`/var/lib/dpkg/lock-frontend` (یا حداقل `apt-get -o DPkg::Lock::Timeout=300`) و یک
قفل اختصاصی برای خود اسکریپت:

```bash
exec 9>/run/windscribe-manager.lock; flock -n 9 || die "یک نسخهٔ دیگر در حال اجراست"
```

---

### 🟡 B9 — بدون `runuser`، دستورهای «به نام کاربر» با **root** اجرا می‌شوند

```
runuser MISSING
  as_user_out id -u => 0        # یعنی root، با HOME=/home/user
```

در این حالت `gsettings set ...` و `update-desktop-database ~/.local/share/applications`
با root ولی با HOME کاربر اجرا می‌شوند ⇒ ساخت فایل‌های **root-owned** داخل
`~/.config/dconf` و `~/.local/share/applications` که بعداً دسکتاپ کاربر را خراب می‌کند.
(روی Debian معمولاً `runuser` هست — ولی چون در `/usr/sbin` است، در اجرای بدون root
اصلاً پیدا نمی‌شود و همین باعث شد در `--list` جزو «ابزارهای غایب» فهرست شود.)

**اصلاح:** fallback به `sudo -u "$REAL_USER"` / `setpriv`، و اگر هیچ‌کدام نبود
**کاری نکن** به‌جای اجرای با root.

---

### 🔵 موارد کوچک‌تر

| # | مورد |
|---|---|
| B10 | `MAX_PROBE_FILES=400` **قبل از** رتبه‌بندی بریده می‌شود: با ۴۱۱ فایل، جدیدترین نسخه (2.13.0، الفبایی آخر) نادیده گرفته شد و 2.10.10 انتخاب شد |
| B11 | `/dev/tty` — تست `[[ -r /dev/tty ]]` وقتی ترمینال کنترلی نیست هم true است ⇒ دو خط خطای خام `bash: /dev/tty: No such device or address` روی خروجی. با `[[ -t 0 ]]` یا `exec 3<>/dev/tty` تست کن |
| B12 | حذف تکراری‌ها «نمایندهٔ» hardlink را الفبایی انتخاب می‌کند: در جدول `hardlink-copy.deb` نشان داده شد و نام واقعیِ `windscribe_2.10.10_amd64.deb` اصلاً دیده نشد |
| B13 | راهنما می‌گوید «`--` پایان گزینه‌هاست؛ بعدش آرگومان است» ولی هر آرگومانی بعد از `--` خطای مرگبار می‌دهد ⇒ `--` بی‌فایده است |
| B14 | با `--keep-keyring` خلاصه همچنان می‌نویسد `keyring secrets : 0 removed` (باید بنویسد «نگه داشته شد») |
| B15 | آرشیوهای `/var/backups/windscribe-manager/` هرگز چرخش/پاک‌سازی نمی‌شوند (در تست من ۶ آرشیو انباشته شد) و **توکن لاگین را به‌صورت متن خام** نگه می‌دارند. حداقل: نگه‌داشتن N آرشیو آخر + هشدار در راهنما |
| B16 | فایل `plasma-...-appletsrc.wsm-bak` برای همیشه در `~/.config` می‌ماند (هر اجرا بازنویسی، هیچ‌وقت پاک نمی‌شود) |
| B17 | در حالت `--remove` هیچ‌وقت `record_deb_identity` معنا ندارد (اسکنی نشده)، ولی خلاصه با اطمینان می‌گوید «فایل deb دست‌نخورده ماند» بدون هیچ اثباتی |

---

## ۴. نقد طراحی (فراتر از باگ)

**۴٫۱ `guard_path` آن چیزی نیست که کامنتش می‌گوید.**
کامنت: «فقط برای مسیری 0 برمی‌گرداند که اثباتاً حذفش امن است». تست واحد نشان داد:

```
ok allow /etc/passwd
ok allow /usr/share/applications/firefox.desktop
```

یعنی guard صرفاً «فاجعه‌بار نیست» را چک می‌کند، نه «مالِ ویندسکرایب است». تنها چیزی
که واقعاً محافظت می‌کند `path_is_ours()` و لیست‌های ثابت‌اند — و در `sweep_owned_files`
برای فایل‌ها `path_is_ours` **اصلاً صدا زده نمی‌شود** (به `dpkg -L` اعتماد می‌شود).
پس یک بستهٔ جعلی به نام `windscribe` که ادعای مالکیت `/etc/...` کند، باعث حذف آن
فایل‌ها می‌شود. پیشنهاد: در sweep هم شرط «یا زیر `/opt/windscribe` است یا
`path_is_ours`» را اضافه کن، و کامنت را واقع‌گرایانه بنویس.

**۴٫۲ پیش‌فرضِ «فراموشی» برای یک ابزار به‌روزرسانی تهاجمی است.**
`sudo ./windscribe-manager.sh` بدون هیچ پرسشی لاگین و تنظیمات را پاک می‌کند — نه
فقط کاربر جاری، بلکه **همهٔ کاربران ماشین و root**. برای «به‌روزرسانی خودکار»
(چیزی که راهنمای فارسی به‌عنوان دستور همیشگی معرفی می‌کند) پیش‌فرض بهتر
`--keep-user-data` است و پاک‌سازی باید صریح (`--forget`) باشد.

**۴٫۳ نبودِ قفل، با ادعای «stateless و امن برای اجرای مجدد» جمع نمی‌شود.**
دو اجرای همزمان واقعاً به هم خوردند (بالا). یک `flock` سه‌خطی کافی است.

**۴٫۴ ۲۰۰۰ خط برای این کار زیاد است.**
منطق واقعی شاید ۴۰۰ خط باشد؛ بقیه کامنت‌های تضمین‌محور و لیست‌های ثابت است — و
همین لیست‌های ثابت منبع B1/B2/B5 شدند. پیشنهاد عملی: (۱) هر چیزی که می‌شود از
`dpkg -L` و payload خود deb گرفت، از آنجا بگیر؛ (۲) لیست ثابت را فقط برای چیزهایی
نگه دار که dpkg نمی‌داند؛ (۳) `shellcheck` را در CI بگذار (اینجا در دسترس نبود ولی
چند مورد مثل `local -n` و گلاب‌های تودرتو ارزش بررسی دارند)؛ (۴) همین سناریوهای
تست را به‌صورت اسکریپت نگه دار — نسخهٔ اجرایی‌اش را کنار همین گزارش گذاشته‌ام.

**۴٫۵ چیزی که خیلی خوب بود.**
اثبات sha256 فایل دانلود، ریدایرکت `Dir::Cache::archives`، توقف قبل از حذف روی فایل
خراب، بررسی محتوایی برای نام‌های مشکوک، ویرایش جراحی‌وار فایل KDE، و پیام‌های
دوزبانه — این‌ها بالاتر از سطح معمولِ اسکریپت‌های نصب/حذف هستند.

---

## ۵. اولویت اصلاح (اگر فقط وقت ۵ تغییر را داری)

1. **B1** — کش‌های برنامه‌های دیگر را پاک نکن (خطر واقعی از دست رفتن دادهٔ کاربر).
2. **B4** — `check_deb_untouched || true` (کرش دروغین بعد از نصب موفق).
3. **B3** — شمارش `refused` و گزارش صادقانه.
4. **B5** — `ESSENTIAL_ARTEFACTS` را از payload بگیر (هشدار کاذب روی بستهٔ واقعی).
5. **B2** — مسیر flatpak + الگوی `*windscribe*`.

---

## ۶. بازتولید تست‌ها

`windscribe-manager/test-harness.sh` — بسته‌های جعلی، طعمه‌ها و همهٔ سناریوها را
می‌سازد و اجرا می‌کند. فقط داخل یک ماشین/کانتینر یک‌بارمصرف اجرا شود:

```bash
sudo ./windscribe-manager/test-harness.sh /path/to/windscribe-manager.sh
```

نتیجهٔ اجرای فعلی روی نسخهٔ v3.0:

```
passed: 41   failed: 3
```

هر سه شکست، «کاوشگرِ باگ شناخته‌شده» در بخش ۷ هارنس‌اند:
`B1: unrelated plank cache kept`، `B1: gnome saved-session kept`،
`B2: flatpak data removed`. یعنی ۴۱ رفتار درست تأیید شد و دقیقاً همان دو باگی که
در بالا توضیح داده شد بازتولید می‌شوند.
