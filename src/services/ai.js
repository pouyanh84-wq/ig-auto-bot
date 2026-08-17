// src/services/ai.js
// هوش مصنوعی — تولید پاسخ هوشمند (نسخه کامل)
const OpenAI = require('openai');
const config = require('../config');

const openai = new OpenAI({ apiKey: config.openai.apiKey });

class AIService {
  // ============================================
  // تولید پاسخ هوشمند (مکالمه آزاد)
  // ============================================
  async generateResponse({ message, customerName, products, conversationHistory, context, botConfig }) {
    const productsText = this._formatProducts(products);

    // ساخت System Prompt با دانش کسب‌وکار
    const systemPrompt = this._buildSystemPrompt({
      customerName,
      productsText,
      botConfig,
      context
    });

    // ساخت آرایه messages برای OpenAI (مکالمه واقعی)
    const messages = this._buildMessagesArray({
      systemPrompt,
      conversationHistory,
      message
    });

    try {
      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages: messages,
        response_format: { type: 'json_object' },
        temperature: config.openai.temperature,
        max_tokens: config.openai.maxTokens
      });

      const responseText = completion.choices[0].message.content;
      const response = JSON.parse(responseText);

      console.log(`🤖 AI Response:`, {
        intent: response.intent,
        textPreview: response.text?.substring(0, 80) + '...'
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
  // ساخت آرایه messages برای OpenAI
  // ============================================
  _buildMessagesArray({ systemPrompt, conversationHistory, message }) {
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // اضافه کردن تاریخچه مکالمه (آخرین ۱۰ پیام)
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        if (msg.sender === 'customer') {
          messages.push({ role: 'user', content: msg.content });
        } else if (msg.sender === 'bot' || msg.sender === 'admin') {
          // فقط پاسخ‌های AI رو اضافه کن (نه متن خام)
          try {
            const parsed = JSON.parse(msg.content);
            if (parsed.text) {
              messages.push({ role: 'assistant', content: parsed.text });
            }
          } catch {
            messages.push({ role: 'assistant', content: msg.content });
          }
        }
      }
    }

    // پیام فعلی مشتری
    messages.push({ role: 'user', content: message });

    return messages;
  }

  // ============================================
  // ساخت System Prompt با دانش کسب‌وکار
  // ============================================
  _buildSystemPrompt({ customerName, productsText, botConfig, context }) {
    const welcomeMsg = botConfig?.welcome_message || '';
    const catalogPrompt = botConfig?.product_catalog_prompt || '';

    // دانش پایه کسب‌وکار
    const businessKnowledge = this._getBusinessKnowledge();

    return `
${businessKnowledge}

نام مشتری: ${customerName || 'مشتری گرامی'}

محصولات/خدمات موجود:
${productsText}

${catalogPrompt ? `اطلاعات تکمیلی:\n${catalogPrompt}\n` : ''}

--- قوانین مکالمه ---

۱. **مکالمه آزاد:** به هر سوالی که مشتری بپرسه جواب بده. نیازی نیست فقط کلمات کلیدی خاصی رو چک کنی.

۲. **مثل یک ادمین واقعی:** مودب، صمیمی و حرفه‌ای باش. انگار واقعاً داری چت می‌کنی.

۳. **پاسخ به فارسی:** همیشه به فارسی پاسخ بده (مگر اینکه مشتری انگلیسی صحبت کنه).

۴. **اطلاعات دقیق:** فقط اطلاعاتی رو بگو که در دانش کسب‌وکار هست. از خودت چیزی اضافه نکن.

۵. **ثبت سفارش:** وقتی مشتری خواست سفارش بده:
   - قدم‌به‌قدم اطلاعات رو جمع کن (نام، شماره، آدرس، پلن/محصول)
   - اگه اطلاعات کم بود، بپرس
   - وقتی کامل شد، تأیید بگیر
   - سفارش رو ثبت کن

۶. **سوال خارجی:** اگه سوالی خارج از حیطه کسب‌وکار بود، بگو:
   "متأسفم، این سوال خارج از حیطه کاری ماست. لطفاً با مدیر صحبت کنید."

۷. **کوتاه و مفید:** پاسخ‌های طولانی نده. ۲-۵ جمله کافیه.

۸. **هیچ‌وقت جعلی نساز:** اطلاعات نادرست نده.

۹. **تشخیص زبان:** اگر مشتری انگلیسی نوشت، انگلیسی جواب بده.

۱۰. **پیشنهاد:** اگه مشتری دقیق نمی‌دونه چی می‌خواد، کمکش کن انتخاب کنه.

--- خروجی JSON ---
خروجی رو حتماً به صورت JSON برگردون:
{
  "text": "متن پاسخ",
  "intent": "chat" | "order" | "info_request" | "support" | "handoff",
  "items": [{"product_name": "نام محصول", "quantity": 1, "price": 0}],
  "customer_info": {
    "name": "نام مشتری اگر گفته",
    "phone": "تلفن اگر گفته",
    "address": "آدرس اگر گفته"
  }
}

${context === 'comment' ? 'این پاسخ برای یک کامنت اینستاگرامه — کوتاه، جذاب و تبلیغاتی باش.' : ''}
${context === 'story_mention' ? 'این پاسخ برای ریپلای به استوریه — سریع و جذاب باش.' : ''}
`;
  }

