const { app, request, startDb, stopDb, clearDb, createUserWithToken, PASSWORD } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

const valid = { name: 'Test Student', email: 'Student@Test.dev', password: PASSWORD };

describe('registration', () => {
  it('registers a student, returns a token and never exposes the password', async () => {
    const res = await request(app).post('/api/auth/register').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('student@test.dev');
    expect(res.body.user.role).toBe('student');
    expect(res.body.user.password).toBeUndefined();
  });

  it('does not allow self-registration as admin or instructor', async () => {
    for (const role of ['admin', 'instructor']) {
      const res = await request(app).post('/api/auth/register').send({ ...valid, email: `${role}@test.dev`, role });
      expect(res.status).toBe(400);
    }
  });

  it('rejects weak passwords and invalid emails with field details', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'X Y', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('rejects duplicate emails', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const res = await request(app).post('/api/auth/register').send(valid);
    expect(res.status).toBe(409);
  });
});

describe('login, me and logout', () => {
  beforeEach(() => request(app).post('/api/auth/register').send(valid));

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: valid.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('returns the same error for a wrong password and an unknown email', async () => {
    const bad = await request(app).post('/api/auth/login').send({ email: valid.email, password: 'Wrong1234' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'Wrong1234' });
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(bad.body.message).toBe(unknown.body.message);
  });

  it('requires a valid token for /me', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
  });

  it('invalidates the token after logout', async () => {
    const { body } = await request(app).post('/api/auth/login').send({ email: valid.email, password: PASSWORD });
    const auth = { Authorization: `Bearer ${body.token}` };
    expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(200);
    expect((await request(app).post('/api/auth/logout').set(auth)).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(401);
  });

  it('blocks suspended accounts, including already-issued tokens', async () => {
    const { user, token } = await createUserWithToken('student', 'sus@test.dev');
    user.status = 'suspended';
    await user.save();
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    const login = await request(app).post('/api/auth/login').send({ email: 'sus@test.dev', password: PASSWORD });
    expect(login.status).toBe(403);
  });
});

describe('email formats', () => {
  it('accepts addresses on private or non-public domains such as the seeded @lms.test accounts', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Seed Style', email: 'admin@lms.test', password: PASSWORD });
    expect(res.status).toBe(201);
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@lms.test', password: PASSWORD });
    expect(login.status).toBe(200);
  });
});
