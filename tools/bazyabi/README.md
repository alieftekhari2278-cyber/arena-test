# 🔄 `bazyabi` — بازیابی خودکار آرشیو فیزیک کنکور ۱۴۰۶

پیاده‌سازی اجراییِ [راهنمای بازیابی همه دانلودها](../../docs/راهنمای-بازیابی-همه-دانلودها.md).
هدف: بازگرداندن **۹۶ فایل PDF** (کتاب‌های درسی + امتحان نهایی فیزیک ۳ + کنکور تجربی ۱۴۰۰–۱۴۰۵)
با تلاش مجدد، آینه‌ها، Wayback و راستی‌آزمایی خودکار.

## ⚡ ساده‌ترین راه: نسخهٔ تک‌فایلی پایتون (ویندوز / مک / لینوکس)

فقط پایتون ۳.۸ به بالا لازم است — هیچ نصبی، هیچ کتابخانه‌ای، bash هم لازم نیست:

```bash
python bazyabi.py                      # همه‌چیز (بخش‌های A تا G)
python bazyabi.py --root "D:\download" # تعیین مسیر ذخیره
python bazyabi.py kotob                # فقط کتاب‌های درسی
python bazyabi.py verify               # فقط راستی‌آزمایی
```

خروجی، ساختار پوشه و نام‌های فارسی دقیقاً مثل نسخهٔ bash است (با تست تطابق تضمین شده).
اگر `pip install pypdf` کرده باشید، شمار صفحه‌ها هم با جدول بخش A مقایسه می‌شود.

## اجرا (نسخهٔ bash)

```bash
# بازیابی کامل (گام‌های ۱ تا ۶ بخش G راهنما)
tools/bazyabi/bazyabi.sh all

# فقط یک بخش
tools/bazyabi/bazyabi.sh kotob     # کتاب‌های درسی (بخش A)
tools/bazyabi/bazyabi.sh nahayi    # امتحان نهایی فیزیک ۳ (بخش B)
tools/bazyabi/bazyabi.sh konkur    # کنکور تجربی (بخش C)

# بررسی سلامت آرشیو موجود و گزارش
tools/bazyabi/bazyabi.sh verify
tools/bazyabi/bazyabi.sh report
```

## متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `DOWNLOAD_ROOT` | `/home/z/my-project/download` | ریشهٔ ذخیره‌سازی |
| `DRY_RUN` | `0` | `1` = فقط نمایش کارها بدون دانلود |
| `USE_WAYBACK` | `1` | `0` = خاموش‌کردن fallback آرشیو اینترنت |
| `TRIES` | `3` | تعداد تلاش مجدد هر لینک (با تأخیر پلکانی) |
| `MIN_SIZE` | `51200` | حداقل حجم قابل‌قبول PDF (بخش F) |
| `CHAP_BASE` / `KONKUR_BASE` | آدرس‌های اصلی | برای تست یا آینه قابل تغییر |

## زنجیرهٔ مقاومت در برابر خطا (بخش E راهنما)

برای هر فایل به‌ترتیب امتحان می‌شود:

1. لینک اصلی، تا `TRIES` بار با تأخیر پلکانی (۱۰، ۲۰، ۳۰ ثانیه)
2. آینه‌های تعریف‌شده در `data/mirrors.tsv` (مثلاً فیزیک ۱ دهم از physicfa.ir)
3. نسخهٔ آرشیوشده در Wayback (`.../web/{timestamp}id_/{URL}` — بایت خام PDF)
4. درخواست ثبت نسخهٔ تازه (`web.archive.org/save/{URL}`)

فایل فقط وقتی پذیرفته می‌شود که هدرش `%PDF-` باشد؛ دانلود ناقص در `*.part` می‌ماند و حذف می‌شود.
اجرای دوباره **ازسرگیری** است: فایل‌های سالمِ موجود دوباره دانلود نمی‌شوند.

## راستی‌آزمایی (بخش F راهنما)

