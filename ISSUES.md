# فهرست مشکلات و کارهای پیشنهادی

این فایل backlog فنی پروژه است. هر مورد عمداً مستقل نوشته شده تا بتوان آن را در یک تغییر جداگانه پیاده‌سازی، review و merge کرد.

## راهنمای اولویت

- **P0 — مسدودکننده:** امنیت، صحت داده یا قابلیت اجرای پایه را تهدید می‌کند.
- **P1 — مهم:** قبل از توسعه‌ی featureهای بعدی یا انتشار عمومی باید حل شود.
- **P2 — بهبود:** کیفیت، نگه‌داری و تجربه‌ی توسعه را بهتر می‌کند.
- **P3 — آینده:** قابلیت محصولی یا بهبود غیرضروری برای MVP.

---

## P0 — مسدودکننده‌ها

### ISS-001 — محدود کردن CORS به originهای مجاز

- **شدت:** P0 / امنیتی
- **محل:** `server/src/index.js:12`, `server/src/index.js:18`
- **وضعیت:** رفع شد در این تغییر.
- **مشکل قبلی:** HTTP CORS و Socket.io با `origin: "*"` باز بودند.
- **راه‌حل اعمال‌شده:** allowlist مشترک در `server/src/cors.js` اضافه شد؛ مقدار از `CLIENT_ORIGIN` با فرمت comma-separated خوانده می‌شود و در نبود env، `http://localhost:5173` استفاده می‌شود. Express و Socket.io هر دو از همان options استفاده می‌کنند.
- **تست:** `server/test/cors.test.js` رفتار default، parsing، origin مجاز و origin غیرمجاز را بررسی می‌کند.
- **معیار پذیرش:**
  - [x] originهای مجاز فقط از configuration خوانده شوند.
  - [x] origin ناشناس در HTTP و Socket.io رد شود.
  - [x] تست رفتاری برای origin مجاز و غیرمجاز اضافه شود.

### ISS-002 — جلوگیری از ورود داده‌ی نامعتبر به اکشن‌های Socket.io

- **شدت:** P0 / صحت و پایداری
- **وضعیت:** بخش اصلی رفع شد در این تغییر؛ validation کامل invariantهای بازی هنوز باز است.
- **محل:** `server/src/validation.js`, `server/src/index.js`, `server/src/game/engine.js`
- **راه‌حل اعمال‌شده:** payloadهای create/join/rejoin، room state، board ids، منابع، trade، کارت توسعه و picks قبل از engine validate می‌شوند. handlerها خطای `{ ok: false, error }` برمی‌گردانند و اجرای engine را با try/catch ایزوله می‌کنند.
- **guardهای engine:** player ناشناخته و vertex/edge/tile خارج از محدوده خطای کنترل‌شده می‌دهند؛ لغو trade فقط برای proposer مجاز است.
- **تست:** `server/test/validation.test.js` payload ناقص، type غلط، ID خارج از محدوده، player ناشناخته و مالکیت trade را بررسی می‌کند.
- **معیار پذیرش:**
  - [x] handler عمومی با payload نامعتبر exception قابل‌مشاهده به client نمی‌دهد.
  - [x] شناسه‌های tile/vertex/edge قبل از دسترسی به آرایه validate شوند.
  - [x] تست منفی برای payload ناقص و نوع داده‌ی غلط وجود داشته باشد.
  - [ ] همه‌ی invariantهای پیچیده‌ی قوانین بازی با تست پوشش داده شوند.

### ISS-003 — ایمن‌سازی شناسه‌ی روم و بازیکن

