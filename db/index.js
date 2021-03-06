'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  user: 'hummaps',
  host: 'hummaps.com',
  database: 'production',
  password: null,
  port: 5432,
});

module.exports = {
  query: (text, params) =>  pool.query(text, params)
};
