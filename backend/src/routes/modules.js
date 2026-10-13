const router = require('express').Router();
const content = require('../controllers/contentController');
const validate = require('../middleware/validate');
const cv = require('../validators/content');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin', 'instructor'));
router.patch('/:id', validate(cv.moduleUpdate), content.updateModule);
router.delete('/:id', content.removeModule);
router.post('/:moduleId/lessons', validate(cv.lessonCreate), content.createLesson);

module.exports = router;