- **شدت:** P0 / امنیتی
- **محل:** `server/src/rooms.js:8-17`, `server/src/game/core.js:191-199`
- **مشکل:** شناسه‌ها با `Math.random()` ساخته می‌شوند و برای فضای امنیتی مناسب نیستند.
- **اثر:** حدس‌زدن شناسه‌ی روم یا بازیکن ساده‌تر می‌شود.
- **راه‌حل پیشنهادی:** برای ID داخلی از `crypto.randomUUID()` و برای کد کوتاه روم از منبع تصادفی امن استفاده کنید؛ برخورد ID نیز باید بررسی شود.
- **معیار پذیرش:**
  - [ ] تولید ID به `Math.random()` وابسته نباشد.
  - [ ] کد روم در صورت برخورد دوباره تولید شود.
  - [ ] تست یکتا بودن در تعداد نمونه‌ی معقول اضافه شود.

---

## P1 — کارهای ضروری قبل از MVP پایدار

### ISS-004 — تولید و commit کردن lockfileهای معتبر

- **شدت:** P1 / بازتولیدپذیری
- **محل:** `client/package-lock.json`, `server/package-lock.json`, `package-lock.json` ریشه
- **مشکل:** lockfileهای client/server در اجرای محلی تولید شده‌اند اما در وضعیت فعلی git untracked هستند و lockfile ریشه خالی و بی‌مصرف است.
- **اثر:** clone تازه با `npm ci` قابل اتکا نیست و نسخه‌ی وابستگی‌ها drift می‌کند.
- **راه‌حل پیشنهادی:** lockfile معتبر هر package را commit کنید؛ lockfile ریشه را فقط در صورت تبدیل پروژه به npm workspace نگه دارید.
- **معیار پذیرش:**
  - [ ] `npm ci` در client و server از clone تازه موفق باشد.
  - [ ] lockfile ریشه یا حذف شده باشد یا workspace واقعی را توصیف کند.
  - [ ] نصب بدون تغییر ناخواسته‌ی lockfile تمام شود.

### ISS-005 — اصلاح مدل نگهداری روم‌ها و persistence

- **شدت:** P1 / قابلیت محصول
- **محل:** `server/src/rooms.js:6`, `server/src/game/core.js:328-353`
- **وضعیت فعلی:** علت ازبین‌رفتن روم‌ها بعد از deploy/restart تأیید شد؛ این issue هنوز باز است.
- **مشکل:** state فقط در `Map` حافظه نگهداری می‌شود.
- **اثر:** restart، crash یا اجرای چند process باعث از دست رفتن بازی و ناسازگاری state می‌شود.
- **راه‌حل پیشنهادی:** برای MVP کوتاه‌مدت lifecycle و TTL روم‌ها را مشخص کنید؛ برای persistence واقعی storage/DB و در صورت scale شدن یک shared store اضافه کنید. مستندات نباید ادعا کند SQLite فعال است.
- **معیار پذیرش:**
  - [ ] رفتار restart برای کاربر مستند و تست شده باشد.
  - [ ] روم‌های خالی/قدیمی cleanup شوند.
  - [ ] تصمیم persistence در roadmap و config شفاف باشد.

### ISS-006 — گسترش تست‌های unit برای قوانین اصلی بازی

- **شدت:** P1 / کیفیت
- **وضعیت:** در این تغییر تست runner و تست‌های پایه اضافه شده‌اند؛ پوشش کامل engine هنوز باقی است.
- **محل:** `server/src/game/core.js`, `server/src/game/engine.js`
- **مشکل باقی‌مانده:** قوانین distance، هزینه‌ها، setup، راهزن، معامله و امتیازدهی هنوز به‌صورت جامع تست نشده‌اند.
- **اثر:** تغییرات روی منطق بازی ممکن است regression بسازند بدون اینکه مشخص شوند.
- **راه‌حل پیشنهادی:** تست‌های deterministic برای core و engine اضافه کنید؛ randomness را قابل seed یا injectable کنید.
- **معیار پذیرش:**
  - [x] script استاندارد `npm test` وجود داشته باشد.
  - [ ] قوانین distance، هزینه‌ها، setup، roll/discard/robber و trade پوشش داده شوند.
  - [x] تست‌ها در CI قابل اجرا باشند.

