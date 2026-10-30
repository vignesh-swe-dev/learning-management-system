const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

let mongod;

async function startDb() {
  if (process.env.TEST_MONGO_URI) {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    return;
  }
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}
async function stopDb() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}
async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

const PASSWORD = 'Passw0rd123';

// Creates a user directly in the DB (any role) and returns { user, token } via the real login route.
async function createUserWithToken(role, email = `${role}@test.dev`) {
  const user = await User.create({ name: `${role} user`, email, password: PASSWORD, role });
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return { user, token: res.body.token };
}

module.exports = { app, request, startDb, stopDb, clearDb, createUserWithToken, PASSWORD };

// ---- Phase 3/4 helpers ----
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

async function publishedCourse(teacherToken, { lessons = [{ title: 'Welcome', type: 'text', content: 'Hello class' }] } = {}) {
  const course = (await request(app).post('/api/courses').set(bearer(teacherToken))
    .send({ title: 'Test course', description: 'A course used by the tests.', category: 'Testing' })).body.course;
  const mod = (await request(app).post(`/api/courses/${course._id}/modules`).set(bearer(teacherToken)).send({ title: 'Module 1' })).body.module;
  const created = [];
  for (const l of lessons) {
    created.push((await request(app).post(`/api/modules/${mod._id}/lessons`).set(bearer(teacherToken)).send(l)).body.lesson);
  }
  await request(app).patch(`/api/courses/${course._id}`).set(bearer(teacherToken)).send({ status: 'published' });
  return { course, lessons: created };
}
const enroll = (studentToken, courseId) => request(app).post('/api/enrollments').set(bearer(studentToken)).send({ courseId });

module.exports.bearer = bearer;
module.exports.publishedCourse = publishedCourse;
module.exports.enroll = enroll;

// ---- Socket.IO helpers (Phase 5) ----
const http = require('http');
const { io: ioClient } = require('socket.io-client');
const { initSockets } = require('../src/sockets');
const realtime = require('../src/services/realtime');
const presence = require('../src/services/presence');

let ioServer;
const openSockets = [];

async function startSockets() {
  const server = http.createServer(app);
  ioServer = initSockets(server);
  await new Promise((r) => server.listen(0, r));
  return `http://localhost:${server.address().port}`;
}
async function stopSockets() {
  openSockets.splice(0).forEach((s) => s.close());
  realtime.reset();
  presence.reset();
  if (ioServer) await new Promise((r) => ioServer.close(r));
}
// Resolves with the connected socket once the server has said "ready"; rejects if the handshake is refused.
function connect(url, token) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
    openSockets.push(socket);
    socket.once('ready', (info) => resolve(Object.assign(socket, { info })));
    socket.once('connect_error', (err) => { socket.close(); reject(err); });
  });
}
const waitFor = (socket, event, ms = 2000) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), ms);
  socket.once(event, (data) => { clearTimeout(t); resolve(data); });
});
// Asserts that an event does NOT arrive in the window.
const expectNo = (socket, event, ms = 400) => new Promise((resolve, reject) => {
  const handler = (d) => reject(new Error(`Unexpected "${event}": ${JSON.stringify(d)}`));
  socket.once(event, handler);
  setTimeout(() => { socket.off(event, handler); resolve(); }, ms);
});
const emitAck = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

Object.assign(module.exports, { startSockets, stopSockets, connect, waitFor, expectNo, emitAck, sleep });
