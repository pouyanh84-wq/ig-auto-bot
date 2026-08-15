// src/routes/products.js
// مدیریت محصولات
const express = require('express');
const router = express.Router();
const db = require('../services/database');

// ============================================
// دریافت لیست محصولات
// GET /products?user_id=xxx
// ============================================
router.get('/', async (req, res) => {
  const userId = req.query.user_id;

  if (!userId) {
    return res.status(400).json({ error: 'user_id الزامی است' });
  }

  try {
    const products = await db.getProductsByUserId(userId);
    res.json({ products });
  } catch (error) {
    res.status(500).json({ error: 'خطا در دریافت محصولات' });
  }
});

// ============================================
// ایجاد محصول جدید
// POST /products
// ============================================
router.post('/', async (req, res) => {
  const { userId, name, description, price, stock, category, imageUrl } = req.body;

  if (!userId || !name || !price) {
    return res.status(400).json({ error: 'userId, name و price الزامی هستند' });
  }

  try {
    const product = await db.createProduct({
      userId,
      name,
      description,
      price: Number(price),
      stock: stock ? Number(stock) : 0,
      category,
      imageUrl
    });

    res.json({ product, message: 'محصول ایجاد شد' });
  } catch (error) {
    res.status(500).json({ error: 'خطا در ایجاد محصول' });
  }
});

// ============================================
// بروزرسانی محصول
// PUT /products/:id
// ============================================
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  try {
    const product = await db.updateProduct(id, fields);
    res.json({ product, message: 'محصول بروزرسانی شد' });
  } catch (error) {
    res.status(500).json({ error: 'خطا در بروزرسانی محصول' });
  }
});

// ============================================
// حذف محصول
// DELETE /products/:id
// ============================================
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await db.updateProduct(id, { is_active: false });
    res.json({ message: 'محصول حذف شد' });
  } catch (error) {
    res.status(500).json({ error: 'خطا در حذف محصول' });
  }
});

module.exports = router;