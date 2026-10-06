require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

// ---- Database mode: explicit, never switched automatically ----
const dbMode = (process.env.DB_MODE || 'local').toLowerCase();
if (!['local', 'atlas'].includes(dbMode)) throw new Error(`DB_MODE must be "local" or "atlas" (got "${process.env.DB_MODE}")`);
// MONGO_URI is still honoured for local mode so older .env files keep working.
const localUri = process.env.LOCAL_MONGO_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lms_database';
const mongoUri = dbMode === 'atlas' ? process.env.ATLAS_URI : localUri;

const required = isTest ? ['JWT_SECRET'] : ['JWT_SECRET'];
if (!isTest && dbMode === 'atlas' && !process.env.ATLAS_URI) {
  throw new Error('DB_MODE=atlas requires ATLAS_URI (mongodb+srv://<user>:<password>@<cluster>/lms_database)');
}
if (!isTest && dbMode === 'atlas' && !/^mongodb(\+srv)?:\/\//.test(process.env.ATLAS_URI)) {
  throw new Error('ATLAS_URI must start with mongodb+srv:// or mongodb://');
}
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}
if (isProd && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

module.exports = {
  isProd,
  isTest,
  port: Number(process.env.PORT) || 5000,
  dbMode,
  mongoUri,
  dbTimeoutMs: Number(process.env.DB_TIMEOUT_MS) || 10000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Real-time tuning (milliseconds)
  presenceGraceMs: Number(process.env.PRESENCE_GRACE_MS) || 8000, // wait this long before calling a user offline, so reloads do not flicker
  attendanceDisconnectGraceMs: Number(process.env.ATTENDANCE_DISCONNECT_GRACE_MS) || 60000, // a vanished student is signed out of a live session after this
  dashboardDebounceMs: Number(process.env.DASHBOARD_DEBOUNCE_MS) || 1500,
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',').map((s) => s.trim()).filter(Boolean),
};
