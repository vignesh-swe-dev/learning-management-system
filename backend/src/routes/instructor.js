const router = require('express').Router();
const ctrl = require('../controllers/progressController');
const validate = require('../middleware/validate');
const v = require('../validators/progress');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin', 'instructor'));
router.get('/courses/:courseId/progress', validate(v.query, 'query'), ctrl.instructorProgress);

module.exports = router;
