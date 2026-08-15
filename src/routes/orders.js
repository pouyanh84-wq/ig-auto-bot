// src/routes/orders.js
// مدیریت سفارشات
const express = require('express');
const router = express.Router();
const db = require('../services/database');

// ============================================
// لیست سفارشات
// GET /orders?user_id=xxx&status=pending
// ============================================
router.get('/', async (req, res) => {
  const { user_id, status } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id الزامی است' });
  }

  try {
    let orders = await db.getOrdersByUserId(user_id);

    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: 'خطا در دریافت سفارشات' });
  }
});

// ============================================
// بروزرسانی وضعیت سفارش
// PUT /orders/:id
// ============================================
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { status, payment_status } = req.body;

  try {
    const order = await db.updateOrderStatus(id, status, payment_status);
    res.json({ order, message: 'سفارش بروزرسانی شد' });
  } catch (error) {
    res.status(500).json({ error: 'خطا در بروزرسانی سفارش' });
  }
});

// ============================================
// جزئیات سفارش
// GET /orders/:id
// ============================================
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT o.*, c.customer_name, c.customer_ig_id
       FROM orders o
       LEFT JOIN conversations c ON o.conversation_id = c.id
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'سفارش پیدا نشد' });
    }

    res.json({ order: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'خطا در دریافت سفارش' });
  }
});

module.exports = router;