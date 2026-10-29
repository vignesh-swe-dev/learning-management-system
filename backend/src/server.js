const http = require('http');
const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const { initSockets } = require('./sockets');

(async () => {
  await connectDB();
  const server = http.createServer(app);
  initSockets(server);
  server.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
})().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
