const router = require('express').Router();
const ctrl = require('../controllers/quizController');
const validate = require('../middleware/validate');
const v = require('../validators/quizzes');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin', 'instructor', 'student'));
router.get('/:id', ctrl.getAttempt);
router.patch('/:id/grade', authorize('admin', 'instructor'), validate(v.gradeAttempt), ctrl.gradeAttempt);

module.exports = router;
