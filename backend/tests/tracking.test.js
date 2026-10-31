const { app, request, startDb, stopDb, clearDb, createUserWithToken, bearer, publishedCourse, enroll,
  startSockets, stopSockets, connect, emitAck, waitFor, sleep } = require('./helpers');
const { LessonProgress } = require('../src/models');

let url;
beforeAll(async () => { await startDb(); url = await startSockets(); });
afterAll(async () => { await stopSockets(); await stopDb(); });
afterEach(async () => { await sleep(50); await clearDb(); });

const TWO = [{ title: 'One', type: 'text', content: 'a' }, { title: 'Two', type: 'text', content: 'b' }];
async function world() {
  const teacher = await createUserWithToken('instructor', 't@test.dev');
  const other = await createUserWithToken('instructor', 'o@test.dev');
  const admin = await createUserWithToken('admin');
  const a = await createUserWithToken('student', 'a@test.dev');
  const b = await createUserWithToken('student', 'b@test.dev');
  const { course, lessons } = await publishedCourse(teacher.token, { lessons: TWO });
  await enroll(a.token, course._id);
  await enroll(b.token, course._id);
  return { teacher, other, admin, a, b, course, lessons };
}
const complete = (token, lessonId) => request(app).post(`/api/progress/lessons/${lessonId}`).set(bearer(token)).send({ completed: true });
const get = (token, path) => request(app).get(path).set(bearer(token));

describe('active students', () => {
  it('lists who is online now and which lesson they are viewing, for the right instructors only', async () => {
    const { teacher, other, admin, a, b, course, lessons } = await world();
    const sa = await connect(url, a.token);
    await connect(url, b.token);
    await emitAck(sa, 'lesson:start', { lessonId: lessons[1]._id });

    const res = await get(teacher.token, '/api/tracking/active-students');
    expect(res.body.total).toBe(2);
    const row = res.body.data.find((r) => r.student.id === a.user.id);
    expect(row).toMatchObject({ courseId: course._id, lessonTitle: 'Two', courseTitle: 'Test course' });
    expect(row.lastActivityAt).toBeTruthy();
    expect(res.body.data.find((r) => r.student.id === b.user.id).lessonTitle).toBeNull(); // online, not in a lesson

    expect((await get(admin.token, '/api/tracking/active-students')).body.total).toBe(2);
    expect((await get(other.token, '/api/tracking/active-students')).body.total).toBe(0);
    expect((await get(a.token, '/api/tracking/active-students')).status).toBe(403);
    expect((await get(teacher.token, `/api/tracking/active-students?courseId=${course._id}`)).body.total).toBe(2);
  });

  it('stops listing a student once they go offline', async () => {
    const { teacher, a } = await world();
    const staff = await connect(url, teacher.token);
    const online = waitFor(staff, 'user:online');
    const sa = await connect(url, a.token);
    await online;
    const gone = waitFor(staff, 'user:offline');
    sa.close();
    await gone;
    expect((await get(teacher.token, '/api/tracking/active-students')).body.total).toBe(0);
  });
});

describe('activity feed', () => {
  it('shows recent learning events for the instructor’s courses, newest first', async () => {
    const { teacher, other, a, lessons } = await world();
    const sa = await connect(url, a.token);
    await emitAck(sa, 'lesson:start', { lessonId: lessons[0]._id });
    await complete(a.token, lessons[0]._id);
    await sleep(100);
    const res = await get(teacher.token, '/api/tracking/activity');
    expect(res.body.data.map((e) => e.action)).toEqual(['lesson.completed', 'lesson.started']);
    expect(res.body.data[0]).toMatchObject({ user: { name: 'student user' }, course: { title: 'Test course' }, meta: { lessonTitle: 'One' } });
    expect((await get(other.token, '/api/tracking/activity')).body.total).toBe(0);
    expect((await get(a.token, '/api/tracking/activity')).status).toBe(403);
    expect((await get(teacher.token, '/api/tracking/activity?limit=1')).body.pages).toBe(2);
  });

  it('hides which lesson a student viewed once they opt out, but keeps completions', async () => {
    const { teacher, a, lessons } = await world();
    const sa = await connect(url, a.token);
    await emitAck(sa, 'lesson:start', { lessonId: lessons[0]._id });
    await complete(a.token, lessons[0]._id);
    await request(app).patch(`/api/users/${a.user.id}`).set(bearer(a.token)).send({ shareLiveActivity: false });
    await sleep(100);
    const res = await get(teacher.token, '/api/tracking/activity');
    expect(res.body.data.map((e) => e.action)).toEqual(['lesson.completed']);
  });
});

