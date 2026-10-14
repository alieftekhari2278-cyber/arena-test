# پرامپت حرفه‌ای: فروشگاه سی‌پی کالاف دیوتی موبایل (CoD Mobile CP Store)

این فایل، درخواست ساده‌ی «برام یک فروشگاه CP بساز، حرفه‌ای و جذاب» را به یک بریف مهندسی/طراحی کامل تبدیل می‌کند که بتوان آن را مستقیماً به یک مدل هوش مصنوعی کدنویس (Claude، ChatGPT، Cursor، Lovable، v0، Bolt و…) داد.

| نسخه | چه زمانی استفاده شود |
| --- | --- |
| **۱) Master Prompt** | وقتی مدل، قابلیت ساخت پروژه‌ی بزرگ را دارد (Agent / Cursor / Claude Code) |
| **۲) Compact Prompt** | برای شروع سریع یا ابزارهایی که محدودیت طول ورودی دارند |
| **۳) Phase Prompts** | برای ابزارهای مرحله‌ای مثل Lovable / v0 / Bolt (هر مرحله جداگانه) |
| **۴) Polish Prompts** | بعد از ساخت اولیه، برای جذاب‌تر کردن و رفع ایراد |
| **۵) چک‌لیست** | قبل از ارسال، جای‌گزین‌کردن `[PLACEHOLDER]`ها |

> نسخه‌های کتابخانه‌ها بر اساس آخرین نسخه‌ی منتشرشده در npm در تاریخ نگارش (مهر ۱۴۰۵ / اکتبر ۲۰۲۶) است: Next.js 16، Tailwind CSS 4، Zod 4، Prisma 7، Motion 14 (نام جدید Framer Motion).

---

## ۱) Master Prompt — نسخه کامل

