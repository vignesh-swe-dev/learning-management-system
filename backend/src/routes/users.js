const router = require('express').Router();
const ctrl = require('../controllers/userController');
const validate = require('../middleware/validate');
const v = require('../validators/users');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', authorize('admin'), validate(v.list, 'query'), ctrl.list);
router.post('/', authorize('admin'), validate(v.create), ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', (req, res, next) =>
  validate(req.user.role === 'admin' ? v.adminUpdate : v.selfUpdate)(req, res, next), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;
