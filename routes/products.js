const pool = require('../db');
const router = require('express').Router();

router.get('/', async (req, res) => {
  try {
    const { category_id } = req.query;

    if (category_id) {
      const result = await pool.query('SELECT * FROM products WHERE category_id = $1', [
        category_id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No Products in category ' + category_id });
      }

      res.json(result.rows);
      return;
    }
    const result = await pool.query('SELECT * FROM products');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No Products' });
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/product/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]); // send single product object
  } catch (err) {
    console.error('Error fetching product', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