```text
ROLE
You are a senior full-stack engineer and product designer who has shipped high-converting e-commerce experiences for gaming audiences. You write production-grade Next.js/TypeScript code and have an exceptional eye for premium, modern UI. You make decisions confidently, document assumptions, and never leave placeholder content.

MISSION
Build "[STORE_NAME]" (domain: [DOMAIN]) — a premium, Persian-language (RTL) online store that sells Call of Duty: Mobile CP (COD Points), Battle Pass, and special bundles to Iranian players. The site must feel like a top-tier gaming brand built it: visually striking, fast, trustworthy, and effortless to buy from on a mid-range Android phone.

TARGET USERS & SUCCESS METRIC
- CoD Mobile players aged 14–30 in Iran; 85%+ mobile traffic (Android, 4G, mid-range devices).
- They care about: lowest price per CP, fastest delivery, account safety, and a human support channel (Telegram).
- North-star: a first-time visitor completes a CP purchase in under 90 seconds from landing, with zero confusion.

TECH STACK (strict)
- Next.js 16 (App Router, React Server Components, Server Actions), TypeScript in strict mode
- Tailwind CSS v4 + shadcn/ui (custom tokens), Motion (formerly Framer Motion), lucide-react
- React Hook Form + Zod v4 (client and server validation), TanStack Query v5 (client data), Zustand v5 (checkout draft state)
- Prisma 7 + PostgreSQL (SQLite allowed for local dev)
- Auth: phone number + SMS OTP, secure httpOnly session cookies, RBAC (user | support | admin)
- Payments: a provider-agnostic PaymentGateway interface with a ZarinPal (sandbox) implementation + internal Wallet payment; easy to add Zibal/IDPay later
- next/font with Vazirmatn for Persian UI + a geometric display font (Rajdhani or Orbitron) for numerals/CP amounts
- Jalali (Shamsi) dates via date-fns-jalali; Persian-digit formatting utility; Toman currency formatter (e.g. ۴۸۰٬۰۰۰ تومان)
- All UI strings live in one typed dictionary (/lib/i18n/fa.ts) — no hard-coded copy inside components
- If your environment is frontend-only: build the complete UI on a typed mock API layer (/lib/api/*) and mark every integration point with // TODO: integrate.

DESIGN DIRECTION — "Tactical Premium"
- Dark-first theme. Background #0A0D12, surfaces #111620 / #161C27, borders at 6–10% white alpha, text #E6EAF2, muted text #8B94A7.
- Accent palette: Tactical Orange #FF6A00 (primary CTA + glows), Electric Cyan #19E6FF (secondary highlights), success #22C55E, danger #EF4444.
- Visual language: glassmorphism cards (backdrop blur + 1px luminous border), subtle diagonal grid / scanline textures, soft radial glows behind the hero and featured packages, slightly chamfered corners on primary CTAs (military-HUD feel). Clean and spacious — never cluttered.
- Motion: staggered section reveals (150–300ms, ease-out), magnetic hover on CTAs, 3D tilt + glow on package cards, count-up stats, smooth accordions, skeleton loaders. Respect prefers-reduced-motion.
- Layout: mobile-first, 12-column grid, 8pt spacing scale, max-width 1280px, strong visual hierarchy, sticky bottom "Buy" bar on product & checkout for mobile.
- Full RTL: <html lang="fa" dir="rtl">, mirrored chevrons/icons, Tailwind logical properties (ps/pe/ms/me, start/end), optional Persian-numerals toggle.
- Real Persian copy everywhere (no lorem ipsum). Tone: confident, friendly, gamer-savvy. Example hero: «سی‌پی کالاف دیوتی موبایل؛ ارزان‌تر و سریع‌تر از همیشه» — sub: «تحویل آنی با آیدی، بدون نیاز به رمز اکانت».
- Artwork: use ORIGINAL tactical/abstract visuals (gradients, HUD elements, 3D-styled coin/crate renders). Do NOT use copyrighted game artwork, logos, or character art.
- Provide a light theme toggle, but dark is the default.

INFORMATION ARCHITECTURE & PAGES
1. Home /
   - Hero: headline, subheadline, primary CTA «خرید سی‌پی», secondary «راهنمای خرید», floating 3D-tilt package cards, trust micro-badges (تحویل ۵ دقیقه‌ای، پرداخت امن، پشتیبانی ۲۴/۷، تضمین بازگشت وجه).
   - Live stats strip with count-up: سفارش‌های تحویل‌شده، میانگین زمان تحویل، رضایت کاربران (computed from real data, never hard-coded).
   - Packages grid with badges «پرفروش‌ترین» / «بهترین ارزش», bonus-CP labels, and "price per CP".
   - Anonymized live-orders ticker (e.g. «۰۹۱۲***۴۵ همین حالا ۲۴۰۰ CP خرید») — shows REAL orders only; auto-hides when there are fewer than 20 orders in the last 24h.
   - How it works (3 steps) → Delivery methods comparison (آیدی vs اکانت) → Testimonials carousel → FAQ accordion → Blog teaser → Final CTA → Footer (links, اینماد/ساماندهی placeholders, Telegram [TELEGRAM_HANDLE], legal + unofficial-reseller disclaimer).
2. Shop /shop — all products; filters (نوع: CP / بتل‌پس / آفر ویژه; روش تحویل), sorting (قیمت / محبوبیت), responsive grid, skeletons.
3. Product /product/[slug] — package detail, bonus breakdown, price + compare-at price, delivery ETA, delivery-method selector, sticky buy bar, related packages, method-specific FAQ.
4. Checkout /checkout — 3-step wizard with progress indicator:
   - Step 1: Package & quantity, discount code, one-tap upsell (e.g. add Battle Pass).
   - Step 2: Delivery details —
     - Method A: by Player UID (numeric 6–20 digits with inline validation + "how to find your UID" popover, in-game name).
     - Method B: by account login (provider: Activision / Facebook / Google / Apple; email; password; clear risk warnings; "2FA must be disabled" notice; explicit consent checkbox). Credentials go over HTTPS only, are encrypted at rest with AES-256-GCM, and auto-purge after delivery.
   - Step 3: Review & Pay — order summary, wallet-balance toggle, gateway selection, terms consent, pay button → gateway redirect → callback page with clear success / failure states (confetti on success, retry on failure).
5. Order tracking /track & /orders/[id] — status timeline (ثبت شد → پرداخت شد → در حال پردازش → تحویل داده شد / ناموفق / بازگشت وجه), delivery proof (admin-uploaded screenshot), copyable order code, support CTA.
6. Auth — phone → 6-digit OTP (auto-advancing inputs, paste support, 90s resend countdown, rate-limited). Guest checkout that becomes an account on OTP verification. Zero friction.
7. User dashboard /dashboard — overview, orders, wallet (balance, top-up, transactions), saved player IDs, profile, referral code & earnings, support tickets.
8. Content — /guide (finding UID, how CP works, method comparison), /faq, /blog + /blog/[slug] (MDX), /contact (form + Telegram deep link), /terms, /privacy, /refund-policy.
9. Admin /admin (RBAC: admin/support) — KPI dashboard (revenue today / 7d / 30d, orders by status, conversion), Orders table (search, filters, status transitions with notes, "reveal credentials" action that writes an audit entry, upload delivery proof, refund), Products CRUD (price, bonus, availability, badges, sort order), Discount codes, Users, Wallet transactions, Content (FAQ, blog, announcement banner), Settings (gateway keys, SMS provider, Telegram notification webhook, exchange-rate price helper), Audit log.

PRODUCT CATALOG (seed data)
Seed the standard CoD Mobile tiers with realistic, admin-editable Toman prices:
- 80 CP · 420 CP (400 + 20) · 880 CP (800 + 80) · 2,400 CP (2,000 + 400) · 5,000 CP (4,000 + 1,000) · 10,800 CP (8,000 + 2,800)
- Battle Pass (Premium), Battle Pass Bundle, and 1–2 «آفر ویژه» bundles
- Product fields: slug, title, type, cp, bonusCp, priceToman, compareAtToman, deliveryMethods[], etaMinutes, badge, isActive, sortOrder, salesCount.

CORE BUSINESS RULES
- Order statuses: PENDING_PAYMENT → PAID → PROCESSING → DELIVERED | FAILED | REFUNDED | CANCELED. Every transition is logged with actor + timestamp + note.
- Payment flow: create order → request gateway → verify on callback (idempotent) → mark PAID → notify admin (Telegram webhook) & user (SMS). Wallet payments are atomic and create WalletTransaction records.
- Discount codes: percent or fixed; min order; total & per-user usage limits; expiry; stackable = false.
- Referral: unique code per user; a % of the referee's first paid order is credited to the referrer's wallet.
- Account-login orders: credentials visible only via explicit admin "reveal" (audited); auto-purge 24h after DELIVERED.
- Prices in Toman with Persian digit grouping; always show «قیمت هر CP» for comparison.

TRUST & CONVERSION (must-have)
Trust bar, اینماد/ساماندهی placeholders, delivery-time guarantee, refund-policy link next to the pay button, social proof (live ticker + testimonials with avatars), transparent "چرا ارزان‌تریم؟" explainer, floating Telegram support button, sales-count badges on packages. Use urgency honestly — no fake countdown timers, no fake stats. Footer disclaimer: independent reseller, not affiliated with Activision; all trademarks belong to their owners.

DATA MODEL (Prisma)
User, Session, OtpCode, Product, Order, OrderItem, DeliveryDetail (encrypted payload), Payment, WalletTransaction, DiscountCode, DiscountRedemption, Referral, Ticket, TicketMessage, BlogPost, Faq, Setting, AuditLog — with proper enums, relations, and indexes.

NON-FUNCTIONAL REQUIREMENTS
- Performance: Lighthouse ≥ 90 (Performance / Best Practices / SEO), LCP < 2.5s on 4G, next/image everywhere, RSC by default, minimal client JS, route-level code splitting.
- SEO: Persian metadata, OpenGraph/Twitter cards, JSON-LD (Organization, Product, FAQPage, BreadcrumbList), sitemap.xml, robots.txt, clean slugs.
- Security: Zod validation server-side, rate limiting (OTP, login, checkout), CSRF-safe Server Actions, httpOnly/secure/sameSite cookies, RBAC middleware on /admin, no secrets in client bundle, security headers (CSP, HSTS, X-Frame-Options) in next.config, .env.example included.
- Accessibility: WCAG 2.1 AA contrast, full keyboard navigation, visible focus rings, aria labels, semantic HTML, tap targets ≥ 44px.
- Testing: Vitest unit tests for pricing / discount / wallet logic; Playwright e2e for the happy-path checkout and one admin status transition.
- Code quality: feature-based folder structure, reusable UI primitives, typed API layer, ESLint + Prettier, no `any`, env-driven config, meaningful comments.
- Resilience: error boundaries, structured logging, and loading / empty / error states for every screen.

OUT OF SCOPE (v1)
Multi-currency, multiple languages, native mobile app, crypto payments, marketplace/multi-vendor features.

DELIVERABLES
1. A short implementation plan + explicit list of assumptions (do not ask me questions — decide and document).
2. Project scaffold with folder structure, design tokens (CSS variables + Tailwind config) and the shadcn theme.
3. Every page above — fully responsive, RTL-correct, with real Persian copy and prisma/seed.ts.
4. OTP auth, checkout wizard, payment abstraction with ZarinPal sandbox, wallet, order tracking, admin panel.
5. README.md (setup, env vars, scripts, switching gateway/SMS providers, deployment to Vercel or a VPS) and .env.example.
6. Run the app, make sure there are zero type errors and zero console errors, then summarize what was built and what remains as TODOs.

QUALITY BAR
The result must look like a premium gaming brand designed it — not a template. Prioritize visual polish, speed, and a frictionless mobile checkout over feature breadth. When something is ambiguous, pick the option that maximizes buyer trust and conversion.

BUILD ORDER
Design system → Layout / Navbar / Footer → Home → Shop / Product → Checkout → Auth → Orders / Tracking → Dashboard / Wallet → Admin → Payment / SMS / Telegram integrations → Tests → SEO / Performance / Accessibility pass → README.
```

