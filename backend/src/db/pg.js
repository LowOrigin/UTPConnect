const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE
});

async function initDb() {
  // crea tablas mínimas si no existen
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY,
      msg_id TEXT UNIQUE,
      topic TEXT,
      payload JSONB,
      received_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);
  console.log('DB initialized');
}

async function saveEvent(topic, payload) {
  const msgId = payload.msgId || null;
  try {
    if (msgId) {
      // intenta insertar, si msg_id duplicado -> ignora
      await pool.query(
        `INSERT INTO events (msg_id, topic, payload) VALUES ($1, $2, $3) ON CONFLICT (msg_id) DO NOTHING`,
        [msgId, topic, payload]
      );
    } else {
      await pool.query(`INSERT INTO events (topic, payload) VALUES ($1, $2)`, [topic, payload]);
    }
  } catch (err) {
    console.error('DB save error', err);
  }
}

module.exports = { initDb, saveEvent, pool };
