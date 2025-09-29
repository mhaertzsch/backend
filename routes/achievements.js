const { userId } = require('../utility');
const pool = require('../db');
const router = require('express').Router();

///////////////////////////////////////
/// API Endpoints
///////////////////////////////////////

router.get('/available', async (req, res) => {
  await checkAchievements(userId());
  const result = await pool.query(
    `SELECT user_id, user_achievements.achievement_id, state, title, condition, progress, description, reward_info, award_badge_id FROM user_achievements LEFT JOIN achievements ON user_achievements.achievement_id = achievements.id LEFT JOIN achievement_rewards ON user_achievements.achievement_id = achievement_rewards.achievement_id WHERE user_id = $1 AND state = 'available'`,
    [userId()]
  );
  res.json(result.rows);
});
router.get('/unlocked', async (req, res) => {
  await checkAchievements(userId());
  const result = await pool.query(
    `SELECT user_id, user_achievements.achievement_id, state, title, condition, progress, description, reward_info, award_badge_id FROM user_achievements LEFT JOIN achievements ON user_achievements.achievement_id = achievements.id LEFT JOIN achievement_rewards ON user_achievements.achievement_id = achievement_rewards.achievement_id WHERE user_id = $1 AND state = 'unlocked'`,
    [userId()]
  );
  res.json(result.rows);
});
router.get('/claimed', async (req, res) => {
  await checkAchievements(userId());
  const result = await pool.query(
    `SELECT user_id, user_achievements.achievement_id, state, title, description, reward_info, award_badge_id, claimed_at FROM user_achievements LEFT JOIN achievements ON user_achievements.achievement_id = achievements.id LEFT JOIN achievement_rewards ON user_achievements.achievement_id = achievement_rewards.achievement_id WHERE user_id = $1 AND state = 'claimed'`,
    [userId()]
  );
  res.json(result.rows);
});
router.get('/claim/:id', async (req, res) => {
  const { id } = req.params;
  await checkAchievements(userId());
  const result = await claimAchievement(userId(), id);
  res.json(result);
});
module.exports = router;

///////////////////////////////////////
/// Errungenschaften-System Funktionen
///////////////////////////////////////

async function checkAchievements(userId) {
  await updateAchievementAvailability(userId);
  // Errungenschaften + Zustand
  const achievements = await pool.query(
    `
    SELECT a.*, ua.state
    FROM achievements a
    JOIN user_achievements ua
      ON ua.achievement_id = a.id
    WHERE ua.user_id = $1
  `,
    [userId]
  );

  const user = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);

  for (const achievement of achievements.rows) {
    // Noch nicht dem Nutzer verfügbare Herausforderungen werden noch nicht "unlocked"
    if (achievement.state !== 'available') continue;

    const condition = achievement.condition;
    const userVal = user.rows[0][condition.col];

    // Progress wird gesetzt zu userVal. falls userVal jedoch vom typ Boolean ist,
    // dann wird es in eine Zahl gecasted, da die Spalte 'progress' nur Zahlen annimmt.
    const progress = typeof userVal === 'boolean' ? (userVal ? 1 : 0) : userVal;
    await pool.query(
      `UPDATE user_achievements
         SET progress = $1
         WHERE user_id = $2 AND achievement_id = $3`,
      [progress, userId, achievement.id]
    );

    // Überprüfung ob die Bedingung erfüllt wird
    let meets = false;
    if (typeof condition.value === 'boolean') {
      meets = userVal === condition.value;
    } else {
      meets = userVal >= condition.value;
    }
    // Wenn Bedingung erfüllt ist, dann wird die Errungenschaft auf unlocked und somit abholbar gestellt
    if (meets) {
      await pool.query(
        `UPDATE user_achievements
         SET state = 'unlocked'
         WHERE user_id = $1 AND achievement_id = $2`,
        [userId, achievement.id]
      );
    }
  }
}

// Selbsterklärend
async function isAchievementClaimed(userId, achievementId) {
  const result = await pool.query(
    `
    SELECT state
    FROM user_achievements
    WHERE user_id = $1 AND achievement_id = $2
    LIMIT 1
    `,
    [userId, achievementId]
  );
  if (result.rowCount === 0) {
    // Es gibt keine row also definitiv nicht geclaimed
    return false;
  }
  return result.rows[0].state === 'claimed';
}

