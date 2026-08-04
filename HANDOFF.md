# هندآف فنی — Catan Online

## ۱. خلاصه اجرایی

این ریپو یک بازی آنلاین چندنفره‌ی کاتان است که از دو اپلیکیشن جدا تشکیل شده است:

- **Client:** React 18 + Vite + Socket.io Client
- **Server:** Node.js ESM + Express + Socket.io

وضعیت فعلی برای ادامه‌ی توسعه مناسب است، اما هنوز باید به‌عنوان یک prototype/MVP ناتمام در نظر گرفته شود. build کلاینت موفق است و lint، تست‌های unit/integration، persistence فایل، CI و syntax check اضافه شده‌اند؛ با این حال پوشش کامل product flow و shared database/multi-process persistence هنوز باقی است.

فهرست کارهای قابل تبدیل به issue در [`ISSUES.md`](./ISSUES.md) قرار دارد.

## ۲. وضعیت بررسی‌شده

| بخش | وضعیت |
|---|---|
| ساختار client/server | موجود و قابل فهم |
| نصب dependencyها | در محیط بررسی موفق |
| build کلاینت | موفق |
| اجرای server syntax check | موفق |
| تست خودکار | ۲۴۹ تست server، ۴۵ تست integration/persistence، ۶۲ تست shared و ۷ تست client؛ پوشش کامل product end-to-end باقی است |
| lint/format | ESLint و Prettier format check فعال |
| CI | GitHub Actions با shared gate، concurrency، format/lint/test/build/syntax فعال است |
| persistence | mirror اتمیک JSON و load در startup فعال؛ database/multi-process store وجود ندارد |
| احراز هویت | وجود ندارد |
| CORS production-safe | allowlist با `CLIENT_ORIGIN` فعال است |
| ظرفیت فعلی روم | ۲ تا ۴ نفر از shared source of truth |
| IDهای روم/بازیکن | crypto-random؛ کد روم collision-aware و player UUID v4 |
| عملیات سرور | PORT/TTL/storage config، health/live/ready و graceful shutdown فعال |
| integration | دو یا چند socket client واقعی، private-state isolation و reconnect تست می‌شوند |

## ۳. معماری فعلی

### Client

ورودی برنامه `client/src/main.jsx` است و جریان اصلی UI در `client/src/App.jsx` قرار دارد. رندر تخته در `BoardSVG.jsx` و پنل‌ها در `Panels.jsx` انجام می‌شود. اتصال Socket.io در `client/src/socket.js` ساخته می‌شود.

کلاینت دو نوع داده دریافت می‌کند:

1. `gameState`: state عمومی بازی، بدون منابع و کارت‌های دست سایر بازیکن‌ها.
2. `myPrivateState`: منابع و کارت‌های توسعه‌ی بازیکن جاری.

آدرس سرور در زمان build از `VITE_SERVER_URL` خوانده می‌شود. در development نبود آن به `http://localhost:4000` fallback می‌کند؛ در production اگر frontend و backend هم‌origin باشند از origin فعلی استفاده می‌شود، و در deploy جدا باید `VITE_SERVER_URL` قبل از build تنظیم شود. همچنین `CLIENT_ORIGIN` باید روی backend production تنظیم شود؛ در غیر این صورت server عمداً startup نمی‌شود. نمونه‌ی backend در `server/.env.example` است.

### Server

`server/src/index.js` مسئول HTTP، health check، graceful shutdown و event handlerهای Socket.io است. `server/src/config.js` مقدارهای `PORT`, `ROOM_TTL_MS`, `STORAGE_PATH` و readiness را validate می‌کند. `server/src/storage.js` mirror اتمیک و versioned JSON را مدیریت می‌کند و `rooms.js` آن را در lifecycle روم مصرف می‌کند. تست‌های lifecycle، integration و storage در `server/test/rooms.test.js`, `server/test/integration.test.js` و `server/test/storage.test.js` قرار دارند.

- `rooms.js`: نگهداری روم‌ها در `Map` و مدیریت create/join/reconnect/disconnect؛ lobby خالی فوراً cleanup می‌شود و روم in-game پس از قطع همه تا `ROOM_TTL_MS` برای reconnect باقی می‌ماند. `storage.js` mirror اتمیک JSON می‌نویسد و در startup روم‌ها را با بازیکنان disconnected restore می‌کند.
- `game/core.js`: مدل state، ساخت هندسه‌ی تخته، منابع، امتیاز و state عمومی.
- `game/engine.js`: منطق server-authoritative برای setup، تاس، راهزن، ساخت‌وساز، معامله، کارت توسعه و پایان نوبت.
- `shared/game-constants.mjs`: source of truth برای constants بازی، ظرفیت و asset mapping.
- `shared/contracts.mjs`: قرارداد event/state و مرز public/private.

