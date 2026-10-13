const router = require('express').Router();
const ctrl = require('../controllers/courseController');
const content = require('../controllers/contentController');
const validate = require('../middleware/validate');
const v = require('../validators/courses');
const cv = require('../validators/content');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', validate(v.list, 'query'), ctrl.list);
router.post('/', authorize('admin', 'instructor'), validate(v.create), ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', authorize('admin', 'instructor'), validate(v.update), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

router.get('/:id/enrollments', authorize('admin', 'instructor'), validate(v.enrollmentsList, 'query'), ctrl.listEnrollments);
router.post('/:courseId/modules', authorize('admin', 'instructor'), validate(cv.moduleCreate), content.createModule);

module.exports = router;
