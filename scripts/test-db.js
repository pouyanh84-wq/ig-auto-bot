// scripts/test-db.js
// تست عملی دیتابیس — ایجاد کاربر آزمایشی
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://sszywdunzoyhoxmijqfd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzenl3ZHVuem95aG94bWlqcWZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDc5MTAsImV4cCI6MjEwMjI4MzkxMH0.WmqgZk1xFBbltkmyhIg7IGsSNHcTjTr4JGFqveoFazU'
);

async function test() {
  console.log('🧪 Testing database operations...\n');

  // 1. Insert test user
  const { data: user, error: userErr } = await supabase
    .from('users')
    .upsert({ 
      email: 'test@example.com', 
      password_hash: 'test_hash_123', 
      business_name: 'فروشگاه آزمایشی' 
    }, { onConflict: 'email' })
    .select()
    .single();

  if (userErr) {
    console.log('❌ User insert error:', userErr.message);
  } else {
    console.log('✅ User created:', user.email, user.business_name);
  }

  // 2. List all tables and count rows
  const tables = ['users', 'connected_pages', 'products', 'conversations', 'messages', 'orders', 'bot_configs', 'activity_logs'];
  
  console.log('\n📊 Table row counts:');
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    console.log(`   ${table}: ${error ? '❌ ' + error.message : count + ' rows'}`);
  }

  // 3. Clean up test data
  if (user) {
    await supabase.from('users').delete().eq('email', 'test@example.com');
    console.log('\n🧹 Test data cleaned up');
  }

  console.log('\n🎉 Database test complete!');
}

test().catch(console.error);