هر اکشن از Socket.io به engine می‌رسد و در صورت موفقیت state به روم broadcast می‌شود. integration testها با socket client واقعی private-state isolation، broadcast، invalid ack و reconnect را بررسی می‌کنند.

## ۴. نحوه‌ی اجرای محلی

### نصب

در هر package جداگانه نصب کنید:

```bash
cd server
npm ci

cd ../client
npm ci
```

اگر lockfile معتبر در branch وجود نداشت، ابتدا یک‌بار `npm install` اجرا و lockfile تولیدشده را بررسی و commit کنید؛ هدف نهایی استفاده از `npm ci` در clone تازه است.

### اجرا

ترمینال اول:

```bash
cd server
npm run dev
```

ترمینال دوم:

```bash
cd client
npm run dev
```

بررسی health:

```bash
curl http://localhost:4000/health
```

پاسخ مورد انتظار یک JSON با `ok: true` و نام service است.

## ۵. دستورات اعتبارسنجی فعلی

```bash
cd client
npm run build

cd ../server
node --check src/index.js
node --check src/rooms.js
node --check src/game/core.js
node --check src/game/engine.js
```

در وضعیت فعلی `npm test`, `npm run lint` و `npm run format:check` در هر دو package تعریف شده‌اند. تست‌های client، CORS، validation، core، engine، room lifecycle، integration، storage و health اجرا می‌شوند؛ full suite سرور ۲۴۹ تست دارد. قراردادهای shared در مجموع ۶۲ تست دارند و client هفت تست دارد. پوشش کامل product end-to-end و database چندپردازشی هنوز باز است.

## ۶. ریسک‌های مهم

### امنیت

- CORS با allowlist قابل‌پیکربندی کنترل می‌شود؛ پیش‌فرض development فقط `http://localhost:5173` است.
- ورودی‌های Socket.io اکنون با validation مرکزی بررسی می‌شوند؛ پوشش کامل contractهای بازی هنوز باید توسعه پیدا کند.
- شناسه‌های روم و بازیکن با crypto تولید می‌شوند؛ کد روم collision-aware و player ID از UUID v4 استفاده می‌کند.
- authorization برای pending actionهای کارت توسعه و مالکیت cancel trade بررسی می‌شود؛ پوشش end-to-end کامل بازی هنوز باقی است.

### صحت state

- undo checkpoint همه‌ی قراردادهای state را به‌صورت صریح پوشش نمی‌دهد.
- state اصلی روم در حافظه است و mirror فایل JSON versioned/atomic دارد؛ database یا shared multi-process store هنوز وجود ندارد.
- guardهای اصلی IDهای board و player اضافه شده‌اند؛ validation کامل همه‌ی invariants بازی همچنان نیازمند تست‌های بیشتر است.

### نگه‌داری

- constants اصلی shared شده‌اند؛ translation catalog و همه‌ی state/event contractها هنوز کامل به shared منتقل نشده‌اند.
- متن‌ها و labelها در دو زبان/منبع جدا قرار دارند.
- ESLint، Prettier، ۲۴۹ تست server، ۶۲ تست shared، ۷ تست client و CI فعال هستند؛ آسیب‌پذیری‌های npm و پوشش کامل product end-to-end هنوز باید پیگیری شوند.
- lockfileهای client/server tracked هستند؛ audit و به‌روزرسانی دوره‌ای dependencyها همچنان لازم است.

## ۷. ترتیب پیشنهادی برای ادامه‌ی کار

### فاز صفر — hygiene و بازتولیدپذیری

1. [x] نگه‌داشتن `.gitignore` و حذف فایل‌های generated/system از index.
2. [x] تثبیت lockfileهای client/server و حذف lockfile ریشه.
3. تعریف نسخه‌ی Node پشتیبانی‌شده.
4. [x] اصلاح README و environment example.

### فاز یک — امنیت و ورودی‌ها

1. [x] افزودن validation مرکزی برای event payloadها.
2. [x] امن کردن IDها.
3. [x] اضافه کردن guard برای vertex/edge/tile/player.
4. [x] کامل کردن authorization برای pending actionها و trade.

