const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getMyNotifications, markAsRead, registerFcmToken } = require('../controllers/notifications.controller');

router.use(authenticate);

router.get('/', getMyNotifications);
router.patch('/read', markAsRead);
router.post('/fcm-token', registerFcmToken);

module.exports = router;
