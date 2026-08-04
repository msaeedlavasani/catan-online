# Catan Online

نسخه‌ی آنلاین و چندنفره‌ی بازی کاتان با کلاینت React/Vite و سرور Node.js/Socket.io. منطق بازی در سرور اجرا و اعتبارسنجی می‌شود و کلاینت فقط state عمومی تخته و state خصوصی بازیکن خودش را دریافت می‌کند.

> وضعیت فعلی: پروژه قابل نصب و build است، اما هنوز MVP پایدار و production-ready نیست. فهرست مشکلات و برنامه‌ی رفع آن‌ها در [`HANDOFF.md`](./HANDOFF.md) و [`ISSUES.md`](./ISSUES.md) قرار دارد.

## وضعیت فعلی

- ظرفیت فعلی روم: **۲ تا ۴ بازیکن**؛ فقط چهار رنگ فعلی asset کامل دارند.
- نگهداری روم‌ها: state اصلی در حافظه و mirror پایدار در فایل JSON نسخه‌دار؛ بازی‌ها بعد از restart قابل بازیابی هستند، اما هنوز database/multi-process store نداریم.
- احراز هویت و حساب کاربری: وجود ندارد.
- lint، format check و تست‌های خودکار فعال‌اند؛ server اکنون ۲۴۹ تست، shared contractها ۶۲ تست و client هفت تست دارند.
- integration test چندبازیکنه‌ی Socket.io اضافه شده است.
- پایگاه‌داده: در نسخه‌ی فعلی استفاده نمی‌شود؛ persistence فعلی فایل JSON است.

## ساختار پروژه

```text
catan-online/
├── client/                 # React + Vite + Socket.io client
│   ├── public/assets/      # assetهای تصویری تخته و مهره‌ها
│   └── src/
│       ├── components/     # رندر تخته و پنل‌های بازی
│       ├── game/           # ثابت‌ها و helperهای کلاینت
│       └── App.jsx         # جریان اصلی UI و state کلاینت
├── server/                 # Node.js + Express + Socket.io
│   └── src/
│       ├── game/core.js    # مدل state، تخته و helperهای قوانین
│       ├── game/engine.js  # اکشن‌های server-authoritative بازی
│       ├── rooms.js        # مدیریت in-memory روم‌ها و TTL
│       ├── storage.js      # persistence اتمیک JSON روم‌ها
│       ├── config.js       # validation تنظیمات و readiness
│       └── index.js         # HTTP API و health/Socket.io
├── shared/                 # قراردادهای مشترک client/server
│   ├── game-constants.mjs  # constants بازی و ظرفیت
│   └── contracts.mjs       # event/state contracts
├── HANDOFF.md              # راهنمای تحویل و برنامه‌ی ادامه‌ی کار
├── ISSUES.md               # backlog مشکلات با اولویت و معیار پذیرش
└── ROADMAP.md              # نقشه‌ی راه محصول
```

## پیش‌نیازها

- Node.js و npm
- دو پورت آزاد برای کلاینت (`5173`) و سرور (`4000`)

نسخه‌ی دقیق Node در ریپو pin نشده است؛ قبل از production بهتر است نسخه‌ی پشتیبانی‌شده در `.nvmrc` یا `engines` مشخص شود.

## اجرای محلی

### ۱. اجرای سرور

```bash
cd server
npm ci
npm run dev
```

سرور روی `http://localhost:4000` اجرا می‌شود و health check در مسیر `GET /health` قرار دارد. این endpoint وضعیت سرویس، uptime و PID را به‌صورت JSON برمی‌گرداند. برای orchestration، `GET /health/live` liveness و `GET /health/ready` readiness با بررسی room store و memory ارائه می‌شوند. مقدار `PORT` باید عدد صحیح بین ۱ تا ۶۵۵۳۵ باشد؛ مقدار نامعتبر با warning به ۴۰۰۰ fallback می‌کند. سرور روی `SIGTERM` و `SIGINT` ابتدا Socket.io و سپس HTTP را graceful می‌بندد.

### ۲. اجرای کلاینت

در ترمینال دوم:

```bash
cd client
npm ci
npm run dev
```

سپس آدرس نمایش‌داده‌شده توسط Vite را باز کنید؛ معمولاً `http://localhost:5173` است.

