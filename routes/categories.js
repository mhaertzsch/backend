const pool = require('../db');
const router = require('express').Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No Categories' });
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
