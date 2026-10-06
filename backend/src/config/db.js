const mongoose = require('mongoose');
const env = require('./env');

// Hide credentials before a connection string is ever logged or returned by an API.
const redact = (uri = '') => uri.replace(/\/\/([^:@/]+):([^@]*)@/, '//$1:****@');
const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
let listening = false;

function watch() {
  if (listening) return;
  listening = true;
  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected — the driver will keep retrying; requests may fail meanwhile'));
  mongoose.connection.on('reconnected', () => console.log('[db] reconnected'));
  mongoose.connection.on('error', (e) => console.error('[db] error:', e.message));
}

async function connectDB(uri = env.mongoUri) {
  mongoose.set('strictQuery', true);
  watch();
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: env.dbTimeoutMs, connectTimeoutMS: env.dbTimeoutMs });
  } catch (err) {
    // No silent fallback to another database: the operator must fix the configured one.
    const hint = env.dbMode === 'atlas'
      ? 'Check ATLAS_URI, the database user/password, and that your IP is allowed in Atlas Network Access.'
      : 'Check that the MongoDB Community Server service is running (Windows: services.msc → MongoDB Server).';
    throw new Error(`Could not connect to ${env.dbMode} MongoDB (${redact(uri)}): ${err.message}. ${hint}`);
  }
  console.log(`[db] connected — mode=${env.dbMode} db=${mongoose.connection.name} host=${mongoose.connection.host}`);
  return mongoose.connection;
}

// Live status, used by the health endpoints.
async function dbStatus({ ping = false } = {}) {
  const c = mongoose.connection;
  const out = { mode: env.dbMode, state: STATES[c.readyState] || 'unknown', database: c.name || null };
  if (ping && c.readyState === 1) {
    const t = Date.now();
    await c.db.admin().ping();
    out.latencyMs = Date.now() - t;
    out.host = c.host;
    out.collections = (await c.db.listCollections().toArray()).length;
  }
  return out;
}

module.exports = connectDB;
module.exports.dbStatus = dbStatus;
module.exports.redact = redact;
