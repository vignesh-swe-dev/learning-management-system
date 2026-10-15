const router = require('express').Router();
const ctrl = require('../controllers/quizController');
const validate = require('../middleware/validate');
const v = require('../validators/quizzes');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin', 'instructor', 'student'));
router.get('/', validate(v.list, 'query'), ctrl.list);
router.post('/', authorize('admin', 'instructor'), validate(v.create), ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', authorize('admin', 'instructor'), validate(v.update), ctrl.update);
router.delete('/:id', authorize('admin', 'instructor'), ctrl.remove);
router.post('/:id/attempts', ctrl.startAttempt);
router.get('/:id/attempts', ctrl.listAttempts);
router.put('/:id/attempts/:attemptId/answers', validate(v.submitAttempt), ctrl.saveAnswers);
router.post('/:id/attempts/:attemptId/submit', validate(v.submitAttempt), ctrl.submitAttempt);

module.exports = router;
