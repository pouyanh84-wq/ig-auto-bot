// src/routes/webhook.js
// نسخه مخصوص Chatwoot Agent Bot

const express = require('express');
const router = express.Router();
const axios = require('axios');
const aiService = require('../services/ai');
const db = require('../services/database');
const config = require('../config');

// ============================================
// دریافت رویداد از Chatwoot (POST)
// ============================================
router.post('/', async (req, res) => {
  // همیشه سریع ۲۰۰ برگردان تا Chatwoot صبر نکند
  res.status(200).send('EVENT_RECEIVED');

  try {
    const payload = req.body;

    // فقط ایونت message_created را پردازش کن
    if (payload.event !== 'message_created') {
      return;
    }

    // فقط پیام‌های ورودی مشتری
    if (payload.message_type !== 'incoming') {
      return;
    }

    // پیام‌های خصوصی را نادیده بگیر
    if (payload.private === true) {
      return;
    }

    const content = payload.content;
    if (!content || content.trim() === '') {
      return;
    }

    const conversationId = payload.conversation?.id;
    const accountId = payload.account?.id;
    const contactName = payload.sender?.name || 'مشتری';
    const contactId = payload.sender?.id;

    console.log(`📩 پیام جدید از Chatwoot | مکالمه: ${conversationId} | متن: ${content}`);

    // تولید پاسخ با هوش مصنوعی
    const aiResponse = await aiService.generateResponse({
      message: content,
      customerName: contactName,
      products: [],               // اگر محصولات داری اینجا از دیتابیس بگیر
      conversationHistory: [],    // بعداً می‌توانی تاریخچه را اضافه کنی
      context: 'dm',
      botConfig: null
    });

    // ارسال پاسخ به Chatwoot
    if (aiResponse?.text) {
      await sendReplyToChatwoot(accountId, conversationId, aiResponse.text);
      console.log(`✅ پاسخ ارسال شد: ${aiResponse.text.substring(0, 50)}...`);
    }

  } catch (error) {
    console.error('❌ خطا در پردازش webhook چت‌ووت:', error.message);
  }
});

// ============================================
// ارسال پاسخ به Chatwoot
// ============================================
async function sendReplyToChatwoot(accountId, conversationId, content) {
  try {
    const url = `https://app.chatwoot.com/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;

    await axios.post(url, {
      content: content,
      message_type: 'outgoing',
      private: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': process.env.CHATWOOT_BOT_TOKEN || 'PwsQj66UGYoUPD4futcGKUeo'
      }
    });

  } catch (error) {
    console.error('❌ خطا در ارسال پاسخ به Chatwoot:', error.response?.data || error.message);
  }
}

// برای سازگاری با درخواست‌های GET (اگر لازم شد)
router.get('/', (req, res) => {
  res.status(200).send('Webhook is working');
});

module.exports = router;
