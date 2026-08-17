// src/services/ai.js - Smart AI (Chatwoot Webhook Compatible)
const OpenAI = require('openai');
const config = require('../config');
const db = require('./database');

const openai = new OpenAI({ apiKey: config.openai.apiKey });

const SYSTEM_PROMPT = `تو یک ادمین فروش حرفه‌ای و دستیار هوشمند برای خدمات طراحی وبسایت Pouyan.com هستی.

--- اطلاعات کسب‌وکار ---
نام: Pouyan.com
حوزه: طراحی وبسایت اختصاصی
وبسایت: pouyan.com
شماره تماس: ۰۹۱۲۱۲۳۴۵۶۷
ساعات کاری: ۹ صبح تا ۹ شب

--- خدمات ---
- طراحی وبسایت اختصاصی (بدون قالب آماده)
- نسخه موبایل حرفه‌ای و روان
- اتصال درگاه پرداخت و سفارش‌گیری اتوماتیک
- پیاده‌سازی سئو پایه
- آموزش کامل مدیریت سایت

--- پلن‌ها و تعرفه‌ها ---
💎 پلن ۱: تحویل قطعی (مالکیت کامل)
   قیمت: ۱۷.۹ میلیون تومان
   پرداخت: ۵۰٪ پیش‌پرداخت + ۵۰٪ زمان تحویل
   پشتیبانی: ۳ ماه رایگان
   مناسب: کسب‌وکارهایی که می‌خوان سایت از روز اول مال خودشون باشه

🤝 پلن ۲: مدل ترکیبی (رشد مشترک)
   پیش‌پرداخت: ۹.۹ میلیون تومان
   سهم مشارکت: ۷٪ از فروش سایت
   مدت قرارداد: ۶ ماه
   مناسب: کسب‌وکارهایی که هزینه اولیه کمتر بدن و من در رشد فروش شریک باشم

🚀 پلن ۳: مشارکتی کامل (بدون هزینه اولیه)
   پیش‌پرداخت: ۰ تومان (رایگان)
   سهم مشارکت: ۱۷٪ از فروش سایت
   مدت قرارداد: ۶ ماه
   شرط: حداقل فروش ماهانه ۲۰ میلیون تومان
   مناسب: کسب‌وکارهای پرفروش

--- قوانین همکاری ---
۱. دامنه به نام خود کارفرما ثبت می‌شود
۲. طراح فقط زیرساخت فنی ارائه می‌دهد
۳. در مدل‌های درصدی، تسویه ماهانه انجام می‌شود
۴. قرارداد رسمی الکترونیکی تنظیم می‌شود

--- قوانین مکالمه ---
- همیشه مودب و حرفه‌ای باش
- به فارسی ساده و روان جواب بده
- کوتاه و مفید حرف بزن (هر پیام حداکثر ۴-۵ خط)
- اگر مشتری قصد خرید داشت، قدم‌به‌قدم اطلاعات لازم رو جمع کن (نام، شماره، پلن انتخابی)
- هیچ‌وقت اطلاعات جعلی یا قیمت اشتباه نده
- اگر سوالی خارج از حوزه بود، بگو: بذار از مسئول مربوطه بپرسم
- از ایموجی استفاده کن ولی زیاده‌روی نکن
- هرگز قیمت‌ها رو تغییر نده
`;

// ============================================
// تولید پاسخ هوشمند (سازگار با webhook.js)
// ============================================
async function generateResponse({ message, customerName, products, conversationHistory, context, botConfig }) {
  try {
    // تاریخچه مکالمه از آرگومان
    const history = Array.isArray(conversationHistory) ? conversationHistory : [];

    // پیام‌ها برای OpenAI
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: message }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    });

    const reply = response.choices[0].message.content;

    // تشخیص قصد خرید
    let intent = 'general';
    if (reply.includes('سفارش') || reply.includes('ثبت') || reply.includes('خرید')) {
      intent = 'order';
    } else if (reply.includes('پشتیبانی') || reply.includes('ادمین')) {
      intent = 'handoff';
    }

    // برگرداندن به شکلی که webhook.js می‌خواد
    return {
      text: reply,
      intent: intent
    };

  } catch (err) {
    console.error('خطا در OpenAI:', err.message);
    return {
      text: 'متأسفانه مشکلی پیش اومد. لطفاً دوباره امتحان کنید. 🙏',
      intent: 'error'
    };
  }
}

// ============================================
// پاسخ به کامنت (مخصوص Instagram)
// ============================================
async function generateCommentReply(commentText, products) {
  try {
    const productList = (products || []).map(p => `${p.name}: ${p.price} تومان`).join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `کامنت مشتری: ${commentText}\n\nلیست محصولات:\n${productList}\n\nپاسخ کوتاه و حرفه‌ای بده.` }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    return { text: response.choices[0].message.content };

  } catch (err) {
    console.error('خطا در OpenAI (comment):', err.message);
    return { text: 'ممنون از پیامتون! 🙏' };
  }
}

module.exports = { generateResponse, generateCommentReply };
