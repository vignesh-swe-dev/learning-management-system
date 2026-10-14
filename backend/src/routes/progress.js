const router = require('express').Router();
const ctrl = require('../controllers/progressController');
const validate = require('../middleware/validate');
const v = require('../validators/progress');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.post('/lessons/:lessonId', validate(v.report), ctrl.recordLesson);
router.get('/:courseId', validate(v.query, 'query'), ctrl.getCourseProgress);

module.exports = router;
