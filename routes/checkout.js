const pool = require('../db');
const { totalToGems, userId } = require('../utility');
const router = require('express').Router();

router.post('/', async (req, res) => {
  const data = req.body;

  const { paymentMethod, items, couponId } = data;
  let subtotal = 0;
  for (const { productId, quantity } of items) {
    let product = null;
    try {
      const productRows = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);

      if (productRows.rows.length === 0) {
        return res.status(404).json({ error: 'At least one product not available' });
      }

      product = productRows.rows[0];
    } catch (err) {
      console.error('Error fetching product', err);
      res.status(500).json({ error: 'Internal server error' });
    }
    if (quantity > product.stock) {
      const resp = { status: 'error', code: 'INSUFFICIENT_STOCK', productId };
      return res.status(409).json(resp);
    }
    subtotal += product.price * quantity;
  }
  // Coupon Validierung falls Gutschein vorhanden ist
  let discount = 0;
  if (couponId) {
    // check ob Nutzer Gutschein besitzt
    const check = await pool.query(
      'SELECT * FROM user_coupons WHERE coupon_id = $1 AND user_id = $2',
      [couponId, userId()]
    );
    if (check.rows.length === 0 || check.rows[0].quantity <= 0) {
      const resp = { status: 'error', code: 'COUPON_NOT_OWNED', couponId };
      return res.status(409).json(resp);
    }

    const result = await pool.query('SELECT * FROM coupons WHERE id = $1', [couponId]);
    const coupon = result.rows[0];

    //Mindestbestellwert von 5€ bei Flat Type Coupons
    if (coupon.type === 'flat' && subtotal < coupon.value - 5) {
      const resp = { status: 'error', code: 'COUPON_NOT_ELIGIBLE', couponId };
      return res.status(409).json(resp);
    }
    discount =
      //math floor?
      coupon.type === 'percentage' ? subtotal * (coupon.value / 100) : coupon.value;

    //consume coupon
    await pool.query(
      'UPDATE user_coupons SET quantity = quantity - 1 WHERE coupon_id = $1 AND user_id = $2',
      [couponId, userId()]
    );
  }
  //Rabatt durch user_level
  const userLevelResult = await pool.query('SELECT user_level FROM users WHERE id = $1', [
    userId(),
  ]);
  switch (userLevelResult.rows[0].user_level) {
    case 'guest':
      break;
    case 'standard':
      break;
    case 'user_silver':
      discount += subtotal * (1 / 100);
      console.log('discount applied');
      break;
    case 'user_gold':
      discount += subtotal * (5 / 100);
      console.log('discount applied');
      break;
    case 'user_platinum':
      discount += subtotal * (10 / 100);
      console.log('discount applied');
      break;
    default:
      console.log('no matching user_level found');
      break;
  }

  const total = Math.max(0, subtotal - discount).toFixed(2);

  // Platzhalter falls irgendwann eine richtige Zahlungsüberprüfung durchgeführt wird
  const paymentApproved = true;
  if (!paymentApproved) {
    const resp = { status: 'error', code: 'PAYMENT_FAILED' };
    return res.status(402).json(resp);
  }

  try {
    await pool.query(
      `UPDATE users SET gems = gems + $1, money_spent = money_spent + $2 WHERE id = $3`,
      [totalToGems(total), total, userId()]
    );
  } catch (err) {
    console.error('Error updating user table', err);
    res.status(500).json({ error: 'Internal server error' });
  }

  for (const { productId, quantity } of items) {
    try {
      await pool.query(
        `UPDATE products SET stock = stock - $1, status = CASE WHEN stock - $1 <= 0 THEN 'sold-out'::PRODUCTSTATUS ELSE 'in-stock'::PRODUCTSTATUS END WHERE id = $2`,
        [quantity, productId]
      );
    } catch (err) {
      console.error('Error updating products table', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  const orderIdResult = await pool.query(
    `INSERT INTO orders (user_id, order_total) VALUES ($1, $2) RETURNING id;`,
    [userId(), total]
  );
  const orderId = orderIdResult.rows[0].id;
  for (const { productId, quantity } of items) {
    try {
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3);`,
        [orderId, productId, quantity]
      );
    } catch (err) {
      console.error('Error inserting into order items table', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  const order = {
    orderId: `ord_${orderId}`,
    subtotal,
    discount,
    total,
    currency: 'EUR',
    paymentMethod,
    items,
    couponId: couponId ?? null,
  };

  const resp = { status: 'success', order };
  return res.status(201).json(resp);
});
module.exports = router;
