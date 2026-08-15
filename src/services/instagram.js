// src/services/instagram.js
// ارتباط با Instagram Graph API
const axios = require('axios');
const config = require('../config');

class InstagramService {
  constructor() {
    this.baseUrl = config.meta.graphApiBase;
  }

  // ============================================
  // ارسال پیام دایرکت
  // ============================================
  async sendMessage(recipientId, text, pageAccessToken) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text },
          messaging_type: 'RESPONSE'
        },
        {
          params: { access_token: pageAccessToken },
          timeout: 10000
        }
      );
      console.log(`✅ پیام ارسال شد به ${recipientId}`);
      return response.data;
    } catch (error) {
      this._handleError('ارسال پیام', error);
      throw error;
    }
  }

  // ============================================
  // ارسال تصویر
  // ============================================
  async sendImage(recipientId, imageUrl, pageAccessToken) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/me/messages`,
        {
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: 'image',
              payload: { url: imageUrl }
            }
          }
        },
        {
          params: { access_token: pageAccessToken },
          timeout: 10000
        }
      );
      console.log(`✅ تصویر ارسال شد به ${recipientId}`);
      return response.data;
    } catch (error) {
      this._handleError('ارسال تصویر', error);
      throw error;
    }
  }

  // ============================================
  // ارسال دکمه‌های Quick Reply
  // ============================================
  async sendQuickReplies(recipientId, text, buttons, pageAccessToken) {
    try {
      const quickReplies = buttons.map(btn => ({
        content_type: 'text',
        title: btn.title,
        payload: btn.payload
      }));

      const response = await axios.post(
        `${this.baseUrl}/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text, quick_replies: quickReplies }
        },
        {
          params: { access_token: pageAccessToken },
          timeout: 10000
        }
      );
      console.log(`✅ Quick Replies ارسال شد به ${recipientId}`);
      return response.data;
    } catch (error) {
      this._handleError('ارسال Quick Replies', error);
      throw error;
    }
  }

  // ============================================
  // ارسال پاسخ به کامنت
  // ============================================
  async replyToComment(mediaId, text, pageAccessToken) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${mediaId}/comments`,
        { message: text },
        {
          params: { access_token: pageAccessToken },
          timeout: 10000
        }
      );
      console.log(`✅ پاسخ به کامنت ارسال شد`);
      return response.data;
    } catch (error) {
      this._handleError('پاسخ به کامنت', error);
      throw error;
    }
  }

  // ============================================
  // دریافت اطلاعات کاربر
  // ============================================
  async getUserInfo(userId, pageAccessToken) {
    try {
      const response = await axios.get(`${this.baseUrl}/${userId}`, {
        params: {
          fields: 'name,profile_pic',
          access_token: pageAccessToken
        },
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      this._handleError('دریافت اطلاعات کاربر', error);
      return null;
    }
  }

  // ============================================
  // دریافت اطلاعات رسانه (پست)
  // ============================================
  async getMediaInfo(mediaId, pageAccessToken) {
    try {
      const response = await axios.get(`${this.baseUrl}/${mediaId}`, {
        params: {
          fields: 'id,caption,media_type,media_url,timestamp',
          access_token: pageAccessToken
        },
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      this._handleError('دریافت اطلاعات رسانه', error);
      return null;
    }
  }

  // ============================================
  // دریافت پست‌های اخیر پیج
  // ============================================
  async getRecentMedia(instagramAccountId, pageAccessToken, limit = 10) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${instagramAccountId}/media`,
        {
          params: {
            fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count',
            limit,
            access_token: pageAccessToken
          },
          timeout: 5000
        }
      );
      return response.data.data || [];
    } catch (error) {
      this._handleError('دریافت پست‌های اخیر', error);
      return [];
    }
  }

  // ============================================
  // Exchange Code به Long-Lived Token
  // ============================================
  async exchangeToken(shortToken) {
    try {
      const response = await axios.get(`${this.baseUrl}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          fb_exchange_token: shortToken
        },
        timeout: 10000
      });
      return response.data.access_token;
    } catch (error) {
      this._handleError('Exchange Token', error);
      throw error;
    }
  }

  // ============================================
  // دریافت لیست پیج‌های کاربر
  // ============================================
  async getPages(accessToken) {
    try {
      const response = await axios.get(`${this.baseUrl}/me/accounts`, {
        params: {
          fields: 'id,name,access_token',
          access_token: accessToken
        },
        timeout: 5000
      });
      return response.data.data || [];
    } catch (error) {
      this._handleError('دریافت پیج‌ها', error);
      return [];
    }
  }

  // ============================================
  // پیدا کردن اکانت اینستاگرام متصل به پیج
  // ============================================
  async getInstagramAccountId(pageId, pageAccessToken) {
    try {
      const response = await axios.get(`${this.baseUrl}/${pageId}`, {
        params: {
          fields: 'instagram_business_account',
          access_token: pageAccessToken
        },
        timeout: 5000
      });
      return response.data.instagram_business_account?.id || null;
    } catch (error) {
      this._handleError('دریافت Instagram Account ID', error);
      return null;
    }
  }

  // ============================================
  // مدیریت خطاها
  // ============================================
  _handleError(context, error) {
    const errorData = error.response?.data?.error;
    if (errorData) {
      console.error(`❌ خطا در ${context}:`, {
        message: errorData.message,
        type: errorData.type,
        code: errorData.code,
        fbtrace_id: errorData.fbtrace_id
      });
    } else {
      console.error(`❌ خطا در ${context}:`, error.message);
    }
  }
}

module.exports = new InstagramService();