### ISS-007 — هماهنگ کردن ظرفیت بازیکن‌ها با مستندات و assetها

- **شدت:** P1 / محصول و UX
- **محل:** `README.md:3` قدیمی، `server/src/rooms.js:30`, `client/src/game/constants.js:17`
- **مشکل:** README قبلی ۲ تا ۶ بازیکن می‌گفت، اما سرور فعلاً حداکثر ۴ بازیکن را می‌پذیرد.
- **اثر:** انتظار کاربر با رفتار واقعی سیستم متفاوت است.
- **راه‌حل پیشنهادی:** تا زمان تکمیل assetها ظرفیت رسمی را ۲ تا ۴ نگه دارید یا دو رنگ/asset باقی‌مانده را کامل کنید.
- **معیار پذیرش:**
  - [ ] ظرفیت در UI، README و server یکسان باشد.
  - [ ] تست join برای حداقل، ظرفیت مجاز و نفر اضافه وجود داشته باشد.

### ISS-008 — اعتبارسنجی شناسه‌ها و objectهای بازی در engine

- **شدت:** P1 / پایداری
- **محل:** توابعی مثل `placeSetupSettlement`, `placeSetupRoad`, `moveRobber`, `buildRoad`, `buildSettlement` در `server/src/game/engine.js`
- **مشکل:** بعضی توابع پیش از بررسی وجود `board.vertices[vertexId]`, `board.edges[edgeId]` یا tile، به property آن دسترسی دارند.
- **اثر:** ورودی خارج از محدوده می‌تواند TypeError ایجاد کند.
- **راه‌حل پیشنهادی:** guard مشترک برای شناسه‌ها و playerهای ناشناخته تعریف کنید و خطای قابل پیش‌بینی برگردانید.
- **معیار پذیرش:**
  - [ ] همه‌ی اکشن‌ها برای ID خارج از محدوده `{ ok: false }` برگردانند.
  - [ ] هیچ ورودی socket باعث crash process نشود.

### ISS-009 — کنترل دسترسی اکشن‌های pending و trade

- **شدت:** P1 / صحت بازی
- **محل:** `server/src/game/engine.js:383-410`, `server/src/game/engine.js:438-458`
- **مشکل:** بعضی resolveها فقط وجود pending را بررسی می‌کنند و ownership بازیکن/offer را به‌صورت کامل محدود نمی‌کنند؛ `cancelTrade` نیز مالکیت offer را بررسی نمی‌کند.
- **اثر:** بازیکنی غیر از صاحب اکشن می‌تواند state pending یا offer را تغییر دهد.
- **راه‌حل پیشنهادی:** برای هر pending، `playerId` صاحب اکشن را ذخیره و در resolve تطبیق دهید؛ cancel فقط برای proposer مجاز باشد.
- **معیار پذیرش:**
  - [ ] بازیکن دیگر نتواند year-of-plenty یا monopoly را resolve کند.
  - [ ] بازیکن دیگر نتواند offer متعلق به شخص دیگری را cancel کند.
  - [ ] تست authorization برای هر دو مسیر اضافه شود.

### ISS-010 — اصلاح state undo و checkpointهای ناقص

- **شدت:** P1 / صحت بازی
- **محل:** `server/src/game/engine.js:19-62`, `server/src/game/engine.js:64-71`
- **مشکل:** checkpoint بخشی از state را ذخیره می‌کند، اما همه‌ی stateهای وابسته به نوبت/اکشن را تضمین نمی‌کند و بعد از undo نیز checkpoint مصرف/بازتنظیم نمی‌شود.
- **اثر:** undo می‌تواند state ناسازگار بسازد یا امکان تکرار غیرمنتظره‌ی revert را بدهد.
- **راه‌حل پیشنهادی:** قرارداد دقیق undo را مشخص کنید، snapshot را versioned و کامل کنید، بعد از restore checkpoint را invalidate یا به‌صورت شفاف refresh کنید.
- **معیار پذیرش:**
  - [ ] تست ترکیبی build/trade/dev-card/undo داشته باشد.
  - [ ] undo دوباره بدون اکشن جدید رفتار تعریف‌شده داشته باشد.
  - [ ] stateهای public/private بعد از undo سازگار باشند.

