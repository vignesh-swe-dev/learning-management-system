const router = require('express').Router();
const content = require('../controllers/contentController');
const validate = require('../middleware/validate');
const cv = require('../validators/content');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/:id/access', content.access);
router.patch('/:id', authorize('admin', 'instructor'), validate(cv.lessonUpdate), content.updateLesson);
router.delete('/:id', authorize('admin', 'instructor'), content.removeLesson);

module.exports = router;