  // ============================================
  // دانش پایه کسب‌وکار (قابل تغییر توسط فروشنده)
  // ============================================
  _getBusinessKnowledge() {
    return `
--- دانش کسب‌وکار ---

تو یک ادمین فروش حرفه‌ای هستی برای خدمات طراحی وبسایت و دیجیتال مارکتینگ.

خدمات ما:
- طراحی وبسایت اختصاصی (بدون قالب آماده)
- نسخه موبایل حرفه‌ای
- اتصال درگاه پرداخت و سفارش‌گیری اتوماتیک
- سئو پایه
- آموزش مدیریت سایت

پلن‌های قیمتی:

💎 پلن ۱: تحویل قطعی (مالکیت کامل)
   - قیمت: ۱۷.۹ میلیون تومان
   - پرداخت: ۵۰٪ پیش‌پرداخت + ۵۰٪ زمان تحویل
   - پشتیبانی: ۳ ماه رایگان
   - مناسب: کسب‌وکارهایی که می‌خوان از روز اول مالک سایتشون باشن

🤝 پلن ۲: مشارکتی (رشد مشترک)
   - پیش‌پرداخت: ۹.۹ میلیون تومان
   - سهم مشارکت: ۷٪ از فروش سایت
   - مدت قرارداد: ۶ ماه
   - بعد از ۶ ماه: بدون هزینه اضافی
   - مناسب: کسب‌وکارهایی که می‌خوان هزینه اولیه کمتری بدن

🚀 پلن ۳: بدون پیش‌پرداخت
   - پیش‌پرداخت: ۰ تومان (رایگان)
   - سهم مشارکت: ۱۷٪ از فروش سایت
   - مدت قرارداد: ۶ ماه
   - حداقل فروش ماهانه: ۲۰ میلیون تومان
   - در صورت افت فروش ۲ ماه متوالی: قرارداد فسخ می‌شه
   - هزینه هاست و دامنه بر عهده کارفرماست
   - مناسب: کسب‌وکارهای پرفروش

تماس:
- تلفن: ۰۹۱۲۱۲۳۴۵۶۷
- ایمیل: pouyan@pouyan.com
- سایت: pouyan.com
- ساعات کاری: ۹ صبح تا ۹ شب

قوانین پرداخت:
- در درگاه پرداخت آنلاین
- امکان پرداخت اقساطی در پلن ۱
- تسویه مشارکت ماهانه از طریق گزارش درگاه پرداخت
`;
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
    const englishChars = text.match(/[a-zA-Z]/g);

    if (persianChars && persianChars.length > (englishChars?.length || 0)) {
      return 'fa';
    }
    if (englishChars && englishChars.length > (persianChars?.length || 0)) {
      return 'en';
    }
    return 'fa';
  }

  // ============================================
  // فرمت‌بندی محصولات
  // ============================================
  _formatProducts(products) {
    if (!products || products.length === 0) {
      return 'هنوز محصولی ثبت نشده. لطفاً به مشتری بگو "اطلاعات محصولات به زودی اضافه می‌شه"‌';
    }

    return products.map(p =>
      `📦 ${p.name}\n   قیمت: ${Number(p.price).toLocaleString('fa-IR')} تومان\n   موجودی: ${p.stock > 0 ? `${p.stock} عدد` : 'ناموجود'}\n   ${p.description || ''}`
    ).join('\n\n');
  }
}

module.exports = new AIService();
