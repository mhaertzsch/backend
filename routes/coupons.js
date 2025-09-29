const pool = require('../db');
const { userId } = require('../utility');
const router = require('express').Router();

router.get('/owned', async (req, res) => {
  let coupons = [];
  try {
    const result = await pool.query('SELECT * FROM user_coupons WHERE user_id = $1', [userId()]);

    for (let owned of result.rows) {
      const coupon = await pool.query('SELECT * FROM coupons WHERE id = $1', [owned.coupon_id]);
      coupons.push({ coupon: coupon.rows[0], quantity: owned.quantity });
    }

    res.json(coupons);
  } catch (err) {
    console.error('Error fetching user coupons', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