describe('learning activity reports', () => {
  it('counts activity per day, week and month from stored records', async () => {
    const { teacher, a, b, course, lessons } = await world();
    await complete(a.token, lessons[0]._id);
    await complete(a.token, lessons[1]._id);
    await complete(b.token, lessons[0]._id);

    const daily = await get(teacher.token, '/api/tracking/reports?period=daily');
    expect(daily.body.buckets).toHaveLength(14);
    const today = daily.body.buckets[13];
    expect(today).toMatchObject({ lessonsCompleted: 3, activeStudents: 2 });
    expect(daily.body.buckets[12].lessonsCompleted).toBe(0);

    const filtered = await get(teacher.token, `/api/tracking/reports?period=daily&courseId=${course._id}`);
    expect(filtered.body.buckets[13].lessonsCompleted).toBe(3);

    const weekly = await get(teacher.token, '/api/tracking/reports?period=weekly');
    expect(weekly.body.buckets).toHaveLength(12);
    expect(weekly.body.buckets[11].lessonsCompleted).toBe(3);
    const monthly = await get(teacher.token, '/api/tracking/reports?period=monthly');
    expect(monthly.body.buckets[11].lessonsCompleted).toBe(3);
  });

  it('puts activity in the right day for the viewer’s time zone', async () => {
    const { teacher, a, lessons } = await world();
    await complete(a.token, lessons[0]._id);
    // Pretend it was completed at 20:00 UTC yesterday: for UTC+5:30 that is already 01:30 today.
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1); d.setUTCHours(20, 0, 0, 0);
    await LessonProgress.updateOne({}, { completedAt: d });
    const utc = (await get(teacher.token, '/api/tracking/reports?period=daily&tzOffset=0')).body.buckets;
    const ist = (await get(teacher.token, '/api/tracking/reports?period=daily&tzOffset=330')).body.buckets;
    expect(utc[12].lessonsCompleted).toBe(1);
    expect(ist[13].lessonsCompleted).toBe(1);
  });

  it('shows students only their own activity, and keeps other instructors out', async () => {
    const { teacher, other, a, b, course, lessons } = await world();
    await complete(a.token, lessons[0]._id);
    await complete(b.token, lessons[0]._id);
    const mine = await get(a.token, '/api/tracking/reports?period=daily');
    expect(mine.body.buckets[13].lessonsCompleted).toBe(1);
    expect((await get(other.token, `/api/tracking/reports?courseId=${course._id}`)).status).toBe(403);
    expect((await get(other.token, '/api/tracking/reports')).body.buckets[13].lessonsCompleted).toBe(0);
    const parent = await createUserWithToken('parent');
    expect((await get(parent.token, '/api/tracking/reports')).status).toBe(403);
    expect((await get(teacher.token, '/api/tracking/reports?period=hourly')).status).toBe(400);
  });
});

describe('dashboards', () => {
  it('gives instructors live totals for their own courses', async () => {
    const { teacher, other, a, course, lessons } = await world();
    await connect(url, a.token);
    await complete(a.token, lessons[0]._id);
    await complete(a.token, lessons[1]._id);
    const asg = (await request(app).post('/api/assignments').set(bearer(teacher.token))
      .send({ courseId: course._id, title: 'Task', description: 'Do it.', dueAt: new Date(Date.now() + 86400000).toISOString(), maxMarks: 10 })).body.assignment;
    await request(app).post(`/api/assignments/${asg._id}/submit`).set(bearer(a.token)).send({ answerText: 'x' });

    const d = (await get(teacher.token, '/api/tracking/dashboard')).body;
    expect(d).toMatchObject({ totalStudents: 2, activeStudents: 1, totalCourses: 1, totalLessons: 2, pendingAssignments: 1, overallCompletionRate: 50 });
    expect(d.courses[0]).toMatchObject({ title: 'Test course', enrolled: 2, completed: 1, completionRate: 50, averageProgress: 50 });
    expect(d.dailyActivity).toHaveLength(7);
    expect(d.recentActivity.length).toBeGreaterThan(0);

    const empty = (await get(other.token, '/api/tracking/dashboard')).body;
    expect(empty).toMatchObject({ totalStudents: 0, activeStudents: 0, totalCourses: 0, pendingAssignments: 0 });
  });

  it('counts today’s attendance', async () => {
    const { teacher, a, course } = await world();
    const s = (await request(app).post('/api/attendance/sessions').set(bearer(teacher.token)).send({ courseId: course._id, title: 'Today' })).body.session;
    await request(app).post(`/api/attendance/sessions/${s._id}/join`).set(bearer(a.token));
    const d = (await get(teacher.token, '/api/tracking/dashboard')).body;
    expect(d.todaysAttendance).toMatchObject({ sessions: 1, present: 1, expected: 2, percent: 50 });
    expect(d.openSessions).toBe(1);
  });

  it('counts students who hid their live status without naming them', async () => {
    const { teacher, a } = await world();
    await connect(url, a.token);
    await request(app).patch(`/api/users/${a.user.id}`).set(bearer(a.token)).send({ shareLiveActivity: false });
    const d = (await get(teacher.token, '/api/tracking/dashboard')).body;
    expect(d).toMatchObject({ activeStudents: 0, hiddenActiveCount: 1 });
  });

  it('gives students their own learning dashboard', async () => {
    const { teacher, a, course, lessons } = await world();
    await complete(a.token, lessons[0]._id);
    await request(app).post('/api/assignments').set(bearer(teacher.token))
      .send({ courseId: course._id, title: 'To do', description: 'Do it.', dueAt: new Date(Date.now() + 86400000).toISOString(), maxMarks: 10 });
    const d = (await get(a.token, '/api/tracking/dashboard')).body;
    expect(d).toMatchObject({ role: 'student', enrolledCourses: 1, completedCourses: 0, averageProgress: 50, pendingAssignmentCount: 1 });
    expect(d.pendingAssignments[0].title).toBe('To do');
    expect(d.recentCompletions[0]).toMatchObject({ lesson: 'One', course: 'Test course' });
  });

  it('lets a parent see a linked student’s dashboard only', async () => {
    const { a, b, lessons } = await world();
    const parent = await createUserWithToken('parent', 'p@test.dev');
    parent.user.linkedStudents = [a.user.id];
    await parent.user.save();
    await complete(a.token, lessons[0]._id);
    const ok = await get(parent.token, `/api/tracking/dashboard?studentId=${a.user.id}`);
    expect(ok.body).toMatchObject({ role: 'parent', averageProgress: 50 });
    expect((await get(parent.token, `/api/tracking/dashboard?studentId=${b.user.id}`)).status).toBe(403);
    expect((await get(parent.token, '/api/tracking/dashboard')).status).toBe(400);
  });
});
