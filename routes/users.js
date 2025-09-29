const pool = require('../db');
const { userId } = require('../utility');
const router = require('express').Router();

router.get('/me', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId()]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No User found by that id' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user data', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
