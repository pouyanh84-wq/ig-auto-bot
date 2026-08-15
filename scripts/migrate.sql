-- ============================================
-- 🤖 Instagram Auto Bot — Database Schema
-- این SQL رو در Supabase SQL Editor اجرا کن
-- ============================================

-- Users (فروشنده‌ها)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  business_name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Connected Pages (پیج‌های متصل شده)
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

-- Products (محصولات)
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

-- Conversations (مکالمات)
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

-- Messages (پیام‌ها)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders (سفارشات)
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

-- Bot Configs (تنظیمات چت‌بات)
CREATE TABLE IF NOT EXISTS bot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connected_page_id UUID UNIQUE REFERENCES connected_pages(id) ON DELETE CASCADE,
  welcome_message TEXT DEFAULT 'سلام! خوش اومدید. چطور می‌تونم کمکتون کنم؟',
  product_catalog_prompt TEXT,
  auto_reply_rules JSONB DEFAULT '{}',
  working_hours JSONB DEFAULT '{"start": "09:00", "end": "23:00", "timezone": "Asia/Tehran"}',
  fallback_message TEXT DEFAULT 'متأسفم، الان نمی‌تونم جواب بدم. لطفاً بعداً دوباره پیام بدید.',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity Logs (لاگ فعالیت‌ها)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- آماده! حالا دیتابیس کامله ✅
-- ============================================
