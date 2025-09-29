const pool = require('../db');
const { userId } = require('../utility');
const router = require('express').Router();

///////////////////////////////////////
/// API Endpoints
///////////////////////////////////////

router.get('/single', async (req, res) => {
  await gachaPull(1, req, res);
});

router.get('/ten', async (req, res) => {
  await gachaPull(10, req, res);
});

module.exports = router;

///////////////////////////////////////
/// Gacha-System Funktionen
///////////////////////////////////////

// Absteigende Reihenfolge der Wahrscheinlichkeiten ist wichtig!
const rarities = [
  { name: 'common', probability: 0.7 },
  { name: 'rare', probability: 0.2 },
  { name: 'super_rare', probability: 0.09 },
  { name: 'ultra_rare', probability: 0.01 },
];

function rollRarity() {
  const r = Math.random(); // Zahl zwischen 0.0 - 1.0
  let cumulative = 0;

  for (const rarity of rarities) {
    cumulative += rarity.probability;
    if (r < cumulative) {
      return rarity.name;
    }
  }
}

async function addCouponsToInv(coupons, user_id) {
  for (const coupon of coupons) {
    if (coupon.id === 1) continue;

    await pool.query(
      `INSERT INTO user_coupons (user_id, coupon_id, quantity)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, coupon_id)
       DO UPDATE SET quantity = user_coupons.quantity + 1`,
      [user_id, coupon.id]
    );
  }
}

async function gachaPull(rollCount, req, res) {
  try {
    const result = await pool.query('SELECT gems FROM users WHERE id = $1', [userId()]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'user not found' });
    }
    if (result.rows[0].gems < 50 * rollCount) {
      return res.status(404).json({ error: 'not enough gems' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', err });
  }

  let rolledRarities = [];
  for (var i = 1; i <= rollCount; i++) {
    const rarity = rollRarity();
    rolledRarities.push(rarity);
  }
  let rolledCoupons = [];
  for (const rarity of rolledRarities) {
    const result = await pool.query('SELECT * FROM coupons WHERE rarity = $1', [rarity]);
    const couponsOfRolledRarity = result.rows;

    const rolledCoupon =
      couponsOfRolledRarity[Math.floor(Math.random() * couponsOfRolledRarity.length)];

    try {
      await pool.query(
        'UPDATE users SET gems = gems - 50, xp = xp + 100, pulls_count = pulls_count +1 WHERE id = $1 AND gems >= 50',
        [userId()]
      );
    } catch (err) {
      console.error('Error', err);
      res.status(500).json({ error: 'Failed to remove gems and award xp, Internal server error' });
    }
    rolledCoupons.push(rolledCoupon);
  }
  await addCouponsToInv(rolledCoupons, userId());

  if (rollCount === 1) {
    return res.json(rolledCoupons[0]);
  }
  return res.json(rolledCoupons);
}
