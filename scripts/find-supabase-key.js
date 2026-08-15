// scripts/setup-supabase.js
// اتصال به Supabase با کتابخانه رسمی + ایجاد جداول از طریق SQL
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sszywdunzoyhoxmijqfd.supabase.co';

// سعی در یافتن anon key از تنظیمات
async function findAnonKey() {
  console.log('🔍 Trying to find Supabase anon key...\n');
  
  // Try to get project info from the REST API
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: { 'Content-Type': 'application/json' }
  });
  
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text.substring(0, 500));
  
  // Check headers for info
  console.log('\nResponse headers:');
  for (const [key, value] of res.headers.entries()) {
    if (key.includes('auth') || key.includes('apikey') || key.includes('anon')) {
      console.log(`  ${key}: ${value}`);
    }
  }
}

findAnonKey().catch(console.error);
