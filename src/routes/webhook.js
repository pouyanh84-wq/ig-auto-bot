// src/routes/webhook.js
// مدیریت Webhook اینستاگرام — دریافت پیام‌ها، کامنت‌ها، منشن‌ها
const express = require('express');
const router = express.Router();
const instagramService = require('../services/instagram');
const aiService = require('../services/ai');
const db = require('../services/database');
const config = require('../config');

// ============================================
// تأیید Webhook توسط فیسبوک (GET)
// ============================================
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.meta.verifyToken) {
    console.log('✅ Webhook تأیید شد توسط فیسبوک');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook تأیید نشد — token mismatch');
    res.sendStatus(403);
  }
});

// ============================================
// دریافت رویدادها از اینستاگرام (POST)
// ============================================
router.post('/', async (req, res) => {
  const body = req.body;

  // پاسخ سریع (فیسبوک باید ظرف ۲۰ ثانیه ۲۰۰ بگیره)
  res.status(200).send('EVENT_RECEIVED');

  // پردازش رویدادها (asynchrounous)
  try {
    if (body.object === 'instagram' || body.object === 'page') {
      const entries = body.entry || [];

      for (const entry of entries) {
        const pageId = entry.id;
        const events = entry.changes || [];

        for (const event of events) {
          await _processEvent(event, pageId);
        }
      }
    }
  } catch (error) {
    console.error('❌ خطا در پردازش رویداد:', error.message);
  }
});

// ============================================
// پردازش رویداد
// ============================================
async function _processEvent(event, pageId) {
  const field = event.field;
  const value = event.value;

  switch (field) {
    case 'messages':
      await _handleMessage(value, pageId);
      break;
    case 'messaging_postbacks':
      await _handlePostback(value, pageId);
      break;
    case 'comments':
      await _handleComment(value, pageId);
      break;
    case 'mentions':
      await _handleMention(value, pageId);
      break;
    case 'story_mentions':
      await _handleStoryMention(value, pageId);
      break;
    default:
      console.log(`ℹ️ رویداد ناشناخته: ${field}`);
  }
}

// ============================================
// پردازش پیام دایرکت
// ============================================
async function _handleMessage(messageData, pageId) {
  const senderId = messageData.from?.id;
  const text = messageData.text;
  const messageId = messageData.mid || messageData.message_id;

  // پیام‌های خالی یا استیکر رو نادیده بگیر
  if (!senderId || (!text && !messageData.attachments)) {
    return;
  }

  // جلوگیری از پردازش تکراری
  if (messageData.is_echo) {
    return; // پاسخ خودمون رو دوباره پردازش نکن
  }

  console.log(`📩 پیام جدید | از: ${senderId} | پیج: ${pageId} | متن: ${text || '[تصویر]'}`);

  // پیدا کردن مشتری مرتبط با این پیج
  const connectedPage = await db.findConnectedPageByPageId(pageId);
  if (!connectedPage) {
    console.log(`⚠️ پیج ${pageId} در سیستم ثبت نشده`);
    return;
  }

  const userId = connectedPage.user_id;

  // دریافت یا ایجاد مکالمه
  const conversation = await db.findOrCreateConversation({
    userId,
    connectedPageId: connectedPage.id,
    customerIgId: senderId
  });

  // ذخیره پیام مشتری
  await db.saveMessage({
    conversationId: conversation.id,
    sender: 'customer',
    content: text || '[تصویر]',
    messageType: text ? 'text' : 'image',
    metadata: messageData
  });

  // دریافت تاریخچه مکالمه
  const history = await db.getConversationHistory(conversation.id);

  // دریافت محصولات فروشگاه
  const products = await db.getProductsByUserId(userId);

  // دریافت تنظیمات چت‌بات
  const botConfig = await db.getBotConfig(connectedPage.id);

  // بررسی ساعات کاری
  if (!_isWithinWorkingHours(botConfig)) {
    const fallbackMsg = botConfig?.fallback_message || 'الان خارج از ساعات کاری هستیم. لطفاً بعداً پیام بدید.';
    await instagramService.sendMessage(senderId, fallbackMsg, connectedPage.access_token);
    return;
  }

  // دریافت اطلاعات مشتری
  const customerInfo = await instagramService.getUserInfo(senderId, connectedPage.access_token);

  // تولید پاسخ هوشمند
  const aiResponse = await aiService.generateResponse({
    message: text || 'مشتری تصویر فرستاده',
    customerName: customerInfo?.name || conversation.customer_name,
    products,
    conversationHistory: history,
    context: 'dm',
    botConfig
  });

  // بروزرسانی نام مشتری
  if (customerInfo?.name && !conversation.customer_name) {
    await db.query(
      'UPDATE conversations SET customer_name = $2 WHERE id = $1',
      [conversation.id, customerInfo.name]
    );
  }

  // ارسال پاسخ
  if (aiResponse.text) {
    await instagramService.sendMessage(senderId, aiResponse.text, connectedPage.access_token);
  }

  // ذخیره پاسخ بات
  await db.saveMessage({
    conversationId: conversation.id,
    sender: 'bot',
    content: aiResponse.text,
    messageType: 'text',
    metadata: { intent: aiResponse.intent }
  });

  // اگر قصد خرید داره
  if (aiResponse.intent === 'order' && aiResponse.items?.length > 0) {
    await _handleOrderIntent(conversation, connectedPage, aiResponse);
  }

  // اگر نیاز به دخالت ادمین هست
  if (aiResponse.intent === 'handoff') {
    await _notifyAdmin(conversation, connectedPage, text);
  }
}

