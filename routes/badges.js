const pool = require('../db');
const { userId } = require('../utility');
const router = require('express').Router();

router.get('/', async (req, res) => {
  const result = await pool.query(`SELECT * FROM badges`);
  res.json(result.rows);
});

router.get('/unlocked', async (req, res) => {
  const result = await pool.query(
    `SELECT id, title, date_received, image_url, description, rarity FROM user_badges LEFT JOIN badges ON user_badges.badge_id = badges.id WHERE user_id = $1`,
    [userId()]
  );
  res.json(result.rows);
});
router.get('/locked', async (req, res) => {
  const result = await pool.query(
    `SELECT id, title, image_url, description, rarity FROM badges LEFT JOIN user_badges ON user_badges.badge_id = badges.id WHERE user_id IS NULL OR user_id != $1`,
    [userId()]
  );
  res.json(result.rows);
});
module.exports = router;
