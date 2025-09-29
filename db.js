const { Pool } = require('pg');

const pool = new Pool({
  user: 'admin',
  password: 'admin',
  host: 'localhost',
  database: 'gameshop',
  port: 5432,
});

module.exports = pool;