---

## P2 — کیفیت و نگه‌داری

### ISS-011 — حذف duplication بین client و server

- **شدت:** P2 / نگه‌داری
- **محل:** `client/src/game/constants.js`, `server/src/game/core.js`
- **مشکل:** هزینه‌ها، resource typeها، رنگ بازیکن‌ها و labelها در دو محل مستقل تعریف شده‌اند.
- **اثر:** تغییر یک قانون ممکن است فقط در یک سمت اعمال شود.
- **راه‌حل پیشنهادی:** package یا پوشه‌ی `shared/` با قراردادهای مشترک بسازید؛ labelهای UI را از منطق server جدا نگه دارید.
- **معیار پذیرش:**
  - [ ] BUILD_COST و RESOURCE_TYPES یک source of truth داشته باشند.
  - [ ] build client/server بدون import path شکننده انجام شود.
  - [ ] contract test برای state و event payload اضافه شود.

### ISS-012 — یکسان‌سازی ترجمه‌ها و متن‌های قابل نمایش

- **شدت:** P2 / UX
- **محل:** `client/src/game/constants.js:35-41`, `server/src/game/core.js:228-234`
- **مشکل:** label کارت‌های توسعه در client فارسی و در server انگلیسی است.
- **اثر:** logها و UI یک زبان واحد ندارند.
- **راه‌حل پیشنهادی:** catalog ترجمه‌ی واحد برای UI و log تعریف کنید؛ متن‌های داخلی خطا نیز قرارداد مشخص داشته باشند.
- **معیار پذیرش:**
  - [ ] label هر کارت در همه‌ی مسیرها یکسان باشد.
  - [ ] متن user-facing از منطق بازی جدا شود.

### ISS-013 — تکمیل lint/format و quality gate

- **شدت:** P2 / کیفیت
- **وضعیت:** ESLint و scriptهای `lint` اضافه شده‌اند؛ formatter هنوز باقی است.
- **محل:** `client/package.json`, `server/package.json`
- **مشکل باقی‌مانده:** format check مشترک وجود ندارد.
- **اثر:** بخشی از style drift و خطاهای ساده در review دیر پیدا می‌شوند.
- **راه‌حل پیشنهادی:** Prettier را متناسب با ESM/JSX تنظیم و scriptهای `format:check` و `format` اضافه کنید.
- **معیار پذیرش:**
  - [x] lint در هر دو package اجرا شود.
  - [ ] format check deterministic باشد.
  - [x] CI روی lint شکست را گزارش کند.

### ISS-014 — تکمیل CI برای نصب، build، lint و test

- **شدت:** P2 / اتوماسیون
- **وضعیت:** workflow در `.github/workflows/ci.yml` اضافه شده و روی push به `main` و pull request اجرا می‌شود.
- **مشکل باقی‌مانده:** اجباری‌کردن status check نیازمند فعال‌سازی branch protection در تنظیمات GitHub است.
- **اثر:** بدون branch protection، workflow می‌تواند شکست بخورد اما merge دستی هنوز ممکن است.
- **راه‌حل پیشنهادی:** پس از push workflow، jobهای `client` و `server` را به required status checks تبدیل کنید.
- **معیار پذیرش:**
  - [x] PR شامل `npm ci`, build، lint و test باشد.
  - [x] secret و environment production وارد CI نشود.
  - [ ] branch protection مانع merge در صورت شکست CI شود.

### ISS-015 — مدیریت پیکربندی و health check production