---

## ۲) Compact Prompt — نسخه کوتاه (برای شروع سریع)

```text
Build a premium, Persian (RTL, lang="fa") e-commerce site with Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui + Motion for selling Call of Duty: Mobile CP (COD Points) to Iranian players. Dark "tactical premium" theme: bg #0A0D12, accent orange #FF6A00 + cyan #19E6FF, glassmorphism cards, 3D-tilt package cards, count-up stats, live-orders ticker, Vazirmatn font, Persian digits, Jalali dates, Toman prices. Original artwork only — no copyrighted game assets.

Pages: Home, Shop, Product, 3-step Checkout (delivery by Player UID or by account login with strong warnings + AES-256-GCM encrypted credentials), phone-OTP auth, Order tracking timeline, User dashboard (wallet, referral, saved IDs, tickets), Admin panel (orders, packages, discounts, users, settings, audit log), Guide/FAQ/Blog/Contact/Terms.

Seed standard tiers: 80 / 420 / 880 / 2400 / 5000 / 10800 CP + Battle Pass + special bundles. Provider-agnostic payment interface with ZarinPal sandbox + wallet. Prisma 7 + PostgreSQL. Real Persian copy (no lorem ipsum), mobile-first, Lighthouse ≥ 90, WCAG AA, loading/empty/error states everywhere.

Don't ask questions — document assumptions, build it, run it, fix all errors, then summarize.
```