| بررسی | ابزار | رفتار در نبود ابزار |
|---|---|---|
| هدر `%PDF-` و حجم | `head`, `wc` | همیشه فعال |
| شمار صفحه vs جدول | `pdfinfo` | fallback به `pypdf`، سپس شمارش خام `/Type /Page` |
| کد شناسنامهٔ کتاب | `pdftotext` | در نبودش رد می‌شود (هشدار نمی‌دهد) |

برای بررسی کامل نصب توصیه می‌شود: `sudo apt install poppler-utils` (یا `pip install pypdf`).

## ساختار

```text
tools/bazyabi/
├── bazyabi.sh              # نقطهٔ ورود، دستورهای all/kotob/nahayi/konkur/verify/report
├── lib/common.sh           # دانلود مقاوم، Wayback، راستی‌آزمایی، نام‌گذاری فارسی
├── data/kotob.tsv          # ۱۴ کتاب: کد، دسته، نام مقصد، صفحات، سال چاپ
├── data/konkur-pages.tsv   # ۹ صفحهٔ کنکور
├── data/nahayi-pages.tsv   # صفحهٔ فیزیک ۳ + ۷ درس دیگر برای گسترش (بخش D)
├── data/mirrors.tsv        # آینه‌های جایگزین
└── tests/                  # تست آفلاین با سرور ماک
```

## تست

بدون نیاز به اینترنت، با سرور ماک محلی:

```bash
bash tools/bazyabi/tests/run_tests.sh
```

تست‌ها پوشش می‌دهند: شمار فایل هر دسته، نام‌گذاری فارسی ماه/سال/رشته،
سقف ۲ فایل تشریحی در هر دورهٔ کنکور، تشخیص فایل خراب، گزارش TSV و حالت `DRY_RUN`.

## 🚀 دانلود از راه GitHub Actions (وقتی شبکهٔ محلی بسته است)

رانرهای GitHub اینترنت آزاد دارند. اگر محیط شما به `chap.sch.ir` / `konkur.in` نمی‌رسد،
بگذارید رانر دانلود کند و نتیجه را از GitHub بردارید:

**۱) فعال‌سازی workflow** (یک‌بار — عامل Arena مجوز ساخت workflow ندارد):

```bash
mkdir -p .github/workflows
cp docs/ci/bazyabi-download.yml .github/workflows/bazyabi-download.yml
git add .github/workflows && git commit -m "افزودن workflow بازیابی" && git push
```

> `workflow_dispatch` فقط وقتی در تب Actions دیده می‌شود که فایل روی **شاخهٔ پیش‌فرض (main)** باشد.

**۲) اجرا:** تب **Actions** ← «بازیابی آرشیو» ← **Run workflow**
— بار اول با گزینهٔ `probe` (حدود ۳۰ ثانیه) تا مطمئن شوید رانر به منابع می‌رسد، بعد با `all`.

**۳) برداشت نتیجه:** خروجی هم `artifact` است و هم روی شاخهٔ `archive/pdf` push می‌شود:

```bash
tools/bazyabi/fetch-archive.sh          # شاخه archive/pdf را می‌گیرد و در DOWNLOAD_ROOT می‌چیند
```

شاخهٔ `archive/pdf` با `git clone --depth 1` برداشت می‌شود، پس در محیط‌هایی که فقط
`github.com` برایشان باز است هم کار می‌کند (برخلاف artifactها که از
`objects.githubusercontent.com` سرو می‌شوند).

## محدودیت شناخته‌شده

اگر شبکه به `chap.sch.ir` / `konkur.in` دسترسی نداشته باشد (فیلترینگ یا allowlist)،
هیچ‌کدام از مسیرها جواب نمی‌دهد. در آن حالت اسکریپت به‌درستی «ناموفق» گزارش می‌دهد
و چیزی از خود نمی‌سازد — اسکریپت را روی شبکه‌ای با دسترسی اجرا کنید.

## CI

تعریف workflow در `docs/ci/tests.yml` آماده است (shellcheck + تست آفلاین).
برای فعال‌سازی:

```bash
mkdir -p .github/workflows && cp docs/ci/tests.yml .github/workflows/tests.yml
```
