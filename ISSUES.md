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
- **وضعیت:** persistence فایل JSON و lifecycle روم در این batch تکمیل و روی production redeploy شد؛ database/multi-process store هنوز باز است.
- **محل:** `server/src/storage.js`, `server/src/rooms.js`, `server/src/config.js`, `server/test/storage.test.js`
- **راه‌حل اعمال‌شده:** storage versioned و atomic با path قابل تنظیم اضافه شد؛ startup rooms را load و بازیکنان را disconnected می‌کند؛ mutationها mirror می‌شوند؛ failure با `STORAGE_REQUIRED` کنترل می‌شود.
- **اثر باقی‌مانده:** فایل JSON برای چند process، lock توزیع‌شده و scale افقی کافی نیست.
- **معیار پذیرش:**
  - [x] save/load/delete deterministic و تست‌پذیر باشد.
  - [x] write اتمیک و schema version داشته باشد.
  - [x] startup/load failure رفتار کنترل‌شده داشته باشد.
  - [ ] persistence database/shared store برای production scale اضافه شود.

### ISS-006 — گسترش تست‌های unit و integration قوانین اصلی بازی

- **شدت:** P1 / کیفیت
- **وضعیت:** unit و integration چندبازیکنه در این batch تکمیل شد؛ product flow کامل هنوز باز است.
- **محل:** `server/test/core.test.js`, `server/test/engine.test.js`, `server/test/integration.test.js`
- **تغییر:** core/engine و ۲۱ سناریوی Socket.io واقعی برای create/join، broadcast، private state isolation، invalid ack، disconnect/reconnect و دو روم مستقل پوشش داده شد.
- **معیار پذیرش:**
  - [x] script استاندارد `npm test` وجود داشته باشد.
  - [x] قوانین core و pending actionهای engine پوشش داده شوند.
  - [x] تست چندبازیکنه‌ی Socket.io در CI قابل اجرا باشد.
  - [ ] تست end-to-end کامل برای setup، roll/discard/robber، trade و winner اضافه شود.

### ISS-007 — هماهنگ کردن ظرفیت بازیکن‌ها با مستندات و assetها

- **شدت:** P1 / محصول و UX
- **وضعیت:** رفع شد در این batch.
- **محل:** `shared/game-constants.mjs`, `server/src/rooms.js`, `server/src/game/engine.js`, `client/src/App.jsx`, `server/test/rooms.test.js`
- **راه‌حل اعمال‌شده:** `MIN_PLAYERS=2`, `MAX_PLAYERS=4`, رنگ‌ها و asset mapping در shared source of truth قرار گرفتند؛ server join/start و client UI از همان constants استفاده می‌کنند.
- **تست:** contract test و join ظرفیت با `MAX_PLAYERS` هماهنگ است.
- **معیار پذیرش:**
  - [x] ظرفیت در UI، README و server یکسان باشد.
  - [x] تست join برای ظرفیت مجاز و نفر اضافه وجود داشته باشد.
  - [x] رنگ/asset خارج از ظرفیت استفاده نشود.

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
- **وضعیت:** قرارداد اصلی undo در این batch تثبیت و تست شد؛ طراحی undo چندمرحله‌ای هنوز باز است.
- **محل:** `server/src/game/engine.js`, `server/test/engine.test.js`
- **راه‌حل اعمال‌شده:** snapshot اکنون robber و وضعیت کارت توسعه را هم نگه می‌دارد؛ بعد از restore checkpoint refresh می‌شود و undo تکراری بدون action با خطای کنترل‌شده رد می‌شود.
- **تست:** ۱۹ تست برای no-op undo، checkpoint lifecycle، public/private consistency و sequenceهای ترکیبی build/trade/dev-card اضافه شد.
- **معیار پذیرش:**
  - [x] تست ترکیبی build/trade/dev-card/undo وجود دارد.
  - [x] undo دوباره بدون اکشن جدید رفتار تعریف‌شده دارد.
  - [x] stateهای public/private بعد از undo سازگار می‌مانند.
  - [ ] undo چندمرحله‌ای یا history کامل در صورت نیاز محصول طراحی شود.

---

## P2 — کیفیت و نگه‌داری

### ISS-011 — حذف duplication بین client و server

- **شدت:** P2 / نگه‌داری
- **وضعیت:** constants و event/state contractهای اصلی shared شده‌اند؛ contractهای کامل versioned برای همه‌ی API هنوز باز هستند.
- **محل:** `shared/game-constants.mjs`, `shared/contracts.mjs`, `client/src/game/constants.js`, `server/src/game/core.js`, `server/src/validation.js`
- **راه‌حل اعمال‌شده:** constants ظرفیت/resource/build و event names، payload shapes، phaseها، pendingها و public/private boundaries در shared modules تعریف و frozen شدند.
- **تست:** ۶۲ تست contract برای constants، event/state shapes، immutability و cross-reference.
- **معیار پذیرش:**
  - [x] BUILD_COST و RESOURCE_TYPES یک source of truth دارند.
  - [x] client build و server test با import مشترک موفق‌اند.
  - [x] public/private state contract تست می‌شود.
  - [ ] contractها versioned و به validation/runtime schema کامل متصل شوند.

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
- **وضعیت:** رفع شد در این batch.
- **محل:** `.prettierrc`, `.prettierignore`, `client/package.json`, `server/package.json`, `.github/workflows/ci.yml`
- **راه‌حل اعمال‌شده:** Prettier و `format:check` در client/server فعال شدند و CI پیش از lint آن‌ها را اجرا می‌کند.
- **معیار پذیرش:**
  - [x] lint در هر دو package اجرا شود.
  - [x] format check deterministic باشد.
  - [x] CI روی format و lint شکست را گزارش کند.

