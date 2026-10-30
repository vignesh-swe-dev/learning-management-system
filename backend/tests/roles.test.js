const { app, request, startDb, stopDb, clearDb, createUserWithToken, PASSWORD } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

const bearer = (t) => ({ Authorization: `Bearer ${t}` });

describe('role-based access to /api/users', () => {
  it('lets only admins list users', async () => {
    const admin = await createUserWithToken('admin');
    const student = await createUserWithToken('student');
    const instructor = await createUserWithToken('instructor');

    const ok = await request(app).get('/api/users').set(bearer(admin.token));
    expect(ok.status).toBe(200);
    expect(ok.body.total).toBe(3);
    expect(ok.body.data[0].password).toBeUndefined();

    expect((await request(app).get('/api/users').set(bearer(student.token))).status).toBe(403);
    expect((await request(app).get('/api/users').set(bearer(instructor.token))).status).toBe(403);
    expect((await request(app).get('/api/users')).status).toBe(401);
  });

  it('paginates and searches', async () => {
    const admin = await createUserWithToken('admin');
    for (let i = 0; i < 5; i += 1) await createUserWithToken('student', `s${i}@test.dev`);
    const page = await request(app).get('/api/users?limit=2&page=2').set(bearer(admin.token));
    expect(page.body.data).toHaveLength(2);
    expect(page.body.pages).toBe(3);
    const search = await request(app).get('/api/users?q=s3@').set(bearer(admin.token));
    expect(search.body.total).toBe(1);
  });

  it('lets admins create instructors but not other roles', async () => {
    const admin = await createUserWithToken('admin');
    const student = await createUserWithToken('student');
    const body = { name: 'New Teacher', email: 'teacher@test.dev', password: PASSWORD, role: 'instructor' };
    expect((await request(app).post('/api/users').set(bearer(admin.token)).send(body)).status).toBe(201);
    expect((await request(app).post('/api/users').set(bearer(student.token)).send({ ...body, email: 'x@test.dev' })).status).toBe(403);
  });
});

describe('ownership checks', () => {
  it('lets a user read and edit only themselves', async () => {
    const a = await createUserWithToken('student', 'a@test.dev');
    const b = await createUserWithToken('student', 'b@test.dev');
    expect((await request(app).get(`/api/users/${a.user.id}`).set(bearer(a.token))).status).toBe(200);
    expect((await request(app).get(`/api/users/${b.user.id}`).set(bearer(a.token))).status).toBe(403);
    expect((await request(app).patch(`/api/users/${b.user.id}`).set(bearer(a.token)).send({ name: 'Hacked' })).status).toBe(403);
    const own = await request(app).patch(`/api/users/${a.user.id}`).set(bearer(a.token)).send({ name: 'Renamed' });
    expect(own.status).toBe(200);
    expect(own.body.user.name).toBe('Renamed');
  });

  it('prevents students from escalating their own role', async () => {
    const s = await createUserWithToken('student');
    // `role` is not in the self-update schema, so it is stripped and the body is then empty.
    const res = await request(app).patch(`/api/users/${s.user.id}`).set(bearer(s.token)).send({ role: 'admin' });
    expect(res.status).toBe(400);
    const me = await request(app).get('/api/auth/me').set(bearer(s.token));
    expect(me.body.user.role).toBe('student');
  });

  it('lets a parent view a linked student only', async () => {
    const child = await createUserWithToken('student', 'child@test.dev');
    const other = await createUserWithToken('student', 'other@test.dev');
    const parent = await createUserWithToken('parent');
    parent.user.linkedStudents = [child.user.id];
    await parent.user.save();
    expect((await request(app).get(`/api/users/${child.user.id}`).set(bearer(parent.token))).status).toBe(200);
    expect((await request(app).get(`/api/users/${other.user.id}`).set(bearer(parent.token))).status).toBe(403);
  });
});

describe('admin actions', () => {
  it('revokes sessions when an admin changes a role, and writes an audit log', async () => {
    const admin = await createUserWithToken('admin');
    const s = await createUserWithToken('student');
    const res = await request(app).patch(`/api/users/${s.user.id}`).set(bearer(admin.token)).send({ role: 'instructor' });
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(bearer(s.token))).status).toBe(401);
    const ActivityLog = require('../src/models/ActivityLog');
    expect(await ActivityLog.countDocuments({ action: 'user.update', isAudit: true })).toBe(1);
  });

  it('stops admins deleting themselves or changing their own role', async () => {
    const admin = await createUserWithToken('admin');
    expect((await request(app).delete(`/api/users/${admin.user.id}`).set(bearer(admin.token))).status).toBe(400);
    expect((await request(app).patch(`/api/users/${admin.user.id}`).set(bearer(admin.token)).send({ role: 'student' })).status).toBe(400);
  });

  it('returns 404 for unknown ids and 400 for malformed ones', async () => {
    const admin = await createUserWithToken('admin');
    expect((await request(app).get('/api/users/64b64b64b64b64b64b64b64b').set(bearer(admin.token))).status).toBe(404);
    expect((await request(app).get('/api/users/not-an-id').set(bearer(admin.token))).status).toBe(400);
  });
});
