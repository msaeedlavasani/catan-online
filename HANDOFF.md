# هندآف فنی — Catan Online

## ۱. خلاصه اجرایی

این ریپو یک بازی آنلاین چندنفره‌ی کاتان است که از دو اپلیکیشن جدا تشکیل شده است:

- **Client:** React 18 + Vite + Socket.io Client
- **Server:** Node.js ESM + Express + Socket.io

وضعیت فعلی برای ادامه‌ی توسعه مناسب است، اما هنوز باید به‌عنوان یک prototype/MVP ناتمام در نظر گرفته شود. build کلاینت موفق است و lint، تست‌های پایه، CI و syntax check اضافه شده‌اند؛ با این حال تست کامل قوانین، persistence و قابلیت‌های production هنوز باقی هستند.

فهرست کارهای قابل تبدیل به issue در [`ISSUES.md`](./ISSUES.md) قرار دارد.

## ۲. وضعیت بررسی‌شده

| بخش | وضعیت |
|---|---|
| ساختار client/server | موجود و قابل فهم |
| نصب dependencyها | در محیط بررسی موفق |
| build کلاینت | موفق |
| اجرای server syntax check | موفق |
| تست خودکار | ۱۴۸ تست server و ۷ تست client؛ پوشش کامل end-to-end باقی است |
| lint/format | ESLint فعال؛ formatter هنوز باقی است |
| CI | GitHub Actions برای lint/test/build/syntax اضافه شده |
| persistence | وجود ندارد؛ state در memory است |
| احراز هویت | وجود ندارد |
| CORS production-safe | allowlist با `CLIENT_ORIGIN` فعال است |
| ظرفیت فعلی روم | ۲ تا ۴ نفر |
| IDهای روم/بازیکن | crypto-random؛ کد روم collision-aware و player UUID v4 |
| عملیات سرور | PORT validation، health metadata و graceful shutdown فعال |

## ۳. معماری فعلی

### Client

ورودی برنامه `client/src/main.jsx` است و جریان اصلی UI در `client/src/App.jsx` قرار دارد. رندر تخته در `BoardSVG.jsx` و پنل‌ها در `Panels.jsx` انجام می‌شود. اتصال Socket.io در `client/src/socket.js` ساخته می‌شود.

کلاینت دو نوع داده دریافت می‌کند:

1. `gameState`: state عمومی بازی، بدون منابع و کارت‌های دست سایر بازیکن‌ها.
2. `myPrivateState`: منابع و کارت‌های توسعه‌ی بازیکن جاری.

آدرس سرور در زمان build از `VITE_SERVER_URL` خوانده می‌شود. در development نبود آن به `http://localhost:4000` fallback می‌کند؛ در production اگر frontend و backend هم‌origin باشند از origin فعلی استفاده می‌شود، و در deploy جدا باید `VITE_SERVER_URL` قبل از build تنظیم شود. همچنین `CLIENT_ORIGIN` باید روی backend production تنظیم شود؛ در غیر این صورت server عمداً startup نمی‌شود. نمونه‌ی backend در `server/.env.example` است.

### Server

`server/src/index.js` مسئول HTTP، health check، graceful shutdown و event handlerهای Socket.io است. `server/src/config.js` مقدار `PORT` را validate می‌کند. تست‌های lifecycle در `server/test/health.test.js`, `server/test/shutdown.test.js` و `server/test/rooms.test.js` قرار دارند.

- `rooms.js`: نگهداری روم‌ها در `Map` و مدیریت create/join/reconnect/disconnect.
- `game/core.js`: مدل state، ساخت هندسه‌ی تخته، منابع، امتیاز و state عمومی.
- `game/engine.js`: منطق server-authoritative برای setup، تاس، راهزن، ساخت‌وساز، معامله، کارت توسعه و پایان نوبت.

هر اکشن از Socket.io به engine می‌رسد و در صورت موفقیت state به روم broadcast می‌شود.

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