### ISS-014 — تکمیل CI برای نصب، build، lint و test

- **شدت:** P2 / اتوماسیون
- **وضعیت:** workflow hardening شد؛ branch protection هنوز نیازمند تنظیم GitHub با دسترسی مالک است.
- **محل:** `.github/workflows/ci.yml`
- **راه‌حل اعمال‌شده:** concurrency با cancel stale run، job مستقل shared contract، job names پایدار و syntax check کامل‌تر اضافه شد؛ permissions حداقلی `contents: read` باقی است.
- **Required checks پیشنهادی:** `Shared contract tests`, `Client format, lint, test, build`, `Server format, lint, test, syntax`.
- **معیار پذیرش:**
  - [x] PR شامل format، `npm ci`, build، lint و test باشد.
  - [x] secret و environment production وارد CI نشود.
  - [x] jobهای required نام پایدار داشته باشند.
  - [ ] branch protection در GitHub فعال شود.

### ISS-015 — مدیریت پیکربندی و health check production

- **شدت:** P2 / عملیاتی
- **وضعیت:** بخش config و health اصلی رفع شد؛ readiness/liveness و TTL config در این batch تکمیل شدند.
- **محل:** `server/src/config.js`, `server/src/index.js`, `server/test/config.test.js`, `server/test/health.test.js`, `server/test/shutdown.test.js`
- **راه‌حل اعمال‌شده:** PORT و `ROOM_TTL_MS` validate می‌شوند؛ `/health` backward-compatible است؛ `/health/live` liveness و `/health/ready` readiness با room-store و memory check اضافه شدند؛ graceful shutdown حفظ شده است.
- **تست:** config، health/live/ready و ترتیب graceful shutdown تست شده‌اند.
- **معیار پذیرش:**
  - [x] config نامعتبر مقدار کنترل‌شده دارد و warning/fallback می‌دهد.
  - [x] shutdown اتصال‌ها را به‌ترتیب تمیز می‌بندد.
  - [x] health endpoint قراردادی و مستند است.
  - [x] readiness و liveness جداگانه اضافه شده‌اند.

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
- **وضعیت:** persistence فایل JSON برای recovery اضافه شده؛ حساب کاربری و persistence database/shared هنوز باز است.
- **مشکل:** بازیکن نام موقت دارد و بازی به user واقعی متصل نیست؛ فایل JSON برای scale افقی مناسب نیست.
- **معیار پذیرش:** user/session، مالکیت بازی، migration داده‌ها و storage چندپردازشی مشخص و تست‌پذیر باشند.

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

1. `ISS-016` و `ISS-004`: تمیز کردن working tree و تثبیت نصب — انجام شد.
2. `ISS-001` تا `ISS-003`: بستن سطح حمله‌ی پایه — انجام شد.
3. `ISS-002`, `ISS-008`, `ISS-009`: validation و authorization ورودی‌ها — انجام شد.
4. `ISS-006`: تست‌های core و engine — بخش unit انجام شد؛ end-to-end باز است.
5. `ISS-007`: ظرفیت و assetهای رسمی — تست ظرفیت انجام شد؛ source of truth UI باز است.
6. `ISS-005`, `ISS-010`: persistence و قرارداد undo — باز.
7. `ISS-011` تا `ISS-015`: shared contract، formatter، branch protection و readiness/liveness — بخشی انجام شد؛ موارد علامت‌گذاری‌شده باز هستند.

## وضعیت deploy production

- **آخرین deploy:** commit `98c1c68` روی `catan.saeedlavasani.ir` با Docker اجرا شد.
- **نتیجه:** `/health`, `/health/live`, `/health/ready` و ساخت روم از دامنه‌ی واقعی موفق بودند.
- **حفاظت sabtbrooker:** کانتینرهای sabtbrooker و `sabtbrooker-nginx` در redeploy متوقف یا بازسازی نشدند و بعد از عملیات healthy/running باقی ماندند.
- **rollback:** snapshot در `/root/catan-redeploy-backup-20260804_191354.tar.gz` روی سرور ایجاد شد.
- **نکته:** source deploy محلی `/opt/catan-online` هنوز باید با artifactهای Docker/Nginx همین commit sync شود تا restart آینده compose قدیمی را اجرا نکند.

## روند batch توسعه

برای حفظ context و کنترل کیفیت، هر batch حداکثر پنج تسک مستقل دارد. agentها فقط کد و تست تسک خود را اجرا می‌کنند و مستندات/commit/push انجام نمی‌دهند. agent اصلی بعد از بررسی خروجی همه‌ی agentها، quality gate و verify مستقل، `README.md`، `HANDOFF.md` و همین فایل را به‌روز می‌کند و یک commit واحد push می‌کند. این قرارداد باید در انتقال پروژه به گفت‌وگو یا اکانت دیگر نیز حفظ شود.

7. سپس reconnect، persistence، حساب کاربری و UX.
