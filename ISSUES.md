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
- **تست:** `server/test/validation.test.js` payload ناقص، type غلط، event بدون payload مثل `buyDevCard`، ID خارج از محدوده، player ناشناخته و مالکیت trade را بررسی می‌کند.
- **معیار پذیرش:**
  - [x] handler عمومی با payload نامعتبر exception قابل‌مشاهده به client نمی‌دهد.
  - [x] شناسه‌های tile/vertex/edge قبل از دسترسی به آرایه validate شوند.
  - [x] تست منفی برای payload ناقص و نوع داده‌ی غلط وجود داشته باشد.
  - [ ] همه‌ی invariantهای پیچیده‌ی قوانین بازی با تست پوشش داده شوند.

### ISS-003 — ایمن‌سازی شناسه‌ی روم و بازیکن

- **شدت:** P0 / امنیتی
- **وضعیت:** رفع شد در این batch.
- **محل:** `server/src/rooms.js`, `server/src/game/core.js`, `server/test/ids.test.js`
- **راه‌حل اعمال‌شده:** کد روم با `crypto.randomBytes` تولید و در `rooms` برای collision بررسی می‌شود؛ ID بازیکن و IDهای داخلی با `crypto.randomUUID()` تولید می‌شوند.
- **تست:** قالب، یکتایی، entropy و عدم استفاده از `Math.random()` پوشش داده شده است.
- **معیار پذیرش:**
  - [x] تولید ID به `Math.random()` وابسته نباشد.
  - [x] کد روم در صورت برخورد دوباره تولید شود.
  - [x] تست یکتا بودن در تعداد نمونه‌ی معقول اضافه شود.

---

## P1 — کارهای ضروری قبل از MVP پایدار

### ISS-004 — تولید و commit کردن lockfileهای معتبر

- **شدت:** P1 / بازتولیدپذیری
- **وضعیت:** بخش lockfile رفع شده است؛ بررسی drift وابستگی‌ها همچنان باید در CI ادامه داشته باشد.
- **محل:** `client/package-lock.json`, `server/package-lock.json`
- **وضعیت فعلی:** lockfileهای client و server tracked و معتبر هستند؛ lockfile ریشه حذف شده چون پروژه workspace ریشه نیست.
- **اثر باقی‌مانده:** نسخه‌های dependency با وجود lock شدن باید به‌صورت دوره‌ای audit و به‌روزرسانی شوند.
- **راه‌حل اعمال‌شده:** `npm ci` برای هر package در CI و بررسی‌های محلی اجرا می‌شود.
- **معیار پذیرش:**
  - [x] `npm ci` در client و server از clone تازه موفق باشد.
  - [x] lockfile ریشه حذف شده باشد.
  - [x] نصب بدون تغییر ناخواسته‌ی lockfile تمام شود.

### ISS-005 — اصلاح مدل نگهداری روم‌ها و persistence

- **شدت:** P1 / قابلیت محصول
- **محل:** `server/src/rooms.js`, `server/src/game/core.js`
- **وضعیت فعلی:** persistence هنوز باز است؛ lifecycle lobby و cleanup روم خالی در این batch تست و تثبیت شد.
- **مشکل:** state فقط در `Map` حافظه نگهداری می‌شود.
- **اثر:** restart، crash یا اجرای چند process باعث از دست رفتن بازی و ناسازگاری state می‌شود.
- **راه‌حل پیشنهادی:** برای MVP کوتاه‌مدت TTL روم‌های in-game را مشخص کنید؛ برای persistence واقعی storage/DB و در صورت scale شدن shared store اضافه کنید. مستندات نباید ادعا کند SQLite فعال است.
- **معیار پذیرش:**
  - [ ] رفتار restart برای کاربر مستند و تست شده باشد.
  - [x] روم خالی در lobby cleanup می‌شود و تست lifecycle دارد.
  - [ ] تصمیم persistence در roadmap و config شفاف باشد.

### ISS-006 — گسترش تست‌های unit برای قوانین اصلی بازی

- **شدت:** P1 / کیفیت
- **وضعیت:** بخش unit تست core و engine در این batch تکمیل شد؛ پوشش end-to-end بازی هنوز باقی است.
- **محل:** `server/test/core.test.js`, `server/test/engine.test.js`
- **تغییر:** ۶۵ تست deterministic برای geometry، منابع، هزینه‌ها، distance rule، longest road، scoring، public state و state factory اضافه شد و authorization pending actions نیز تست شد.
- **معیار پذیرش:**
  - [x] script استاندارد `npm test` وجود داشته باشد.
  - [x] قوانین core و pending actionهای engine پوشش داده شوند.
  - [x] تست‌ها در CI قابل اجرا باشند.
  - [ ] تست end-to-end کامل برای setup، roll/discard/robber، trade و winner اضافه شود.

