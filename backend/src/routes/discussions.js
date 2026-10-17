const router = require('express').Router();
const ctrl = require('../controllers/discussionController');
const validate = require('../middleware/validate');
const v = require('../validators/discussions');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin', 'instructor', 'student'));
router.get('/', validate(v.list, 'query'), ctrl.list);
router.post('/', validate(v.create), ctrl.create);
router.get('/:id', validate(v.thread, 'query'), ctrl.getOne);
router.patch('/:id', validate(v.moderate), ctrl.moderate);
router.delete('/:id', ctrl.remove);
router.post('/:id/replies', validate(v.reply), ctrl.reply);
router.delete('/:id/replies/:replyId', ctrl.removeReply);
module.exports = router;