در development کلاینت بدون تنظیم اضافه به `http://localhost:4000` وصل می‌شود. برای production، آدرس عمومی backend را **قبل از build** در `client/.env` تنظیم کنید:

```env
VITE_SERVER_URL=https://api.example.com
```

اگر frontend و backend روی یک origin هستند، می‌توانید `VITE_SERVER_URL` را خالی بگذارید تا کلاینت از origin فعلی مرورگر استفاده کند. بعد از هر تغییر این مقدار، باید دوباره `npm run build` اجرا شود.

روی سرور نیز origin frontend را تنظیم کنید؛ نمونه‌ی کامل در [`server/.env.example`](./server/.env.example) است:

```env
NODE_ENV=production
CLIENT_ORIGIN=https://game.example.com
PORT=4000
ROOM_TTL_MS=300000
STORAGE_PATH=data/rooms
STORAGE_REQUIRED=false
READINESS_MEMORY_THRESHOLD=0.9
```

چند origin با comma قابل تعریف است. اگر `NODE_ENV=production` باشد و `CLIENT_ORIGIN` تنظیم نشده باشد، سرور عمداً startup را متوقف می‌کند تا اتصال browser به‌صورت خاموش خراب نشود.

## دستورات توسعه

### Client

```bash
cd client
npm run dev       # توسعه
npm run build     # build تولیدی
npm run preview   # سرو کردن build محلی
```

### Server

```bash
cd server
npm run dev       # توسعه با nodemon
npm start         # اجرای مستقیم
```

scriptهای `lint`، `format:check` و `test` در هر دو package فعال هستند. ورودی‌های Socket.io با validation مرکزی در `server/src/validation.js` بررسی می‌شوند و قرارداد event/state در `shared/contracts.mjs` با contract test کنترل می‌شود. تست‌های integration چندبازیکنه در `server/test/integration.test.js` و persistence در `server/test/storage.test.js` قرار دارند. قبل از انتشار، `npm audit` نیز باید بررسی شود.

## معماری کوتاه

- Express فقط health check و middlewareهای پایه را فراهم می‌کند.
- Socket.io رویدادهای ساخت/پیوستن به روم و اکشن‌های بازی را مدیریت می‌کند.
- `server/src/game/engine.js` مرجع اعتبارسنجی اکشن‌هاست؛ به منطق بازی از سمت کلاینت اعتماد نمی‌شود.
- state عمومی بدون دست کارت و منابع سایر بازیکنان broadcast می‌شود و state خصوصی هر بازیکن جداگانه ارسال می‌گردد.
- روم‌ها در `Map` به‌عنوان source of truth نگهداری می‌شوند و mirror فایل JSON دارند؛ این معماری برای چند process یا scale افقی کافی نیست و باید به shared database/store ارتقا پیدا کند.

## بررسی سریع صحت پروژه

```bash
cd client
npm ci
npm run build

cd ../server
npm ci
node --check src/index.js
node --check src/rooms.js
node --check src/game/core.js
node --check src/game/engine.js
node --check src/validation.js
npm test
npm run lint
```

## مستندات ادامه‌ی کار

- [`HANDOFF.md`](./HANDOFF.md): وضعیت فنی، ریسک‌ها، روش ادامه و ترتیب پیشنهادی کار.
- [`ISSUES.md`](./ISSUES.md): issueهای مستقل با شدت، محل، اثر، راه‌حل و معیار پذیرش.
- [`ROADMAP.md`](./ROADMAP.md): roadmap محصول.

## روند ادامه‌ی توسعه

توسعه‌ی پروژه به batchهای حداکثر پنج‌تایی از تسک‌های مستقل تقسیم می‌شود. agentها فقط کد و تست scope خود را تغییر می‌دهند؛ بررسی نهایی، حل conflict، به‌روزرسانی `README.md`، `HANDOFF.md` و `ISSUES.md`، commit و push فقط توسط agent اصلی انجام می‌شود. جزئیات این روند در بخش ۱۱ [`HANDOFF.md`](./HANDOFF.md) ثبت شده است.

## مجوز

در حال حاضر فایل license در ریپو تعریف نشده است. پیش از انتشار عمومی، مجوز پروژه مشخص شود.
