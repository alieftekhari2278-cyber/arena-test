# ابزار بازیابی آرشیو فیزیک (کنکور ۱۴۰۶)

پیاده‌سازی اجراییِ سند «راهنمای بازیابی کامل دانلودها». یک بار اجرا می‌کنید، کل آرشیو
(کتاب‌های درسی + امتحان نهایی فیزیک ۳ + کنکور تجربی) دوباره دانلود، راستی‌آزمایی و گزارش می‌شود.

## اجرا

```bash
bash tools/recover-archive/recover.sh              # اجرای کامل
bash tools/recover-archive/recover.sh --net-check  # فقط تست دسترسی به منابع (سریع)
bash tools/recover-archive/recover.sh --only books # فقط کتاب‌های درسی (بخش A)
bash tools/recover-archive/recover.sh --only nahayi
bash tools/recover-archive/recover.sh --only konkur
bash tools/recover-archive/recover.sh --verify-only # فقط راستی‌آزمایی فایل‌های موجود
bash tools/recover-archive/recover.sh --zip        # آرشیو یکجای نهایی (ZIP، رمز: www.konkur.in)
bash tools/recover-archive/recover.sh --dry-run    # فقط نمایش آدرس‌ها، بدون دانلود
```

مسیر ذخیره به ترتیب انتخاب می‌شود:

1. متغیر محیطی `DL_DIR` (اگر تعیین شود)
2. `/home/z/my-project/download` (مسیر رسمی سند)
3. `download/` کنار همین مخزن (وقتی مسیر بالا ساخته نشود)

```bash
DL_DIR=~/download bash tools/recover-archive/recover.sh
```

اگر شبکه‌تان به سایت‌های مرجع دسترسی ندارد (خطای `000`)، پراکسی بدهید:

```bash
export HTTPS_PROXY=socks5h://127.0.0.1:1080
export HTTP_PROXY="$HTTPS_PROXY"
bash tools/recover-archive/recover.sh
```

## ویژگی‌ها

- **ادامه‌پذیر:** فایل سالمِ موجود دوباره دانلود نمی‌شود؛ هر بار اجرا فقط کمبودها را می‌گیرد.
- **زنجیره جایگزین (بخش E سند):** تلاش مستقیم → تکرار با تأخیر → جابه‌جایی http/https → آینه
  (مثل physicfa برای فیزیک ۱ دهم) → Wayback Machine (`id_` برای بایت خام) → درخواست ثبت نسخه تازه.
- **راستی‌آزمایی (بخش F سند):** هدر `%PDF-`، حداقل حجم، شمار صفحه در برابر جدول، کد کتاب روی
  شناسنامه (`11xxxx`)، و بررسی عنوان «فیزیک» در صفحه اول برگه‌های امتحانی.
- **نام‌گذاری فارسی:** `خرداد-1404-فیزیک3-تجربی.pdf`، `کنکور-1405-تجربی-دفترچه.pdf` و …
- **گزارش فارسی:** `گزارش-بازیابی.md` + `manifest.tsv` در ریشه پوشه دانلود.

## پیش‌نیازها

- `curl`, `bash`, `python3`
- اختیاری ولی توصیه‌شده: `poppler-utils` (برای `pdfinfo`/`pdftotext`)

```bash
sudo apt install -y poppler-utils        # دبیان/اوبونتو
pip install pypdf                        # جایگزین شمارش صفحه اگر poppler نبود
```

بدون poppler هم کار می‌کند: شمارش صفحه با `pypdf` و در نهایت تخمین از ساختار فایل انجام می‌شود،
ولی بررسی «کد کتاب روی شناسنامه» غیرفعال می‌ماند.

## فایل‌های داده (قابل ویرایش بدون دست‌زدن به کد)

| فایل | محتوا |
|---|---|
| `data/books.tsv` | ۱۴ ردیف کتاب درسی: کد کتاب، سال تحصیلی، کد دسته، نام فارسی مقصد، شمار صفحه، سال چاپ، آینه |
| `data/nahayi-fizik3.tsv` | ۴۴ لینک راستی‌آزمایی‌شده نهایی فیزیک ۳ (۲۲ تجربی + ۲۲ ریاضی) |
| `data/konkur-pages.tsv` | ۹ صفحه کنکور تجربی ۱۴۰۰–۱۴۰۵ |
| `data/nahayi-other-subjects.tsv` | بخش D سند: شناسه صفحه نهاییِ درس‌های دیگر برای گسترش بعدی |

فایل تیر ۱۴۰۵ در فهرست ثابت نیست و به‌صورت زنده از صفحه `konkur.in/124927` استخراج می‌شود
(همین‌طور هر امتحان تازه‌ای که بعداً به صفحه ۸۹۶۹۱ اضافه شود).

## آزمون

```bash
bash tools/recover-archive/selftest.sh
```

۱۶ آزمون آفلاین (سرور محلی + PDF ساختگی) که منطق دانلود، رد فایل خراب، شمارش صفحه،
استخراج لینک و نام‌گذاری فارسی را می‌سنجد — بدون نیاز به اینترنت.

## اجرا روی GitHub Actions (اختیاری)

اگر شبکه محلی‌تان دسترسی ندارد، فایل `github-workflow.yml.sample` را در مسیر
`.github/workflows/recover-archive.yml` کپی کنید و از تب Actions اجرا بگیرید؛ خروجی به‌صورت
artifact قابل دانلود است. توجه: Runnerهای گیت‌هاب خارج از ایران هستند و ممکن است خودشان به
`chap.sch.ir` دسترسی نداشته باشند — اولین گام همان workflow یک جدول دسترسی چاپ می‌کند.
