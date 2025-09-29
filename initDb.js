const pool = require('./db');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const initDataPath = join(__dirname, 'initial_data');

async function initDb() {
  const createTypeProductStatus =
    "CREATE TYPE PRODUCTSTATUS AS ENUM ('in-stock','sold-out', 'pre-order');";
  const createTableProducts = `CREATE TABLE IF NOT EXISTS products
    (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        brand TEXT NOT NULL,
        price NUMERIC NOT NULL,
        description TEXT NOT NULL,
        category_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        rating_score NUMERIC NOT NULL,
        rating_count INTEGER NOT NULL,
        status PRODUCTSTATUS NOT NULL,
        stock INTEGER NOT NULL
    )`;
  const createTableAchievements = `CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_info TEXT,
  required_id  INT REFERENCES achievements(id) ON DELETE SET NULL,
  condition JSONB NOT NULL
);`;

  const createTableAchievementRewards = `CREATE TABLE IF NOT EXISTS achievement_rewards (
  achievement_id INT PRIMARY KEY REFERENCES achievements(id) ON DELETE CASCADE,
  xp INT,
  gems INT,
  coupon_id INT REFERENCES coupons(id) ON DELETE SET NULL,
  award_badge_id TEXT REFERENCES badges(id) ON DELETE SET NULL,
  account_upgrade USERLEVEL
);`;
  const createTypeBadgeRarity =
    "CREATE TYPE BADGERARITY AS ENUM ('common', 'rare',  'super_rare' ,'ultra_rare', 'super_ultra_rare');";
  const createTableBadges = `CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT NOT NULL,
  rarity BADGERARITY NOT NULL
);`;
  const createTableUserBadges = `
  CREATE TABLE IF NOT EXISTS user_badges (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  date_received TIMESTAMP,
  PRIMARY KEY (user_id, badge_id)
);`;
  const createTypeAchievementState = `CREATE TYPE ACHIEVEMENTSTATE AS ENUM ('locked', 'available', 'unlocked', 'claimed');`;
  const createTableUserAchievements = `
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  state ACHIEVEMENTSTATE NOT NULL DEFAULT 'locked',
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0),
  claimed_at TIMESTAMP,
  PRIMARY KEY (user_id, achievement_id)
);`;

  const createTableOrders = `CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_date TIMESTAMP DEFAULT NOW(),
    order_total NUMERIC NOT NULL CHECK (order_total >= 0),
    status TEXT NOT NULL DEFAULT 'In Bearbeitung'
  );`;
  const createTableOrderItems = `CREATE TABLE IF NOT EXISTS order_items (
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    PRIMARY KEY (order_id, product_id)
);`;
  const createTypeCouponRarity =
    "CREATE TYPE COUPONRARITY AS ENUM ('common', 'rare',  'super_rare' ,'ultra_rare');";
  const createTypeCouponType = "CREATE TYPE COUPONTYPE AS ENUM ('flat','percentage', 'dud');";
  const createTableCoupons = `CREATE TABLE IF NOT EXISTS coupons
    (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        rarity COUPONRARITY NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT NOT NULL,
        value INTEGER NOT NULL CHECK (value >= 0),
        type COUPONTYPE NOT NULL
    )`;
  const createTypeUserLevel =
    "CREATE TYPE USERLEVEL AS ENUM ('guest', 'standard', 'user_silver' ,'user_gold', 'user_platinum');";
  const createTableUsers = `CREATE TABLE IF NOT EXISTS users
    (   
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL DEFAULT 'Bob',
        user_level USERLEVEL NOT NULL DEFAULT 'standard',
        avatar_url TEXT DEFAULT NULL,
        gems INTEGER NOT NULL DEFAULT 0 CHECK (gems >= 0),
        pulls_count INTEGER NOT NULL DEFAULT 0 CHECK (pulls_count >= 0),
        money_spent NUMERIC NOT NULL DEFAULT 0 CHECK (money_spent >= 0),
        xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
        added_wishlist BOOLEAN NOT NULL DEFAULT false
    )`;

  const createDefaultUser = `INSERT INTO users (id, username, gems, avatar_url) VALUES (1, 'Bob', 1000, '/user_avatar.png') ON CONFLICT (id) DO NOTHING`;
  const createTableUserCoupons = `CREATE TABLE IF NOT EXISTS user_coupons
    (
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        coupon_id INT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
        quantity  INT NOT NULL DEFAULT 1 CHECK (quantity >= 0),
        PRIMARY KEY (user_id, coupon_id)
    )`;

  const createTableCategories = `CREATE TABLE IF NOT EXISTS categories
    (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
    )`;

  const createTypeQueries = [
    createTypeUserLevel,
    createTypeCouponRarity,
    createTypeCouponType,
    createTypeProductStatus,
    createTypeBadgeRarity,
    createTypeAchievementState,
  ];
  const createTableQueries = [
    createTableUsers,
    createTableCategories,
    createTableProducts,
    createTableOrders,
    createTableOrderItems,
    createTableCoupons,
    createTableBadges,
    createTableAchievements,
    createTableAchievementRewards,
    createTableUserCoupons,
    createTableUserAchievements,
    createTableUserBadges,
  ];
  const seedTableQueries = [createDefaultUser];

  //Als erstes werden die selbstdefinierten Typen erzeugt, da einige Tabellen ohne diese nicht erzeugt werden können.
  console.log('Creating Types...');
  for (const type of createTypeQueries) {
    try {
      await pool.query(type);
      console.log(`Successfully created type ${type}`);
    } catch (error) {
      if (error.code === '42710') {
        // duplicate_object Error code in Postgres laut https://www.postgresql.org/docs/current/errcodes-appendix.html
        console.log('Type already exists, continuing...');
      } else if (error.code === 'ECONNREFUSED') {
        return console.error('Could not connect to Database. Is the container running?\n\n', error);
      } else {
        return console.error('Error creating type', error);
      }
    }
  }
  console.log('Creating Types: SUCCESS');

  console.log('Creating Tables...');
  for (const [index, table] of createTableQueries.entries()) {
    try {
      await pool.query(table);
      console.log(
        `Successfully created table (Or already exists) (${index + 1}/${createTableQueries.length})`
      );
    } catch (error) {
      return console.error('Error creating table', table, error);
    }
  }
  console.log('Creating Tables: SUCCESS');

  console.log('Seeding Tables...');
  for (const initData of seedTableQueries) {
    try {
      await pool.query(initData);
      console.log(`Successfully seeded table with data ${initData}`);
    } catch (error) {
      return console.error('Error seeded table', error);
    }
  }

  try {
    const productsJson = join(initDataPath, 'products.json');
    const products = JSON.parse(readFileSync(productsJson, 'utf-8'));

    for (const product of products) {
      await pool.query(
        `INSERT INTO products (id, title, brand, price, description, category_id, image_url, rating_score, rating_count, status, stock) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING`,
        [
          product.id,
          product.title,
          product.brand,
          product.price,
          product.description,
          product.category_id,
          product.image_url,
          product.rating_score,
          product.rating_count,
          product.status,
          product.stock,
        ]
      );
    }
    console.log('Seeding Tables from JSON Files: (1/6) Products');

    const categoriesJson = join(initDataPath, 'categories.json');
    const categories = JSON.parse(readFileSync(categoriesJson, 'utf-8'));

    for (const category of categories) {
      await pool.query(
        `INSERT INTO categories (id, name) VALUES (
  $1, $2) ON CONFLICT DO NOTHING`,
        [category.id, category.name]
      );
    }
    console.log('Seeding Tables from JSON Files: (2/6) Categories');

    const couponsJson = join(initDataPath, 'coupons.json');
    const coupons = JSON.parse(readFileSync(couponsJson, 'utf-8'));
    for (const coupon of coupons) {
      await pool.query(
        `INSERT INTO coupons (id, name, image_url, rarity, description, value, type) VALUES (
  $1, $2, $3, $4, $5 ,$6, $7) ON CONFLICT DO NOTHING`,
        [
          coupon.id,
          coupon.name,
          coupon.image_url,
          coupon.rarity,
          coupon.description,
          coupon.value,
          coupon.type,
        ]
      );
    }
    console.log('Seeding Tables from JSON Files: (3/6) Coupons');

    const achievementsJson = join(initDataPath, 'achievements.json');
    const achievements = JSON.parse(readFileSync(achievementsJson, 'utf-8'));
    for (const achievement of achievements) {
      await pool.query(
        `INSERT INTO achievements (id, title, description, reward_info, required_id, condition) VALUES (
  $1, $2, $3, $4, $5 ,$6) ON CONFLICT DO NOTHING`,
        [
          achievement.id,
          achievement.title,
          achievement.description,
          achievement.reward_info,
          achievement.required_id,
          achievement.condition,
        ]
      );
    }
    console.log('Seeding Tables from JSON Files: (5/6) Achievements');

    const badgesJson = join(initDataPath, 'badges.json');
    const badges = JSON.parse(readFileSync(badgesJson, 'utf-8'));
    for (const badge of badges) {
      await pool.query(
        `INSERT INTO badges (id, title, image_url, description, rarity) VALUES (
            $1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [badge.id, badge.title, badge.image_url, badge.description, badge.rarity]
      );
    }
    console.log('Seeding Tables from JSON Files: (4/6) Badges');

    const achievementRewardsJson = join(initDataPath, 'achievement_rewards.json');
    const achievementRewards = JSON.parse(readFileSync(achievementRewardsJson, 'utf-8'));
    for (const reward of achievementRewards) {
      await pool.query(
        `INSERT INTO achievement_rewards (achievement_id, xp, gems, coupon_id, award_badge_id, account_upgrade) VALUES (
  $1, $2, $3, $4, $5 ,$6) ON CONFLICT DO NOTHING`,
        [
          reward.achievement_id,
          reward.xp,
          reward.gems,
          reward.coupon_id,
          reward.award_badge_id,
          reward.account_upgrade,
        ]
      );
    }
    console.log('Seeding Tables from JSON Files: (6/6) Achievement Rewards');
  } catch (error) {
    return console.error('Error seeding tables', error);
  }
  console.log('Seeding Tables: SUCCESS');
  console.log('Database successfully initialized!');
}

module.exports = initDb;