---

## ۳) Phase Prompts — ساخت مرحله‌به‌مرحله (برای Lovable / v0 / Bolt)

ابتدا Master Prompt را به‌عنوان بریف ارسال کنید؛ سپس هر مرحله را بعد از تأیید مرحله قبل بفرستید. هر پرامپت با جمله‌ی «Continue from the master brief above.» شروع می‌شود تا مدل زمینه را گم نکند.

### Phase 1 — Foundation & Home

```text
Continue from the master brief above. Build ONLY: design tokens (CSS variables + Tailwind config), global RTL layout with Vazirmatn, dark theme, responsive navbar with mobile drawer, footer, and the complete Home page using typed mock data. Focus on exceptional visual polish and motion (hero glows, 3D-tilt package cards, count-up stats, live-orders ticker). No backend yet.
```

### Phase 2 — Shop, Product, Checkout UI

```text
Continue from the master brief above. Now build /shop, /product/[slug], and the 3-step /checkout wizard with full Zod validation, both delivery methods (Player UID / account login with warnings + consent), discount-code UI, wallet toggle, and a mock payment flow that lands on success/failure pages. Keep checkout draft state in Zustand. Add a sticky mobile buy bar.
```

### Phase 3 — Auth & Orders

```text
Continue from the master brief above. Implement phone + OTP auth (mock SMS provider in dev that logs the code), secure sessions, guest-to-account flow, rate limiting, then /orders, /orders/[id] with the status timeline, and /track by order code.
```