// ============================================
// پردازش کامنت
// ============================================
async function _handleComment(commentData, pageId) {
  const commentText = commentData.text;
  const mediaId = commentData.media_id;
  const commenterId = commentData.from?.id;

  console.log(`💬 کامنت جدید | از: ${commenterId} | متن: ${commentText}`);

  const connectedPage = await db.findConnectedPageByPageId(pageId);
  if (!connectedPage) return;

  // فقط به کامنت‌هایی پاسخ بده که سوالی باشن
  if (!_isQuestion(commentText)) {
    console.log('ℹ️ کامنت سوال نیست، پاسخ داده نشد');
    return;
  }

  const products = await db.getProductsByUserId(connectedPage.user_id);
  const aiResponse = await aiService.generateCommentReply(commentText, products);

  if (aiResponse.text) {
    await instagramService.replyToComment(mediaId, aiResponse.text, connectedPage.access_token);
  }
}

// ============================================
// پردازش منشن
// ============================================
async function _handleMention(mentionData, pageId) {
  console.log(`📢 منشن جدید | پیج: ${pageId} | ${mentionData.text}`);

  const connectedPage = await db.findConnectedPageByPageId(pageId);
  if (!connectedPage) return;

  // پاسخ خودکار به منشن
  const thankYouMessage = 'ممنون از منشن! 🙏 اگه سوالی دارید، خوشحال می‌شیم کمکتون کنیم.';
  
  // منشن‌ها معمولاً در کامنت پاسخ داده می‌شن
  if (mentionData.media_id) {
    await instagramService.replyToComment(
      mentionData.media_id,
      thankYouMessage,
      connectedPage.access_token
    );
  }
}

// ============================================
// پردازش منشن استوری
// ============================================
async function _handleStoryMention(storyData, pageId) {
  console.log(`📱 منشن استوری | پیج: ${pageId}`);

  const connectedPage = await db.findConnectedPageByPageId(pageId);
  if (!connectedPage) return;

  const senderId = storyData.from?.id;
  if (!senderId) return;

  const products = await db.getProductsByUserId(connectedPage.user_id);
  const aiResponse = await aiService.generateResponse({
    message: 'مشتری پیج ما رو در استوری منشن کرده',
    customerName: '',
    products,
    conversationHistory: [],
    context: 'story_mention'
  });

  // ارسال پاسخ به دایرکت مشتری
  if (aiResponse.text) {
    await instagramService.sendMessage(senderId, aiResponse.text, connectedPage.access_token);
  }
}

// ============================================
// پردازش Postback (دکمه‌ها)
// ============================================
async function _handlePostback(postbackData, pageId) {
  const senderId = postbackData.sender?.id;
  const payload = postbackData.postback?.payload;

  console.log(`🔘 Postback | از: ${senderId} | Payload: ${payload}`);

  if (!senderId || !payload) return;

  const connectedPage = await db.findConnectedPageByPageId(pageId);
  if (!connectedPage) return;

  // پردازش بر اساس payload
  switch (payload) {
    case 'VIEW_PRODUCTS':
      const products = await db.getProductsByUserId(connectedPage.user_id);
      const productList = products.slice(0, 5).map(p =>
        `📦 ${p.name} - ${Number(p.price).toLocaleString('fa-IR')} تومان`
      ).join('\n');
      await instagramService.sendMessage(senderId, `محصولات ما:\n\n${productList}\n\nبرای سفارش، نام محصول رو بفرستید.`, connectedPage.access_token);
      break;

    case 'CONTACT_ADMIN':
      await instagramService.sendMessage(senderId, 'پیام شما به مدیر فروشگاه ارسال شد. به زودی با شما تماس می‌گیریم.', connectedPage.access_token);
      await _notifyAdmin(null, connectedPage, 'مشتری درخواست تماس با ادمین داره');
      break;

    default:
      await instagramService.sendMessage(senderId, 'متأسفم، متوجه نشدم. لطفاً دوباره توضیح بدید.', connectedPage.access_token);
  }
}

