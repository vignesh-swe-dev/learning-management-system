const router = require('express').Router();
const ctrl = require('../controllers/assignmentController');
const validate = require('../middleware/validate');
const v = require('../validators/assignments');
const precheck = require('../middleware/submissionPrecheck');
const { uploadFile } = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin', 'instructor', 'student'));
router.get('/', validate(v.list, 'query'), ctrl.list);
router.post('/', authorize('admin', 'instructor'), validate(v.create), ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', authorize('admin', 'instructor'), validate(v.update), ctrl.update);
router.delete('/:id', authorize('admin', 'instructor'), ctrl.remove);
router.get('/:id/submissions', authorize('admin', 'instructor'), validate(v.page, 'query'), ctrl.listSubmissions);
router.post('/:id/submit', precheck, uploadFile('submission', { required: false }), validate(v.submit), ctrl.submit);

module.exports = router;
