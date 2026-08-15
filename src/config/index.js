// src/config/index.js
// مرکز تنظیمات سیستم
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  
  meta: {
    appId: process.env.APP_ID,
    appSecret: process.env.APP_SECRET,
    verifyToken: process.env.VERIFY_TOKEN,
    pageAccessToken: process.env.PAGE_ACCESS_TOKEN,
    graphApiVersion: 'v18.0',
    get graphApiBase() {
      return `https://graph.facebook.com/${this.graphApiVersion}`;
    }
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    maxTokens: 500,
    temperature: 0.7
  },

  database: {
    url: process.env.DATABASE_URL
  },

  site: {
    url: process.env.SITE_URL
  }
};
