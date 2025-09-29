const pool = require('../db');
const { userId } = require('../utility');
const router = require('express').Router();

router.get('/flag-first-wishlist', async (req, res) => {
  const result = await pool.query(`UPDATE users SET added_wishlist = true WHERE id = $1`, [
    userId(),
  ]);
  res.json(result);
});
module.exports = router;
