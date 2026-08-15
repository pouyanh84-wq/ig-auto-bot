# 🤖 Instagram Auto Bot

اتوماسیون هوشمند اینستاگرام برای فروشگاه‌های اینترنتی

## امکانات

- ✅ پاسخ خودکار به دایرکت با هوش مصنوعی
- ✅ مدیریت کامنت‌ها و منشن‌ها
- ✅ ثبت سفارش خودکار
- ✅ CRM و مدیریت مشتریان
- ✅ داشبورد آماری
- ✅ پشتیبانی از چند مشتری همزمان

## راه‌اندازی سریع

### ۱. نصب وابستگی‌ها
```bash
npm install
```

### ۲. ساخت فایل .env
```bash
cp .env.example .env
# سپس مقادیر واقعی رو پر کن
```

### ۳. ساخت دیتابیس
```bash
# در Supabase یا هر PostgreSQL دیگه‌ای، جداول رو بساز
npm run setup-db
```

### ۴. اجرای سرور
```bash
# حالت توسعه (با auto-reload)
npm run dev

# حالت تولید
npm start
```

## ساختار پروژه

```
ig-auto-bot/
├── src/
│   ├── server.js              ← سرور اصلی
│   ├── config/
│   │   └── index.js           ← تنظیمات
│   ├── routes/
│   │   ├── webhook.js         ← Webhook اینستاگرام
│   │   ├── auth.js            ← اتصال پیج (OAuth)
│   │   ├── products.js        ← مدیریت محصولات
│   │   ├── orders.js          ← مدیریت سفارشات
│   │   └── dashboard.js       ← داشبورد و آمار
│   └── services/
│       ├── instagram.js       ← ارتباط با Instagram API
│       ├── ai.js              ← هوش مصنوعی (OpenAI)
│       └── database.js        ← مدیریت دیتابیس
├── .env.example               ← نمونه تنظیمات
├── package.json
└── README.md
```

## API Endpoints

| مسیر | method | توضیح |
|-------|--------|-------|
| `/webhook` | GET | تأیید Webhook |
| `/webhook` | POST | دریافت پیام‌ها |
| `/auth/connect` | GET | شروع اتصال پیج |
| `/auth/callback` | GET | بازگشت OAuth |
| `/auth/pages` | GET | لیست پیج‌ها |
| `/api/products` | GET/POST | محصولات |
| `/api/orders` | GET | سفارشات |
| `/api/dashboard` | GET | آمار و داشبورد |

## مراحل بعدی

1. حساب Meta Developer بساز
2. اپلیکیشن Business بساز
3. Instagram Graph API رو فعال کن
4. Webhook رو تنظیم کن
5. با ngrok تست کن
6. App Review بفرست

## نکات مهم

- فیسبوک App Review ممکنه ۱ تا ۴ هفته طول بکشه
- فقط پیج‌های Business/Creator قابل اتصال هستن
- پیام‌های قدیمی قابل پردازش نیستن
- Rate limit: ~۲۰۰ پیام ارسال در ساعت
