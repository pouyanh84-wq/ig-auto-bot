// src/services/ai.js - Groq Free AI (v2 - Fixed Model Names)
const axios = require('axios');

const SYSTEM_PROMPT = `تو یک ادمین فروش حرفه‌ای برای خدمات طراحی وبسایت Pouyan.com هستی.

اطلاعات کسب‌وکار:
نام: Pouyan.com
حوزه: طراحی وبسایت اختصاصی
شماره تماس: ۰۹۱۲۱۲۳۴۵۶۷

خدمات:
- طراحی وبسایت اختصاصی (بدون قالب آماده)
- نسخه موبایل حرفه‌ای
- اتصال درگاه پرداخت
- سئو پایه

پلن‌ها:
💎 پلن ۱: ۱۷.۹ میلیون تومان (تحویل قطعی)
🤝 پلن ۲: ۹.۹ میلیون پیش + ۷٪ فروش (۶ ماه)
🚀 پلن ۳: ۰ تومان + ۱۷٪ فروش (۶ ماه، حداقل فروش ۲۰ میلیون)

تماس: ۰۹۱۲۱۲۳۴۵۶۷

قوانین:
- به فارسی جواب بده
- کوتاه و مفید باش
- مودب و حرفه‌ای باش
- اگه مشتری خواست سفارش بده، اطلاعاتش رو جمع کن
`;

// ========================================
// Groq (رایگان - ۳۰ درخواست/دقیقه)
// ========================================
async function tryGroq(fullPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'placeholder' || !apiKey.startsWith('gsk_')) {
    console.log('⚠️ GROQ_API_KEY تنظیم نشده یا اشتباهه');
    return null;
  }

  // مدل‌های مختلف Groq
  const models = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama3-70b-8192',
    'llama3-8b-8192',
    'mixtral-8x7b-32768',
    'gemma-7b-it'
  ];

  for (const model of models) {
    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: fullPrompt }
          ],
          temperature: 0.7,
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const reply = response.data?.choices?.[0]?.message?.content;
      if (reply && reply.length > 5) {
        console.log(`✅ Groq مدل ${model} کار کرد`);
        return reply;
      }
    } catch (e) {
      console.log(`❌ Groq مدل ${model}: ${e.response?.data?.error?.message || e.message}`);
      continue;
    }
  }
  return null;
}

// ========================================
// پاسخ هوشمند پیش‌فرض
// ========================================
function getSmartFallback(userMessage) {
  const msg = userMessage.toLowerCase();
  
  if (msg.includes('سلام') || msg.includes('خوبی') || msg.includes('خوشی') || msg.includes('قربان')) {
    return 'سلام! 👋 خوش اومدید. من دستیار Pouyan.com هستم. چطور می‌تونم کمکتون کنم؟';
  }
  if (msg.includes('قیمت') || msg.includes('تعرفه') || msg.includes('هزینه') || msg.includes('چنده')) {
    return '💰 تعرفه‌های ما:\n💎 پلن ۱: ۱۷.۹ میلیون تومان\n🤝 پلن ۲: ۹.۹ میلیون + ۷٪ فروش\n🚀 پلن ۳: رایگان + ۱۷٪ فروش\n\nکدوم پلن براتون مناسب‌تره؟';
  }
  if (msg.includes('پلن') || msg.includes('توضیح')) {
    return '📋 پلن‌های ما:\n💎 پلن ۱: تحویل قطعی (مالکیت کامل)\n🤝 پلن ۲: مشارکتی (رشد مشترک)\n🚀 پلن ۳: بدون پیش‌پرداخت\n\nهر کدوم رو توضیح بدم؟';
  }
  if (msg.includes('سفارش') || msg.includes('ثبت') || msg.includes('شروع') || msg.includes('می‌خوام')) {
    return '🛒 عالیه! برای ثبت سفارش لطفاً این اطلاعات رو بفرستید:\n۱. نام و نام خانوادگی\n۲. شماره تماس\n۳. نام کسب‌وکار\n۴. پلن مورد نظر';
  }
  if (msg.includes('تماس') || msg.includes('تلفن') || msg.includes('شماره')) {
    return '📞 اطلاعات تماس:\n📱 تلفن: ۰۹۱۲۱۲۳۴۵۶۷\n🌐 سایت: pouyan.com\n💬 تلگرام: @pouyan_dev';
  }
  if (msg.includes('ممنون') || msg.includes('تشکر')) {
    return 'خواهش می‌کنم! 🙏 خوشحالم که تونستم کمکتون کنم.';
  }
  if (msg.includes('بله') || msg.includes('آره') || msg.includes('درسته')) {
    return 'عالیه! ✅ لطفاً اطلاعاتت رو بفرست تا ثبت کنم.';
  }
  
  return 'سلام! 👋 من دستیار هوشمند Pouyan.com هستم.\n\n🔹 قیمت طراحی سایت\n🔹 مشاهده پلن‌ها\n🔹 ثبت سفارش\n🔹 تماس با ما\n\nچطور می‌تونم کمکتون کنم؟';
}

// ========================================
// تابع اصلی
// ========================================
async function generateResponse({ message, customerName, products, conversationHistory, context, botConfig }) {
  const fullPrompt = `مشتری می‌گوید: ${message}

تو باید به فارسی پاسخ بدی.`;

  // روش ۱: Groq (رایگان + سریع)
  let reply = await tryGroq(fullPrompt);
  if (reply) {
    return { text: reply, intent: 'general' };
  }

  // روش ۲: پاسخ هوشمند پیش‌فرض
  console.log('⚠️ Groq کار نکرد، از پاسخ پیش‌فرض استفاده شد');
  return {
    text: getSmartFallback(message),
    intent: 'fallback'
  };
}

async function generateCommentReply(commentText, products) {
  return {
    text: getSmartFallback(commentText)
  };
}

module.exports = { generateResponse, generateCommentReply };
