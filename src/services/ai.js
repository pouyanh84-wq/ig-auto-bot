// src/services/ai.js - Groq Free AI + Fallback
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
// روش ۱: Groq (رایگان - ۳۰ درخواست/دقیقه)
// ========================================
async function tryGroq(fullPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'placeholder') return null;

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama3-8b-8192',
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

    return response.data?.choices?.[0]?.message?.content;
  } catch (e) {
    console.log(`❌ Groq کار نکرد: ${e.message}`);
    return null;
  }
}

// ========================================
// روش ۲: Together AI (رایگان - ۵ دلار اعتبار)
// ========================================
async function tryTogether(fullPrompt) {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey || apiKey === 'placeholder') return null;

  try {
    const response = await axios.post(
      'https://api.together.xyz/v1/chat/completions',
      {
        model: 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo',
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

    return response.data?.choices?.[0]?.message?.content;
  } catch (e) {
    console.log(`❌ Together کار نکرد: ${e.message}`);
    return null;
  }
}

// ========================================
// روش ۳: Hugging Face (رایگان)
// ========================================
async function tryHuggingFace(fullPrompt) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey || apiKey === 'placeholder') return null;

  const models = [
    'mistralai/Mistral-7B-Instruct-v0.3',
    'HuggingFaceH4/zephyr-7b-beta',
    'google/gemma-2-2b-it'
  ];

  for (const model of models) {
    try {
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          inputs: fullPrompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            top_p: 0.95,
            repetition_penalty: 1.1,
            do_sample: true
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      let reply = '';
      if (Array.isArray(response.data)) {
        reply = response.data[0]?.generated_text || '';
      } else if (response.data?.generated_text) {
        reply = response.data.generated_text;
      }

      reply = reply.replace(/<s>\[INST\]|<\/s>|\/INST/g, '').trim();
      if (reply && reply.length > 5) {
        console.log(`✅ Hugging Face مدل ${model} کار کرد`);
        return reply;
      }
    } catch (e) {
      console.log(`❌ مدل ${model} کار نکرد: ${e.message}`);
      continue;
    }
  }
  return null;
}

// ========================================
// روش ۴: پاسخ هوشمند پیش‌فرض
// ========================================
function getSmartFallback(userMessage) {
  const msg = userMessage.toLowerCase();
  
  if (msg.includes('سلام') || msg.includes('خوبی') || msg.includes('خوشی')) {
    return 'سلام! 👋 خوش اومدید. من دستیار Pouyan.com هستم. چطور می‌تونم کمکتون کنم؟';
  }
  if (msg.includes('قیمت') || msg.includes('تعرفه') || msg.includes('هزینه')) {
    return '💰 تعرفه‌های ما:\n💎 پلن ۱: ۱۷.۹ میلیون تومان\n🤝 پلن ۲: ۹.۹ میلیون + ۷٪ فروش\n🚀 پلن ۳: رایگان + ۱۷٪ فروش\n\nکدوم پلن براتون مناسب‌تره؟';
  }
  if (msg.includes('پلن') || msg.includes('توضیح')) {
    return '📋 پلن‌های ما:\n💎 پلن ۱: تحویل قطعی (مالکیت کامل)\n🤝 پلن ۲: مشارکتی (رشد مشترک)\n🚀 پلن ۳: بدون پیش‌پرداخت\n\nهر کدوم رو توضیح بدم؟';
  }
  if (msg.includes('سفارش') || msg.includes('ثبت') || msg.includes('شروع')) {
    return '🛒 عالیه! برای ثبت سفارش لطفاً این اطلاعات رو بفرستید:\n۱. نام و نام خانوادگی\n۲. شماره تماس\n۳. نام کسب‌وکار\n۴. پلن مورد نظر';
  }
  if (msg.includes('تماس') || msg.includes('تلفن') || msg.includes('شماره')) {
    return '📞 اطلاعات تماس:\n📱 تلفن: ۰۹۱۲۱۲۳۴۵۶۷\n🌐 سایت: pouyan.com\n💬 تلگرام: @pouyan_dev';
  }
  if (msg.includes('ممنون') || msg.includes('تشکر')) {
    return 'خواهش می‌کنم! 🙏 خوشحالم که تونستم کمکتون کنم.';
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

  // روش ۲: Together AI (رایگان)
  reply = await tryTogether(fullPrompt);
  if (reply) {
    return { text: reply, intent: 'general' };
  }

  // روش ۳: Hugging Face (رایگان)
  reply = await tryHuggingFace(fullPrompt);
  if (reply) {
    return { text: reply, intent: 'general' };
  }

  // روش ۴: پاسخ هوشمند پیش‌فرض
  console.log('⚠️ هیچ AI کار نکرد، از پاسخ پیش‌فرض استفاده شد');
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
