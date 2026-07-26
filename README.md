# Catan Online

نسخه‌ی آنلاین و چندنفره (۲ تا ۶ نفر) بازی کاتان.

## ساختار پروژه

```
catan-game/
├── server/     # Node.js + Express + Socket.io + SQLite
└── client/     # React + Vite
```

## اجرای محلی (Development)

### سرور
```bash
cd server
npm install
npm run dev     # روی http://localhost:4000 بالا میاد
```

### کلاینت
```bash
cd client
npm install
npm run dev     # روی http://localhost:5173 بالا میاد
```

کلاینت به‌صورت پیش‌فرض به `http://localhost:4000` وصل می‌شه (قابل تغییر با فایل `.env` در پوشه‌ی client، متغیر `VITE_SERVER_URL`).

## نقشه‌ی راه (Roadmap)

پیشرفت پروژه رو در [`ROADMAP.md`](./ROADMAP.md) ببینید. فعلاً روی **اسپرینت ۰ (پایه‌ریزی ریپو و پلمبینگ سرور/کلاینت)** هستیم.

## استک فنی
- **Server:** Node.js, Express, Socket.io, better-sqlite3
- **Client:** React, Vite, Socket.io-client