### ISS-007 — هماهنگ کردن ظرفیت بازیکن‌ها با مستندات و assetها

- **شدت:** P1 / محصول و UX
- **وضعیت:** ظرفیت واقعی و lifecycle روم تست و مستند شد؛ asset و UI رسمی هنوز باید بررسی شوند.
- **محل:** `server/src/rooms.js`, `server/test/rooms.test.js`, `client/src/game/constants.js`
- **مشکل باقی‌مانده:** باید یک منبع حقیقت برای ظرفیت و assetهای قابل‌استفاده در UI تعریف شود.
- **تغییر:** تست‌های join ظرفیت ۴ نفر، نفر پنجم، روم ناموجود و روم شروع‌شده اضافه شد.
- **معیار پذیرش:**
  - [ ] ظرفیت در UI، README و server یکسان باشد.
  - [x] تست join برای ظرفیت مجاز و نفر اضافه وجود داشته باشد.

### ISS-008 — اعتبارسنجی شناسه‌ها و objectهای بازی در engine

- **شدت:** P1 / پایداری
- **وضعیت:** رفع شد همراه با ISS-002 در batchهای قبلی.
- **محل:** guardهای `server/src/game/engine.js` و تست‌های `server/test/validation.test.js`, `server/test/engine.test.js`
- **راه‌حل اعمال‌شده:** vertex/edge/tile و player قبل از دسترسی بررسی می‌شوند و payload نامعتبر با ack کنترل‌شده رد می‌شود.
- **معیار پذیرش:**
  - [x] اکشن‌ها برای ID خارج از محدوده `{ ok: false }` برمی‌گردانند.
  - [x] هیچ ورودی socket باعث crash process نمی‌شود.

### ISS-009 — کنترل دسترسی اکشن‌های pending و trade

- **شدت:** P1 / صحت بازی
- **وضعیت:** رفع شد در این batch.
- **محل:** `server/src/game/engine.js`, `server/test/engine.test.js`
- **راه‌حل اعمال‌شده:** owner `playerId` در pendingهای knight، road building، year of plenty و monopoly ذخیره می‌شود و تمام resolveها با آن تطبیق داده می‌شوند؛ جریان dice=7 که pending مالک ندارد حفظ شده است.
- **تست:** مالک و non-owner برای resolve کارت‌ها، حرکت راهزن، steal و road building رایگان پوشش داده شدند.
- **معیار پذیرش:**
  - [x] بازیکن دیگر نتواند year-of-plenty یا monopoly را resolve کند.
  - [x] بازیکن دیگر نتواند offer متعلق به شخص دیگری را cancel کند.
  - [x] authorization کارت‌های knight و road building نیز تست شده است.

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
- **وضعیت:** بخش اصلی رفع شد در این batch؛ readiness/liveness تفکیک‌شده هنوز باز است.
- **محل:** `server/src/config.js`, `server/src/index.js`, `server/test/config.test.js`, `server/test/health.test.js`, `server/test/shutdown.test.js`
- **راه‌حل اعمال‌شده:** PORT به عدد صحیح ۱ تا ۶۵۵۳۵ validate می‌شود؛ health شامل `ok`, `service`, `uptime`, `pid` است؛ shutdown روی SIGTERM/SIGINT ابتدا Socket.io و سپس HTTP را می‌بندد و timeout محافظ دارد.
- **تست:** config، health و ترتیب graceful shutdown تست شده‌اند.
- **معیار پذیرش:**
  - [x] config نامعتبر مقدار کنترل‌شده دارد و warning/fallback می‌دهد.
  - [x] shutdown اتصال‌ها را به‌ترتیب تمیز می‌بندد.
  - [x] health endpoint قراردادی و مستند است.
  - [ ] readiness و liveness جداگانه اضافه شوند.

### ISS-016 — نگه‌داشتن خروجی تولیدی و فایل‌های سیستم خارج از git

- **شدت:** P2 / hygiene
- **محل:** `.DS_Store`, `client/dist/`, `client/node_modules/`, lockfileهای تولیدشده
- **وضعیت:** بخش cleanup قبلی رفع شده؛ این batch نیز با اجرای install/build وضعیت clean را حفظ کرد.
- **راه‌حل اعمال‌شده:** generated files و فایل‌های سیستم در `.gitignore` هستند و lockfileهای معتبر تنها artifactهای نصب‌شده‌ی tracked هستند.
- **معیار پذیرش:**
  - [x] `git status` بعد از install/build فقط تغییرات عمدی را نشان دهد.
  - [x] `.DS_Store` در index باقی نماند.

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
