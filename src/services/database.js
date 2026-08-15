// src/services/database.js
// مدیریت دیتابیس PostgreSQL / Supabase
const { Pool } = require('pg');
const config = require('../config');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      ssl: {
        rejectUnauthorized: false // برای Supabase Pooler
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    
    pool.on('error', (err) => {
      console.error('❌ خطای غیرمنتظره در دیتابیس:', err);
    });
  }
  return pool;
}

// ============================================
// اجرای کوئری
// ============================================
async function query(text, params = []) {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// ============================================
// کاربران (فروشنده‌ها)
// ============================================
async function findUserByEmail(email) {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function createUser({ email, passwordHash, businessName }) {
  const result = await query(
    `INSERT INTO users (id, email, password_hash, business_name) 
     VALUES (gen_random_uuid(), $1, $2, $3) 
     RETURNING *`,
    [email, passwordHash, businessName]
  );
  return result.rows[0];
}

// ============================================
// پیج‌های متصل شده
// ============================================
async function findConnectedPageByPageId(instagramAccountId) {
  const result = await query(
    'SELECT * FROM connected_pages WHERE instagram_account_id = $1 AND is_active = true',
    [instagramAccountId]
  );
  return result.rows[0] || null;
}

async function findConnectedPagesByUserId(userId) {
  const result = await query(
    'SELECT * FROM connected_pages WHERE user_id = $1 ORDER BY connected_at DESC',
    [userId]
  );
  return result.rows;
}

async function saveConnectedPage({ userId, pageId, instagramAccountId, accessToken, pageName }) {
  const result = await query(
    `INSERT INTO connected_pages (id, user_id, page_id, instagram_account_id, access_token, page_name) 
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) 
     ON CONFLICT (instagram_account_id) 
     DO UPDATE SET access_token = $4, page_name = $5, is_active = true
     RETURNING *`,
    [userId, pageId, instagramAccountId, accessToken, pageName]
  );
  return result.rows[0];
}

async function updateAccessToken(instagramAccountId, newToken) {
  await query(
    'UPDATE connected_pages SET access_token = $2 WHERE instagram_account_id = $1',
    [instagramAccountId, newToken]
  );
}

// ============================================
// محصولات
// ============================================
async function getProductsByUserId(userId) {
  const result = await query(
    'SELECT * FROM products WHERE user_id = $1 AND is_active = true ORDER BY name',
    [userId]
  );
  return result.rows;
}

async function createProduct({ userId, name, description, price, stock, category, imageUrl }) {
  const result = await query(
    `INSERT INTO products (id, user_id, name, description, price, stock, category, image_url) 
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7) 
     RETURNING *`,
    [userId, name, description, price, stock, category, imageUrl]
  );
  return result.rows[0];
}

async function updateProduct(id, fields) {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  
  const result = await query(
    `UPDATE products SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0];
}

// ============================================
// مکالمات
// ============================================
async function findOrCreateConversation({ userId, connectedPageId, customerIgId }) {
  // ابتدا مکالمه موجود رو پیدا کن
  let result = await query(
    'SELECT * FROM conversations WHERE customer_ig_id = $1 AND connected_page_id = $2',
    [customerIgId, connectedPageId]
  );

  if (result.rows.length > 0) {
    // بروزرسانی زمان آخرین پیام
    await query(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
      [result.rows[0].id]
    );
    return result.rows[0];
  }

  // مکالمه جدید بساز
  result = await query(
    `INSERT INTO conversations (id, user_id, connected_page_id, customer_ig_id) 
     VALUES (gen_random_uuid(), $1, $2, $3) 
     RETURNING *`,
    [userId, connectedPageId, customerIgId]
  );
  return result.rows[0];
}

// ============================================
// پیام‌ها
// ============================================
async function saveMessage({ conversationId, sender, content, messageType, metadata }) {
  const result = await query(
    `INSERT INTO messages (id, conversation_id, sender, content, message_type, metadata) 
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) 
     RETURNING *`,
    [conversationId, sender, content, messageType || 'text', metadata ? JSON.stringify(metadata) : null]
  );
  return result.rows[0];
}

async function getConversationHistory(conversationId, limit = 20) {
  const result = await query(
    `SELECT * FROM messages 
     WHERE conversation_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [conversationId, limit]
  );
  return result.rows.reverse(); // قدیمی‌ترین اول
}

// ============================================
// سفارشات
// ============================================
async function createOrder({ userId, conversationId, customerIgId, items, totalAmount, shippingInfo }) {
  const result = await query(
    `INSERT INTO orders (id, user_id, conversation_id, customer_ig_id, items, total_amount, shipping_info) 
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6) 
     RETURNING *`,
    [userId, conversationId, customerIgId, JSON.stringify(items), totalAmount, JSON.stringify(shippingInfo)]
  );
  return result.rows[0];
}

async function updateOrderStatus(orderId, status, paymentStatus) {
  const result = await query(
    `UPDATE orders 
     SET status = COALESCE($2, status), 
         payment_status = COALESCE($3, payment_status),
         updated_at = NOW() 
     WHERE id = $1 
     RETURNING *`,
    [orderId, status, paymentStatus]
  );
  return result.rows[0];
}

async function getOrdersByUserId(userId, limit = 50) {
  const result = await query(
    `SELECT o.*, c.customer_ig_id, c.customer_name 
     FROM orders o 
     LEFT JOIN conversations c ON o.conversation_id = c.id 
     WHERE o.user_id = $1 
     ORDER BY o.created_at DESC 
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

// ============================================
// تنظیمات چت‌بات
// ============================================
async function getBotConfig(connectedPageId) {
  const result = await query(
    'SELECT * FROM bot_configs WHERE connected_page_id = $1',
    [connectedPageId]
  );
  return result.rows[0] || null;
}

async function saveBotConfig({ connectedPageId, welcomeMessage, productCatalogPrompt, autoReplyRules, workingHours, fallbackMessage }) {
  const result = await query(
    `INSERT INTO bot_configs (id, connected_page_id, welcome_message, product_catalog_prompt, auto_reply_rules, working_hours, fallback_message)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
     ON CONFLICT (connected_page_id)
     DO UPDATE SET welcome_message = $2, product_catalog_prompt = $3, auto_reply_rules = $4, working_hours = $5, fallback_message = $6
     RETURNING *`,
    [connectedPageId, welcomeMessage, productCatalogPrompt, 
     autoReplyRules ? JSON.stringify(autoReplyRules) : null,
     workingHours ? JSON.stringify(workingHours) : null,
     fallbackMessage]
  );
  return result.rows[0];
}

// ============================================
// آمار و گزارش
// ============================================
async function getDashboardStats(userId) {
  const [conversations, orders, revenue] = await Promise.all([
    query(
      `SELECT COUNT(*) as total, 
              COUNT(*) FILTER (WHERE status = 'active') as active 
       FROM conversations WHERE user_id = $1`,
      [userId]
    ),
    query(
      `SELECT COUNT(*) as total, 
              COUNT(*) FILTER (WHERE status = 'pending') as pending,
              COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed 
       FROM orders WHERE user_id = $1`,
      [userId]
    ),
    query(
      `SELECT COALESCE(SUM(total_amount), 0) as total 
       FROM orders WHERE user_id = $1 AND payment_status = 'paid'`,
      [userId]
    )
  ]);

  return {
    conversations: {
      total: parseInt(conversations.rows[0].total),
      active: parseInt(conversations.rows[0].active)
    },
    orders: {
      total: parseInt(orders.rows[0].total),
      pending: parseInt(orders.rows[0].pending),
      confirmed: parseInt(orders.rows[0].confirmed)
    },
    revenue: parseFloat(revenue.rows[0].total)
  };
}

// ============================================
// ایجاد جداول دیتابیس
// ============================================
async function initializeDatabase() {
  console.log('🔧 در حال ایجاد جداول دیتابیس...');
  
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      business_name TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS connected_pages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      page_id TEXT,
      instagram_account_id TEXT UNIQUE NOT NULL,
      page_name TEXT,
      access_token TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      connected_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      price DECIMAL(12,2) NOT NULL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      category TEXT,
      image_url TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      connected_page_id UUID REFERENCES connected_pages(id) ON DELETE CASCADE,
      customer_ig_id TEXT NOT NULL,
      customer_name TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      last_message_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'text',
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      conversation_id UUID REFERENCES conversations(id),
      customer_ig_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      total_amount DECIMAL(12,2) DEFAULT 0,
      items JSONB DEFAULT '[]',
      shipping_info JSONB DEFAULT '{}',
      payment_status TEXT DEFAULT 'unpaid',
      payment_reference TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bot_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connected_page_id UUID UNIQUE REFERENCES connected_pages(id) ON DELETE CASCADE,
      welcome_message TEXT DEFAULT 'سلام! 👋 خوش اومدید. چطور می‌تونم کمکتون کنم؟',
      product_catalog_prompt TEXT,
      auto_reply_rules JSONB DEFAULT '{}',
      working_hours JSONB DEFAULT '{"start": "09:00", "end": "23:00", "timezone": "Asia/Tehran"}',
      fallback_message TEXT DEFAULT 'متأسفم، الان نمی‌تونم جواب بدم. لطفاً بعداً دوباره پیام بدید.',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      details JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log('✅ جداول دیتابیس با موفقیت ایجاد شد');
}

module.exports = {
  query,
  findUserByEmail,
  findUserById,
  createUser,
  findConnectedPageByPageId,
  findConnectedPagesByUserId,
  saveConnectedPage,
  updateAccessToken,
  getProductsByUserId,
  createProduct,
  updateProduct,
  findOrCreateConversation,
  saveMessage,
  getConversationHistory,
  createOrder,
  updateOrderStatus,
  getOrdersByUserId,
  getBotConfig,
  saveBotConfig,
  getDashboardStats,
  initializeDatabase
};
