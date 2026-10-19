const router = require('express').Router();
const ctrl = require('../controllers/authController');
const validate = require('../middleware/validate');
const v = require('../validators/auth');
const { authenticate } = require('../middleware/auth');

router.post('/register', validate(v.register), ctrl.register);
router.post('/login', validate(v.login), ctrl.login);
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.post('/change-password', authenticate, validate(v.changePassword), ctrl.changePassword);

module.exports = router;