- **شدت:** P2 / عملیاتی
- **محل:** `server/src/index.js:9-19`
- **مشکل:** PORT و CORS تنها به‌صورت ناقص configuration شده‌اند و health check readiness/liveness تفکیک ندارد.
- **اثر:** deploy و مانیتورینگ قابل اتکا نیست.
- **راه‌حل پیشنهادی:** env schema، مقدارهای dev/prod، graceful shutdown و health endpoint مستند اضافه کنید.
- **معیار پذیرش:**
  - [ ] config نامعتبر هنگام startup fail-fast شود.
  - [ ] shutdown اتصال‌ها را تمیز ببندد.
  - [ ] health endpoint قراردادی و مستند باشد.

### ISS-016 — نگه‌داشتن خروجی تولیدی و فایل‌های سیستم خارج از git

- **شدت:** P2 / hygiene
- **محل:** `.DS_Store`, `client/dist/`, `client/node_modules/`, lockfileهای تولیدشده
- **مشکل:** فایل‌های سیستم و خروجی/وابستگی محلی در وضعیت working tree دیده شدند؛ `.DS_Store` قبلاً در git نیز tracked بوده است.
- **اثر:** diffهای آلوده و clone سنگین/غیرقابل‌اعتماد.
- **راه‌حل پیشنهادی:** `.gitignore` نگه داشته شود؛ فایل‌های generated از index حذف و فقط artifactهای لازم commit شوند.
- **معیار پذیرش:**
  - [ ] `git status` بعد از install/build فقط فایل‌های source/مستندات عمدی را نشان دهد.
  - [ ] `.DS_Store` در index باقی نماند.

---

## P3 — پس از تثبیت MVP

### ISS-017 — reconnect واقعی و lifecycle بازیکن

- **محل:** `server/src/rooms.js`, handlerهای `rejoinRoom` و `disconnect`, `client/src/App.jsx`
- **وضعیت فعلی:** کلاینت خطای اتصال، timeout اکشن و reconnect اولیه را بهتر گزارش می‌کند؛ reconnect پایدار بعد از restart هنوز به persistence وابسته است.
- **مشکل:** reconnect وابسته به نگهداری `playerId` در کلاینت و state in-memory است و TTL/تعارض session ندارد.
- **معیار پذیرش:** reconnect در قطع کوتاه، refresh صفحه و session هم‌زمان رفتار مشخص داشته باشد.

### ISS-018 — حساب کاربری و persistence بازی

- **محل:** کل پروژه؛ در roadmap اسپرینت ۳ و ۴
- **مشکل:** بازیکن نام موقت دارد و بازی به user واقعی متصل نیست.
- **معیار پذیرش:** user/session، مالکیت بازی و migration داده‌ها مشخص و تست‌پذیر باشند.

### ISS-019 — واکنش‌گرایی موبایل و دسترس‌پذیری

- **محل:** `client/src/App.jsx`, `client/src/styles.js`, components
- **مشکل:** تست responsive و accessibility وجود ندارد.
- **معیار پذیرش:** keyboard navigation، label مناسب، contrast و breakpointهای اصلی بررسی شوند.

### ISS-020 — تصمیم‌گیری و ثبت license

- **محل:** ریشه‌ی ریپو
- **مشکل:** فایل license وجود ندارد.
- **معیار پذیرش:** مجوز پروژه با توافق مالک اضافه و در README لینک شود.

---

## ترتیب پیشنهادی اجرا

1. `ISS-016` و `ISS-004`: تمیز کردن working tree و تثبیت نصب.
2. `ISS-001` تا `ISS-003`: بستن سطح حمله‌ی پایه.
3. `ISS-002`, `ISS-008`, `ISS-009`: validation و authorization ورودی‌ها.
4. `ISS-006`: تست‌های engine قبل از refactorهای بزرگ.
5. `ISS-007`, `ISS-010`: اصلاح قراردادهای محصول و state.
6. `ISS-011` تا `ISS-015`: shared contract، tooling و CI.
7. سپس reconnect، persistence، حساب کاربری و UX.
