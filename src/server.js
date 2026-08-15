// src/server.js
// ============================================
// 🤖 سرور اصلی اتوماسیون اینستاگرام
// ============================================
require('dotenv').config();

const express = require('express');
const config = require('./config');
const db = require('./services/database');

// مسیرها
const webhookRouter = require('./routes/webhook');
const authRouter = require('./routes/auth');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const dashboardRouter = require('./routes/dashboard');

const app = express();

// ============================================
// Middleware
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS (برای فرانت‌اند)
app.use((req, res, next) => {
  const allowedOrigins = [
    config.site.url,
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// لاگ درخواست‌ها
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ============================================
// مسیرها
// ============================================

// Webhook اینستاگرام (بدون تغییر مسیر)
app.use('/webhook', webhookRouter);

// فرآیند اتصال (OAuth)
app.use('/auth', authRouter);

// مدیریت محصولات
app.use('/api/products', productsRouter);

// مدیریت سفارشات
app.use('/api/orders', ordersRouter);

// داشبورد
app.use('/api/dashboard', dashboardRouter);

// ============================================
// صفحات ساده
// ============================================

// صفحه سلامت سرور
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Instagram Auto Bot',
    version: '1.0.0',
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Railway health check
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// صفحه اصلی
app.get('/', (req, res) => {
  res.json({
    name: '🤖 Instagram Auto Bot API',
    version: '1.0.0',
    docs: {
      health: '/health',
      webhook: '/webhook',
      auth: '/auth/connect?user_id=YOUR_USER_ID',
      products: '/api/products?user_id=YOUR_USER_ID',
      orders: '/api/orders?user_id=YOUR_USER_ID',
      dashboard: '/api/dashboard?user_id=YOUR_USER_ID'
    }
  });
});

// ============================================
// مدیریت خطاها
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ خطای سرور:', err.message);
  res.status(500).json({ error: 'خطای داخلی سرور' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'مسور پیدا نشد' });
});

// ============================================
// راه‌اندازی سرور
// ============================================
async function start() {
  try {
    // اتصال به دیتابیس
    console.log('🔌 در حال اتصال به دیتابیس...');
    await db.query('SELECT 1');
    console.log('✅ دیتابیس متصل شد');

    // ایجاد جداول
    await db.initializeDatabase();

    // راه‌اندازی سرور
    const port = process.env.PORT || config.port;
    app.listen(port, '0.0.0.0', () => {
      console.log('');
      console.log('🤖 ============================================');
      console.log('🤖  Instagram Auto Bot - سرور فعال شد!');
      console.log('🤖 ============================================');
      console.log(`🌐 آدرس: http://0.0.0.0:${port}`);
      console.log(`📡 Webhook: http://0.0.0.0:${port}/webhook`);
      console.log(`🔗 اتصال: http://0.0.0.0:${port}/auth/connect?user_id=YOUR_ID`);
      console.log(`📊 داشبورد: http://0.0.0.0:${port}/api/dashboard?user_id=YOUR_ID`);
      console.log('🤖 ============================================');
      console.log('');
    });
  } catch (error) {
    console.error('❌ خطا در راه‌اندازی:', error.message);
    process.exit(1);
  }
}

start();