// ============================================
// مدیریت قصد خرید
// ============================================
async function _handleOrderIntent(conversation, connectedPage, aiResponse) {
  // ذخیره اطلاعات مشتری
  if (aiResponse.customer_info?.name) {
    await db.query(
      'UPDATE conversations SET customer_name = $2 WHERE id = $1',
      [conversation.id, aiResponse.customer_info.name]
    );
  }

  // بررسی آیا اطلاعات کامله
  const info = aiResponse.customer_info || {};
  if (info.name && info.phone && info.address) {
    // محاسبه قیمت
    const products = await db.getProductsByUserId(connectedPage.user_id);
    let totalAmount = 0;
    const orderItems = [];

    for (const item of aiResponse.items) {
      const product = products.find(p =>
        p.name.includes(item.product_name) || item.product_name.includes(p.name)
      );
      if (product) {
        totalAmount += product.price * (item.quantity || 1);
        orderItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity || 1,
          price: product.price
        });
      }
    }

    // ایجاد سفارش
    const order = await db.createOrder({
      userId: connectedPage.user_id,
      conversationId: conversation.id,
      customerIgId: conversation.customer_ig_id,
      items: orderItems,
      totalAmount,
      shippingInfo: info
    });

    console.log(`🛒 سفارش جدید ایجاد شد: ${order.id}`);

    // TODO: ارسال لینک پرداخت (زرین‌پال / آی‌دی‌پی)
    await instagramService.sendMessage(
      conversation.customer_ig_id,
      `سفارش شما ثبت شد! ✅\n\n` +
      `📦 شماره سفارش: ${order.id.toString().slice(0, 8)}\n` +
      `💰 مبلغ: ${totalAmount.toLocaleString('fa-IR')} تومان\n\n` +
      `برای پرداخت، لینک پرداخت به زودی ارسال می‌شه.`,
      connectedPage.access_token
    );
  }
}

// ============================================
// اطلاع‌رسانی به ادمین
// ============================================
async function _notifyAdmin(conversation, connectedPage, message) {
  // TODO: ارسال نوتیفیکیشن به ادمین (تلگرام، ایمیل، SMS)
  console.log(`🔔 نوتیفیکیشن به ادمین: ${message}`);

  // مثال: ارسال به تلگرام
  // await telegramBot.sendMessage(ADMIN_CHAT_ID, `🔔 ${message}`);
}

// ============================================
// بررسی ساعات کاری
// ============================================
function _isWithinWorkingHours(botConfig) {
  if (!botConfig?.working_hours) return true; // اگر تنظیم نشده، همیشه فعال

  try {
    const hours = typeof botConfig.working_hours === 'string'
      ? JSON.parse(botConfig.working_hours)
      : botConfig.working_hours;

    if (!hours.start || !hours.end) return true;

    const now = new Date();
    // تبدیل به ساعت تهران
    const tehranTime = new Date(now.toLocaleString('en-US', { timeZone: hours.timezone || 'Asia/Tehran' }));
    const currentHour = tehranTime.getHours();
    const currentMinute = tehranTime.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMin] = hours.start.split(':').map(Number);
    const [endHour, endMin] = hours.end.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return currentTime >= startTime && currentTime <= endTime;
  } catch {
    return true;
  }
}

// ============================================
// تشخیص اینکه آیا کامنت یه سواله
// ============================================
function _isQuestion(text) {
  const questionWords = ['چی', 'چه', 'چند', 'کجا', 'کی', 'چطور', 'چگونه', 'آیا', 'آیا', 'هست', 'هستید', 'میشه', 'میشه', 'لطفا', '?', '؟'];
  return questionWords.some(w => text.includes(w));
}

module.exports = router;
