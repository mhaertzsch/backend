const pool = require('../db');
const { userId } = require('../utility');
const router = require('express').Router();

router.get('/my-orders', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY order_date DESC',
      [userId()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No Orders with User ID ' + userId() });
    }
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users orders', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/order-items/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM order_items LEFT JOIN products ON product_id = id WHERE order_id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No Items with Order ID ' + id });
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching order items', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
