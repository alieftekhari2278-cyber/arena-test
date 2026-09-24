# مغز مگس اسکن‌شده: از میکروسکوپ الکترونی تا محیط دوبعدی — و چطور می‌توان همین‌جا در این چت اجرایش کرد

> گزارش تحقیق عمیق | تهیه‌شده در چت Arena | سپتامبر ۲۰۲۶

---

## خلاصه اجرایی (TL;DR)

در اکتبر ۲۰۲۴ کنسرسیوم **FlyWire** نقشه‌ی کامل مغز یک مگس میوه‌ی ماده (*Drosophila melanogaster*) را منتشر کرد: **~۱۴۰٬۰۰۰ نورون و بیش از ۵۴٫۵ میلیون سیناپس** [1](https://www.nih.gov/news-events/nih-research-matters/complete-wiring-map-adult-fruit-fly-brain). در همان سال Philip Shiu و همکاران نشان دادند با فقط ۴ چیز — گراف اتصالات، وزن = تعداد سیناپس‌ها، نقشه‌ی تحریکی/مهاری نورون‌ها، و مدل ساده‌ی **LIF** (Leaky Integrate-and-Fire) — می‌توان کل مغز را در کامپیوتر «زنده» کرد و رفتار حرکتی واقعی مگس را با دقت ۹۵٪ پیش‌بینی کرد [2](https://github.com/Kisame76/drosophila-brain-mlx). در مارس ۲۰۲۶ شرکت **Eon Systems** حلقه را بست: مغز شبیه‌سازی‌شده را به بدن فیزیکی مجازی (MuJoCo / NeuroMechFly) وصل کرد و رفتارهایی مثل راه‌رفتن، پاک‌سازی (grooming) و تغذیه **بدون هیچ آموزشی** ظهور کردند [4](https://eon.systems/updates/weve-uploaded-a-fruit-fly). موج دیگری از پروژه‌های مردمی هم این مغز را به Super Mario 64، Doom، Minecraft، بازی Dino، بازار بیت‌کوین و حتی پهپاد واقعی وصل کرده‌اند [3](https://github.com/townie/awesome-fruit-fly) — از جمله آرناهای دوبعدیِ «مگس دنبال شکر می‌گردد» [3](https://github.com/kris072008/firefly-brain).

**نتیجه‌ی بخش امکان‌سنجی من (تست‌شده، نه حدسی):** ✅ من می‌توانم مغز کامل مگس را با **تمام ۱۳۸٬۶۳۹ نورون و تمام ۱۵٬۰۹۱٬۹۸۳ اتصال (۵۴٬۴۹۲٬۹۲۲ سیناپس)** — بدون حذف حتی یک نورون — در همین چت دانلود کنم (۶ ثانیه!)، در ۱۲۱ مگابایت رم بارگذاری کنم و با موتور LIF واقعی Shiu روی داده‌ی واقعی اجرا کنم؛ سرعت اندازه‌گیری‌شده: **۱٬۰۵۹ گام شبیه‌سازی در ثانیه** (۲۰۰ میلی‌ثانیه‌ی زمان زیست‌شناختی در ۱٫۹ ثانیه). کافیست یک آرنای دوبعدی HTML5 Canvas + WebSocket به آن وصل کنم تا «مگس دیجیتال» همین‌جا در پیش‌نمایش زنده‌ی چت راه برود. جزئیات کامل در بخش ۴.

---

## بخش ۱ — مغز اسکن‌شده: بزرگ‌ترین نقشه‌ی عصبی تاریخ چطور ساخته شد

### ۱.۱ روش اسکن

مغز مگس میوه قطریدی در حدود ۱ میلی‌متر دارد. تیم FlyWire (با رهبری Mala Murthy و Sebastian Seung در پرینستون و همکاری ۱۲۷ مؤسسه) مغز یک مگس ماده را ثابت‌سازی کرد، به برش‌های فوق‌نازک **۴۰ نانومتری** برید — بیش از **۷٬۰۵۰ برش** — و هر برش را با میکروسکوپ الکترونی عبوری (TEM) تصویربرداری کرد؛ حجم داده‌ی خام حدود **۱۰۰ ترابایت** بود (تقریباً معادل حافظه‌ی ۱۰۰ لپ‌تاپ) [2](https://www.dongascience.com/en/news/78380). سپس هوش مصنوعی تصاویر را کنار هم چید و بازسازی سه‌بعدی نورون‌ها را تولید کرد، و صدها پژوهشگر — از جمله دانشمندان شهروند — پیش‌نویس را «proofread» کردند تا خطاهای قطعه‌بندی حذف شود [2](https://www.dongascience.com/en/news/78380).

خروجی این فرایند یعنی **کانکتوم**: فهرست کامل تمام نورون‌ها (با شناسه، نوع سلولی، مکان) و تمام اتصالات سیناپسی بین آن‌ها (چه کسی به چه کسی، چند سیناپس، در کدام ناحیه‌ی مغز، با چه انتقال‌دهنده‌ی عصبی احتمالی).

### ۱.۲ اعداد کلیدی FlyWire (انتشار Nature، اکتبر ۲۰۲۴)

| کمیت | مقدار |
|---|---|
| نورون‌ها | ~۱۴۰٬۰۰۰ (نسخه‌ی عمومی ۷۸۳: **۱۳۸٬۶۳۹ نورون proofread** — عددی که خودم در داده‌ها تأیید کردم) |
| سیناپس‌ها | **۵۴٫۵ میلیون** (من در داده‌ی خام ۵۴٬۴۹۲٬۹۲۲ تا شمردم) |
| انواع سلولی | ۸٬۴۵۳ نوع (از جمله ۴٬۵۸۱ نوع تازه‌کشف‌شده) |
| مقالات هم‌زمان | ۹ مقاله در Nature [3](https://www.nature.com/nature/volumes/634/issues/8032) |
| نکته‌ی جالب | ~۸۵٪ نورون‌ها «درونی» هستند — فقط با نورون‌های دیگر مغز سیناپس می‌سازند [1](https://www.nih.gov/news-events/nih-research-matters/complete-wiring-map-adult-fruit-fly-brain) |

ناحیه‌ی **SEZ** (زیرمری) که تقریباً تمام سیگنال‌های خروجی به سمت نورون‌های حرکتی را می‌فرستد، یکی از کشف‌های مهم این نقشه بود [1](https://www.nih.gov/news-events/nih-research-matters/complete-wiring-map-adult-fruit-fly-brain).

### ۱.۳ خانواده‌ی کامل کانکتوم‌های مگس

| کانکتوم | سال | جنس/دامنه | نورون | سیناپس | نکته |
|---|---|---|---|---|---|
| hemibrain (Janelia) | ۲۰۲۰ | ماده، نیم‌مغز | ~۲۵ هزار | ~۲۰ میلیون | اولین قطعه‌ی بزرگ [4](https://elifesciences.org/articles/62362) |
| MANC (Janelia) | ۲۰۲۳ | نر، فقط طناب عصبی (VNC) | ~۲۳ هزار | ۱۰ میلیون TBar | «نخاعِ» مگس [3](https://www.janelia.org/project-team/flyem/manc-connectome) |
| **FAFB / FlyWire** | **۲۰۲۴** | **ماده، کل مغز** | **~۱۴۰ هزار** | **۵۴٫۵ میلیون** | اولین مغز کامل حیوان بینا و راه‌رو [2](https://www.dongascience.com/en/news/78380) |
| BANC (Lee lab) | ۲۰۲۵ | ماده، مغز + طناب عصبی | ~۱۱۴ هزار | ~۱۰۸ میلیون | بدون لایه‌ی اول بینایی (لامینا و شبکیه) [2](https://github.com/sjcabs/fly_connectome_data_tutorial) |
| **MaleCNS (Janelia+Google)** | **۲۰۲۶ (Cell)** | **نر، کل سیستم عصبی مرکزی** | **۱۶۶٬۷۰۰** | **۱۲۵ میلیون** | شامل VNC و **نورون‌های حرکتی واقعی**! [1](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/) [5](https://www.cell.com/cell/fulltext/S0092-8674(26)00942-6) |

نکته‌ی مهم برای پروژه‌ی ما: کانکتوم FlyWire فقط «مغز» را دارد، نه بدن و طناب عصبی را — یعنی **نورون‌های حرکتی (motor neurons) نهایی داخلش نیستند** و باید از فعالیت «نورون‌های نزولی» (Descending Neurons) به حرکت رسید؛ این دقیقاً همان کاری است که Eon کرد [4](https://eon.systems/updates/weve-uploaded-a-fruit-fly). MaleCNS (سپتامبر ۲۰۲۶) این حلقه را کامل‌تر می‌کند چون تا خود نورون‌های حرکتی را دارد [1](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/).

---

## بخش ۲ — چطور از نقشه استفاده کردند و به محیط وصلش کردند

### ۲.۱ قدم اول: زنده‌کردن مغز بدون بدن — مدل Shiu et al. (Nature 2024)

Philip Shiu و همکاران ساده‌ترین کار ممکن را کردند و شگفت‌آور بود که کار کرد: کل مغز را به‌صورت شبکه‌ی **Leaky Integrate-and-Fire** با همان سیم‌کشی واقعی اجرا کردند. نسخه‌ی منتشرشده: **۱۲۷٬۴۰۰ نورون و ۱۴٬۶۸۷٬۱۷۸ اتصال جهت‌دار** از FlyWire v630 [2](https://github.com/Kisame76/drosophila-brain-mlx). مدل در Brian2 نوشته شده و کد + داده‌ی کاملش آزاد است [1](https://github.com/philshiu/Drosophila_brain_model).

دستور پخت (فقط ۴ ماده) — همان چیزی که Eon هم تأیید کرد [4](https://eon.systems/updates/weve-uploaded-a-fruit-fly):

1. **گراف اتصالات** (چه کسی به چه کسی وصل است)
2. **وزن هر اتصال = تعداد سیناپس‌های بین دو نورون**
3. **علامت هر نورون** از انتقال‌دهنده‌ی عصبی پیش‌بینی‌شده: استیل‌کولین، دوپامین، سروتونین و اکتوپامین → تحریکی؛ GABA و گلوتامات → مهاری [3](https://github.com/kris072008/firefly-brain)
4. **دینامیک LIF**: `dv/dt = (v₀ − v + g)/τ_mbr` با ثابت‌های زیست‌شناختی از ادبیات (τ_mbr=20ms، آستانه −45mV، ریست −52mV، دوره‌ی تحریم 2.2ms، تأخیر آکسونی 1.8ms، وزن هر سیناپس 0.275mV) [3](https://github.com/kris072008/firefly-brain)

ورودی حسایی به‌صورت spike های پواسونی (۱۵۰ هرتز) به نورون‌های حسی تزریق می‌شود و خروجی، الگوی اسپایک کل مغز است. نتیجه‌ی معروف: تحریک **۲۱ نورون قندی‌چشای** راست → فعال‌شدن **MN9**، نورون حرکتی واقعی «بیرون‌آوردن خرطوم برای خوردن» — یک رفلکس واقعی مگس که صرفاً از سیم‌کشی بیرون آمد [4](https://github.com/Simpbuilder/FlyBrain). این مدل رفتار حرکتی واقعی را با دقت **۹۵٪** پیش‌بینی کرد [2](https://www.finallyoffline.com/article/eon-systems-creates-first-walking-digital-brain-with-140000-neurons-mmibitch).

### ۲.۲ قدم دوم: وصل‌کردن مغز به بدن — Eon Systems (مارس ۲۰۲۶)

استارتاپ Eon Systems مدل Shiu را به یک بدن فیزیکی شبیه‌سازی‌شده در موتور **MuJoCo** (مبتنی بر بدن **NeuroMechFly** با ۸۷ مفصل) وصل کرد و حلقه بسته شد [5](https://www.xrom.in/post/inside-the-digital-fly-eon-s-embodied-brain-simulation-explained):

```
محیط مجازی → گیرنده‌های حسی (چشم/چشا/لمس) → مغزِ کانکتومی (LIF)
     ↑                                                      ↓
   بدن MuJoCo ← کنترلرها ← نورون‌های نزولی (DN) ← فعالیت عصبی
```

رفتارهای **راه‌رفتن، grooming و تغذیه** بدون هیچ آموزش/رینفورسمنت‌لرنینگی ظهور کردند و ادعای ۹۱٪ دقت رفتاری مطرح شد [4](https://eon.systems/updates/weve-uploaded-a-fruit-fly). ویدیوی آن وایرال شد («مگسی که هر متولد نشده در حال راه‌رفتن است») [3](https://x.com/oh_that_hat/status/2030383547832533378). محدودیت‌های صادقانه که خود Eon و تحلیلگران اعلام کردند:

- نورون‌های حرکتی واقعی در FlyWire نیستند (بدن اسکن نشده)؛ فعالیت DN ها به کنترلر بدن نگاشت شده — فقط برخی DN ها مثل DNa01، DNa02، aDN1، oDN1 و giant fiber [3](https://www.startbase.com/news/startup-eon-systems-demonstriert-erste-multi-verhaltensfaehige-gehirn-emulation/)
- LIF هیچ قاعده‌ی انعطاف‌پذیری/یادگیری ندارد — این مگس حافظه‌ی بلندمدت نمی‌سازد [4](https://eon.systems/updates/weve-uploaded-a-fruit-fly)
- تحلیل Patrick Mineault: در این شبیه‌سازی‌ها عملاً فقط چند صد تا ~۱۰۰۰ نورون به‌طور معنادار فعال می‌شوند، نه کل مغز؛ و خروجی بازی‌ها بیشتر «فرایند تصادفیِ هدایت‌شده با سیم‌کشی» است تا رفتار انطباقی [4](https://www.neuroai.science/p/are-flies-playing-beat-saber)

### ۲.۳ قدم سوم: موج MaleCNS و محیط‌های دوبعدی (۲۰۲۵–۲۰۲۶)

با انتشار MaleCNS (~۱۶۶٬۷۰۰ نورون شامل طناب عصبی) [1](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/) و آزادبودن داده‌ها، انفجاری از پروژه‌های «مغز مگس + محیط» ساخته شد [3](https://github.com/townie/awesome-fruit-fly). مستقیم‌ترین نمونه برای خواسته‌ی شما:

| پروژه | محیط | ورودی حسایی | خروجی حرکتی |
|---|---|---|---|
| **firefly-brain** [3](https://github.com/kris072008/firefly-brain) | **آرنای دوبعدی** با لبه‌های پیوسته؛ مگس دنبال شکر می‌گردد | ۱۲۹ نورون قندی + ۶۵ نورون تلخ‌چشا، ورودی پواسونی ۱۵۰Hz با تقسیم چپ/راست بر اساس جهت غذا | عدم‌تقارن نرخ آتش دو نورون نزولی **DNge059** → نرخ چرخش |
| Fly64 (SM64) [1](https://github.com/ornata/fly) | دنیای سه‌بعدی Super Mario 64 | ۶ دوربین مخفی → چشم مگس | DNg100→دوربین جلو، تفاضل DNa02/DNg13→فرمان، DNp01/DNp10→پرش |
| fly-escape / flyjump (بازی Dino) / fly-flappy [3](https://github.com/cobanov/awesome-fly) | دوبعدی (فرار از خانه، بازی Dino، Flappy Bird) | — | — |
| Fly Brain Minecraft [2](https://github.com/cobanov/awesome-fly) | ماینکرفت؛ کانکتوم MaleCNS برای هر مگسِ بازی | حس‌های مدل‌شده | خوانش حرکتی + HUD عصبی زنده |
| Stonkfly [3](https://digiato.com/cryptocurrency/fruit-fly-brain-model-trades-bitcoin-coinbase) | بازار بیت‌کوین (Coinbase) — ۱۶۶ هزار نورون | چارت قیمت | معامله |
| FlyDrones (★223) | دنیای واقعی! دوربین → چشم مگس → مغز اسپایکی → DN ها → کنترل پهپاد با دموی سه‌بعدی زنده در مرورگر | دوربین | فرمان پهپاد |
| FLY.LAB / FLYBOX [5](https://flyboxlab.vercel.app/) | **سندباکس دوبعدی تعاملی در مرورگر**: غذا بده، بترسان، مغزش را عوض کن | جمعیت‌های حسی نام‌دار | خوانش‌های حرکتی کانکتوم‌محور |
| fly-craftax [2](https://flybrain.info/projects/) | محیط بقای Craftax | — | خوانش DN با PPO آموزش‌دیده |
| flm [3](https://github.com/townie/awesome-fruit-fly) | گفتگو! مدل زبانی 1.2B فریز‌شده + کل کانکتوم MaleCNS | متن | توکن |

پوشش فارسی این موج هم منتشر شد: خبرگزاری آنا درباره «مغز مگس پشت فرمان بازی‌های کلاسیک» (دووم و ماینکرفت) [1](https://ana.ir/fa/news/1082547/%D8%A8%D8%B1%D9%86%D8%A7%D9%85%D9%87-%D9%86%D9%88%DB%8C%D8%B3%D8%A7%D9%86-%D9%85%D8%BA%D8%B2-%D9%85%DA%AF%D8%B3-%D9%85%DB%8C%D9%88%D9%87-%D8%B1%D8%A7-%D9%BE%D8%B4%D8%AA-%D9%81%D8%B1%D9%85%D8%A7%D9%86-%D8%A8%D8%A7%D8%B2%DB%8C-%D9%87%D8%A7%DB%8C-%DA%A9%D9%84%D8%A7%D8%B3%DB%8C%DA%A9) و دیجیاتو درباره Stonkfly [3](https://digiato.com/cryptocurrency/fruit-fly-brain-model-trades-bitcoin-coinbase) و زومیت درباره خود FlyWire [2](https://www.zoomit.ir/health-medical/427689-world-first-google-maps-for-entire-brain/).

**الگوی مشترک همه‌ی این پروژه‌ها** (و دقیقاً همان چیزی که من هم پیاده می‌کنم):

1. کل گراف کانکتوم را به‌صورت ماتریس خلوص (sparse) علامت‌دار بارگذاری کن — بدون هیچ کاهشی
2. نورون‌های حسی مشخص (با حاشیه‌نویسی Schlegel et al.) را به شرایط محیط وصل کن
3. دینامیک LIF را اجرا کن
4. نرخ آتش جمعیت نورون‌های نزولی (DN) را به متغیرهای حرکتی بدن (سرعت جلو/چرخش) نگاشت کن
5. موقعیت جدید بدن → ورودی حسی تازه → گام بعدی (حلقه‌ی بسته)

---

## بخش ۳ — منابع داده و ابزار (کاوش‌شده و ارزیابی‌شده)

### ۳.۱ داده‌ها

| منبع | محتوا | دسترسی از سندباکس من |
|---|---|---|
| **philshiu/Drosophila_brain_model** (GitHub) [1](https://github.com/philshiu/Drosophila_brain_model) | `Connectivity_783.parquet` (96MB، ۱۵٬۰۹۱٬۹۸۳ اتصال با وزن علامت‌دار) + `Completeness_783.csv` (۱۳۸٬۶۳۹ نورون) + `model.py` | ✅ **تست‌شده — کلون در ۶ ثانیه** |
| eonsystemspbc/fly-brain (GitHub) | همان داده + بک‌اندهای Brian2-CUDA، GeNN، NEST-GPU، PyTorch | ✅ در دسترس (git clone) |
| Zenodo رکورد 10676866 | سیناپس‌های کامل (9.5GB) + اتصالات proofread (150MB) + احتمالات NT | ❌ دانلود مستقیم بلاک (ولی محتوای معادلش در ریپوی بالا هست) |
| flywire_annotations (GitHub) [5](https://www.cell.com/cell/fulltext/S0092-8674(26)00942-6) | حاشیه‌نویسی انواع سلولی Schlegel et al. (`Supplemental_file1_neuron_annotations.tsv`، 31.7MB) — برای پیداکردن GRN ها و DN ها | ✅ **تست‌شده — کلون شد** |
| flyconnectome/2025malecns (GitHub) [5](https://www.cell.com/cell/fulltext/S0092-8674(26)00942-6) | داده‌های تکمیلی مقاله‌ی MaleCNS | ✅ در دسترس |
| باکت GCS آموزش sjcabs [2](https://github.com/sjcabs/fly_connectome_data_tutorial) | edgelist کامل BANC/FAFB/MANC/MaleCNS (3–8GB) | ❌ بلاک |
| neuPrint (Janelia) [1](https://www.virtualflybrain.org/docs/tools/neuprint/) | کوئری تعاملی hemibrain/MANC/MaleCNS | ❌ نیازمند توکن |
| Codex (codex.flywire.ai) [2](https://flybrain.info/projects/) | اکسپلورر و دانلود پنج کانکتوم | ❌ بلاک از سندباکس |

### ۳.۲ موتورهای شبیه‌سازی موجود (برای مقایسه با پیاده‌سازی من)

- **Brian2** (مرجع اصلی Shiu) — یک ثانیه‌ی مغز ≈ ۲ ثانیه‌ی محاسبه [2](https://github.com/Kisame76/drosophila-brain-mlx)
- پورت **MLX/Metal** برای Apple Silicon: 0.29 ثانیه به‌ازای هر ثانیه‌ی زیستی روی M4 Pro [2](https://github.com/Kisame76/drosophila-brain-mlx)
- **flybrain-nx**: پیاده‌سازی C++ برای کنسول سوییچ با کل ۱۳۹٬۲۵۵ نورون و ۵۴٫۵M سیناپس + آرنای بسته‌ی بدن [5](https://github.com/vibecoderanon/flybrain-nx)
- موتور Rust با «زیر‌میلی‌ثانیه تأخیر و کمتر از 400MB رم» برای گراف ۱۵M یالی (Lukas-Prokes/bio-compiler-engine)

---

## بخش ۴ — من چطور می‌توانم همین‌جا در این چت انجامش بدهم (تست‌شده و اثبات‌شده)

### ۴.۱ محیط اجرای من (اندازه‌گیری‌شده)

- **CPU:** ۲ هسته | **RAM:** 3.8GB | بدون GPU
- **شبکه:** GitHub (git clone و API) و PyPI ✅ باز؛ Zenodo، Google Cloud Storage، Hugging Face، codex.flywire.ai ❌ بلاک — پس مسیر داده باید از GitHub باشد، و **هست**

### ۴.۲ آزمایش‌هایی که همین حالا انجام دادم (نه تخمین — اجرای واقعی)

**آزمایش ۱ — دانلود و بارگذاری داده‌ی واقعی:**

```
git clone philshiu/Drosophila_brain_model   →  6 ثانیه، 185MB
```

| کمیت | مقدار تأییدشده |
|---|---|
| نورون‌ها | **۱۳۸٬۶۳۹** (فهرست کامل proofread) |
| اتصالات جهت‌دار | **۱۵٬۰۹۱٬۹۸۳** یال با وزن علامت‌دار |
| مجموع سیناپس‌ها | **۵۴٬۴۹۲٬۹۲۲** (دقیقاً همان ۵۴٫۵M منتشرشده) |
| سهم تحریکی/مهاری | ۹٬۰۵۹٬۳۰۲ یال تحریکی / ۶٬۰۳۲٬۶۸۱ مهاری |
| RAM ماتریس CSR | **۱۲۱ MB** — به‌راحتی جا می‌شود |

**آزمایش ۲ — بنچمارک موتور LIF (داده‌ی ساختگی با همان ابعاد):**

| حالت | سرعت |
|---|---|
| انتشار رخداد‌محور (event-driven) — 2.7M یال | ۶۵۰ گام/ثانیه |
| انتشار رخداد‌محور — 14.7M یال | ۲۰۲ گام/ثانیه |
| ضرب کامل ماتریس در بردار (SpMV) — 14.7M یال | ۴۹ گام/ثانیه |

**آزمایش ۳ — اجرای واقعی مدل Shiu روی داده‌ی واقعی (۲ CPU همین سندباکس):**

- پارامترهای دقیق `model.py`: v₀=v_rst=−52mV، آستانه −45mV، τ_mbr=20ms، τ_g=5ms، تحریم 2.2ms، تأخیر 1.8ms، w_syn=0.275mV، ورودی پواسونی ۱۵۰Hz روی ۱۰۰ هاب برتر
- نتیجه: **۲۰۰ میلی‌ثانیه‌ی زمان زیست‌شناختی در ۱٫۹ ثانیه‌ی دیواری (۱٬۰۵۹ گام/ثانیه با dt=0.1ms)** — یعنی ~۱۰ برابر کندتر از زمان واقعی؛ با dt=0.5ms عملاً نزدیک زمان واقعی
- ۹٬۰۴۹ اسپیک در شبکه؛ ۱٬۳۶۳ نورون متمایز (۱٪ مغز) فعال شدند — سازگار با مشاهده‌ی Mineault که در این شبیه‌سازی‌ها بخش کوچکی از مغز فعال می‌شود [4](https://www.neuroai.science/p/are-flies-playing-beat-saber)

**نتیجه: پیاده‌سازی «مغز کاملِ تمام‌نورونی + محیط دوبعدی» در این چت کاملاً عملی است.** اسکریپت‌های اثبات‌شده در پوشه‌ی `poc/` همین ریپو ذخیره شده‌اند (`fetch_data.sh` و `fly_lif_core.py`).

### ۴.۳ معماری پیشنهادی (گام بعدی)

```
┌────────────────────────── سندباکس (پایتون) ──────────────────────────┐
│                                                                      │
│  داده: philshiu repo → Connectivity_783.parquet → ماتریس CSR علامت‌دار │
│                                                                      │
│  ┌───────────── حلقه‌ی بسته‌ی شبیه‌سازی ─────────────┐                 │
│  │  آرنای ۲D (موقعیت مگس، غذا، گرادیان)            │                 │
│  │      ↓                                          │                 │
│  │  GRN های قندی/تلخ (چپ/راست) ← پواسون 150Hz      │                 │
│  │      ↓                                          │                 │
│  │  موتور LIF رخدادمحور — ۱۳۸,۶۳۹ نورون، ۱۵.۱M یال │  ← بدون کاهش  │
│  │      ↓                                          │                 │
│  │  خوانش DN (مثلاً DNge059 چپ/راست یا DNa02)      │                 │
│  │      ↓                                          │                 │
│  │  سرعت خطی + نرخ چرخش → موقعیت جدید مگس          │                 │
│  └──────────────────────────────────────────────────┘                 │
│           ↕ WebSocket (وضعیت اسپیک‌ها + موقعیت، ~20Hz)                │
└──────────────────────────────────────────────────────────────────────┘
          ↓
┌────────────── مرورگر شما (پیش‌نمایش زنده‌ی چت) ──────────────┐
│  Canvas دوبعدی: آرنا + مگس + لکه‌های شکر                    │
│  نقشه‌ی حرارتی فعالیت مغز (بر اساس neuropil هر نورون)        │
│  کنترل‌ها: غذا بگذار / نورون تحریک یا ساکت کن / سرعت زمان    │
└────────────────────────────────────────────────────────────┘
```

نکات طراحی:

- **بدون حذف نورون:** تمام ۱۳۸٬۶۳۹ نورون و ۱۵٬۰۹۱٬۹۸۳ یال در شبیه‌سازی می‌مانند. آنچه کاهش می‌یابد فقط «رندر» است (نمایش تجمعی neuropil ها)، نه خود شبکه
- **رخداد‌محور بودن** (فقط سطرهای نورون‌های اسپیک‌زده لمس می‌شوند) همان ترفندی است که کل مغز را روی CPU لپ‌تاپ نزدیک زمان واقعی نگه می‌دارد [3](https://github.com/kris072008/firefly-brain)
- **فقط گام زمانی حسی:** مغز با dt=0.1ms جلو می‌رود ولی محیط/بدن را می‌توان هر ۱۰–۲۵ms به‌روزرسانی کرد (مثل فایرب‌ریان: ورودی GRN از فاصله/جهت غذا، خروجی DN به چرخش) [3](https://github.com/kris072008/firefly-brain)
- داده‌ی حجیم در `.cache` (خارج از اسنپ‌شات) نگهداری می‌شود و اسکریپت bootstrap هر بار در چند ثانیه آن را بازمی‌گرداند؛ در ریپو فقط کد (~ده‌ها کیلوبایت) ذخیره می‌شود

### ۴.۴ نقشه‌ی راه پیشنهادی (اگر بگویید شروع کنم)

| فاز | کار | خروجی |
|---|---|---|
| ۰ | اجرای `poc/fetch_data.sh` + اعتبارسنجی | ماتریس CSR در حافظه |
| ۱ | بازتولید رفلکس مرجع: قند → MN9 (خرطوم) | صحت‌سنجی علمی موتور |
| ۲ | کالیبراسیون DN: رتبه‌بندی نورون‌های نزولی بر اساس پاسخ قند/تلخ (روش `calibrate` فایرب‌ریان) | انتخاب خوانش حرکتی |
| ۳ | سرور FastAPI + WebSocket + Canvas دوبعدی | **مگس دیجیتال زنده در پیش‌نمایش چت** |
| ۴ | امکانات تعاملی: جراحی عصبی (تحریک/سکوت نورون‌ها)، پخش‌زمانی اسپیک‌ها، حالت تلخ | آزمایشگاه بازی‌پذیر |

### ۴.۵ محدودیت‌های علمی که صادقانه باید بدانید

1. **ساختار ≠ عملکرد کامل.** وزن‌ها فقط «تعداد سیناپس» هستند؛ قدرت واقعی سیناپس‌ها، غیرخطی‌های دندریتی، نورومدولاسیون و انعطاف‌پذیری (یادگیری) در مدل نیست [4](https://eon.systems/updates/weve-uploaded-a-fruit-fly) [3](https://github.com/kris072008/firefly-brain)
2. **علامت نورون‌ها «پیش‌بینی» مدل زبانی است، نه اندازه‌گیری** برای اکثر نورون‌ها [3](https://github.com/kris072008/firefly-brain)
3. **نگاشت DN → حرکت یک برون‌یابی است.** اینکه سیگنال DNge059 در مگس واقعی معنی «بچرخ» بدهد، از این مدل برنمی‌آید [3](https://github.com/kris072008/firefly-brain)
4. در این شبیه‌سازی‌ها عمقاً کل ۱۴۰ هزار نورون به‌طور یکسان فعال نمی‌شوند؛ رفتارهای نمایش‌داده‌شده بازتاب مدارهای حسایی-حرکتی نسبتاً کلیشه‌ای هستند، نه کل رفتار مگس [4](https://www.neuroai.science/p/are-flies-playing-beat-saber) [1](https://www.reddit.com/r/ArtificialInteligence/comments/1rpy6ob/a_complete_fruit_fly_brain_simulation_now/)
5. FlyWire بدن را ندارد؛ MaleCNS عصب حرکتی را اضافه می‌کند و ارتقای طبیعی همین پروژه در آینده است [1](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/)

---

## جمع‌بندی

- مغز مگس با میکروسکوپ الکترونی برش‌به‌برش اسکن شد و به کانکتوم ۱۴۰ هزار نورونی/۵۴٫۵ میلیون سیناپسی تبدیل شد [1](https://www.nih.gov/news-events/nih-research-matters/complete-wiring-map-adult-fruit-fly-brain)
- با LIF + وزن سیناپسی + علامت انتقال‌دهنده، مغز در کامپیوتر زنده شد و رفلکس‌های واقعی بازتولید شدند [1](https://github.com/philshiu/Drosophila_brain_model)
- Eon Systems مغز را به بدن MuJoCo وصل کرد و رفتار نوظهور دید [4](https://eon.systems/updates/weve-uploaded-a-fruit-fly)؛ جامعه هم آن را به آرناهای دوبعدی، بازی‌ها و حتی پهپاد وصل کرد [3](https://github.com/kris072008/firefly-brain) [1](https://github.com/ornata/fly)
- **من همه‌ی داده‌ها و ابزار لازم را در همین چت تست‌شده در اختیار دارم:** دانلود ۶ ثانیه‌ای از GitHub، ۱۲۱MB رم برای کل شبکه، ۱٬۰۵۹ گام/ثانیه موتور LIF روی ۲ هسته — و طراحی مشخص برای آرنای دوبعدی تعاملی با **صفر حذف نورونی**

بگویید «شروع کن» تا فازهای ۱ تا ۳ را همین حالا بسازم و مگس دیجیتالِ تمام‌نورونی را در پیش‌نمایش زنده‌ی همین چت راه بیندازم. 🪰

---

## پیوست — منابع کلیدی

- FlyWire/Nature 2024: [1](https://www.nih.gov/news-events/nih-research-matters/complete-wiring-map-adult-fruit-fly-brain) [2](https://www.dongascience.com/en/news/78380) [3](https://www.nature.com/nature/volumes/634/issues/8032) [4](https://www.nature.com/immersive/d42859-024-00053-4/index.html)
- مدل مغز کامل: [ریپوی رسمی Shiu et al.](https://github.com/philshiu/Drosophila_brain_model) [2](https://github.com/Kisame76/drosophila-brain-mlx) [4](https://github.com/Simpbuilder/FlyBrain) [5](https://github.com/vibecoderanon/flybrain-nx)
- داده‌های سیناپسی FlyWire: [Zenodo 10676866](https://zenodo.org/records/10676866)
- تجسم‌گرایی (Eon): [4](https://eon.systems/updates/weve-uploaded-a-fruit-fly) [2](https://www.finallyoffline.com/article/eon-systems-creates-first-walking-digital-brain-with-140000-neurons-mmibitch) [3](https://www.startbase.com/news/startup-eon-systems-demonstriert-erste-multi-verhaltensfaehige-gehirn-emulation/) [5](https://www.xrom.in/post/inside-the-digital-fly-eon-s-embodied-brain-simulation-explained) [4](https://www.neuroai.science/p/are-flies-playing-beat-saber)
- آرنای دوبعدی/بازی‌ها: [3](https://github.com/kris072008/firefly-brain) [1](https://github.com/ornata/fly) [2](https://github.com/cobanov/awesome-fly) [3](https://github.com/townie/awesome-fruit-fly) [2](https://flybrain.info/projects/) [5](https://flyboxlab.vercel.app/)
- کانکتوم‌های جدیدتر: [5](https://www.sciencedaily.com/releases/2026/06/260610003047.htm) [1](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/) [5](https://www.cell.com/cell/fulltext/S0092-8674(26)00942-6) [2](https://github.com/sjcabs/fly_connectome_data_tutorial) [3](https://www.janelia.org/project-team/flyem/manc-connectome)
- پوشش فارسی: [2](https://www.zoomit.ir/health-medical/427689-world-first-google-maps-for-entire-brain/) [1](https://ana.ir/fa/news/1082547/%D8%A8%D8%B1%D9%86%D8%A7%D9%85%D9%87-%D9%86%D9%88%DB%8C%D8%B3%D8%A7%D9%86-%D9%85%D8%BA%D8%B2-%D9%85%DA%AF%D8%B3-%D9%85%DB%8C%D9%88%D9%87-%D8%B1%D8%A7-%D9%BE%D8%B4%D8%AA-%D9%81%D8%B1%D9%85%D8%A7%D9%86-%D8%A8%D8%A7%D8%B2%DB%8C-%D9%87%D8%A7%DB%8C-%DA%A9%D9%84%D8%A7%D8%B3%DB%8C%DA%A9) [3](https://digiato.com/cryptocurrency/fruit-fly-brain-model-trades-bitcoin-coinbase)
