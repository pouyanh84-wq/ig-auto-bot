// src/routes/auth.js
// فرآیند اتصال پیج اینستاگرام (OAuth)
const express = require('express');
const router = express.Router();
const instagramService = require('../services/instagram');
const db = require('../services/database');
const config = require('../config');

// ============================================
// شروع فرآیند اتصال
// GET /auth/connect?user_id=xxx
// ============================================
router.get('/connect', (req, res) => {
  const userId = req.query.user_id;

  if (!userId) {
    return res.status(400).json({ error: 'user_id الزامی است' });
  }

  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

  const authUrl = `https://www.facebook.com/${config.meta.graphApiVersion}/dialog/oauth?` +
    `client_id=${config.meta.appId}&` +
    `redirect_uri=${encodeURIComponent(config.site.url + '/auth/callback')}&` +
    `scope=instagram_basic,instagram_manage_messages,instagram_manage_comments,pages_show_list,pages_messaging&` +
    `state=${state}`;

  console.log(`🔗 شروع اتصال برای کاربر ${userId}`);
  res.redirect(authUrl);
});

// ============================================
// دریافت کد و تبدیل به Token
// GET /auth/callback?code=xxx&state=xxx
// ============================================
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).json({ error: 'کد یا state نامعتبر است' });
  }

  try {
    // استخراج userId از state
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    console.log(`🔄 دریافت توکن برای کاربر ${userId}`);

    // مرحله ۱: تبدیل کد به Short-Lived Token
    const tokenResponse = await instagramService.exchangeToken(code);
    // Note: exchangeToken currently does fb_exchange_token, we need a different approach
    // Let's use the direct token exchange
    
    const axios = require('axios');
    const tokenResult = await axios.get(
      `${config.meta.graphApiBase}/oauth/access_token`,
      {
        params: {
          client_id: config.meta.appId,
          redirect_uri: config.site.url + '/auth/callback',
          client_secret: config.meta.appSecret,
          code
        }
      }
    );

    const shortToken = tokenResult.data.access_token;
    console.log(`✅ Short-lived token دریافت شد`);

    // مرحله ۲: تبدیل به Long-Lived Token (۶۰ روز)
    const longTokenResult = await axios.get(
      `${config.meta.graphApiBase}/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          fb_exchange_token: shortToken
        }
      }
    );

    const longToken = longTokenResult.data.access_token;
    console.log(`✅ Long-lived token دریافت شد`);

    // مرحله ۳: دریافت لیست پیج‌ها
    const pages = await instagramService.getPages(longToken);
    console.log(`📄 ${pages.length} پیج پیدا شد`);

    // مرحله ۴: پیدا کردن و ذخیره پیج‌های اینستاگرام
    const connectedPages = [];

    for (const page of pages) {
      // دریافت توکن پیج
      const pageToken = page.access_token || longToken;

      // پیدا کردن اکانت اینستاگرام متصل
      const igAccountId = await instagramService.getInstagramAccountId(page.id, pageToken);

      if (igAccountId) {
        // ذخیره در دیتابیس
        const savedPage = await db.saveConnectedPage({
          userId,
          pageId: page.id,
          instagramAccountId: igAccountId,
          accessToken: pageToken,
          pageName: page.name
        });

        connectedPages.push(savedPage);
        console.log(`✅ پیج "${page.name}" متصل شد (IG: ${igAccountId})`);
      }
    }

    if (connectedPages.length === 0) {
      return res.redirect(
        `${config.site.url}/dashboard?error=no_instagram_page&message=هیچ پیج اینستاگرام بیزینسی متصل به این فیسبوک پیدا نشد`
      );
    }

    // موفقیت
    res.redirect(
      `${config.site.url}/dashboard?connected=true&pages=${connectedPages.length}`
    );

  } catch (error) {
    console.error('❌ خطا در فرآیند اتصال:', error.response?.data || error.message);
    res.redirect(
      `${config.site.url}/dashboard?error=connection_failed&message=${encodeURIComponent(error.message)}`
    );
  }
});

// ============================================
// لیست پیج‌های متصل
// GET /auth/pages?user_id=xxx
// ============================================
router.get('/pages', async (req, res) => {
  const userId = req.query.user_id;

  if (!userId) {
    return res.status(400).json({ error: 'user_id الزامی است' });
  }

  try {
    const pages = await db.findConnectedPagesByUserId(userId);
    res.json({ pages });
  } catch (error) {
    res.status(500).json({ error: 'خطا در دریافت پیج‌ها' });
  }
});

// ============================================
// قطع اتصال پیج
// DELETE /auth/disconnect/:pageId
// ============================================
router.delete('/disconnect/:pageId', async (req, res) => {
  const { pageId } = req.params;

  try {
    await db.query(
      'UPDATE connected_pages SET is_active = false WHERE id = $1',
      [pageId]
    );
    res.json({ success: true, message: 'اتصال قطع شد' });
  } catch (error) {
    res.status(500).json({ error: 'خطا در قطع اتصال' });
  }
});

module.exports = router;
