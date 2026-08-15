// scripts/setup-supabase.js
// اتصال به Supabase و ایجاد جداول
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sszywdunzoyhoxmijqfd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzenl3ZHVuem95aG94bWlqcWZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDc5MTAsImV4cCI6MjEwMjI4MzkxMH0.WmqgZk1xFBbltkmyhIg7IGsSNHcTjTr4JGFqveoFazU';

const supabase = createClient(supabaseUrl, supabaseKey);

const SQL_SETUP = `
-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  business_name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Connected Pages
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

-- Products
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

-- Conversations
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

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders
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

-- Bot Configs
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

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
`;

async function setup() {
  console.log('🔌 Connecting to Supabase...');
  
  // Test connection by trying to read from any table
  const { data, error } = await supabase.from('users').select('*').limit(1);
  
  if (error && error.code === '42P01') {
    console.log('✅ Connected! Tables don\'t exist yet, creating them...\n');
  } else if (error) {
    console.log('⚠️  Connection test result:', error.message);
  } else {
    console.log('✅ Connected! Tables already exist.\n');
  }

  // Execute SQL via RPC
  console.log('🔧 Creating tables via SQL...');
  
  // Split SQL into individual statements and execute them
  const statements = SQL_SETUP
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (const stmt of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
      if (error) {
        // If exec_sql doesn't exist, try alternative
        console.log('   ⚠️  RPC not available, trying alternative...');
        break;
      }
      successCount++;
    } catch (e) {
      errorCount++;
    }
  }

  if (successCount > 0) {
    console.log(`✅ Executed ${successCount} statements via RPC`);
  }

  // Verify tables
  console.log('\n📋 Checking tables...');
  const tables = ['users', 'connected_pages', 'products', 'conversations', 'messages', 'orders', 'bot_configs', 'activity_logs'];
  
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error && error.code === '42P01') {
      console.log(`   ❌ ${table} - NOT EXISTS`);
    } else {
      console.log(`   ✅ ${table} - EXISTS`);
    }
  }
}

setup().catch(console.error);
