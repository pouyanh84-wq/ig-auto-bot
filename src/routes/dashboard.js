// src/routes/dashboard.js
// داشبورد و آمار
const express = require('express');
const router = express.Router();
const db = require('../services/database');

// ============================================
// آمار کلی داشبورد
// GET /dashboard?user_id=xxx
// ============================================
router.get('/', async (req, res) => {
  const userId = req.query.user_id;

  if (!userId) {
    return res.status(400).json({ error: 'user_id الزامی است' });
  }

  try {
    const stats = await db.getDashboardStats(userId);
    const pages = await db.findConnectedPagesByUserId(userId);

    res.json({
      stats,
      connectedPages: pages.length,
      pages: pages.map(p => ({
        id: p.id,
        name: p.page_name,
        instagram_id: p.instagram_account_id,
        active: p.is_active,
        connected_at: p.connected_at
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'خطا در دریافت آمار' });
  }
});

// ============================================
// لیست مکالمات اخیر
// GET /dashboard/conversations?user_id=xxx
// ============================================
router.get('/conversations', async (req, res) => {
  const userId = req.query.user_id;

  if (!userId) {
    return res.status(400).json({ error: 'user_id الزامی است' });
  }

  try {
    const result = await db.query(
      `SELECT c.*, cp.page_name, cp.instagram_account_id
       FROM conversations c
       LEFT JOIN connected_pages cp ON c.connected_page_id = cp.id
       WHERE c.user_id = $1
       ORDER BY c.last_message_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ conversations: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'خطا در دریافت مکالمات' });
  }
});

// ============================================
// جزئیات یک مکالمه
// GET /dashboard/conversations/:id/messages
// ============================================
router.get('/conversations/:id/messages', async (req, res) => {
  const { id } = req.params;

  try {
    const messages = await db.getConversationHistory(id, 100);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'خطا در دریافت پیام‌ها' });
  }
});

// ============================================
// ارسال پاسخ دستی ادمین
// POST /dashboard/conversations/:id/reply
// ============================================
router.post('/conversations/:id/reply', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const instagramService = require('../services/instagram');

  if (!text) {
    return res.status(400).json({ error: 'متن پاسخ الزامی است' });
  }

  try {
    // دریافت اطلاعات مکالمه
    const convResult = await db.query(
      `SELECT c.*, cp.access_token, cp.instagram_account_id
       FROM conversations c
       LEFT JOIN connected_pages cp ON c.connected_page_id = cp.id
       WHERE c.id = $1`,
      [id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'مکالمه پیدا نشد' });
    }

    const conversation = convResult.rows[0];

    // ارسال پاسخ
    await instagramService.sendMessage(
      conversation.customer_ig_id,
      text,
      conversation.access_token
    );

    // ذخیره در دیتابیس
    await db.saveMessage({
      conversationId: id,
      sender: 'admin',
      content: text,
      messageType: 'text'
    });

    res.json({ message: 'پاسخ ارسال شد' });
  } catch (error) {
    res.status(500).json({ error: 'خطا در ارسال پاسخ' });
  }
});

module.exports = router;