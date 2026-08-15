// src/services/ai.js
// هوش مصنوعی — تولید پاسخ هوشمند
const OpenAI = require('openai');
const config = require('../config');

const openai = new OpenAI({ apiKey: config.openai.apiKey });

class AIService {
  // ============================================
  // تولید پاسخ هوشمند
  // ============================================
  async generateResponse({ message, customerName, products, conversationHistory, context, botConfig }) {
    // ساخت لیست محصولات
    const productsText = this._formatProducts(products);

    // ساخت تاریخچه مکالمه
    const historyText = this._formatHistory(conversationHistory);

    // ساخت System Prompt
    const systemPrompt = this._buildSystemPrompt({
      customerName,
      productsText,
      botConfig,
      context
    });

    try {
      const userMessage = historyText
        ? `${historyText}\n\nمشتری: ${message}`
        : `مشتری: ${message}`;

      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: 'json_object' },
        temperature: config.openai.temperature,
        max_tokens: config.openai.maxTokens
      });

      const responseText = completion.choices[0].message.content;
      const response = JSON.parse(responseText);

      console.log(`🤖 AI Response:`, {
        intent: response.intent,
        textPreview: response.text?.substring(0, 50) + '...'
      });

      return response;
    } catch (error) {
      console.error('❌ خطا در AI:', error.message);
      return {
        text: 'متأسفم، مشکلی پیش اومده. لطفاً لحظه‌ای صبر کنید و دوباره امتحان کنید.',
        intent: 'chat',
        items: [],
        customer_info: {}
      };
    }
  }

  // ============================================
  // تولید پاسخ کوتاه برای کامنت
  // ============================================
  async generateCommentReply(commentText, products) {
    const productsText = this._formatProducts(products);

    const systemPrompt = `
تو دستیار یک فروشگاه اینترنتی هستی و به کامنت‌ها پاسخ می‌دی.

محصولات فروشگاه:
${productsText}

قوانین:
- خیلی کوتاه و جذاب باش (حداکثر ۲-۳ جمله)
- به زبان فارسی
- اگر سوال قیمتی هست، جواب بده
- اگر سوال فنی هست، بگو "لطفاً دایرک بدید تا راهنماییتون کنم"
- مودب و صمیمی باش

خروجی به صورت JSON:
{ "text": "متن پاسخ" }
`;

    try {
      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `کامنت: ${commentText}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 150
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      console.error('❌ خطا در پاسخ کامنت:', error.message);
      return { text: 'ممنون از نظرتون! 🙏' };
    }
  }

  // ============================================
  // تشخیص زبان پیام
  // ============================================
  detectLanguage(text) {
    const persianChars = text.match(/[\u0600-\u06FF]/g);
    const arabicChars = text.match(/[\u0600-\u06FF]/g);
    const englishChars = text.match(/[a-zA-Z]/g);
    
    if (persianChars && persianChars.length > (englishChars?.length || 0)) {
      return 'fa';
    }
    if (englishChars && englishChars.length > (persianChars?.length || 0)) {
      return 'en';
    }
    return 'fa'; // پیش‌فرض فارسی
  }

  // ============================================
  // ساخت System Prompt
  // ============================================
  _buildSystemPrompt({ customerName, productsText, botConfig, context }) {
    const welcomeMsg = botConfig?.welcome_message || '';
    const catalogPrompt = botConfig?.product_catalog_prompt || '';

    return `
تو یک دستیار فروش هوشمند برای یک فروشگاه اینترنتی هستی.

نام مشتری: ${customerName || 'مشتری گرامی'}

محصولات موجود:
${productsText}

${catalogPrompt ? `توضیحات تکمیلی فروشگاه:\n${catalogPrompt}\n` : ''}

قوانین مهم:
۱. مودب، صمیمی و حرفه‌ای باش
۲. به زبان فارسی پاسخ بده (مگر اینکه مشتری به انگلیسی صحبت کنه)
۳. اطلاعات دقیق محصولات رو بگو (نام، قیمت، موجودی)
۴. اگر مشتری خواست خرید کنه، اطلاعاتش رو جمع‌آوری کن:
   - نام و نام خانوادگی
   - شماره تلفن
   - آدرس کامل
   - نام محصول و تعداد
۵. قیمت‌ها رو دقیق و واضح بگو (به تومان)
۶. اگر سوالی خارج از حیطه فروشگاهه، بگو "متأسفم، این سوال خارج از حیطه کاری ماست. لطفاً با مدیر فروشگاه صحبت کنید."
۷. هرگز قیمت اشتباه نگو
۸. از emoji زیاد استفاده نکن
۹. کوتاه و مفید پاسخ بده
۱۰. اگر محصولی ناموجود بود، جایگزین پیشنهاد بده

${context === 'comment' ? 'این پاسخ برای یک کامنت اینستاگرامه — کوتاه، جذاب و تبلیغاتی باش.' : ''}
${context === 'story_mention' ? 'این پاسخ برای ریپلای به استوریه — سریع و جذاب باش.' : ''}

خروجی رو حتماً به صورت JSON برگردون:
{
  "text": "متن پاسخ به فارسی",
  "intent": "chat" | "order" | "info_request" | "support" | "handoff",
  "items": [{"product_name": "نام محصول", "quantity": 1, "price": 0}],
  "customer_info": {
    "name": "نام مشتری اگر گفته",
    "phone": "تلفن اگر گفته",
    "address": "آدرس اگر گفته"
  }
}
`;
  }

  // ============================================
  // فرمت‌بندی محصولات
  // ============================================
  _formatProducts(products) {
    if (!products || products.length === 0) {
      return 'محصولی ثبت نشده است.';
    }

    return products.map(p =>
      `📦 ${p.name}\n   قیمت: ${Number(p.price).toLocaleString('fa-IR')} تومان\n   موجودی: ${p.stock > 0 ? `${p.stock} عدد` : 'ناموجود'}\n   ${p.description || ''}`
    ).join('\n\n');
  }

  // ============================================
  // فرمت‌بندی تاریخچه مکالمه
  // ============================================
  _formatHistory(history) {
    if (!history || history.length === 0) return '';

    return history.slice(-10).map(m => {
      const role = m.sender === 'customer' ? 'مشتری' : m.sender === 'bot' ? 'بات' : 'مدیر';
      return `${role}: ${m.content}`;
    }).join('\n');
  }
}

module.exports = new AIService();
