const router = require('express').Router();
const ctrl = require('../controllers/attendanceController');
const validate = require('../middleware/validate');
const v = require('../validators/attendance');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/reports', validate(v.reports, 'query'), ctrl.reports); // students, parents (linked), instructors, admins
router.use(authorize('admin', 'instructor', 'student'));
router.get('/sessions', validate(v.list, 'query'), ctrl.list);
router.post('/sessions', authorize('admin', 'instructor'), validate(v.createSession), ctrl.createSession);
router.get('/sessions/:id', authorize('admin', 'instructor'), ctrl.getSession);
router.patch('/sessions/:id', authorize('admin', 'instructor'), validate(v.updateSession), ctrl.updateSession);
router.post('/sessions/:id/join', authorize('student'), ctrl.join);
router.post('/sessions/:id/leave', authorize('student'), ctrl.leave);

module.exports = router;