در وضعیت فعلی `npm test` و `npm run lint` در هر دو package تعریف شده‌اند. تست‌های client، CORS و validation اجرا می‌شوند؛ validation مرکزی در `server/src/validation.js` ورودی‌های eventها، از جمله eventهای بدون payload مثل `buyDevCard`، را قبل از رسیدن به engine بررسی می‌کند و handlerها خطا را با ack استاندارد برمی‌گردانند. پوشش کامل قوانین بازی همچنان با `ISS-006` دنبال می‌شود.

## ۶. ریسک‌های مهم

### امنیت

- CORS با allowlist قابل‌پیکربندی کنترل می‌شود؛ پیش‌فرض development فقط `http://localhost:5173` است.
- ورودی‌های Socket.io اکنون با validation مرکزی بررسی می‌شوند؛ پوشش کامل contractهای بازی هنوز باید توسعه پیدا کند.
- شناسه‌های روم و بازیکن با crypto تولید می‌شوند؛ کد روم collision-aware و player ID از UUID v4 استفاده می‌کند.
- authorization برای pending actionهای کارت توسعه و مالکیت cancel trade بررسی می‌شود؛ پوشش end-to-end کامل بازی هنوز باقی است.

### صحت state

- undo checkpoint همه‌ی قراردادهای state را به‌صورت صریح پوشش نمی‌دهد.
- state روم فقط در حافظه است.
- guardهای اصلی IDهای board و player اضافه شده‌اند؛ validation کامل همه‌ی invariants بازی همچنان نیازمند تست‌های بیشتر است.

### نگه‌داری

- constants بین client و server تکرار شده‌اند.
- متن‌ها و labelها در دو زبان/منبع جدا قرار دارند.
- ESLint، ۱۴۸ تست server، ۷ تست client و CI فعال هستند؛ formatter و پوشش کامل end-to-end هنوز باقی است.
- lockfileهای client/server tracked هستند؛ audit و به‌روزرسانی دوره‌ای dependencyها همچنان لازم است.

## ۷. ترتیب پیشنهادی برای ادامه‌ی کار

### فاز صفر — hygiene و بازتولیدپذیری

1. نگه‌داشتن `.gitignore` و حذف فایل‌های generated/system از index.
2. تثبیت lockfileهای client/server و حذف lockfile ریشه، مگر اینکه workspace رسمی انتخاب شود.
3. تعریف نسخه‌ی Node پشتیبانی‌شده.
4. اصلاح README و environment example.

### فاز یک — امنیت و ورودی‌ها

1. [x] افزودن validation مرکزی برای event payloadها.
2. [x] امن کردن IDها.
3. [x] اضافه کردن guard برای vertex/edge/tile/player.
4. [x] کامل کردن authorization برای pending actionها و trade.

### فاز دو — تست و تثبیت قوانین

1. [x] تست unit برای `core.js` و `engine.js`.
2. [x] تست lifecycle روم و health check.
3. پوشش setup، منابع، تاس ۷، discard، robber، build، trade، dev cards، longest road و winner به‌صورت end-to-end.
4. تصمیم و تست رسمی undo.

### فاز سه — tooling و CI

1. افزودن formatter و `format:check`.
2. توسعه‌ی تست‌های engine و تبدیل CI به quality gate کامل.
3. گزارش failure قابل فهم در pull request.

### فاز چهار — قابلیت محصول

1. reconnect با lifecycle و TTL مشخص.
2. persistence بازی‌ها.
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
3. ابتدا `ISS-001` تا `ISS-010` را به ترتیب وابستگی انجام دهید؛ refactor shared قبل از داشتن تست ریسک بیشتری دارد.
4. ظرفیت فعلی را ۴ نفر در نظر بگیرید، نه ۶ نفر.
5. فرض نکنید SQLite فعال است؛ در نسخه‌ی فعلی هیچ persistence واقعی وجود ندارد.