// Diese Funktion legt wenn noch nicht vorhanden initial für alle Errungenschaften einen Eintrag in der user_achievements Tabelle an.
// Bei allen Errungenschaften dessen Zustand locked ist, wird überprüft ob sie verfügbar sind und wenn ja aktualisiert.
async function updateAchievementAvailability(userId) {
  const achievements = await pool.query(`SELECT id, required_id FROM achievements`);

  for (const achievement of achievements.rows) {
    // ua steht für user_achievement
    const ua = await pool.query(
      `SELECT state FROM user_achievements WHERE user_id = $1 AND achievement_id = $2`,
      [userId, achievement.id]
    );

    if (ua.rowCount === 0) {
      // row wird initial als locked gesetzt
      await pool.query(
        `INSERT INTO user_achievements (user_id, achievement_id, state)
         VALUES ($1, $2, 'locked')`,
        [userId, achievement.id]
      );
    }

    const currentState = ua.rows[0]?.state || 'locked';

    // Errungenschaft ist schon geclaimed
    if (['unlocked', 'claimed'].includes(currentState)) continue;

    // überprüfung vom pre-requirement (vorher zu erledigende Errungenschaft)
    let prereqOk = false;
    if (!achievement.required_id) {
      prereqOk = true;
    } else {
      // es wird überprüft ob die required_id Errungenschaft abgeschlossen ist.
      // wenn nicht
      prereqOk = await isAchievementClaimed(userId, achievement.required_id);
    }

    if (prereqOk && currentState === 'locked') {
      await pool.query(
        `UPDATE user_achievements SET state = 'available' 
         WHERE user_id = $1 AND achievement_id = $2`,
        [userId, achievement.id]
      );
    }
  }
}
async function claimAchievement(userId, achievementId) {
  const ua = await pool.query(
    `SELECT state FROM user_achievements WHERE user_id = $1 AND achievement_id = $2`,
    [userId, achievementId]
  );

  // Validierung ob Errungenschaft unlocked ist.
  if (ua.rows[0]?.state !== 'unlocked') {
    return { status: 'error', error: 'Errungenschaft ist nicht einlösbar.' };
  }

  // Ausschüttung der Belohnung
  const rewards = await giveAchievementRewards(userId, achievementId);

  // Aktualisierung des Zustands zu claimed

  await pool.query(
    `UPDATE user_achievements SET state = 'claimed', claimed_at = NOW()
     WHERE user_id = $1 AND achievement_id = $2`,
    [userId, achievementId]
  );

  // Aktualisieren für den Fall, dass gerade eine Errungenschaft available geworden ist.
  await updateAchievementAvailability(userId);
  return { status: 'ok', rewards: rewards };
}
async function giveAchievementRewards(userId, achievementId) {
  // Belohnungen laden
  const res = await pool.query(`SELECT * FROM achievement_rewards WHERE achievement_id = $1`, [
    achievementId,
  ]);

  if (res.rowCount === 0) {
    return; // Errungenschaft hat keine Belohnungen :(
  }

  const reward = res.rows[0];

  // Transaktion start
  const client = await pool.connect();
  await client.query('BEGIN');

  try {
    // Gems/XP geben falls vorhanden
    if (reward.xp || reward.gems) {
      await client.query(
        `UPDATE users
         SET xp = COALESCE(xp, 0) + $1,
             gems = COALESCE(gems, 0) + $2
         WHERE id = $3`,
        [reward.xp || 0, reward.gems || 0, userId]
      );
    }

    // Gutschein geben falls vorhanden
    if (reward.coupon_id) {
      await client.query(
        `INSERT INTO user_coupons (user_id, coupon_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, reward.coupon_id]
      );
    }

    // Abzeichen geben falls vorhanden
    if (reward.award_badge_id) {
      await client.query(
        `INSERT INTO user_badges (user_id, badge_id, date_received)
         VALUES ($1, $2, now())
         ON CONFLICT DO NOTHING`,
        [userId, reward.award_badge_id]
      );
    }

    // Kontoupgrade falls vorhanden
    if (reward.account_upgrade) {
      await client.query(
        `UPDATE users
         SET user_level = $1
         WHERE id = $2`,
        [reward.account_upgrade, userId]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.log(err);
    throw err;
  } finally {
    client.release();
  }
  return reward;
}
