const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { submitComplaint, getMyComplaints, getAllComplaints, updateComplaintStatus } = require('../controllers/complaints.controller');

router.use(authenticate);

router.post('/', submitComplaint);
router.get('/my', getMyComplaints);
router.get('/', requireAdmin, getAllComplaints);
router.patch('/:id', requireAdmin, updateComplaintStatus);

module.exports = router;
