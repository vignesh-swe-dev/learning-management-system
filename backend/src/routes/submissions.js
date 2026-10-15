const router = require('express').Router();
const ctrl = require('../controllers/assignmentController');
const validate = require('../middleware/validate');
const v = require('../validators/assignments');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.patch('/:id/grade', authorize('admin', 'instructor'), validate(v.grade), ctrl.grade);
router.get('/:id/file', ctrl.download);

module.exports = router;
