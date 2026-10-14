const router = require('express').Router();
const ctrl = require('../controllers/resultController');
const { authenticate } = require('../middleware/auth');

router.get('/verify/:verificationId', ctrl.verifyCertificate); // public
router.get('/my', authenticate, ctrl.myCertificates);

module.exports = router;