### فاز دو — تست و تثبیت قوانین

1. [x] تست unit برای `core.js` و `engine.js`.
2. [x] تست lifecycle روم، health و integration چندبازیکنه Socket.io.
3. پوشش product end-to-end برای setup، منابع، تاس ۷، discard، robber، build، trade، dev cards، longest road و winner.
4. [x] تصمیم و تست رسمی undo برای یک checkpoint.
5. طراحی undo چندمرحله‌ای در صورت نیاز محصول.

### فاز سه — tooling و CI

1. [x] formatter و `format:check`.
2. [x] CI با shared contract gate، concurrency و syntax check کامل.
3. فعال‌سازی branch protection و required checks در تنظیمات GitHub.

### فاز چهار — قابلیت محصول

1. reconnect با session واقعی.
2. persistence database/shared برای scale چندپردازشی.
3. حساب کاربری/session.
4. بازی‌های باز، spectator و آمار.
5. responsive/accessibility.

## ۸. قراردادهای توسعه

- منطق قوانین بازی باید در server authoritative باقی بماند؛ client نباید منبع حقیقت باشد.
- هیچ event جدیدی بدون تعریف payload، پاسخ ack و مسیر خطای مشخص اضافه نشود.
- تغییر در game state باید با تست مربوط به همان قانون همراه باشد.
- هیچ secret یا `.env` واقعی commit نشود؛ فقط `.env.example` مجاز است.
- خروجی build، `node_modules` و فایل‌های سیستم وارد commit نشوند.
- هر issue یک تغییر مستقل با توضیح اثر و معیار پذیرش داشته باشد.
- تغییرات مربوط به protocol باید هم‌زمان client و server را بررسی کند.

## ۹. Definition of Done پیشنهادی

یک issue وقتی آماده‌ی merge است که:

- رفتار موردنظر با تست یا دستور قابل تکرار بررسی شده باشد.
- مسیر خطا و ورودی نامعتبر در نظر گرفته شده باشد.
- مستندات/contractهای مرتبط به‌روز شده باشند.
- `git status` فقط تغییرات عمدی را نشان دهد.
- build و quality gateهای موجود سبز باشند.

## ۱۰. نکات تحویل به توسعه‌دهنده‌ی بعدی

1. قبل از تغییر منطق بازی، `server/src/game/engine.js` و مدل state در `core.js` را بخوانید.
2. برای تغییر protocol، eventهای هر دو سمت را در یک تغییر بررسی کنید.
3. ابتدا issueهای باز را به ترتیب priority و dependency انجام دهید؛ refactor shared قبل از داشتن تست ریسک بیشتری دارد.
4. ظرفیت فعلی را ۴ نفر در نظر بگیرید، نه ۶ نفر.
5. فرض نکنید SQLite فعال است؛ در نسخه‌ی فعلی هیچ persistence واقعی وجود ندارد.

## ۱۱. روند اجرای پروژه با batch و agentها

این روند بخشی از قرارداد ادامه‌ی پروژه است و باید حتی در اکانت یا گفت‌وگوی دیگری نیز حفظ شود:

1. حداکثر **۵ تسک مستقل** از `ISSUES.md` بر اساس priority و dependency انتخاب شود.
2. هر تسک به یک agent جدا واگذار شود؛ تسک‌های وابسته یا دارای فایل مشترک باید جداگانه زمان‌بندی شوند.
3. agentها فقط کد و تست مربوط به scope خود را تغییر دهند و نتیجه، فایل‌ها، تست‌ها و blockerها را گزارش کنند.
4. agentها نباید `README.md`، `HANDOFF.md`، `ISSUES.md` یا `ROADMAP.md` را تغییر دهند و نباید commit یا push کنند.
5. agent اصلی بعد از دریافت خروجی همه‌ی agentها مسئول بررسی diff، حل conflict، اجرای quality gate و verify مستقل است.
6. پس از تأیید batch، agent اصلی فقط خودش مستندات اصلی را به‌روز می‌کند، یک commit واحد می‌سازد و به `origin/main` push می‌کند.
7. batch بعدی فقط وقتی شروع شود که `HEAD` با `origin/main` همگام و working tree clean باشد.
8. اگر agentی timeout یا خروجی ناقص داشت، تغییرات workspace باید بررسی و تست شود؛ retry کورکورانه مجاز نیست.
