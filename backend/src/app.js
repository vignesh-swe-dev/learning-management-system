const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 0) || false); // set TRUST_PROXY=1 only when behind a reverse proxy

app.use(helmet());
app.use(cors({ origin: env.clientOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize());

if (!env.isTest) {
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: Number(process.env.API_RATE_LIMIT) || 3000, standardHeaders: true, legacyHeaders: false,
    message: { message: 'Too many requests. Please wait a moment and try again.' } }));
  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false,
    message: { message: 'Too many login attempts. Try again in a few minutes.' } }));
  app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));
}

const { dbStatus } = require('./config/db');
app.get('/api/health', async (_req, res) => {
  const db = await dbStatus();
  res.status(db.state === 'connected' ? 200 : 503).json({ status: db.state === 'connected' ? 'ok' : 'degraded', uptimeSec: Math.round(process.uptime()), db: { mode: db.mode, state: db.state } });
});
// Full connection check (pings MongoDB). Open in development so setup can be verified before any admin exists; admin-only in production.
app.get('/api/health/db', (req, res, next) => (env.isProd ? require('./middleware/auth').authenticate(req, res, (e) => (e ? next(e) : require('./middleware/auth').authorize('admin')(req, res, next))) : next()), async (_req, res) => {
  try {
    const s = await dbStatus({ ping: true });
    res.status(s.state === 'connected' ? 200 : 503).json({ status: s.state === 'connected' ? 'ok' : 'error', ...s });
  }
  catch (e) { res.status(503).json({ status: 'error', message: e.message }); }
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/modules', require('./routes/modules'));
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/enrollments', require('./routes/enrollments'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/quiz-attempts', require('./routes/quizAttempts'));
app.use('/api/results', require('./routes/results'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/discussions', require('./routes/discussions'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/instructor', require('./routes/instructor'));
app.use('/api', require('./routes/files')); // /api/thumbnails/:name and /api/files/:name

app.use(notFound);
app.use(errorHandler);

module.exports = app;
