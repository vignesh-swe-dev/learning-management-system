const router = require('express').Router();
const ctrl = require('../controllers/trackingController');
const validate = require('../middleware/validate');
const v = require('../validators/tracking');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/dashboard', validate(v.dashboard, 'query'), ctrl.dashboard); // role-specific: staff, student, or parent with ?studentId=
router.get('/reports', authorize('admin', 'instructor', 'student'), validate(v.reports, 'query'), ctrl.reports);
router.get('/active-students', authorize('admin', 'instructor'), validate(v.active, 'query'), ctrl.activeStudents);
router.get('/activity', authorize('admin', 'instructor'), validate(v.activity, 'query'), ctrl.activity);

module.exports = router;
