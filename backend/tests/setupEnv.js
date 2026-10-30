const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt-signing-0123456789';
process.env.JWT_EXPIRES_IN = '1h';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'lms-test-uploads');
process.env.PRESENCE_GRACE_MS = '150';
process.env.ATTENDANCE_DISCONNECT_GRACE_MS = '250';
process.env.DASHBOARD_DEBOUNCE_MS = '40';
process.env.TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/lms_test';