### Phase 4 — Dashboard & Wallet

```text
Continue from the master brief above. Build /dashboard: overview, orders, wallet (balance, top-up, transaction history), saved player IDs, profile, referral code & earnings, support tickets with threaded messages.
```

### Phase 5 — Admin Panel

```text
Continue from the master brief above. Build /admin with RBAC: KPI dashboard, orders table (filters, status transitions with notes, audited "reveal credentials", delivery-proof upload, refund), products CRUD, discount codes, users, wallet transactions, content (FAQ, blog, announcement banner), settings, audit log.
```

### Phase 6 — Integrations & Hardening

```text
Continue from the master brief above. Wire real integrations behind interfaces: ZarinPal sandbox (idempotent verify), Kavenegar SMS, Telegram admin notifications. Add AES-256-GCM encryption + auto-purge for delivery credentials, security headers, Zod on all server actions, JSON-LD, sitemap/robots, Vitest + Playwright tests, and run a Lighthouse pass (target ≥ 90). Write README + .env.example.
```

---

## ۴) Polish Prompts — جذاب‌تر کردن و رفع ایراد

### UI/UX Audit

```text
Do a strict UI/UX audit of every page: visual hierarchy, spacing consistency (8pt scale), RTL mistakes (mirrored icons, alignment, logical CSS properties), tap targets ≥ 44px, color contrast (WCAG AA), typography scale, and empty/loading/error states. Fix everything and list the changes.
```

### Wow-factor for the Home page

```text
Make the Home page noticeably more premium: layered radial glows + subtle animated grid behind the hero, 3D-tilt package cards with orange glow on hover, magnetic primary CTA, count-up stats, a smooth marquee of live orders, and staggered section reveals. Keep LCP under 2.5s and respect prefers-reduced-motion.
```

### Conversion pass

```text
Optimize for conversion: shorten the path from landing to payment, add "price per CP" and "most popular" cues, put refund-policy and delivery-time guarantees next to the pay button, add inline UID validation help, and make the sticky mobile buy bar always visible on product and checkout.
```

### Performance pass

```text
Run a performance pass: convert unnecessary client components to server components, lazy-load below-the-fold sections, optimize images and fonts, remove unused JS, and report Lighthouse scores before/after.
```

---

## ۵) چک‌لیست قبل از ارسال پرامپت

- [ ] `[STORE_NAME]` → اسم فروشگاه (مثلاً «سی‌پی‌لند»)
- [ ] `[DOMAIN]` → دامنه سایت
- [ ] `[TELEGRAM_HANDLE]` → آیدی پشتیبانی تلگرام
- [ ] اگر درگاه دیگری می‌خواهید (زیبال، آیدی‌پی، نکست‌پی) نام ZarinPal را عوض کنید
- [ ] اگر سرویس پیامک دیگری دارید (SMS.ir، ملی‌پیامک) به‌جای Kavenegar بنویسید
- [ ] اگر مخاطب خارج از ایران است، بخش پرداخت/ارز را به Stripe + USD (یا کریپتو) تغییر دهید
- [ ] اگر محیط شما فقط فرانت‌اند است، جمله‌ی «If your environment is frontend-only…» را نگه دارید؛ در غیر این صورت می‌توانید حذفش کنید

## نکات مهم (صادقانه)

- این پرامپت یک **مشخصات فنی کامل** است؛ هیچ مدلی تضمین نمی‌کند همه‌ی موارد را در یک پاسخ بی‌نقص بسازد. برای نتیجه‌ی بهتر از نسخه‌ی مرحله‌ای (بخش ۳) استفاده کنید و بعد از هر مرحله خروجی را بررسی کنید.
- روش تحویل «با اکانت» به‌معنی نگهداری موقت رمز حساب کاربران است؛ پرامپت رمزنگاری، لاگ دسترسی و حذف خودکار را الزام کرده، اما مسئولیت حقوقی و امنیتی آن با صاحب فروشگاه است.
- فروش CP به‌صورت واسطه‌ای، خدمتی غیررسمی است؛ در سایت از لوگو و آثار هنری دارای کپی‌رایت بازی استفاده نکنید و دیسکلیمر «غیروابسته به Activision» را حفظ کنید.
