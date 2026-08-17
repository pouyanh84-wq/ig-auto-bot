// src/services/ai.js - Hugging Face Free AI
const axios = require('axios');

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY || process.env.AI_PROVIDER === 'huggingface';

// ========================================
// SYSTEM PROMPT - دانش کسب‌وکار
// ========================================
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
// Hugging Face Inference API (رایگان)
// ========================================
const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

async function generateResponse({ message, customerName, products, conversationHistory, context, botConfig }) {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    
    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY تعریف نشده');
    }

    // ساخت prompt
    let fullPrompt = `<s>[INST] ${SYSTEM_PROMPT}

مشتری می‌گوید: ${message}

تو: [/INST]`;

    // اگه تاریخچه مکالمه داریم
    if (conversationHistory && conversationHistory.length > 0) {
      const historyText = conversationHistory.map(m => 
        `${m.role === 'user' ? 'مشتری' : 'تو'}: ${m.content}`
      ).join('\n');
      
      fullPrompt = `<s>[INST] ${SYSTEM_PROMPT}

تاریخچه مکالمه:
${historyText}

مشتری می‌گوید: ${message}

تو: [/INST]`;
    }

    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
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

    // استخراج پاسخ
    let reply = '';
    if (response.data && Array.isArray(response.data)) {
      reply = response.data[0]?.generated_text || '';
    } else if (response.data && response.data.generated_text) {
      reply = response.data.generated_text;
    }

    // تمیز کردن پاسخ
    reply = reply.replace(/<s>\[INST\]|<\/s>|\/INST/g, '').trim();
    
    // اگه پاسخ خالی بود
    if (!reply) {
      reply = 'متأسفانه مشکلی پیش اومد. لطفاً دوباره امتحان کنید. 🙏';
    }

    // تشخیص قصد خرید
    let intent = 'general';
    if (reply.includes('سفارش') || reply.includes('ثبت') || reply.includes('خرید')) {
      intent = 'order';
    }

    return { text: reply, intent };

  } catch (error) {
    console.error('خطا در Hugging Face:', error.message);
    return {
      text: 'متأسفانه مشکلی پیش اومد. لطفاً دوباره امتحان کنید. 🙏',
      intent: 'error'
    };
  }
}

// ========================================
// پاسخ به کامنت
// ========================================
async function generateCommentReply(commentText, products) {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    
    if (!apiKey) {
      return { text: 'ممنون از پیامتون! 🙏' };
    }

    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        inputs: `<s>[INST] ${SYSTEM_PROMPT}

کامنت مشتری: ${commentText}

پاسخ کوتاه و حرفه‌ای بده: [/INST]`,
        parameters: {
          max_new_tokens: 200,
          temperature: 0.7
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
    if (response.data && Array.isArray(response.data)) {
      reply = response.data[0]?.generated_text || '';
    }
    reply = reply.replace(/<s>\[INST\]|<\/s>|\/INST/g, '').trim();

    return { text: reply || 'ممنون از پیامتون! 🙏' };

  } catch (err) {
    console.error('خطا در Hugging Face (comment):', err.message);
    return { text: 'ممنون از پیامتون! 🙏' };
  }
}

module.exports = { generateResponse, generateCommentReply };
